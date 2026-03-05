/**
 * Graph RAG API Routes
 * v1.4 - 圖譜強化 API
 * 
 * 包含：
 * 1. 同一判決的歷史脈絡 API
 * 2. 法官相似案件 API
 * 3. 法院判決差異分析 API (v1.5)
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/postgres');

async function getJudgeTenure(judgeName) {
  try {
    let result = await pool.query(
      'SELECT * FROM judge_tenure_stats WHERE judge_name LIKE $1 LIMIT 1',
      [`%${judgeName}%`]
    );
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return { tenure_years: 0, case_count: 0 };
  } catch(e) {
    return { tenure_years: 0, case_count: 0 };
  }
}

const graphRepository = require('../repositories/graphRepository');
const courtAnalysis = require('../scripts/courtAnalysis');
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
    
    let result = await graphRepository.getCaseHistory(validated.value, limit);
    
    if (!result.originalCase) {
      return error(res, 404, '找不到該案件');
    }

    const tenure = await getJudgeTenure(validated.value);
    result = { ...result, tenure_years: tenure.tenure_years || 0, case_count: tenure.case_count || 0 };
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
    

    const tenure = await getJudgeTenure(validated.value);
    result = { ...result, tenure_years: tenure.tenure_years || 0, case_count: tenure.case_count || 0 };
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
    
    let result = await graphRepository.getJudgeTrendAnalysis(
      validated.value,
      yearFrom,
      yearTo
    );

    const tenure = await getJudgeTenure(validated.value);
    result = { ...result, tenure_years: tenure.tenure_years || 0, case_count: tenure.case_count || 0 };
    return success(res, result);
  } catch (err) {
    console.error('[Graph] 法官趨勢分析查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

// ===== 法院判決差異分析 API (v1.5) =====

/**
 * GET /api/graph/court-analysis
 * 
 * 分析不同法院對同類案件的判決差異
 * 
 * @query {string} caseType - 案件類型篩選 (民事/刑事/行政/家事/少年/憲法)
 *                         - 不傳則回傳所有案件類型
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     status: 'success',
 *     case_type: '民事',
 *     court_count: 3,
 *     courts: [
 *       {
 *         court: '臺北地方法院',
 *         court_level: '地方法院',
 *         case_type: '民事',
 *         stats: {
 *           total_cases: 12000,
 *           plaintiff_win_rate: 30.0,
 *           defendant_win_rate: 30.0,
 *           dismissal_rate: 40.0,
 *           appeal_count: 800,
 *           appeal_sustained_rate: 65.0,
 *           appeal_reversed_rate: 35.0
 *         },
 *         year_range: { from: 108, to: 112 }
 *       },
 *       ...
 *     ],
 *     comparison: {
 *       average: {
 *         plaintiff_win_rate: 28.5,
 *         defendant_win_rate: 31.2,
 *         dismissal_rate: 40.3,
 *         appeal_sustained_rate: 62.0,
 *         appeal_reversed_rate: 38.0
 *       },
 *       most_pro_plaintiff: { court: '臺中地方法院', rate: 35.0 },
 *       most_pro_defendant: { court: '臺北地方法院', rate: 32.0 },
 *       highest_dismissal: { court: '新北地方法院', rate: 45.0 }
 *     }
 *   }
 * }
 */
router.get('/court-analysis', async (req, res) => {
  try {
    const caseType = req.query.caseType || null;
    
    console.log(`[Graph] 查詢法院判決差異分析: caseType=${caseType || '全部'}`);
    
    // 驗證案件類型（如果提供的話）
    const validCaseTypes = ['民事', '刑事', '行政', '家事', '少年', '憲法', null];
    if (caseType && !validCaseTypes.includes(caseType)) {
      return error(res, 400, `無效的案件類型: ${caseType}。支援的類型: 民事、刑事、行政、家事、少年、憲法`);
    }

    // 取得法院分析結果
    let result = courtAnalysis.compareCourtJudgments(caseType);
    
    if (result.status === 'no_data') {
      return error(res, 404, '沒有找到法院統計資料，請先執行 courtAnalysis.js 腳本');
    }

    console.log(`[Graph] 回傳 ${result.court_count} 個法院的分析資料`);
    return success(res, result);
  } catch (err) {
    console.error('[Graph] 法院判決差異分析查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

/**
 * GET /api/graph/court-analysis/refresh
 * 
 * 重新計算法院統計資料
 * 需要管理員權限（暫時不做權限檢查）
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     status: 'success',
 *     courts_updated: 15,
 *     message: '法院統計資料已更新'
 *   }
 * }
 */
router.get('/court-analysis/refresh', async (req, res) => {
  try {
    console.log('[Graph] 重新計算法院統計資料...');
    
    // 重新計算統計資料
    courtAnalysis.createCourtStatsTable();
    const count = courtAnalysis.calculateCourtStatsFromSQLite();
    
    // 嘗試從 PostgreSQL 計算
    courtAnalysis.calculateCourtStatsFromPostgres().catch(() => {});
    
    console.log(`[Graph] 已更新 ${count} 筆法院統計資料`);
    
    return success(res, {
      status: 'success',
      courts_updated: count,
      message: '法院統計資料已更新'
    });
  } catch (err) {
    console.error('[Graph] 重新計算法院統計資料錯誤:', err);
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
    version: '1.5',
    timestamp: new Date().toISOString(),
    endpoints: {
      'case/:jid/history': '取得案件歷史脈絡',
      'judge/:judgeName/cases': '取得法官相似案件',
      'judge/:judgeName/trend': '取得法官判決趨勢',
      'court-analysis': '法院判決差異分析 (v1.5)',
      'court-analysis/refresh': '重新計算法院統計'
    }
  });
});

module.exports = router;
