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

// 簡易背景工作追蹤（單機記憶體版）+ 錯誤日誌
const uploadJobs = new Map();
const jobErrors = new Map(); // jobId -> errors[]
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

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
    if (!job.updatedAt || now - job.updatedAt > JOB_TTL_MS) {
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

/**
 * 匯入單筆資料（帶重試）
 */
async function importItem(item, options = {}) {
  const text = `
    INSERT INTO judgments (jid, jyear, jcase, jno, jdate, jtitle, jfull, jpdf)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (jid) DO UPDATE SET
      jyear = EXCLUDED.jyear,
      jcase = EXCLUDED.jcase,
      jno = EXCLUDED.jno,
      jdate = EXCLUDED.jdate,
      jtitle = EXCLUDED.jtitle,
      jfull = EXCLUDED.jfull,
      jpdf = EXCLUDED.jpdf
  `;
  
  const values = [
    item.JID || item.jid,
    item.JYEAR || item.jyear,
    item.JCASE || item.jcase,
    item.JNO || item.jno,
    item.JDATE || item.jdate,
    item.JTITLE || item.jtitle,
    item.JFULL || item.jfull || item.JFULLX?.JFULLCONTENT || '',
    item.JPDF || item.jpdf || item.JFULLX?.JFULLPDF || ''
  ];
  
  return queryWithRetry(text, values);
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
        try {
          data = JSON.parse(content);
        } catch (jsonErr) {
          // 可能是一行一筆 JSON
          const lines = content.split('\n').filter((line) => line.trim());
          let lineCount = 0;
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              await importItem(item);
              importedCount++;
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
          processedFiles++;
          setJob(jobId, { processedFiles, imported: importedCount, errors: errorCount });
          continue;
        }

        if (Array.isArray(data)) {
          let itemCount = 0;
          for (const item of data) {
            try {
              await importItem(item);
              importedCount++;
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
        } else {
          await importItem(data);
          importedCount++;
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

    // 背景處理，避免同步請求超時導致 502
    setImmediate(() => {
      processUploadJob(jobId, req.file.path, req.file.originalname);
    });

    res.status(202).json({
      success: true,
      message: '檔案已接收，背景匯入中',
      jobId,
      statusEndpoint: `/api/upload/jobs/${jobId}`
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
      byYear: byYear.rows
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
  queryWithRetry,
  getJob,
  getJobErrors,
  setJob,
  addJobError
};
