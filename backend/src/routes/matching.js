/**
 * 媒合 API Routes - v0.8.0
 * 案件-律師匹配、推薦結果、匹配度評分 API
 */
const lawyerService = require("../services/lawyerService");
const express = require('express');
const router = express.Router();
const MatchingService = require('../services/matchingService');

// ========== 案件-律師匹配 API ==========

// POST /api/matching/case - 案件匹配律師
router.post('/case', async (req, res) => {
  try {
    const { 
      caseId,
      caseType, 
      title, 
      summary, 
      keywords,
      description,
      limit = 10,
      minMatchScore = 0.3
    } = req.body;

    if (!caseType && !title && !description) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件類型、標題或描述',
        code: 'MISSING_CASE_INFO'
      });
    }

    const caseData = {
      id: caseId,
      case_type: caseType,
      title,
      summary: summary || description,
      keywords
    };

    const result = MatchingService.matchCaseToLawyers(caseData, {
      limit: parseInt(limit),
      minMatchScore: parseFloat(minMatchScore)
    });

    res.json({
      status: 'success',
      data: result,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/case] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 匹配度評分 API ==========

// POST /api/matching/score - 計算案件-律師匹配度
router.post('/score', async (req, res) => {
  try {
    const { caseData, lawyerId } = req.body;

    if (!lawyerId || !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件資料和律師 ID',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const lawyer = lawyerService.getLawyerById(lawyerId);
    if (!lawyer) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    const score = MatchingService.calculateMatchScore(caseData, lawyer);
    const reasons = MatchingService.getMatchReasons(caseData, lawyer);
    const matchLevel = MatchingService.getMatchLevel(score);

    res.json({
      status: 'success',
      data: {
        score: Math.round(score * 100) / 100,
        level: matchLevel,
        reasons,
        case: {
          type: caseData.case_type,
          title: caseData.title,
          keywords: caseData.keywords
        },
        lawyer: {
          id: lawyer.id,
          name: lawyer.name,
          expertise: lawyer.expertise,
          experience_years: lawyer.experience_years,
          success_rate: lawyer.success_rate,
          rating: lawyer.rating
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/score] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 批量評分 API ==========

// POST /api/matching/batch-score - 批量計算多個律師的匹配度
router.post('/batch-score', async (req, res) => {
  try {
    const { caseData, lawyerIds } = req.body;

    if (!lawyerIds || !Array.isArray(lawyerIds) || lawyerIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '請提供律師 ID 列表',
        code: 'MISSING_LAWYER_IDS'
      });
    }

    const results = [];
    for (const lawyerId of lawyerIds) {
      const lawyer = lawyerService.getLawyerById(lawyerId);
      if (lawyer) {
        const score = MatchingService.calculateMatchScore(caseData, lawyer);
        const matchLevel = MatchingService.getMatchLevel(score);
        results.push({
          lawyer: {
            id: lawyer.id,
            name: lawyer.name,
            expertise: lawyer.expertise,
            experience_years: lawyer.experience_years,
            rating: lawyer.rating
          },
          score: Math.round(score * 100) / 100,
          level: matchLevel
        });
      }
    }

    // 按分數排序
    results.sort((a, b) => b.score - a.score);

    res.json({
      status: 'success',
      data: {
        case: {
          type: caseData.case_type,
          title: caseData.title
        },
        scores: results,
        total: results.length
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/batch-score] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 推薦結果 API ==========

// POST /api/matching/recommend - 取得律師推薦
router.post('/recommend', async (req, res) => {
  try {
    const { 
      userId,
      caseId,
      caseType, 
      title, 
      summary, 
      keywords,
      description,
      limit = 10
    } = req.body;

    if (!caseType && !title && !description) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案件類型、標題或描述',
        code: 'MISSING_CASE_INFO'
      });
    }

    const caseData = {
      id: caseId,
      case_type: caseType,
      title,
      summary: summary || description,
      keywords
    };

    const result = MatchingService.getRecommendations(userId, caseData, {
      limit: parseInt(limit)
    });

    res.json({
      status: 'success',
      data: result,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/recommend] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 歷史記錄 API ==========

// GET /api/matching/history/:userId - 取得推薦歷史
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const history = MatchingService.getHistory(userId, parseInt(limit));

    res.json({
      status: 'success',
      data: history,
      count: history.length,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/history] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 評估律師適合度 API ==========

// GET /api/matching/evaluate/:lawyerId - 評估律師適合哪些案件類型
router.get('/evaluate/:lawyerId', async (req, res) => {
  try {
    const { lawyerId } = req.params;

    const lawyer = lawyerService.getLawyerById(lawyerId);
    if (!lawyer) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    // 模擬不同案件類型的匹配度
    const caseTypes = [
      '民事', '刑事', '行政', '家事', '商事', '智慧財產',
      '勞動', '金融', '不動產', '交通事故', '醫療糾紛'
    ];

    const evaluations = caseTypes.map(type => {
      const testCase = {
        case_type: type,
        keywords: lawyer.expertise.join(' ')
      };
      const score = MatchingService.calculateMatchScore(testCase, lawyer);
      return {
        caseType: type,
        score: Math.round(score * 100) / 100,
        level: MatchingService.getMatchLevel(score)
      };
    });

    // 排序
    evaluations.sort((a, b) => b.score - a.score);

    res.json({
      status: 'success',
      data: {
        lawyer: {
          id: lawyer.id,
          name: lawyer.name,
          expertise: lawyer.expertise
        },
        evaluations,
        bestMatch: evaluations[0]
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[matching/evaluate] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
