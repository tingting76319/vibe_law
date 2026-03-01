const express = require('express');
const cors = require('cors');
const path = require('path');

const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');
const judgeTwinRoutes = require('./routes/judgeDigitalTwin');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: 顯示環境變數
console.log('[Debug] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[Debug] NODE_ENV:', process.env.NODE_ENV);

// 根目錄路徑 - 從 backend/src 往外兩層
const rootPath = path.resolve(__dirname);
console.log('[Debug] __dirname:', __dirname);
console.log('[Debug] Root path:', rootPath);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/judicial', judicialRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/judge', judgeTwinRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'missing'
  });
});

// Serve static files from root
app.use(express.static(path.join(__dirname, '..', '..')));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'index.html'));
});

// Serve upload.html
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'upload.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://0.0.0.0:${PORT}`);
});
