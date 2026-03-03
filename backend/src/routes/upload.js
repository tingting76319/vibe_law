/**
 * 上傳 API - ZIP 檔案匯入
 */
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const db = require('../db/postgres');

const router = express.Router();

// 設定上傳目錄
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 設定 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// 簡易背景工作追蹤（單機記憶體版）
const uploadJobs = new Map();
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

function getJob(jobId) {
  return uploadJobs.get(jobId);
}

function setJob(jobId, patch) {
  const current = uploadJobs.get(jobId) || {};
  uploadJobs.set(jobId, { ...current, ...patch, updatedAt: Date.now() });
}

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of uploadJobs.entries()) {
    if (!job.updatedAt || now - job.updatedAt > JOB_TTL_MS) {
      uploadJobs.delete(jobId);
    }
  }
}

setInterval(cleanupJobs, 1000 * 60 * 5).unref();

async function getTotalCount() {
  const total = await db.query('SELECT COUNT(*) as count FROM judgments');
  return Number.parseInt(total.rows[0].count, 10) || 0;
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

    for (const file of fileHandlers) {
      try {
        const content = file.read();
        let data;
        try {
          data = JSON.parse(content);
        } catch (jsonErr) {
          // 可能是一行一筆 JSON
          const lines = content.split('\n').filter((line) => line.trim());
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              await importItem(item);
              importedCount++;
            } catch (lineErr) {
              errorCount++;
            }
          }
          processedFiles++;
          setJob(jobId, { processedFiles, imported: importedCount, errors: errorCount });
          continue;
        }

        if (Array.isArray(data)) {
          for (const item of data) {
            try {
              await importItem(item);
              importedCount++;
            } catch (itemErr) {
              errorCount++;
            }
          }
        } else {
          await importItem(data);
          importedCount++;
        }
      } catch (fileErr) {
        console.error(`[Upload] 檔案處理失敗: ${file.name}`, fileErr.message);
        errorCount++;
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
      total
    });
  } catch (err) {
    console.error('[Upload Job] 錯誤:', err.message);
    setJob(jobId, {
      status: 'failed',
      step: 'failed',
      error: err.message,
      imported: importedCount,
      errors: errorCount
    });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// 上傳並匯入
router.post('/upload', upload.single('file'), async (req, res) => {
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
      jobId
    });
    
  } catch (error) {
    console.error('[Upload] 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 匯入單筆資料
async function importItem(item) {
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
  
  await db.query(text, values);
}

// 查詢單一匯入工作狀態
router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: '找不到工作或已過期' });
  }
  return res.json(job);
});

// 取得匯入狀態
router.get('/status', async (req, res) => {
  try {
    const total = await db.query('SELECT COUNT(*) as count FROM judgments');
    const byYear = await db.query(`
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
    res.status(500).json({ error: error.message });
  }
});

// Multer 檔案大小限制錯誤回應
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '檔案過大，超過上傳限制' });
  }
  return next(err);
});

module.exports = router;
