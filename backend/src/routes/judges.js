/**
 * Judges API Routes - v0.7.0
 * 法官邏輯引擎 API
 */
const express = require('express');
const router = express.Router();

// 引入服務
const judgeService = require('../services/judgeService');
const judgeTrendAnalysis = require('../services/judgeTrendAnalysis');
const { cacheService } = require('../services/cacheService');

// ========== 判決統計 API (Feature Pipeline) - 優先順序較高 ==========

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

// ========== 法官趨勢 API ==========

// GET /api/judges/trends/:judgeId - 判決趨勢
router.get('/trends/:judgeId', async (req, res) => {
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

// ========== 法官檔案 API ==========

// GET /api/judges/profile/:judgeId - 法官檔案
router.get('/profile/:judgeId', async (req, res) => {
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

// ========== 列表 API ==========

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

module.exports = router;

// ========== 法官資料提取 API ==========

// GET /api/judges/extract - 從判決書提取法官資料
router.get('/extract', async (req, res) => {
  try {
    const { limit = 1000 } = req.query;
    const pool = require('../db/postgres');
    
    // 檢查表格是否存在
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'extracted_judges'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ 
        status: 'success', 
        message: '法官資料表尚未建立，請先執行 extractJudges.js',
        data: [] 
      });
    }
    
    // 查詢法官統計
    const result = await pool.query(`
      SELECT judge_name, COUNT(*) as case_count
      FROM extracted_judges
      GROUP BY judge_name
      ORDER BY case_count DESC
      LIMIT 100
    `);
    
    res.json({
      status: 'success',
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('[judges/extract] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});
