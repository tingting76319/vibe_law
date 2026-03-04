
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
const lawyersRoutes = require('./routes/lawyers');
const matchingRoutes = require('./routes/matching');
const strategyRoutes = require('./routes/strategy');

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

// v0.8.0 律師媒合 API
app.use('/api/lawyers', lawyersRoutes);
app.use('/api/matching', matchingRoutes);

// v0.9.0 訴訟策略 API
app.use('/api/strategy', strategyRoutes);

// v0.4 API Routes
app.use('/api/v04', v04Routes);

// Health check
app.get('/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.1',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    features: {
      upload: 'enhanced',
      laws: 'enabled',
      judgesCourts: 'enabled',
      lawyerMatching: 'enabled',
      litigationStrategy: 'enabled',
      caseClassification: 'enabled',
      hybridSearch: 'enabled'
    }
  });
});

// v1.1 health check
app.get('/api/v11/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.1',
    timestamp: new Date().toISOString(),
    features: {
      caseClassification: 'enabled',
      caseTypeStats: 'enabled',
      hybridSearch: 'enabled',
      queryOptimization: 'enabled'
    }
  });
});

// v0.9 health check
app.get('/api/v09/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0',
    timestamp: new Date().toISOString(),
    features: {
      petitionAnalysis: 'enabled',
      trendPrediction: 'enabled',
      riskAssessment: 'enabled',
      courtSuggestions: 'enabled',
      crossExamination: 'enabled',
      defenseDirection: 'enabled'
    }
  });
});

// v0.8 health check
app.get('/api/v08/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '0.8',
    timestamp: new Date().toISOString(),
    features: {
      lawyerProfiles: 'enabled',
      lawyerSearch: 'enabled',
      caseMatching: 'enabled',
      lawyerRecommendations: 'enabled',
      matchScoring: 'enabled'
    }
  });
});

// v0.7 health check (legacy)
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

// Serve lawyer.html
app.get('/lawyer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'lawyer.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Legal-RAG Backend 啟動中...`);
  console.log(`📡 API Server: http://0.0.0.0:${PORT}`);
  console.log(`📋 v1.1 Features: 判決分類 API (民事/刑事/行政/家事/少年/憲法)`);
  console.log(`📋 v1.1 Features: Hybrid Search 混合搜尋 API`);
  console.log(`📋 v1.1 Features: 資料庫索引優化`);
});
