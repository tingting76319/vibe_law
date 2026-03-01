const express = require('express');
const cors = require('cors');
const path = require('path');
const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');
const judgeTwinRoutes = require('./routes/judgeDigitalTwin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes (MUST be before static files)
app.use('/api/judicial', judicialRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/judge', judgeTwinRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files (frontend) - AFTER API routes
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://localhost:${PORT}`);
  console.log(`📋 API 端點:`);
  console.log(`   GET  /api/judicial/test        - 測試 API 連線`);
  console.log(`   GET  /api/judicial/cases       - 取得所有案例`);
  console.log(`   GET  /api/judicial/search?q=   - 搜尋案例`);
  console.log(`   GET  /api/judicial/cases/:jid  - 取得單一案例`);
  console.log(`   GET  /api/judicial/changelog   - 取得異動清單`);
  console.log(`   POST /api/rag/ask               - RAG 問答`);
  console.log(`   GET  /api/rag/health           - RAG 健康檢查`);
  console.log(`   ─── 法官數位孿生 v0.3 ───`);
  console.log(`   GET  /api/judge/judge-twin/:id    - 法官完整資訊`);
  console.log(`   GET  /api/judge/judges             - 法官列表`);
  console.log(`   GET  /api/judge/judges/search?q=   - 搜尋法官`);
  console.log(`   GET  /api/judge/judges/:id/analysis     - 法官行為分析`);
  console.log(`   GET  /api/judge/judges/:id/style-vector - 裁判風格向量`);
  console.log(`   POST /api/judge/predict            - 判決預測`);
  console.log(`   POST /api/judge/predict/compare    - 多法官預測比較`);
  console.log(`   POST /api/judge/similar            - 相似案例推薦`);
  console.log(`   GET  /api/judge/search?q=         - 搜尋相關判例`);
  console.log(`   GET  /api/judge/similarity-matrix  - 相似度矩陣`);
  console.log(`   GET  /api/judge/clusters          - 案例群組`);
});
