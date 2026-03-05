/**
 * Courts API Routes - v0.7.0
 * 法院邏輯引擎 API
 */
const express = require('express');
const router = express.Router();

// 引入服務
const courtService = require('../services/courtService');
const judgeTrendAnalysis = require('../services/judgeTrendAnalysis');
const { cacheService } = require('../services/cacheService');

// ========== 法院檔案 API ==========

// GET /api/courts/profile/:courtId - 法院檔案
router.get('/profile/:courtId', async (req, res) => {
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

// ========== 法院分析 API ==========

// GET /api/courts/analysis/:courtId - 法院分析
router.get('/analysis/:courtId', async (req, res) => {
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

// ========== 列表 API ==========

// GET /api/courts - 所有法院列表
router.get('/', async (req, res) => {
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
router.get('/search', async (req, res) => {
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

module.exports = router;

// ===== v1.5 新增: 法院判決差異分析 =====

// GET /api/courts/compare - 比較不同法院對同類案件的判決
router.get('/compare', async (req, res) => {
  try {
    const { caseType, year } = req.query;
    
    if (!caseType) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件類型 (caseType)'
      });
    }
    
    const result = await courtService.compareCourtJudgments(caseType, year);
    
    res.json({
      status: 'success',
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        caseType: caseType,
        year: year || 'all'
      }
    });
  } catch (error) {
    console.error('[courts/compare] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// GET /api/courts/trend/:courtId - 法院判決趨勢分析
router.get('/trend/:courtId', async (req, res) => {
  try {
    const { courtId } = req.params;
    const { years } = req.query;
    
    const result = await courtService.getCourtTrend(courtId, years || 3);
    
    res.json({
      status: 'success',
      data: result,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[courts/trend] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});
