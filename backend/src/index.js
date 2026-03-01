const express = require('express');
const cors = require('cors');
const path = require('path');
const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');
const judgeTwinRoutes = require('./routes/judgeDigitalTwin');

const app = express();
const PORT = process.env.PORT || 3000;

// 計算正確的根目錄路徑
const rootPath = path.resolve(__dirname, '..', '..');

console.log('Root path:', rootPath);

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
app.use(express.static(rootPath));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://localhost:${PORT}`);
});
