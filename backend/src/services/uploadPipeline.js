/**
 * Upload Pipeline Service - 強化版
 * - 超時重試機制
 * - 錯誤追蹤與詳細日誌
 * - 更好的錯誤回報
 */
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const db = require('../db/postgres');

// 重試配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
};

// 錯誤追蹤配置
const ERROR_TRACKING = {
  maxErrorsPerJob: 100,
  errorLogPath: path.join(__dirname, '..', 'logs', 'upload-errors')
};

// 確保日誌目錄存在
const logDir = path.dirname(ERROR_TRACKING.errorLogPath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const IMPORT_BATCH_SIZE = Number.parseInt(process.env.UPLOAD_IMPORT_BATCH_SIZE || '100', 10);
const MAX_PARALLEL_JOBS = Number.parseInt(process.env.UPLOAD_MAX_PARALLEL_JOBS || '1', 10);
const MAX_QUEUED_JOBS = Number.parseInt(process.env.UPLOAD_MAX_QUEUED_JOBS || '4', 10);

// 簡易背景工作追蹤（單機記憶體版）+ 錯誤日誌
const uploadJobs = new Map();
const jobErrors = new Map(); // jobId -> errors[]
const jobQueue = [];
let activeJobs = 0;
const JOB_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function getJob(jobId) {
  return uploadJobs.get(jobId);
}

function setJob(jobId, patch) {
  const current = uploadJobs.get(jobId) || {};
  uploadJobs.set(jobId, { ...current, ...patch, updatedAt: Date.now() });
}

function addJobError(jobId, error) {
  if (!jobErrors.has(jobId)) {
    jobErrors.set(jobId, []);
  }
  const errors = jobErrors.get(jobId);
  
  // 記錄錯誤
  const errorRecord = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    file: error.file,
    line: error.line
  };
  
  errors.push(errorRecord);
  
  // 限制錯誤數量
  if (errors.length > ERROR_TRACKING.maxErrorsPerJob) {
    errors.shift();
  }
  
  // 同時寫入日誌檔
  const logFile = `${ERROR_TRACKING.errorLogPath}-${jobId}.json`;
  fs.writeFileSync(logFile, JSON.stringify(errors, null, 2));
}

function getJobErrors(jobId) {
  return jobErrors.get(jobId) || [];
}

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of uploadJobs.entries()) {
    if ((job.status === 'completed' || job.status === 'failed') && job.updatedAt && now - job.updatedAt > JOB_TTL_MS) {
      uploadJobs.delete(jobId);
      jobErrors.delete(jobId);
      
      // 清理日誌檔
      const logFile = `${ERROR_TRACKING.errorLogPath}-${jobId}.json`;
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    }
  }
}

setInterval(cleanupJobs, 1000 * 60 * 5).unref();

function canAcceptNewJob() {
  return jobQueue.length < MAX_QUEUED_JOBS;
}

function enqueueJob(jobMeta) {
  jobQueue.push(jobMeta);
  setJob(jobMeta.jobId, {
    status: 'queued',
    step: 'queued',
    queuePosition: jobQueue.length
  });
}

function refreshQueuePositions() {
  for (let i = 0; i < jobQueue.length; i++) {
    setJob(jobQueue[i].jobId, { queuePosition: i + 1 });
  }
}

function runNextJob() {
  if (activeJobs >= MAX_PARALLEL_JOBS || jobQueue.length === 0) {
    return;
  }

  const job = jobQueue.shift();
  refreshQueuePositions();
  activeJobs++;
  setJob(job.jobId, { queuePosition: 0 });

  processUploadJob(job.jobId, job.filePath, job.originalName)
    .catch((err) => {
      addJobError(job.jobId, {
        message: err.message || 'unknown upload job error',
        stack: err.stack
      });
      setJob(job.jobId, { status: 'failed', error: err.message || 'unknown upload job error' });
    })
    .finally(() => {
      activeJobs = Math.max(0, activeJobs - 1);
      runNextJob();
    });
}

/**
 * 帶重試的資料庫查詢
 */
async function queryWithRetry(text, values, options = {}) {
  const { retries = RETRY_CONFIG.maxRetries, delay = RETRY_CONFIG.retryDelay } = options;
  
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await db.query(text, values);
      return result;
    } catch (error) {
      lastError = error;
      
      // 檢查是否可重試
      const isRetryable = RETRY_CONFIG.retryableErrors.some(e => 
        error.message?.includes(e) || error.code?.includes(e)
      );
      
      if (!isRetryable || attempt === retries) {
        throw error;
      }
      
      console.log(`[Upload] DB 查詢失敗，${delay}ms 後重試 (${attempt + 1}/${retries}): ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

async function getTotalCount() {
  const total = await queryWithRetry('SELECT COUNT(*) as count FROM judgments');
  return Number.parseInt(total.rows[0].count, 10) || 0;
}

function normalizeItem(item) {
  return {
    jid: item.JID || item.jid,
    jyear: item.JYEAR || item.jyear,
    jcase: item.JCASE || item.jcase,
    jno: item.JNO || item.jno,
    jdate: item.JDATE || item.jdate,
    jtitle: item.JTITLE || item.jtitle,
    jfull: item.JFULL || item.jfull || item.JFULLX?.JFULLCONTENT || '',
    jpdf: item.JPDF || item.jpdf || item.JFULLX?.JFULLPDF || ''
  };
}

/**
 * 匯入單筆資料（帶重試）
 */
async function importItem(item, options = {}) {
  return importBatch([item], options);
}

async function importBatch(items, options = {}) {
  const normalized = items
    .map(normalizeItem)
    .filter((row) => typeof row.jid === 'string' && row.jid.length > 0);
  if (normalized.length === 0) {
    return;
  }

  const values = [];
  const placeholders = normalized.map((row, idx) => {
    const base = idx * 8;
    values.push(row.jid, row.jyear, row.jcase, row.jno, row.jdate, row.jtitle, row.jfull, row.jpdf);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const text = `
    INSERT INTO judgments (jid, jyear, jcase, jno, jdate, jtitle, jfull, jpdf)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (jid) DO UPDATE SET
      jyear = EXCLUDED.jyear,
      jcase = EXCLUDED.jcase,
      jno = EXCLUDED.jno,
      jdate = EXCLUDED.jdate,
      jtitle = EXCLUDED.jtitle,
      jfull = EXCLUDED.jfull,
      jpdf = EXCLUDED.jpdf
  `;

  return queryWithRetry(text, values, options);
}

async function flushBatch(batch) {
  if (batch.length === 0) {
    return 0;
  }
  await importBatch(batch);
  return batch.length;
}

async function processUploadJob(jobId, filePath, originalName) {
  let importedCount = 0;
  let errorCount = 0;
  let processedFiles = 0;

  try {
    const ext = path.extname(originalName).toLowerCase();
    setJob(jobId, { status: 'processing', step: 'reading', ext });

    let fileHandlers = [];
    if (ext === '.zip') {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.endsWith('.json'));
      fileHandlers = zipEntries.map((entry) => ({
        name: entry.entryName,
        read: () => entry.getData().toString('utf8')
      }));
    } else if (ext === '.json') {
      fileHandlers = [{
        name: originalName,
        read: () => fs.readFileSync(filePath, 'utf8')
      }];
    } else {
      throw new Error('僅支援 .zip 或 .json 檔案');
    }

    const totalFiles = fileHandlers.length;
    setJob(jobId, { totalFiles, step: 'importing' });

    const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

    for (const file of fileHandlers) {
      try {
        const content = file.read();
        let data;
        const batch = [];

        try {
          data = JSON.parse(content);
        } catch (jsonErr) {
          // 可能是一行一筆 JSON
          const lines = content.split('\n').filter((line) => line.trim());
          let lineCount = 0;
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              batch.push(item);
              if (batch.length >= IMPORT_BATCH_SIZE) {
                importedCount += await flushBatch(batch);
                batch.length = 0;
              }
            } catch (lineErr) {
              errorCount++;
              addJobError(jobId, {
                message: lineErr.message,
                file: file.name,
                line: lineCount,
                stack: lineErr.stack
              });
            }
            lineCount++;
            // 避免長時間阻塞事件迴圈
            if (lineCount % 100 === 0) {
              await yieldToEventLoop();
            }
          }
          importedCount += await flushBatch(batch);
          processedFiles++;
          setJob(jobId, { processedFiles, imported: importedCount, errors: errorCount });
          continue;
        }

        if (Array.isArray(data)) {
          let itemCount = 0;
          for (const item of data) {
            try {
              batch.push(item);
              if (batch.length >= IMPORT_BATCH_SIZE) {
                importedCount += await flushBatch(batch);
                batch.length = 0;
              }
            } catch (itemErr) {
              errorCount++;
              addJobError(jobId, {
                message: itemErr.message,
                file: file.name,
                index: itemCount,
                stack: itemErr.stack
              });
            }
            itemCount++;
            // 大批次匯入時定期釋放控制權
            if (itemCount % 100 === 0) {
              await yieldToEventLoop();
            }
          }
          importedCount += await flushBatch(batch);
        } else {
          batch.push(data);
          importedCount += await flushBatch(batch);
        }
      } catch (fileErr) {
        console.error(`[Upload] 檔案處理失敗: ${file.name}`, fileErr.message);
        errorCount++;
        addJobError(jobId, {
          message: fileErr.message,
          file: file.name,
          stack: fileErr.stack
        });
      }

      processedFiles++;
      setJob(jobId, { processedFiles, imported: importedCount, errors: errorCount });
    }

    const total = await getTotalCount();
    setJob(jobId, {
      status: 'completed',
      step: 'done',
      imported: importedCount,
      errors: errorCount,
      total,
      errorCount: errorCount,
      errorDetails: errorCount > 0 ? getJobErrors(jobId).slice(-10) : [] // 只傳回最後10個錯誤
    });
  } catch (err) {
    console.error('[Upload Job] 錯誤:', err.message);
    addJobError(jobId, {
      message: err.message,
      stack: err.stack
    });
    setJob(jobId, {
      status: 'failed',
      step: 'failed',
      error: err.message,
      imported: importedCount,
      errors: errorCount,
      errorCount: errorCount,
      errorDetails: getJobErrors(jobId).slice(-10)
    });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// 上傳並匯入
async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要上傳的檔案' });
    }

    console.log(`[Upload] 收到檔案: ${req.file.originalname}, 大小: ${req.file.size} bytes`);
    if (!canAcceptNewJob()) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(503).json({
        error: '上傳佇列已滿，請稍後再試',
        activeJobs,
        queuedJobs: jobQueue.length
      });
    }

    const jobId = randomUUID();
    setJob(jobId, {
      status: 'queued',
      step: 'queued',
      fileName: req.file.originalname,
      size: req.file.size,
      imported: 0,
      errors: 0,
      processedFiles: 0,
      totalFiles: 0,
      createdAt: Date.now()
    });

    enqueueJob({
      jobId,
      filePath: req.file.path,
      originalName: req.file.originalname
    });
    setImmediate(runNextJob);

    res.status(202).json({
      success: true,
      message: '檔案已接收，排入背景匯入',
      jobId,
      statusEndpoint: `/api/upload/jobs/${jobId}`,
      queue: {
        activeJobs,
        queuedJobs: jobQueue.length
      }
    });
    
  } catch (error) {
    console.error('[Upload] 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
}

// 查詢單一匯入工作狀態
function handleGetJob(req, res) {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: '找不到工作或已過期' });
  }
  
  const response = { ...job };
  
  // 如果有錯誤，提供錯誤詳情連結
  if (job.errors > 0) {
    response.errorDetailsLink = `/api/upload/jobs/${req.params.jobId}/errors`;
  }

  response.queue = {
    activeJobs,
    queuedJobs: jobQueue.length
  };
  
  return res.json(response);
}

// 查詢工作錯誤詳情
function handleGetJobErrors(req, res) {
  const errors = getJobErrors(req.params.jobId);
  if (!uploadJobs.has(req.params.jobId)) {
    return res.status(404).json({ error: '找不到工作或已過期' });
  }
  
  return res.json({
    jobId: req.params.jobId,
    totalErrors: errors.length,
    errors: errors
  });
}

// 取得匯入狀態
async function handleStatus(req, res) {
  try {
    const total = await queryWithRetry('SELECT COUNT(*) as count FROM judgments');
    const byYear = await queryWithRetry(`
      SELECT jyear, COUNT(*) as count 
      FROM judgments 
      GROUP BY jyear 
      ORDER BY jyear DESC
      LIMIT 10
    `);
    
    res.json({
      total: total.rows[0].count,
      byYear: byYear.rows,
      queue: {
        activeJobs,
        queuedJobs: jobQueue.length,
        maxParallelJobs: MAX_PARALLEL_JOBS,
        maxQueuedJobs: MAX_QUEUED_JOBS
      }
    });
  } catch (error) {
    console.error('[Upload Status] 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  // 匯入配置
  RETRY_CONFIG,
  ERROR_TRACKING,
  
  // API 處理函式
  handleUpload,
  handleGetJob,
  handleGetJobErrors,
  handleStatus,
  
  // 內部函式（供測試）
  processUploadJob,
  importItem,
  importBatch,
  queryWithRetry,
  getJob,
  getJobErrors,
  setJob,
  addJobError
};
