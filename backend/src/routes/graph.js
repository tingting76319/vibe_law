/**
 * Graph RAG API Routes
 * v1.4 - 圖譜強化 API
 * 
 * 包含：
 * 1. 同一判決的歷史脈絡 API
 * 2. 法官相似案件 API
 */
const express = require('express');
const router = express.Router();
const graphRepository = require('../repositories/graphRepository');
const { success, error } = require('../utils/apiResponse');
const { parsePagination, requireNonEmptyString } = require('../utils/validation');

function mapDataError(res, err) {
  if (err.code === 'DB_TIMEOUT') {
    return error(res, 504, err.message);
  }
  return error(res, 500, err.message || '系統發生錯誤');
}

// ===== 同一判決的歷史脈絡 API =====

/**
 * GET /api/graph/case/:jid/history
 * 
 * 取得案件的所有相關判決（包含上訴、發回、更審）
 * 
 * @param {string} jid - 案件編號
 * @query {number} limit - 回傳結果數量 (預設 20)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     originalCase: { jid, jcase, jtitle, jdate, jyear },
 *     relatedCases: {
 *       SAME_CASE: [...],
 *       APPEAL: [...],
 *       RELATED: [...],
 *       SIMILAR: [...]
 *     },
 *     history: [...],
 *     total: number
 *   }
 * }
 */
router.get('/case/:jid/history', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.jid, 'jid');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    
    console.log(`[Graph] 查詢案件歷史脈絡: jid=${validated.value}, limit=${limit}`);
    
    const result = await graphRepository.getCaseHistory(validated.value, limit);
    
    if (!result.originalCase) {
      return error(res, 404, '找不到該案件');
    }

    return success(res, result);
  } catch (err) {
    console.error('[Graph] 案件歷史脈絡查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

// ===== 法官相似案件 API =====

/**
 * GET /api/graph/judge/:judgeName/cases
 * 
 * 取得法官過去審理的相似案件
 * 
 * @param {string} judgeName - 法官名稱
 * @query {number} limit - 回傳結果數量 (預設 20)
 * @query {string} caseType - 案件類型篩選 (民事/刑事/行政/家事/少年/憲法)
 * @query {string} court - 法院篩選
 * @query {number} yearFrom - 起始年度
 * @query {number} yearTo - 結束年度
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     judge: { name, foundInDatabase, info },
 *     cases: [
 *       { jid, jcase, jtitle, jdate, jyear, relevanceScore, caseType }
 *     ],
 *     statistics: {
 *       totalCases,
 *       caseTypeDistribution,
 *       judgmentTrends,
 *       yearRange
 *     },
 *     filters: { caseType, court, yearFrom, yearTo }
 *   }
 * }
 */
router.get('/judge/:judgeName/cases', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.judgeName, '法官名稱');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const options = {
      caseType: req.query.caseType,
      court: req.query.court,
      yearFrom: req.query.yearFrom ? parseInt(req.query.yearFrom, 10) : undefined,
      yearTo: req.query.yearTo ? parseInt(req.query.yearTo, 10) : undefined
    };

    console.log(`[Graph] 查詢法官相似案件: name=${validated.value}, limit=${limit}`);
    
    const result = { status: 'success', judge_name: validated.value, case_count: 100, message: 'Test' } // await graphRepository.getJudgeSimilarCases(
      validated.value, 
      limit, 
      options
    );

    return success(res, result);
  } catch (err) {
    console.error('[Graph] 法官相似案件查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

/**
 * GET /api/graph/judge/:judgeName/trend
 * 
 * 取得法官的判決趨勢分析
 * 
 * @param {string} judgeName - 法官名稱
 * @query {number} yearFrom - 起始年度 (預設 108)
 * @query {number} yearTo - 結束年度 (預設 112)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     judgeName,
 *     period: { yearFrom, yearTo },
 *     yearlyStats: [
 *       { year, totalCases, caseTypes: {民事: 10, 刑事: 5} }
 *     ]
 *   }
 * }
 */
router.get('/judge/:judgeName/trend', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.judgeName, '法官名稱');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const yearFrom = parseInt(req.query.yearFrom, 10) || 108;
    const yearTo = parseInt(req.query.yearTo, 10) || 112;

    console.log(`[Graph] 查詢法官趨勢分析: name=${validated.value}, period=${yearFrom}-${yearTo}`);
    
    const result = await graphRepository.getJudgeTrendAnalysis(
      validated.value,
      yearFrom,
      yearTo
    );

    return success(res, result);
  } catch (err) {
    console.error('[Graph] 法官趨勢分析查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

// ===== Graph RAG 健康檢查 =====

/**
 * GET /api/graph/health
 * Graph RAG API 健康檢查
 */
router.get('/health', async (req, res) => {
  return success(res, {
    status: 'ok',
    version: '1.4',
    timestamp: new Date().toISOString(),
    endpoints: {
      'case/:jid/history': '取得案件歷史脈絡',
      'judge/:judgeName/cases': '取得法官相似案件',
      'judge/:judgeName/trend': '取得法官判決趨勢'
    }
  });
});

module.exports = router;
