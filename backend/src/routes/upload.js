/**
 * 上傳 API - ZIP 檔案匯入
 * 使用 uploadPipeline 服務強化版本
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadPipeline = require('../services/uploadPipeline');

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

const uploadMaxMb = Number.parseInt(process.env.UPLOAD_MAX_FILE_MB || '256', 10);
const upload = multer({ 
  storage,
  limits: { fileSize: uploadMaxMb * 1024 * 1024 }
});

// 上傳並匯入
router.post('/upload', upload.single('file'), uploadPipeline.handleUpload);

// 查詢單一匯入工作狀態
router.get('/jobs/:jobId', uploadPipeline.handleGetJob);

// 查詢工作錯誤詳情
router.get('/jobs/:jobId/errors', uploadPipeline.handleGetJobErrors);

// 取得匯入狀態
router.get('/status', uploadPipeline.handleStatus);

// Multer 檔案大小限制錯誤回應
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `檔案過大，超過上傳限制 (${uploadMaxMb}MB)` });
  }
  return next(err);
});

module.exports = router;
