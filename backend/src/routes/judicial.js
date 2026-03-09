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
      if (Object.prototype.hasOwnProperty.call(result, row.case_type)) {
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
  const configuredUser = process.env.JUDICIAL_AUTH_USER || process.env.JUDICIAL_USER;
  const configuredPassword = process.env.JUDICIAL_AUTH_PASSWORD || process.env.JUDICIAL_PASSWORD;

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
// POST /api/judicial/sync
// Body: { date: "2026-03-04" } 或 { startDate: "2021-12-01", endDate: "2021-12-05" }
router.post('/sync', async (req, res) => {
  try {
    const judicialApi = require('../services/judicialApi');
    const { date, startDate, endDate } = req.body || {};
    const result = await judicialApi.fetchLatestJudgments(date, startDate, endDate);
    success(res, { message: '同步完成', count: result?.length || 0, date: date || 'latest', range: startDate && endDate ? `${startDate} to ${endDate}` : null });
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

// ===== 批量儲存判決書 =====
router.post('/bulk-save', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return error(res, 400, '請提供 items 陣列');
    }
    
    const results = [];
    for (const item of items) {
      try {
        await judicialRepository.upsertJudgment(item);
        results.push({ jid: item.jid, status: 'success' });
      } catch (e) {
        results.push({ jid: item.jid, status: 'error', message: e.message });
      }
    }
    
    success(res, { saved: results.filter(r => r.status === 'success').length, results });
  } catch(e) {
    error(res, 500, e.message);
  }
});

// 單一儲存
router.post('/save', async (req, res) => {
  try {
    const item = req.body;
    if (!item.jid) {
      return error(res, 400, '請提供 jid');
    }
    
    await judicialRepository.upsertJudgment(item);
    success(res, { jid: item.jid, status: 'saved' });
  } catch(e) {
    error(res, 500, e.message);
  }
});

// 取得資料庫統計
router.get('/db-stats', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    let result = { judgments: 0, judges: 0, lawyers: 0 };
    
    try {
      const r1 = await db.query('SELECT COUNT(*) as count FROM judgments');
      result.judgments = parseInt(r1.rows[0]?.count || 0);
    } catch(e) {}
    
    try {
      const r2 = await db.query('SELECT COUNT(*) as count FROM extracted_judges');
      result.judges = parseInt(r2.rows[0]?.count || 0);
    } catch(e) {}
    
    try {
      const r3 = await db.query('SELECT COUNT(*) as count FROM lawyer_profiles');
      result.lawyers = parseInt(r3.rows[0]?.count || 0);
    } catch(e) {}
    
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 提取法官資料
router.post('/extract-judges', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    console.log('🔍 開始提取法官資料...');
    
    const judgments = await db.query('SELECT id, jid, jyear, jcase, jdate, jfull FROM judgments ORDER BY id LIMIT 10000');
    
    const judgeMap = new Map();
    const judgePattern = /法\s*官\s*([^\n\r]{2,4})/g;
    const chiefPattern = /審判長\s*([^\n\r]{2,4})/g;
    
    for (const row of judgments.rows) {
      const text = row.jfull || '';
      const court = (row.jid || '').substring(0, 4);
      
      let match;
      while ((match = judgePattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 4 && !name.includes('法')) {
          const key = `${name}_${court}`;
          if (!judgeMap.has(key)) {
            judgeMap.set(key, { judge_name: name, court, jid: row.jid, jyear: row.jyear, jcase: row.jcase, jdate: row.jdate });
          }
        }
      }
      
      while ((match = chiefPattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 4) {
          const key = `${name}_${court}`;
          if (!judgeMap.has(key)) {
            judgeMap.set(key, { judge_name: name, court, jid: row.jid, jyear: row.jyear, jcase: row.jcase, jdate: row.jdate });
          }
        }
      }
    }
    
    // 儲存到資料庫
    let saved = 0;
    for (const judge of judgeMap.values()) {
      try {
        await db.query(`
          INSERT INTO extracted_judges (judge_name, court, jid, jyear, jcase, jdate)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [judge.judge_name, judge.court, judge.jid, judge.jyear, judge.jcase, judge.jdate]);
        saved++;
      } catch(e) {}
    }
    
    console.log(`✅ 完成！提取 ${judgeMap.size} 位法官`);
    
    res.json({ status: 'success', extracted: judgeMap.size, saved });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立法官資料表索引
router.post('/optimize-judges', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立索引
    await db.query('CREATE INDEX IF NOT EXISTS idx_extracted_judges_court ON extracted_judges(court)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_extracted_judges_jyear ON extracted_judges(jyear)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_extracted_judges_jcase ON extracted_judges(jcase)');
    
    res.json({ status: 'success', message: '索引建立完成' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ===== 律師資料處理 =====

// 建立律師資料表並提取資料
router.post('/extract-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立律師資料表
    await db.query(`
      CREATE TABLE IF NOT EXISTS extracted_lawyers (
        id SERIAL PRIMARY KEY,
        lawyer_name TEXT,
        jid TEXT,
        jyear TEXT,
        jcase TEXT,
        jdate TEXT,
        court TEXT,
        UNIQUE(lawyer_name, jid)
      )
    `);
    
    // 建立索引
    await db.query('CREATE INDEX IF NOT EXISTS idx_extracted_lawyers_name ON extracted_lawyers(lawyer_name)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_extracted_lawyers_court ON extracted_lawyers(court)');
    
    // 新增欄位（如果不存在）
    try { await db.query('ALTER TABLE extracted_lawyers ADD COLUMN IF NOT EXISTS court TEXT'); } catch(e) {}
    
    // 提取律師（從判決書中的律師關鍵詞）
    const judgments = await db.query('SELECT id, jid, jyear, jcase, jdate, jfull FROM judgments ORDER BY id LIMIT 50000');
    
    const lawyerMap = new Map();
    const lawyerPattern = /(?:律師|訴訟代理人|選任辯護人)[^\u4e00-\u9fa5]*([\u4e00-\u9fa5]{2,4})/g;
    
    for (const row of judgments.rows) {
      const text = row.jfull || '';
      const court = (row.jid || '').substring(0, 4);
      
      let match;
      while ((match = lawyerPattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 4) {
          const key = `${name}_${row.jid}`;
          if (!lawyerMap.has(key)) {
            lawyerMap.set(key, {
              lawyer_name: name,
              jid: row.jid,
              jyear: row.jyear,
              jcase: row.jcase,
              jdate: row.jdate,
              court: court
            });
          }
        }
      }
    }
    
    // 儲存到資料庫
    let saved = 0;
    for (const lawyer of lawyerMap.values()) {
      try {
        await db.query(`
          INSERT INTO extracted_lawyers (lawyer_name, jid, jyear, jcase, jdate, court)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [lawyer.lawyer_name, lawyer.jid, lawyer.jyear, lawyer.jcase, lawyer.jdate, lawyer.court]);
        saved++;
      } catch(e) {}
    }
    
    // 建立 lawyer_profiles 表並匯入
    await db.query(`
      CREATE TABLE IF NOT EXISTS lawyer_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE,
        bar_number TEXT,
        specialty TEXT,
        court TEXT,
        win_rate FLOAT DEFAULT 0,
        total_cases INTEGER DEFAULT 0,
        style TEXT DEFAULT '穩健型',
        experience_years INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 從 extracted_lawyers 匯入到 lawyer_profiles
    await db.query(`
      INSERT INTO lawyer_profiles (name, specialty, court, total_cases)
      SELECT lawyer_name, jcase, court, COUNT(*) as cnt
      FROM extracted_lawyers
      GROUP BY lawyer_name, jcase, court
      ON CONFLICT (name) DO UPDATE SET total_cases = lawyer_profiles.total_cases + EXCLUDED.total_cases
    `);
    
    // 統計
    const stats = await db.query('SELECT COUNT(*) as count FROM lawyer_profiles');
    
    res.json({ 
      status: 'success', 
      extracted: lawyerMap.size,
      saved: saved,
      total_lawyers: parseInt(stats.rows[0].count)
    });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立律師資料表並提取資料
router.post('/extract-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 1. 建立 extracted_lawyers 表
    await db.query(`CREATE TABLE IF NOT EXISTS extracted_lawyers (
      id SERIAL PRIMARY KEY,
      lawyer_name TEXT,
      UNIQUE(lawyer_name)
    )`).catch(()=>{});
    
    // 2. 建立 lawyer_profiles 表
    await db.query(`CREATE TABLE IF NOT EXISTS lawyer_profiles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      specialty TEXT,
      win_rate FLOAT DEFAULT 0,
      total_cases INTEGER DEFAULT 0,
      style TEXT DEFAULT '穩健型'
    )`).catch(()=>{});
    
    // 3. 提取律師
    const judgments = await db.query('SELECT jid, jyear, jcase, jfull FROM judgments ORDER BY id LIMIT 20000');
    
    const lawyers = new Set();
    const pattern = /(?:律師|訴訟代理人|選任辯護人)[^\u4e00-\u9fa5]*([\u4e00-\u9fa5]{2,4})/g;
    
    for (const row of judgments.rows) {
      let match;
      while ((match = pattern.exec(row.jfull || '')) !== null) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 4 && !name.includes('律')) {
          lawyers.add(name);
        }
      }
    }
    
    // 4. 儲存
    let saved = 0;
    for (const name of lawyers) {
      await db.query(`INSERT INTO extracted_lawyers (lawyer_name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]).catch(()=>{});
      await db.query(`INSERT INTO lawyer_profiles (name, total_cases) VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET total_cases = lawyer_profiles.total_cases + 1`, [name]).catch(()=>{});
      saved++;
    }
    
    const total = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', extracted: lawyers.size, saved, total: parseInt(total.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 簡化版律師提取
router.post('/extract-lawyers-v2', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 1. 建立表
    await db.query(`CREATE TABLE IF NOT EXISTS lawyer_profiles (id SERIAL PRIMARY KEY, name TEXT UNIQUE)`).catch(()=>{});
    
    // 2. 提取律師（少量測試）
    const result = await db.query('SELECT jfull FROM judgments LIMIT 1000');
    
    const lawyers = new Set();
    for (const row of result.rows) {
      const matches = row.jfull?.match(/(?:律師|訴訟代理人)[^\u4e00-\u9fa5]{0,5}([\u4e00-\u9fa5]{2,4})/g) || [];
      for (const m of matches) {
        const name = m.replace(/(?:律師|訴訟代理人)/, '').trim();
        if (name.length >= 2 && name.length <= 4) lawyers.add(name);
      }
    }
    
    // 3. 儲存
    for (const name of lawyers) {
      await db.query(`INSERT INTO lawyer_profiles (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]).catch(()=>{});
    }
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', extracted: lawyers.size, total: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});
