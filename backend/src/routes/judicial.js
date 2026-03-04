/**
 * Judicial API - PostgreSQL 版本
 * v1.1 - 加入判決分類 API 與 Hybrid Search
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const judicialRepository = require('../repositories/judicialRepository');
const { success, error } = require('../utils/apiResponse');
const { parsePagination, requireNonEmptyString } = require('../utils/validation');

function mapDataError(res, err) {
  if (err.code === 'DB_TIMEOUT') {
    return error(res, 504, err.message);
  }

  return error(res, 500, err.message || '系統發生錯誤');
}

// ===== v1.1 新增: 判決分類 API =====

/**
 * GET /api/judicial/stats/case-types
 * 取得各類案件數量統計
 * 回傳: { 民事: 100, 刑事: 50, 行政: 30, ... }
 */
router.get('/stats/case-types', async (req, res) => {
  try {
    const stats = await judicialRepository.getCaseTypeStats();
    
    // 轉換為物件格式
    const result = {
      民事: 0,
      刑事: 0,
      行政: 0,
      家事: 0,
      少年: 0,
      憲法: 0,
      其他: 0
    };
    
    stats.forEach(row => {
      if (result.hasOwnProperty(row.case_type)) {
        result[row.case_type] = row.count;
      }
    });
    
    // 計算總數
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    
    return success(res, {
      ...result,
      total
    });
  } catch (err) {
    console.error('[Judicial] 案件分類統計錯誤:', err);
    return mapDataError(res, err);
  }
});

/**
 * GET /api/judicial/cases/type/:caseType
 * 依案件類型取得案例列表
 * @param caseType: civil | criminal | administrative | family | juvenile | constitutional
 */
router.get('/cases/type/:caseType', async (req, res) => {
  try {
    const { caseType } = req.params;
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    
    if (pagination.error) {
      return error(res, 400, pagination.error);
    }

    const rows = await judicialRepository.getCasesByType(
      caseType, 
      pagination.limit, 
      pagination.offset
    );
    
    return success(res, rows, {
      count: rows.length,
      limit: pagination.limit,
      offset: pagination.offset,
      caseType
    });
  } catch (err) {
    console.error('[Judicial] 案件類型查詢錯誤:', err);
    return mapDataError(res, err);
  }
});

/**
 * GET /api/judicial/cases/:jid/classification
 * 取得單一案件分類資訊
 */
router.get('/cases/:jid/classification', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.jid, 'jid');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const classification = await judicialRepository.getCaseClassification(validated.value);
    if (!classification) {
      return error(res, 404, '找不到該裁判書');
    }

    return success(res, classification);
  } catch (err) {
    return mapDataError(res, err);
  }
});

// ===== v1.1 新增: Hybrid Search =====

/**
 * GET /api/judicial/search/hybrid
 * 混合搜尋 - 結合關鍵字與向量相似度
 * @param q: 搜尋關鍵詞
 * @param limit: 回傳數量 (預設 20)
 * @param kw: 關鍵字權重 0-1 (預設 0.5)
 * @param vw: 向量權重 0-1 (預設 0.5)
 */
router.get('/search/hybrid', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.query.q, '搜尋關鍵字');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const keywordWeight = parseFloat(req.query.kw) || 0.5;
    const vectorWeight = parseFloat(req.query.vw) || 0.5;

    console.log(`[HybridSearch] 關鍵詞: ${validated.value}, 權重: kw=${keywordWeight}, vw=${vectorWeight}`);

    const results = await judicialRepository.hybridSearch(
      validated.value,
      limit,
      keywordWeight,
      vectorWeight
    );

    return success(res, {
      query: validated.value,
      results,
      metadata: {
        limit,
        keywordWeight,
        vectorWeight,
        resultCount: results.length
      }
    });
  } catch (err) {
    console.error('[Judicial] Hybrid Search 錯誤:', err);
    return mapDataError(res, err);
  }
});

// ===== 現有 API =====

// 搜尋案例
router.get('/search', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.query.q, '搜尋關鍵字');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const rows = await judicialRepository.searchJudgments(validated.value);
    return success(res, rows, { count: rows.length });
  } catch (err) {
    console.error('[Judicial] 搜尋錯誤:', err);
    return mapDataError(res, err);
  }
});

// 取得所有案例
router.get('/cases', async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return error(res, 400, pagination.error);
    }

    const rows = await judicialRepository.getAllJudgments(pagination.limit, pagination.offset);
    return success(res, rows, {
      count: rows.length,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (err) {
    return mapDataError(res, err);
  }
});

// 取得單一案例
router.get('/cases/:jid', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.jid, 'jid');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const row = await judicialRepository.getJudgmentById(validated.value);
    if (!row) {
      return error(res, 404, '找不到該裁判書');
    }

    return success(res, row);
  } catch (err) {
    return mapDataError(res, err);
  }
});

// 裁判書異動清單
router.get('/changelog', async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    if (pagination.error) {
      return error(res, 400, pagination.error);
    }

    const rows = await judicialRepository.getJudgmentChangelog(pagination.limit, pagination.offset);
    return success(res, rows, {
      count: rows.length,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (err) {
    return mapDataError(res, err);
  }
});

// API 帳密驗證
router.post('/auth', async (req, res) => {
  const configuredUser = process.env.JUDICIAL_AUTH_USER;
  const configuredPassword = process.env.JUDICIAL_AUTH_PASSWORD;

  if (!configuredUser || !configuredPassword) {
    return error(res, 503, 'auth 功能尚未設定');
  }

  const user = typeof req.body?.user === 'string' ? req.body.user : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!user || !password) {
    return error(res, 400, 'user 與 password 為必填欄位');
  }

  if (user !== configuredUser || password !== configuredPassword) {
    return error(res, 401, '帳號或密碼錯誤');
  }

  const issuedAt = Date.now();
  const expiresIn = 3600;
  const payload = `${user}:${issuedAt}:${crypto.randomUUID()}`;
  const token = Buffer.from(payload).toString('baseurl');

  return success(res, {
    token,
    tokenType: 'Bearer',
    expiresIn,
    issuedAt
  });
});

// 測試連線
// 手動同步判決書
// GET /api/judicial/sync?date=2026-03-04
router.post('/sync', async (req, res) => {
  try {
    const judicialApi = require('../services/judicialApi');
    const { date } = req.body || {};
    const result = await judicialApi.fetchLatestJudgments(date);
    success(res, { message: '同步完成', count: result?.length || 0, date: date || 'latest' });
  } catch(e) {
    error(res, 500, e.message);
  }
});

router.get('/test', async (req, res) => {
  try {
    const count = await judicialRepository.getJudgmentCount();
    return success(
      res,
      {
        message: 'PostgreSQL 連線成功',
        count
      },
      {}
    );
  } catch (err) {
    return mapDataError(res, err);
  }
});

module.exports = router;
