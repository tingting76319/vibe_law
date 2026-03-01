/**
 * 上傳 API - ZIP 檔案匯入
 */
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { pool, query } = require('../db/postgres');
const path = require('path');
const fs = require('fs');

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
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// 上傳並匯入
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要上傳的檔案' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    console.log(`[Upload] 收到檔案: ${req.file.originalname}, 大小: ${req.file.size} bytes`);
    
    let jsonFiles = [];
    
    // 解壓縮 ZIP 檔案
    if (ext === '.zip') {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      
      // 找出所有 JSON 檔案
      jsonFiles = zipEntries
        .filter(e => !e.isDirectory && e.entryName.endsWith('.json'))
        .map(e => {
          return { name: e.entryName, content: e.getData().toString('utf8') };
        });
      
      console.log(`[Upload] ZIP 內包含 ${jsonFiles.length} 個 JSON 檔案`);
    } else if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf8');
      jsonFiles = [{ name: req.file.originalname, content }];
    } else {
      return res.status(400).json({ error: '僅支援 .zip 或 .json 檔案' });
    }

    // 匯入每個 JSON 檔案
    let importedCount = 0;
    let errorCount = 0;
    
    for (const file of jsonFiles) {
      try {
        let data;
        try {
          data = JSON.parse(file.content);
        } catch (e) {
          // 可能是多行 JSON
          const lines = file.content.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              await importItem(item);
              importedCount++;
            } catch (e2) {
              errorCount++;
            }
          }
          continue;
        }
        
        if (Array.isArray(data)) {
          for (const item of data) {
            try {
              await importItem(item);
              importedCount++;
            } catch (e) {
              errorCount++;
            }
          }
        } else {
          await importItem(data);
          importedCount++;
        }
      } catch (e) {
        console.error(`[Upload] 匯入失敗: ${file.name}`, e.message);
        errorCount++;
      }
    }

    // 清理上傳的檔案
    fs.unlinkSync(filePath);
    
    // 統計
    const total = await query('SELECT COUNT(*) as count FROM judgments');
    
    res.json({
      success: true,
      message: '匯入完成',
      imported: importedCount,
      errors: errorCount,
      total: total.rows[0].count
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
  
  await query(text, values);
}

// 取得匯入狀態
router.get('/status', async (req, res) => {
  try {
    const total = await query('SELECT COUNT(*) as count FROM judgments');
    const byYear = await query(`
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

module.exports = router;
