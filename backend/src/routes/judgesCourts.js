/**
 * Judges & Courts API Routes - v0.7.0
 * 法官/法院邏輯引擎 API
 * 
 * Endpoints:
 * - /api/judges/profile/:judgeId - 法官檔案
 * - /api/courts/profile/:courtId - 法院檔案
 * - /api/judges/trends/:judgeId - 判決趨勢
 * - /api/courts/analysis/:courtId - 法院分析
 */
const express = require('express');
const router = express.Router();
const courtRouter = express.Router();
const judgeRouter = express.Router();

// 引入服務
const judgeService = require('../services/judgeService');
const courtService = require('../services/courtService');
const judgeTrendAnalysis = require('../services/judgeTrendAnalysis');
const { cacheService } = require('../services/cacheService');

// ========== 法官子路由 ==========

// GET /api/judges/profile/:judgeId - 法官檔案
judgeRouter.get('/profile/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const { forceRefresh } = req.query;

    const judge = await judgeService.getJudgeById(judgeId, forceRefresh === 'true');

    if (!judge) {
      return res.status(404).json({
        status: 'error',
        message: '法官不存在',
        code: 'JUDGE_NOT_FOUND'
      });
    }

    // 格式化法官檔案回應
    const profile = {
      id: judge.id,
      name: judge.name,
      court: judge.court,
      position: judge.position,
      tenure: {
        start: judge.tenure_start,
        end: judge.tenure_end
      },
      specialty: judge.specialty ? JSON.parse(judge.specialty) : [],
      bio: judge.bio,
      judgmentStats: judge.judgment_stats,
      behaviorAnalysis: judge.behaviorAnalysis || null,
      styleVector: judge.styleVector || null,
      styleApproach: judge.style_approach,
      styleTendency: judge.style_tendency,
      philosophy: judge.philosophy,
      expertise: judge.expertise ? JSON.parse(judge.expertise) : []
    };

    res.json({
      status: 'success',
      data: profile,
      meta: {
        source: 'judge_profiles',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[judges/profile] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/judges/trends/:judgeId - 判決趨勢
judgeRouter.get('/trends/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const { yearRange, caseType } = req.query;

    // 解析年份範圍
    let yearRangeObj = null;
    if (yearRange) {
      const [start, end] = yearRange.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        yearRangeObj = { startYear: start, endYear: end };
      }
    }

    // 取得法官基本資料
    const judge = await judgeService.getJudgeById(judgeId);
    
    if (!judge) {
      return res.status(404).json({
        status: 'error',
        message: '法官不存在',
        code: 'JUDGE_NOT_FOUND'
      });
    }

    // 取得判決統計
    const stats = judgeTrendAnalysis.getJudgeJudgmentStats(judgeId);
    
    // 取得風格分類
    const styleClassification = judgeTrendAnalysis.classifyJudgeStyle(judgeId);

    // 取得年度趨勢
    const annualTrend = getJudgeAnnualTrend(judgeId, yearRangeObj);

    res.json({
      status: 'success',
      data: {
        judge: {
          id: judge.id,
          name: judge.name,
          court: judge.court,
          position: judge.position
        },
        statistics: stats.status === 'success' ? stats.data : null,
        styleClassification: styleClassification.status === 'success' ? styleClassification.data : null,
        annualTrend: annualTrend,
        yearRange: yearRangeObj || { startYear: 104, endYear: 113 }
      },
      meta: {
        timestamp: new Date().toISOString(),
        cacheTTL: 30
      }
    });
  } catch (error) {
    console.error('[judges/trends] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 法院子路由 ==========

// GET /api/courts/profile/:courtId - 法院檔案
courtRouter.get('/profile/:courtId', async (req, res) => {
  try {
    const { courtId } = req.params;
    const { forceRefresh } = req.query;

    const court = await courtService.getCourtById(courtId, forceRefresh === 'true');

    if (!court) {
      return res.status(404).json({
        status: 'error',
        message: '法院不存在',
        code: 'COURT_NOT_FOUND'
      });
    }

    res.json({
      status: 'success',
      data: court,
      meta: {
        source: 'cases + judge_profiles',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[courts/profile] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/courts/analysis/:courtId - 法院分析
courtRouter.get('/analysis/:courtId', async (req, res) => {
  try {
    const { courtId } = req.params;
    const { yearRange, caseType } = req.query;

    // 解析年份範圍
    let yearRangeObj = null;
    if (yearRange) {
      const [start, end] = yearRange.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        yearRangeObj = { startYear: start, endYear: end };
      }
    }

    const analysis = await courtService.getCourtAnalysis(courtId, {
      yearRange: yearRangeObj,
      caseType
    });

    if (analysis.status === 'error') {
      return res.status(404).json(analysis);
    }

    res.json({
      status: 'success',
      data: analysis.data,
      meta: {
        parameters: {
          yearRange: yearRangeObj || 'all',
          caseType: caseType || 'all'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[courts/analysis] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 通用路由 ==========

// GET /api/judges - 所有法官列表
router.get('/', async (req, res) => {
  try {
    const { court, specialty, style, forceRefresh } = req.query;

    let judges;
    if (court) {
      judges = await judgeService.getJudgesByCourt(court);
    } else {
      judges = await judgeService.getAllJudges(forceRefresh === 'true');
    }

    // 過濾專長
    if (specialty) {
      judges = judges.filter(j => {
        const specialties = j.specialty ? JSON.parse(j.specialty) : [];
        return specialties.some(s => s.includes(specialty));
      });
    }

    // 過濾風格
    if (style) {
      judges = judges.filter(j => 
        j.style_approach?.includes(style) || j.style?.includes(style)
      );
    }

    res.json({
      status: 'success',
      data: judges,
      count: judges.length,
      meta: {
        filters: { court, specialty, style },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[judges] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/courts - 所有法院列表
router.get('/courts', async (req, res) => {
  try {
    const { forceRefresh } = req.query;
    const courts = await courtService.getAllCourts(forceRefresh === 'true');

    res.json({
      status: 'success',
      data: courts,
      count: courts.length,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[courts] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 法院搜尋
router.get('/courts/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        status: 'error',
        message: '請輸入搜尋關鍵字',
        code: 'MISSING_QUERY'
      });
    }

    const courts = await courtService.searchCourts(q);
    res.json({
      status: 'success',
      data: courts,
      count: courts.length
    });
  } catch (error) {
    console.error('[courts/search] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 判決統計 API (Feature Pipeline) ==========

// GET /api/judges/trends/annual - 年度判決趨勢
router.get('/trends/annual', async (req, res) => {
  try {
    const { startYear, endYear } = req.query;
    const yearRange = startYear && endYear 
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;

    const result = judgeTrendAnalysis.getAnnualTrend(yearRange);
    res.json(result);
  } catch (error) {
    console.error('[trends/annual] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/courts/trends/case-distribution - 案件類型分布
router.get('/trends/case-distribution', async (req, res) => {
  try {
    const { court, startYear, endYear } = req.query;
    const yearRange = startYear && endYear
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;

    const result = judgeTrendAnalysis.getCaseTypeDistribution(court, yearRange);
    res.json(result);
  } catch (error) {
    console.error('[trends/case-distribution] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/courts/trends/appeal-rate - 上訴維持率
router.get('/trends/appeal-rate', async (req, res) => {
  try {
    const { court, startYear, endYear } = req.query;
    const yearRange = startYear && endYear
      ? { startYear: parseInt(startYear), endYear: parseInt(endYear) }
      : null;

    const result = judgeTrendAnalysis.getAppealSustainedRate(court, yearRange);
    res.json(result);
  } catch (error) {
    console.error('[trends/appeal-rate] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/courts/trends/court-patterns - 法院判決模式
router.get('/trends/court-patterns', async (req, res) => {
  try {
    const result = judgeTrendAnalysis.getCourtJudgmentPatterns();
    res.json(result);
  } catch (error) {
    console.error('[trends/court-patterns] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ========== 快取管理 ==========

// DELETE /api/judges/cache - 清空快取
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

// ========== 輔助函數 ==========

// 取得法官年度趨勢（模擬）
function getJudgeAnnualTrend(judgeId, yearRange) {
  const start = yearRange?.startYear || 104;
  const end = yearRange?.endYear || 113;
  
  const trends = [];
  for (let year = start; year <= end; year++) {
    const totalCases = Math.floor(Math.random() * 50) + 20;
    const civil = Math.floor(totalCases * 0.5);
    const criminal = Math.floor(totalCases * 0.35);
    const administrative = totalCases - civil - criminal;
    
    trends.push({
      year,
      totalCases,
      breakdown: {
        civil,
        criminal,
        administrative
      },
      winRate: Math.floor(Math.random() * 20) + 40,
      avgCaseDuration: Math.floor(Math.random() * 60) + 60
    });
  }

  return trends;
}

// 註冊子路由
router.use('/courts', courtRouter);
router.use('/', judgeRouter);

module.exports = router;
