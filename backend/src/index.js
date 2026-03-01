const express = require('express');
const cors = require('cors');
const path = require('path');
const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/judicial', judicialRoutes);
app.use('/api/rag', ragRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://localhost:${PORT}`);
  console.log(`📋 API 端點:`);
  console.log(`   GET  /api/judicial/test      - 測試 API 連線`);
  console.log(`   GET  /api/judicial/cases     - 取得所有案例`);
  console.log(`   GET  /api/judicial/search?q= - 搜尋案例`);
  console.log(`   GET  /api/judicial/cases/:jid - 取得單一案例`);
  console.log(`   GET  /api/judicial/changelog - 取得異動清單`);
  console.log(`   POST /api/rag/ask         - RAG 問答`);
  console.log(`   GET  /api/rag/health     - RAG 健康檢查`);
});
