/**
 * 訴訟策略 API 路由 - v0.9.0 MVP
 * 訴狀分析、趨勢預測、風險評估、策略生成、案件管理
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const strategyService = require('../services/strategyService');

// 案件模型（內存存儲）
class Case {
  constructor(data) {
    this.id = data.id || `case-${Date.now()}`;
    this.caseType = data.caseType;
    this.title = data.title;
    this.description = data.description;
    this.context = data.context || '';
    this.keywords = data.keywords || [];
    this.court = data.court || '';
    this.opposingParty = data.opposingParty || '';
    this.evidence = data.evidence || [];
    this.status = data.status || 'draft';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.strategyReport = data.strategyReport || null;
  }
}

// 模擬案件存儲
const casesStore = new Map();

// 設定上傳目錄
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'cases');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式'), false);
    }
  }
});

// ========== 現有 API ==========

// POST /api/strategy/petition-analysis - 訴狀分析
router.post('/petition-analysis', async (req, res) => {
  try {
    const { petitionText, partyType, caseType } = req.body;
    
    if (!petitionText) {
      return res.status(400).json({
        status: 'error',
        message: '缺少訴狀內容',
        code: 'MISSING_PETITION_TEXT'
      });
    }

    const result = await strategyService.analyzePetition(
      petitionText,
      partyType || 'plaintiff',
      caseType || 'general'
    );

    res.json(result);
  } catch (error) {
    console.error('[strategy/petition-analysis] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/strategy/trend-prediction - 趨勢預測
router.get('/trend-prediction', async (req, res) => {
  try {
    const { caseType, court, judgeId } = req.query;
    
    if (!caseType) {
      return res.status(400).json({
        status: 'error',
        message: '缺少案件類型',
        code: 'MISSING_CASE_TYPE'
      });
    }

    const result = await strategyService.predictTrend(caseType, court, judgeId);

    res.json(result);
  } catch (error) {
    console.error('[strategy/trend-prediction] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/strategy/risk-assessment - 風險評估
router.post('/risk-assessment', async (req, res) => {
  try {
    const { caseDetails, caseType, opponentInfo } = req.body;
    
    if (!caseDetails) {
      return res.status(400).json({
        status: 'error',
        message: '缺少案件詳情',
        code: 'MISSING_CASE_DETAILS'
      });
    }

    const result = await strategyService.assessRisk(
      caseDetails,
      caseType || 'general',
      opponentInfo
    );

    res.json(result);
  } catch (error) {
    console.error('[strategy/risk-assessment] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/strategy/court-suggestions - 開庭建議
router.post('/court-suggestions', async (req, res) => {
  try {
    const { caseInfo, hearingType } = req.body;
    
    if (!caseInfo) {
      return res.status(400).json({
        status: 'error',
        message: '缺少案件資訊',
        code: 'MISSING_CASE_INFO'
      });
    }

    const result = await strategyService.getCourtSuggestions(
      caseInfo,
      hearingType || 'main'
    );

    res.json(result);
  } catch (error) {
    console.error('[strategy/court-suggestions] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/strategy/cross-examination - 質詢要點
router.post('/cross-examination', async (req, res) => {
  try {
    const { caseInfo, witnessType, purpose } = req.body;
    
    if (!caseInfo) {
      return res.status(400).json({
        status: 'error',
        message: '缺少案件資訊',
        code: 'MISSING_CASE_INFO'
      });
    }

    const result = await strategyService.getCrossExaminationPoints(
      caseInfo,
      witnessType || 'witness',
      purpose || 'establish'
    );

    res.json(result);
  } catch (error) {
    console.error('[strategy/cross-examination] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/strategy/defense-direction - 辯護方向
router.post('/defense-direction', async (req, res) => {
  try {
    const { caseInfo, role, caseType } = req.body;
    
    if (!caseInfo) {
      return res.status(400).json({
        status: 'error',
        message: '缺少案件資訊',
        code: 'MISSING_CASE_INFO'
      });
    }

    const result = await strategyService.getDefenseDirection(
      caseInfo,
      role || 'defendant',
      caseType || 'general'
    );

    res.json(result);
  } catch (error) {
    console.error('[strategy/defense-direction] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 案件管理 API (新添加) ==========

// POST /api/strategy/case - 建立案件
router.post('/case', async (req, res) => {
  try {
    const { caseType, title, description, context, keywords, court, opposingParty, evidence } = req.body;

    if (!caseType || !title) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件類型和標題',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const newCase = new Case({
      caseType,
      title,
      description,
      context,
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [],
      court,
      opposingParty,
      evidence: evidence || []
    });

    casesStore.set(newCase.id, newCase);

    res.json({
      status: 'success',
      data: newCase,
      message: '案件建立成功'
    });
  } catch (error) {
    console.error('[strategy/case] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/strategy/case/:id - 取得案件
router.get('/case/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = casesStore.get(id);

    if (!caseData) {
      return res.status(404).json({
        status: 'error',
        message: '案件不存在',
        code: 'CASE_NOT_FOUND'
      });
    }

    res.json({
      status: 'success',
      data: caseData
    });
  } catch (error) {
    console.error('[strategy/case/:id] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/strategy/cases - 取得所有案件
router.get('/cases', async (req, res) => {
  try {
    const cases = Array.from(casesStore.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      status: 'success',
      data: cases,
      total: cases.length
    });
  } catch (error) {
    console.error('[strategy/cases] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// PUT /api/strategy/case/:id - 更新案件
router.put('/case/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = casesStore.get(id);

    if (!caseData) {
      return res.status(404).json({
        status: 'error',
        message: '案件不存在',
        code: 'CASE_NOT_FOUND'
      });
    }

    const updated = { ...caseData, ...req.body, updatedAt: new Date().toISOString() };
    casesStore.set(id, updated);

    res.json({
      status: 'success',
      data: updated,
      message: '案件更新成功'
    });
  } catch (error) {
    console.error('[strategy/case/:id] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// DELETE /api/strategy/case/:id - 刪除案件
router.delete('/case/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!casesStore.has(id)) {
      return res.status(404).json({
        status: 'error',
        message: '案件不存在',
        code: 'CASE_NOT_FOUND'
      });
    }

    casesStore.delete(id);

    res.json({
      status: 'success',
      message: '案件刪除成功'
    });
  } catch (error) {
    console.error('[strategy/case/:id] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 訴狀上傳 API ==========

// POST /api/strategy/case/:id/pleading - 上傳訴狀
router.post('/case/:id/pleading', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = casesStore.get(id);

    if (!caseData) {
      return res.status(404).json({
        status: 'error',
        message: '案件不存在',
        code: 'CASE_NOT_FOUND'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: '請上傳檔案',
        code: 'NO_FILE_UPLOADED'
      });
    }

    const pleading = {
      id: `pleading-${Date.now()}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    caseData.evidence.push(pleading);
    caseData.updatedAt = new Date().toISOString();
    casesStore.set(id, caseData);

    res.json({
      status: 'success',
      data: pleading,
      message: '訴狀上傳成功'
    });
  } catch (error) {
    console.error('[strategy/case/:id/pleading] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 策略報告 API ==========

// POST /api/strategy/case/:id/analyze - 分析案件產生策略報告
router.post('/case/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = casesStore.get(id);

    if (!caseData) {
      return res.status(404).json({
        status: 'error',
        message: '案件不存在',
        code: 'CASE_NOT_FOUND'
      });
    }

    // 生成策略報告
    const strategyReport = generateStrategyReport(caseData);

    caseData.strategyReport = strategyReport;
    caseData.status = 'analyzed';
    caseData.updatedAt = new Date().toISOString();
    casesStore.set(id, caseData);

    res.json({
      status: 'success',
      data: strategyReport,
      message: '策略分析完成'
    });
  } catch (error) {
    console.error('[strategy/case/:id/analyze] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/strategy/analyze - 快速分析（不建立案件）
router.post('/analyze', async (req, res) => {
  try {
    const { caseType, title, description, context } = req.body;

    if (!caseType || !title) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件類型和標題',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const mockCase = { caseType, title, description, context };
    const strategyReport = generateStrategyReport(mockCase);

    res.json({
      status: 'success',
      data: strategyReport
    });
  } catch (error) {
    console.error('[strategy/analyze] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 生成策略報告
function generateStrategyReport(caseData) {
  const { caseType, title, description, context } = caseData;
  const titleLower = (title || '').toLowerCase();
  const descLower = (description || '').toLowerCase();
  const contextLower = (context || '').toLowerCase();

  // 根據案件類型生成不同策略
  let attackPoints = [];
  let defensePoints = [];
  let risks = [];
  let laws = [];

  // 通用風險
  risks.push({
    level: 'medium',
    title: '證據蒐集困難',
    description: '部分關鍵證據可能難以取得，需提前規劃證據保全',
    suggestion: '盡早聲請證據保全，向法院申請調查證據'
  });

  risks.push({
    level: 'low',
    title: '訴訟時效',
    description: '注意相關請求權之消滅時效',
    suggestion: '確認案件適用之時效規定，避免權利睡覺'
  });

  // 根據案件類型客製化
  if (caseType === '民事' || caseType === '商事') {
    attackPoints = [
      {
        type: '請求',
        title: '請求損害賠償',
        content: '依民法侵權行為或債務不履行規定，請求對方賠償損失',
        priority: 'high'
      },
      {
        type: '證據',
        title: '契約與轉帳記錄',
        content: '整理所有相關契約、對話記錄、轉帳證明作為證據',
        priority: 'high'
      }
    ];

    defensePoints = [
      {
        type: '抗辯',
        title: '時效抗辯',
        content: '若已超過請求權時效，可主張時效消滅',
        priority: 'medium'
      },
      {
        type: '抗辯',
        title: '過失相抵',
        content: '若原告亦有過失，可請求減輕賠償金額',
        priority: 'medium'
      }
    ];

    laws = [
      { article: '民法第184條', title: '侵權行為' },
      { article: '民法第213條', title: '損害賠償方法' },
      { article: '民法第216條', title: '損害賠償範圍' },
      { article: '民法第197條', title: '侵權行為時效' }
    ];

    if (titleLower.includes('合約') || titleLower.includes('契約')) {
      laws.push({ article: '民法第219條', title: '意思表示' });
      laws.push({ article: '民法第245條之1', title: '要約催告' });
    }
  } else if (caseType === '刑事') {
    attackPoints = [
      {
        type: '告訴',
        title: '提起告訴',
        content: '依據告訴乃論罪之規定提起告訴',
        priority: 'high'
      },
      {
        type: '證據',
        title: '保全證據',
        content: '儘速保全相關證據，確保事實認定',
        priority: 'high'
      }
    ];

    defensePoints = [
      {
        type: '抗辯',
        title: '不在場證明',
        content: '提供不在場證明或證人',
        priority: 'high'
      },
      {
        type: '抗辯',
        title: '正當防衛',
        content: '若為正當防衛或緊急避難，可主張阻卻違法',
        priority: 'medium'
      }
    ];

    laws = [
      { article: '刑法第271條', title: '殺人罪' },
      { article: '刑法第277條', title: '傷害罪' },
      { article: '刑法第284條', title: '過失傷害罪' },
      { article: '刑法第309條', title: '公然侮辱罪' }
    ];
  } else if (caseType === '家事') {
    attackPoints = [
      {
        type: '請求',
        title: '監護權請求',
        content: '提出有利於子女成長之證據',
        priority: 'high'
      },
      {
        type: '請求',
        title: '贍養費請求',
        content: '依民法規定請求贍養費',
        priority: 'medium'
      }
    ];

    defensePoints = [
      {
        type: '抗辯',
        title: '對方不適任',
        content: '提出對方不適合監護之證據',
        priority: 'high'
      }
    ];

    laws = [
      { article: '民法第1052條', title: '裁判離婚' },
      { article: '民法第1055條', title: '監護權歸屬' },
      { article: '民法第1057條', title: '贍養費' },
      { article: '民法第1089條', title: '親權行使' }
    ];
  } else if (caseType === '行政') {
    attackPoints = [
      {
        type: '救濟',
        title: '提起行政救濟',
        content: '對行政處分提起復查或訴願',
        priority: 'high'
      }
    ];

    defensePoints = [
      {
        type: '抗辯',
        title: '程序瑕疵',
        content: '檢視行政處分是否有程序瑕疵',
        priority: 'medium'
      }
    ];

    laws = [
      { article: '行政訴訟法第4條', title: '撤銷訴訟' },
      { article: '行政訴訟法第8條', title: '一般訴訟' },
      { article: '訴願法第1條', title: '訴願管轄' }
    ];
  } else {
    // 預設策略
    attackPoints = [
      {
        type: '請求',
        title: '明確訴訟標的',
        content: '清楚界定請求之權利基礎',
        priority: 'high'
      },
      {
        type: '證據',
        title: '準備證據資料',
        content: '整理所有有利之證據',
        priority: 'high'
      }
    ];

    defensePoints = [
      {
        type: '抗辯',
        title: '程序問題',
        content: '檢視訴訟程序是否有瑕疵',
        priority: 'medium'
      }
    ];

    laws = [
      { article: '民事訴訟法第244條', title: '起訴狀應記載事項' },
      { article: '民事訴訟法第277條', title: '舉證責任分配' },
      { article: '民法第1條', title: '民事法律適用' }
    ];
  }

  // 添加根據上下文的自訂風險
  if (contextLower.includes('和解') || contextLower.includes('調解')) {
    risks.push({
      level: 'high',
      title: '調解風險',
      description: '調解期間對方可能拖延談判',
      suggestion: '設定調解底線，做好調解不成之訴訟準備'
    });
  }

  if (contextLower.includes('對方有錢') || contextLower.includes('對方沒錢')) {
    risks.push({
      level: 'high',
      title: '執行風險',
      description: '需確認對方財產狀況，以免勝訴後無法執行',
      suggestion: '盡早聲請假扣押保全執行'
    });
  }

  return {
    id: `strategy-${Date.now()}`,
    caseType,
    title,
    summary: {
      overallRisk: risks.filter(r => r.level === 'high').length > 0 ? '中高' : '中等',
      strength: attackPoints.filter(p => p.priority === 'high').length,
      weakness: defensePoints.filter(p => p.priority === 'high').length,
      keyLaws: laws.length
    },
    attackPoints,
    defensePoints,
    risks,
    laws,
    timeline: {
      estimatedMonths: caseType === '刑事' ? '6-18' : '6-12',
      keyMilestones: [
        { phase: '起訴', timeframe: '第1個月', status: 'pending' },
        { phase: '證據交換', timeframe: '第1-3個月', status: 'pending' },
        { phase: '言詞辯論', timeframe: '第3-6個月', status: 'pending' },
        { phase: '判決', timeframe: '第6-12個月', status: 'pending' }
      ]
    },
    budget: {
      estimated: caseType === '刑事' ? '15-30萬' : '10-25萬',
      breakdown: [
        { item: '律師費', range: '8-20萬' },
        { item: '裁判費', range: '1-3萬' },
        { item: '其他費用', range: '1-2萬' }
      ]
    },
    generatedAt: new Date().toISOString()
  };
}

// ========== Health Check ==========

// GET /api/strategy/health - 健康檢查
router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    version: '0.9.0',
    timestamp: new Date().toISOString(),
    features: {
      petitionAnalysis: 'enabled',
      trendPrediction: 'enabled',
      riskAssessment: 'enabled',
      courtSuggestions: 'enabled',
      crossExamination: 'enabled',
      defenseDirection: 'enabled',
      caseManagement: 'enabled',
      pleadingUpload: 'enabled',
      strategyReport: 'enabled'
    }
  });
});

// Multer 錯誤處理
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'error',
      message: '檔案過大，超過100MB限制',
      code: 'FILE_TOO_LARGE'
    });
  }
  if (err && err.message === '不支援的檔案格式') {
    return res.status(400).json({
      status: 'error',
      message: err.message,
      code: 'UNSUPPORTED_FILE_TYPE'
    });
  }
  return next(err);
});

module.exports = router;
