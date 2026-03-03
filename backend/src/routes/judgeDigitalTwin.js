/**
 * Judge Digital Twin API Routes - 法官數位孿生 API v0.3
 * 整合資料庫 + 快取機制
 */
const express = require('express');
const router = express.Router();

// 引入服務
const judgeService = require('../services/judgeService');
const { cacheService } = require('../services/cacheService');
const { initCacheTable } = require('../services/cacheService');

// 初始化快取表
initCacheTable();

// ========== 法官資料 API ==========

// 取得所有法官列表
router.get('/judges', async (req, res) => {
  try {
    const { forceRefresh } = req.query;
    const judges = await judgeService.getAllJudges(forceRefresh === 'true');
    res.json({
      status: 'success',
      data: judges,
      count: judges.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 搜尋法官
router.get('/judges/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ status: 'error', message: '請輸入搜尋關鍵字' });
    }
    const judges = await judgeService.searchJudges(q);
    res.json({
      status: 'success',
      data: judges,
      count: judges.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 依法院取得法官
router.get('/judges/court/:court', async (req, res) => {
  try {
    const { court } = req.params;
    const judges = await judgeService.getJudgesByCourt(court);
    res.json({
      status: 'success',
      data: judges,
      count: judges.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得單一法官
router.get('/judges/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const { forceRefresh } = req.query;
    const judge = await judgeService.getJudgeById(judgeId, forceRefresh === 'true');
    
    if (!judge) {
      return res.status(404).json({ status: 'error', message: '法官不存在' });
    }
    
    res.json({
      status: 'success',
      data: judge
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得法官行為分析
router.get('/judges/:judgeId/analysis', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const judge = await judgeService.getJudgeById(judgeId);
    
    if (!judge) {
      return res.status(404).json({ status: 'error', message: '法官不存在' });
    }
    
    res.json({
      status: 'success',
      data: judge.behaviorAnalysis
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得法官裁判風格向量
router.get('/judges/:judgeId/style-vector', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const judge = await judgeService.getJudgeById(judgeId);
    
    if (!judge) {
      return res.status(404).json({ status: 'error', message: '法官不存在' });
    }
    
    res.json({
      status: 'success',
      data: judge.styleVector
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 建立法官
router.post('/judges', async (req, res) => {
  try {
    const judge = await judgeService.createJudge(req.body);
    res.status(201).json({
      status: 'success',
      data: judge
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 更新法官
router.put('/judges/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const judge = await judgeService.updateJudge(judgeId, req.body);
    res.json({
      status: 'success',
      data: judge
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 刪除法官
router.delete('/judges/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    await judgeService.deleteJudge(judgeId);
    res.json({
      status: 'success',
      message: '法官資料已刪除'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 判決預測 API ==========

// 預測判決結果
router.post('/predict', async (req, res) => {
  try {
    const { caseFeatures, judgeId } = req.body;
    
    if (!caseFeatures) {
      return res.status(400).json({ 
        status: 'error', 
        message: '請提供案件特徵 (caseFeatures)' 
      });
    }

    const prediction = await judgeService.predictJudgment(caseFeatures, {
      judgeId,
      includeSimilarCases: true
    });

    res.json({
      status: 'success',
      data: prediction
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 比較多位法官預測
router.post('/predict/compare', async (req, res) => {
  try {
    const { caseFeatures, judgeIds } = req.body;
    
    if (!caseFeatures || !judgeIds || !Array.isArray(judgeIds)) {
      return res.status(400).json({ 
        status: 'error', 
        message: '請提供案件特徵 (caseFeatures) 和法官 ID 陣列 (judgeIds)' 
      });
    }

    const comparison = await judgeService.compareJudgePredictions(caseFeatures, judgeIds);

    res.json({
      status: 'success',
      data: comparison
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 相似案例推薦 API ==========

// 查找相似案例
router.post('/similar', async (req, res) => {
  try {
    const { caseId, caseData, topK, judgeId, minSimilarity, yearRange, caseType } = req.body;
    
    if (!caseId && !caseData) {
      return res.status(400).json({ 
        status: 'error', 
        message: '請提供 caseId 或 caseData' 
      });
    }

    const similarCases = await judgeService.findSimilarCases(
      caseData,
      {
        caseId,
        topK: topK || 10,
        judgeId,
        minSimilarity: minSimilarity || 0.1,
        yearRange,
        caseType
      }
    );

    res.json({
      status: 'success',
      data: {
        similarCases,
        total: similarCases.length
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 搜尋相關判例
router.get('/search', async (req, res) => {
  try {
    const { q, caseType, topK, judgeId } = req.query;
    
    if (!q) {
      return res.status(400).json({ status: 'error', message: '請輸入搜尋關鍵字' });
    }

    const results = await judgeService.searchRelatedCases(q, {
      caseType,
      topK: parseInt(topK) || 10,
      judgeId
    });

    res.json({
      status: 'success',
      data: results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得相似度矩陣
router.get('/similarity-matrix', async (req, res) => {
  try {
    const matrix = await judgeService.getSimilarityMatrix();
    
    res.json({
      status: 'success',
      data: matrix
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得案例群組
router.get('/clusters', async (req, res) => {
  try {
    const { minSimilarity } = req.query;
    const clusters = await judgeService.getCaseClusters(
      parseFloat(minSimilarity) || 0.5
    );
    
    res.json({
      status: 'success',
      data: clusters,
      count: clusters.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 綜合查詢 API ==========

// 法官數位孿生完整資訊
router.get('/judge-twin/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    
    const twin = await judgeService.getJudgeDigitalTwin(judgeId);
    
    if (!twin) {
      return res.status(404).json({ status: 'error', message: '法官不存在' });
    }
    
    res.json({
      status: 'success',
      data: twin
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 快取管理 API ==========

// 清空快取
router.delete('/cache', (req, res) => {
  try {
    cacheService.flush();
    res.json({
      status: 'success',
      message: '快取已清空'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;

// ========== v0.6 法官資料庫增強 API ==========

// 引入趨勢分析服務
const judgeTrendAnalysis = require('../services/judgeTrendAnalysis');
const judgeBehaviorAnalysis = require('../services/judgeBehaviorAnalysis');

// ========== 趨勢分析 API ==========

// 取得年度判決趨勢
router.get('/trends/annual', async (req, res) => {
  try {
    const { startYear, endYear } = req.query;
    const yearRange = startYear && endYear 
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;
    
    const result = judgeTrendAnalysis.getAnnualTrend(yearRange);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得案件類型分布
router.get('/trends/case-distribution', async (req, res) => {
  try {
    const { court, startYear, endYear } = req.query;
    const yearRange = startYear && endYear
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;
    
    const result = judgeTrendAnalysis.getCaseTypeDistribution(court, yearRange);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得上訴維持率
router.get('/trends/appeal-rate', async (req, res) => {
  try {
    const { court, startYear, endYear } = req.query;
    const yearRange = startYear && endYear
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;
    
    const result = judgeTrendAnalysis.getAppealSustainedRate(court, yearRange);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得各法院判決模式
router.get('/trends/court-patterns', async (req, res) => {
  try {
    const result = judgeTrendAnalysis.getCourtJudgmentPatterns();
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 法官判決統計 API ==========

// 取得法官判決統計
router.get('/judges/:judgeId/stats', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const result = judgeTrendAnalysis.getJudgeJudgmentStats(judgeId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得法官風格分類
router.get('/judges/:judgeId/style-classification', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const result = judgeTrendAnalysis.classifyJudgeStyle(judgeId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 法官搜尋 API (v0.6) ==========

// 按法院搜尋法官
router.get('/judges/by-court/:court', async (req, res) => {
  try {
    const { court } = req.params;
    const judges = await judgeService.getJudgesByCourt(court);
    res.json({
      status: 'success',
      data: judges,
      count: judges.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 按專長搜尋法官
router.get('/judges/by-specialty/:specialty', async (req, res) => {
  try {
    const { specialty } = req.params;
    // 從行為分析服務取得
    const judges = judgeBehaviorAnalysis.getAllJudges().filter(judge =>
      judge.specialty?.some(s => s.includes(specialty))
    );
    res.json({
      status: 'success',
      data: judges,
      count: judges.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 按判決風格搜尋法官
router.get('/judges/by-style/:style', async (req, res) => {
  try {
    const { style } = req.params;
    // 支援: strict(嚴謹), lenient(寬鬆), technical(技術導向), balanced(平衡)
    const styleMap = {
      'strict': ['嚴謹', '嚴謹細緻', '程序嚴謹'],
      'lenient': ['寬鬆'],
      'technical': ['技術', '技術導向', '專業精準'],
      'balanced': ['平衡', '法理分析']
    };
    
    const targetStyles = styleMap[style] || [style];
    
    // 從資料庫取得法官
    const allJudges = await judgeService.getAllJudges();
    
    // 過濾符合風格的法官
    const judges = allJudges.filter(judge => {
      const judgeStyle = judge.style_approach || judge.style || '';
      return targetStyles.some(s => judgeStyle.includes(s));
    });
    
    res.json({
      status: 'success',
      data: judges,
      count: judges.length,
      styleMapping: { requested: style, matched: targetStyles }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
// 取得所有可用風格分類
router.get('/styles', async (req, res) => {
  try {
    const styles = [
      { id: 'strict', name: '嚴謹', description: '注重事實認定與證據審查' },
      { id: 'lenient', name: '寬鬆', description: '裁判風格較為靈活，注重效率與平衡' },
      { id: 'technical', name: '技術導向', description: '具有技術專業背景，擅長複雜專業案件' },
      { id: 'balanced', name: '平衡', description: '注重各方權益平衡' },
      { id: 'procedural', name: '程序正義', description: '重視正當程序，確保當事人訴訟權利' }
    ];
    
    res.json({
      status: 'success',
      data: styles
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得所有專長領域
router.get('/specialties', async (req, res) => {
  try {
    const allJudges = judgeBehaviorAnalysis.getAllJudges();
    const specialties = new Set();
    
    allJudges.forEach(judge => {
      judge.specialty?.forEach(s => specialties.add(s));
    });
    
    res.json({
      status: 'success',
      data: Array.from(specialties)
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
