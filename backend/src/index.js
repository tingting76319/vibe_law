const express = require('express');
const cors = require('cors');
const path = require('path');

const judicialRoutes = require('./routes/judicial');
const ragRoutes = require('./routes/rag');
const judgeTwinRoutes = require('./routes/judgeDigitalTwin');
const uploadRoutes = require('./routes/upload');
const lawsRoutes = require('./routes/laws');
const v04Routes = require('./routes/v04.js');
const judgesRoutes = require('./routes/judges');
const courtsRoutes = require('./routes/courts');

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
app.use('/api/laws', lawsRoutes);

// v0.7 法官/法院邏輯引擎 API
app.use('/api/judges', judgesRoutes);
app.use('/api/courts', courtsRoutes);

// v0.4 API Routes
app.use('/api/v04', v04Routes);

// Health check
app.get('/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.7',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    features: {
      upload: 'enhanced',
      laws: 'enabled',
      judgesCourts: 'enabled'
    }
  });
});

// v0.7 health check
app.get('/api/v07/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '0.7',
    timestamp: new Date().toISOString(),
    features: {
      judgeProfile: 'enabled',
      courtProfile: 'enabled',
      judgeTrends: 'enabled',
      courtAnalysis: 'enabled',
      judgmentStatistics: 'enabled',
      caseDistribution: 'enabled',
      appealRate: 'enabled',
      courtPatterns: 'enabled'
    }
  });
});

// v0.4 health check (legacy)
app.get('/api/v04/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '0.6',
    timestamp: new Date().toISOString(),
    features: {
      vectorEmbedding: 'enabled',
      keywordExtraction: 'enabled',
      judgmentProcessing: 'enabled',
      enhancedSearch: 'enabled',
      lawDatabase: 'enabled'
    }
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
  console.log(`🔍 v0.7 Features: 法官/法院邏輯引擎、判決趨勢、法院分析`);
});
