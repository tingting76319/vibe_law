const express = require('express');
const cors = require('cors');
const judicialRoutes = require('./routes/judicial');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/judicial', judicialRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
});
