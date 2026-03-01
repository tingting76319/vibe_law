const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, testConnection } = require('./db/postgres');

const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');
const judgeTwinRoutes = require('./routes/judgeDigitalTwin');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// 計算正確的根目錄路徑
const rootPath = path.resolve(__dirname, '..', '..');

console.log('Root path:', rootPath);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/judicial', judicialRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/judge', judgeTwinRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'disconnected';
  }
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// 測試資料庫連線
app.get('/api/db/test', async (req, res) => {
  try {
    const result = await testConnection();
    res.json({ success: result, message: result ? '資料庫連線成功' : '資料庫連線失敗' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static files
app.use(express.static(rootPath));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://0.0.0.0:${PORT}`);
});
