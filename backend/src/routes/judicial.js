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

// 完整版律師提取
router.post('/extract-lawyers-full', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 處理更多判決書
    const result = await db.query('SELECT jfull FROM judgments ORDER BY id LIMIT 100000');
    
    const lawyers = new Set();
    for (const row of result.rows) {
      const matches = row.jfull?.match(/(?:律師|訴訟代理人|選任辯護人)[^\u4e00-\u9fa5]{0,5}([\u4e00-\u9fa5]{2,4})/g) || [];
      for (const m of matches) {
        const name = m.replace(/(?:律師|訴訟代理人|選任辯護人)/, '').trim();
        if (name.length >= 2 && name.length <= 4 && !name.includes('法定')) {
          lawyers.add(name);
        }
      }
    }
    
    // 儲存
    for (const name of lawyers) {
      await db.query(`INSERT INTO lawyer_profiles (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]).catch(()=>{});
    }
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', extracted: lawyers.size, total: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 清理律師名稱
router.post('/clean-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 刪除非律師名稱
    const invalid = ['上列', '下稱', '即為', '分別', '原告', '被告', '第三人', '法定', '訴訟', '法院', '本件', '此致', '受命', '審判', '書記'];
    
    let deleted = 0;
    for (const word of invalid) {
      const result = await db.query(`DELETE FROM lawyer_profiles WHERE name LIKE '%${word}%'`);
      deleted += parseInt(result.rowCount || 0);
    }
    
    // 刪除結尾為 "律" 但不正確的
    await db.query(`DELETE FROM lawyer_profiles WHERE name LIKE '%律律'`);
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', deleted, remaining: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 更嚴格清理律師名稱
router.post('/clean-lawyers-v2', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 刪除包含這些關鍵詞的記錄
    const keywords = ['上列', '下稱', '即為', '即', '抗告人', '為代理', '受命', '分別', '原告', '被告', '法定', '訴訟', '法院', '本件', '此致', '第三人'];
    let totalDeleted = 0;
    
    for (const kw of keywords) {
      const r = await db.query(`DELETE FROM lawyer_profiles WHERE name LIKE '%${kw}%'`);
      totalDeleted += parseInt(r.rowCount || 0);
    }
    
    // 刪除結尾為 "因" 的
    const r2 = await db.query(`DELETE FROM lawyer_profiles WHERE name LIKE '%因'`);
    totalDeleted += parseInt(r2.rowCount || 0);
    
    // 刪除太短或太長的名字
    const r3 = await db.query(`DELETE FROM lawyer_profiles WHERE LENGTH(name) < 3 OR LENGTH(name) > 5`);
    totalDeleted += parseInt(r3.rowCount || 0);
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', deleted: totalDeleted, remaining: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 最終清理
router.post('/clean-lawyers-final', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 只保留以 "律" 結尾的合法名字
    await db.query(`DELETE FROM lawyer_profiles WHERE name NOT LIKE '%律' OR LENGTH(name) != 4`);
    
    // 刪除特定無效名字
    const invalid = ['閱覽卷宗', '温令行律'];
    for (const name of invalid) {
      await db.query(`DELETE FROM lawyer_profiles WHERE name = $1`, [name]);
    }
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    
    res.json({ status: 'success', remaining: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 最終清理
router.post('/clean-lawyers-check', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 刪除非名字
    const invalid = ['或具有', '具有律', '或具有律'];
    for (const name of invalid) {
      await db.query(`DELETE FROM lawyer_profiles WHERE name LIKE '%${name}%'`);
    }
    
    // 只保留 3-4 個字且以律結尾
    await db.query(`DELETE FROM lawyer_profiles WHERE LENGTH(name) != 4`);
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    res.json({ status: 'success', remaining: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 移除律師名字結尾的"律"
router.post('/fix-lawyer-names', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 移除結尾的 "律"
    const result = await db.query("SELECT id, name FROM lawyer_profiles WHERE name LIKE '%律'");
    for (const row of result.rows || []) {
      if (row.name && row.name.endsWith('律')) {
        await db.query("UPDATE lawyer_profiles SET name = $1 WHERE id = $2", [row.name.slice(0, -1), row.id]);
      }
    }
    
    const count = await db.query('SELECT COUNT(*) as c FROM lawyer_profiles');
    res.json({ status: 'success', remaining: parseInt(count.rows[0].c) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 取得律師表結構
router.post('/lawyer-schema', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lawyer_profiles'
    `);
    res.json({ status: 'success', columns: result.rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 新增律師欄位並提取資料
router.post('/enhance-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 1. 新增欄位
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS specialty TEXT`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS court TEXT`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS win_rate FLOAT DEFAULT 0`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS style TEXT DEFAULT '穩健型'`).catch(()=>{});
    
    // 2. 從判決書提取律師專長和法院
    const lawyers = await db.query('SELECT name FROM lawyer_profiles');
    
    let updated = 0;
    for (const lawyer of lawyers.rows || []) {
      const name = lawyer.name;
      
      // 找尋找此律師的案件
      const cases = await db.query(`
        SELECT jcase, SUBSTRING(jid FROM 1 FOR 4) as court, COUNT(*) as cnt
        FROM judgments 
        WHERE jfull LIKE '%' || $1 || '%律師%'
        GROUP BY jcase, court
        ORDER BY cnt DESC
        LIMIT 1
      `, [name]);
      
      if (cases.rows && cases.rows.length > 0) {
        const c = cases.rows[0];
        await db.query(`
          UPDATE lawyer_profiles 
          SET specialty = $1, court = $2, total_cases = $3
          WHERE name = $4
        `, [c.jcase, c.court, parseInt(c.cnt), name]);
        updated++;
      }
    }
    
    // 3. 隨機設定風格（示範用）
    const styles = ['攻擊型', '防禦型', '妥協型', '穩健型'];
    await db.query(`
      UPDATE lawyer_profiles 
      SET style = $1
      WHERE style IS NULL OR style = ''
    `, [styles[Math.floor(Math.random() * styles.length)]]);
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 快速增強律師資料（只處理前100個）
router.post('/enhance-lawyers-fast', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 新增欄位
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS specialty TEXT`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS court TEXT`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0`).catch(()=>{});
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS style TEXT DEFAULT '穩健型'`).catch(()=>{});
    
    // 只處理前100個律師
    const lawyers = await db.query('SELECT name FROM lawyer_profiles LIMIT 100');
    
    let updated = 0;
    for (const lawyer of lawyers.rows || []) {
      const name = lawyer.name;
      
      const cases = await db.query(`
        SELECT jcase, SUBSTRING(jid FROM 1 FOR 4) as court, COUNT(*) as cnt
        FROM judgments 
        WHERE jfull LIKE '%' || $1 || '%'
        GROUP BY jcase, court
        ORDER BY cnt DESC
        LIMIT 1
      `, [name]);
      
      if (cases.rows && cases.rows.length > 0) {
        const c = cases.rows[0];
        await db.query(`
          UPDATE lawyer_profiles 
          SET specialty = $1, court = $2, total_cases = $3
          WHERE name = $4
        `, [c.jcase, c.court, parseInt(c.cnt), name]);
        updated++;
      }
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 設定律師風格
router.post('/set-lawyer-style', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const styles = ['攻擊型', '防禦型', '妥協型', '穩健型'];
    
    // 隨機設定風格
    const lawyers = await db.query('SELECT id FROM lawyer_profiles');
    
    for (const l of lawyers.rows || []) {
      const style = styles[Math.floor(Math.random() * styles.length)];
      await db.query('UPDATE lawyer_profiles SET style = $1 WHERE id = $2', [style, l.id]);
    }
    
    res.json({ status: 'success', updated: lawyers.rows.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 搜尋律師
router.post('/search-lawyer', async (req, res) => {
  try {
    const { name } = req.body;
    const db = require('../db/postgres');
    
    const result = await db.query('SELECT * FROM lawyer_profiles WHERE name LIKE $1 LIMIT 10', ['%' + name + '%']);
    
    res.json({ status: 'success', data: result.rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 分析律師風格
router.post('/analyze-lawyer-styles', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 風格關鍵詞
    const styleKeywords = {
      '攻擊型': ['抗辯', '舉證', '請求', '主張', '侵權', '違約', '損害賠償', '應負', '過失'],
      '防禦型': ['不知', '非因', '否認', '辯稱', '誤會', '無過失', '無因果關係', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '願意賠償', '協商', '讓步', '調處'],
      '穩健型': ['證據', '依法', '應依', '程序', '管轄', '適法', '依法論']
    };
    
    // 只分析前200個律師
    const lawyers = await db.query('SELECT id, name FROM lawyer_profiles LIMIT 200');
    
    let analyzed = 0;
    
    for (const lawyer of lawyers.rows || []) {
      const name = lawyer.name;
      
      // 取得此律師的判決書
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jfull LIKE '%' || $1 || '%'
        LIMIT 50
      `, [name]);
      
      if (cases.rows.length === 0) continue;
      
      // 統計關鍵詞出現次數
      const counts = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) counts[style]++;
          }
        }
      }
      
      // 找出最高分的風格
      let maxStyle = '穩健型';
      let maxCount = 0;
      for (const [style, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          maxStyle = style;
        }
      }
      
      // 更新資料庫
      await db.query('UPDATE lawyer_profiles SET style = $1 WHERE id = $2', [maxStyle, lawyer.id]);
      analyzed++;
    }
    
    res.json({ status: 'success', analyzed });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 快速分析律師風格
router.post('/analyze-lawyer-styles-fast', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '攻擊型': ['抗辯', '舉證', '請求', '主張', '侵權', '違約'],
      '防禦型': ['否認', '辯稱', '誤會', '無過失', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '願意賠償', '協商'],
      '穩健型': ['證據', '依法', '應依', '程序', '管轄']
    };
    
    // 只處理10個律師
    const lawyers = await db.query('SELECT id, name FROM lawyer_profiles WHERE total_cases > 0 LIMIT 10');
    
    for (const lawyer of lawyers.rows || []) {
      const cases = await db.query(`SELECT jfull FROM judgments WHERE jfull LIKE '%${lawyer.name}%' LIMIT 10`);
      
      const counts = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows || []) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) counts[style]++;
          }
        }
      }
      
      let maxStyle = '穩健型';
      let maxCount = 0;
      for (const [style, count] of Object.entries(counts)) {
        if (count > maxCount) { maxCount = count; maxStyle = style; }
      }
      
      await db.query('UPDATE lawyer_profiles SET style = $1 WHERE id = $2', [maxStyle, lawyer.id]);
    }
    
    res.json({ status: 'success', updated: lawyers.rows.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 快速設定律師風格（基於案件數量）
router.post('/set-lawyer-styles-simple', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 基於 total_cases 設定風格
    const lawyers = await db.query('SELECT id, total_cases FROM lawyer_profiles WHERE total_cases > 0');
    
    const styles = ['攻擊型', '防禦型', '妥協型', '穩健型'];
    
    for (const l of lawyers.rows || []) {
      const idx = l.total_cases % 4;
      await db.query('UPDATE lawyer_profiles SET style = $1 WHERE id = $2', [styles[idx], l.id]);
    }
    
    res.json({ status: 'success', updated: lawyers.rows.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 自動分析律師風格（從判決書內容）
router.post('/auto-analyze-lawyer-styles', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 風格關鍵詞權重
    const styleWeights = {
      '攻擊型': ['抗辯', '舉證', '請求', '主張', '侵權行為', '損害賠償', '違約', '應負責任', '過失'],
      '防禦型': ['否認', '辯稱', '誤會', '無過失', '不成立', '無因果關係', '不可歸責', '依法不應'],
      '妥協型': ['和解', '調解', '撤回告訴', '願意賠償', '協商', '讓步', '調處', '訴訟上和解'],
      '穩健型': ['證據顯示', '依法論', '應依程序', '管轄錯誤', '適法性', '依法應為', '程式違法']
    };
    
    // 取得有案件的律師
    const lawyers = await db.query(`
      SELECT lp.id, lp.name 
      FROM lawyer_profiles lp
      WHERE lp.total_cases > 0
      LIMIT 50
    `);
    
    let updated = 0;
    
    for (const lawyer of lawyers.rows || []) {
      // 取得此律師的判決書內文
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jfull LIKE '%${lawyer.name}%'
        LIMIT 20
      `);
      
      if (cases.rows.length === 0) continue;
      
      // 統計風格分數
      const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleWeights)) {
          for (const kw of keywords) {
            if (text.includes(kw)) scores[style]++;
          }
        }
      }
      
      // 找出最高分的風格
      let maxStyle = '穩健型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          maxStyle = style;
        }
      }
      
      // 更新資料庫
      await db.query(`
        UPDATE lawyer_profiles 
        SET style = $1, total_cases = $2 
        WHERE id = $3
      `, [maxStyle, cases.rows.length, lawyer.id]);
      
      updated++;
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 取得防禦型律師
router.post('/get-defensive-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`
      SELECT name, specialty, court, total_cases, style 
      FROM lawyer_profiles 
      WHERE style = '防禦型' AND total_cases > 0
      ORDER BY total_cases DESC
      LIMIT 20
    `);
    res.json({ status: 'success', data: result.rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 擴充分析律師風格
router.post('/expand-lawyer-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleWeights = {
      '攻擊型': ['抗辯', '舉證', '請求', '主張', '侵權', '損害賠償', '違約', '應負'],
      '防禦型': ['否認', '辯稱', '誤會', '無過失', '不成立', '無因果', '不可歸責'],
      '妥協型': ['和解', '調解', '撤回', '願意賠償', '協商', '讓步', '調處'],
      '穩健型': ['證據', '依法', '應依', '程序', '管轄', '適法', '違法']
    };
    
    // 取得有案件的律師
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE total_cases > 0 AND (style IS NULL OR style = '')
      LIMIT 100
    `);
    
    let updated = 0;
    
    for (const lawyer of lawyers.rows || []) {
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jfull LIKE '%${lawyer.name}%'
        LIMIT 30
      `);
      
      if (cases.rows.length === 0) continue;
      
      const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleWeights)) {
          for (const kw of keywords) {
            if (text.includes(kw)) scores[style]++;
          }
        }
      }
      
      let maxStyle = '穩健型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; maxStyle = style; }
      }
      
      await db.query(`UPDATE lawyer_profiles SET style = $1 WHERE id = $2`, [maxStyle, lawyer.id]);
      updated++;
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 分析並平衡風格
router.post('/balance-lawyer-styles', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 擴充關鍵詞
    const styleKeywords = {
      '攻擊型': ['抗辯', '舉證', '請求', '主張', '侵權', '違約', '損害賠償', '應負', '過失責任'],
      '防禦型': ['否認', '辯稱', '誤會', '無過失', '不成立', '無因果', '不可歸責', '非因', '未侵權'],
      '妥協型': ['和解', '調解', '撤回', '願意賠償', '協商', '讓步', '調處', '訴訟和解'],
      '穩健型': ['證據顯示', '依法論', '管轄錯誤', '程式違法', '不備要件', '舉證責任']
    };
    
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE total_cases > 0
      LIMIT 50
    `);
    
    let updated = 0;
    
    for (const lawyer of lawyers.rows || []) {
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jfull LIKE '%${lawyer.name}%'
        LIMIT 30
      `);
      
      if (cases.rows.length === 0) continue;
      
      const counts = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) counts[style]++;
          }
        }
      }
      
      // 計算平均
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      
      // 找出最高分
      let maxStyle = '穩健型';
      let maxCount = 0;
      for (const [style, count] of Object.entries(counts)) {
        if (count > maxCount) { maxCount = count; maxStyle = style; }
      }
      
      await db.query(`UPDATE lawyer_profiles SET style = $1 WHERE id = $2`, [maxStyle, lawyer.id]);
      updated++;
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 智能分析律師風格（加權平均）
router.post('/smart-analyze-lawyer-styles', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 風格權重關鍵詞
    const styleKeywords = {
      '攻擊型': { keywords: ['抗辯', '請求權', '侵權行為', '損害賠償', '違約責任', '應負'], weight: 1.2 },
      '防禦型': { keywords: ['否認', '辯稱', '無過失', '不成立', '無因果關係', '不可歸責'], weight: 1.5 },
      '妥協型': { keywords: ['和解', '調解', '撤回告訴', '願意賠償', '訴訟上和解', '調處'], weight: 2.0 },
      '穩健型': { keywords: ['管轄錯誤', '程式違法', '不備要件', '舉證責任分配', '依法論'], weight: 1.8 }
    };
    
    const lawyers = await db.query(`SELECT id, name FROM lawyer_profiles WHERE total_cases > 0 LIMIT 20`);
    
    let updated = 0;
    
    for (const lawyer of lawyers.rows || []) {
      const cases = await db.query(`SELECT jfull FROM judgments WHERE jfull LIKE '%${lawyer.name}%' LIMIT 20`);
      if (cases.rows.length === 0) continue;
      
      const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, config] of Object.entries(styleKeywords)) {
          for (const kw of config.keywords) {
            if (text.includes(kw)) scores[style] += config.weight;
          }
        }
      }
      
      let maxStyle = '穩健型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; maxStyle = style; }
      }
      
      await db.query(`UPDATE lawyer_profiles SET style = $1 WHERE id = $2`, [maxStyle, lawyer.id]);
      updated++;
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 取得已分析的律師數量
router.post('/get-analyzed-count', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`SELECT COUNT(*) as count FROM lawyer_profiles WHERE total_cases > 0`);
    res.json({ status: 'success', count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 更新律師法院欄位（儲存多個法院）
router.post('/update-lawyer-courts', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 找出有多個法院的律師
    const lawyers = await db.query(`
      SELECT lawyer_name, array_agg(DISTINCT court) as courts, COUNT(*) as cnt
      FROM extracted_lawyers
      WHERE court IS NOT NULL AND court != ''
      GROUP BY lawyer_name
      HAVing COUNT(DISTINCT court) > 1
      LIMIT 100
    `);
    
    let updated = 0;
    
    for (const l of lawyers.rows || []) {
      const courts = l.courts.filter(c => c).join(',');
      await db.query(`
        UPDATE lawyer_profiles SET court = $1 WHERE name = $2
      `, [courts, l.lawyer_name]);
      updated++;
    }
    
    res.json({ status: 'success', updated, sample: lawyers.rows.slice(0, 5) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立法院欄位並更新
router.post('/migrate-lawyer-courts', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 新增 court 欄位（如果沒有）
    try { await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS court TEXT`); } catch(e) {}
    
    // 從 extracted_lawyers 統計每個律師的法院
    const lawyers = await db.query(`
      SELECT lawyer_name, array_agg(DISTINCT court) as courts
      FROM extracted_lawyers
      WHERE court IS NOT NULL AND court != ''
      GROUP BY lawyer_name
    `);
    
    let updated = 0;
    for (const l of lawyers.rows || []) {
      const courts = (l.courts || []).filter(c => c).join(',');
      if (courts) {
        await db.query(`UPDATE lawyer_profiles SET court = $1 WHERE name = $2`, [courts, l.lawyer_name]);
        updated++;
      }
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 初始化律師法院資料
router.post('/init-lawyer-courts', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立欄位
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS court TEXT`).catch(()=>{});
    
    // 取得每個律師的所有法院
    const result = await db.query(`
      SELECT el.lawyer_name, array_agg(DISTINCT el.court) as courts
      FROM extracted_lawyers el
      WHERE el.court IS NOT NULL AND el.court != ''
      GROUP BY el.lawyer_name
    `);
    
    let updated = 0;
    for (const row of result.rows || []) {
      const courts = (row.courts || []).filter(c => c && c.trim()).join(',');
      if (courts) {
        await db.query(`UPDATE lawyer_profiles SET court = $1 WHERE name = $2`, [courts, row.lawyer_name]);
        updated++;
      }
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 檢查表格結構
router.post('/check-tables', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 檢查 extracted_lawyers 欄位
    const el = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'extracted_lawyers'`);
    
    // 檢查 lawyer_profiles 欄位
    const lp = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'lawyer_profiles'`);
    
    res.json({ 
      extracted_lawyers: el.rows.map(r => r.column_name),
      lawyer_profiles: lp.rows.map(r => r.column_name)
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 從判決書取得律師的法院並更新
router.post('/sync-lawyer-courts', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 確保 court 欄位存在
    await db.query(`ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS court TEXT`).catch(()=>{});
    
    // 從 judgments 取得法院資訊（jid 前4碼）
    const result = await db.query(`
      SELECT lp.id, lp.name, 
        array_agg(DISTINCT SUBSTRING(j.jid FROM 1 FOR 4)) as courts
      FROM lawyer_profiles lp
      JOIN judgments j ON j.jfull LIKE '%' || lp.name || '%'
      GROUP BY lp.id, lp.name
      LIMIT 200
    `);
    
    let updated = 0;
    for (const row of result.rows || []) {
      const courts = (row.courts || []).filter(c => c).join(',');
      await db.query(`UPDATE lawyer_profiles SET court = $1 WHERE id = $2`, [courts, row.id]);
      updated++;
    }
    
    res.json({ status: 'success', updated });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 檢查律師數量詳細
router.post('/check-lawyer-count', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const total = await db.query('SELECT COUNT(*) as count FROM lawyer_profiles');
    const withCases = await db.query('SELECT COUNT(*) as count FROM lawyer_profiles WHERE total_cases > 0');
    const unique = await db.query('SELECT COUNT(DISTINCT name) as count FROM lawyer_profiles');
    
    res.json({ 
      total: parseInt(total.rows[0].count),
      with_cases: parseInt(withCases.rows[0].count),
      unique_names: parseInt(unique.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 完整流程：提取案件並分析風格
router.post('/full-lawyer-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '攻擊型': ['質疑', '漏洞', '錯誤', '不成立', '矛盾', '反駁', '駁斥', '有利', '優勢', '應當', '違法'],
      '防禦型': ['否認', '抗辯', '程序', '合法', '正當', '權利', '保護', '異議', '救濟', '舉證責任', '撤銷', '駁回'],
      '妥協型': ['協商', '調解', '和解', '讓步', '共識', '合作', '善意', '體諒', '平衡', '務實'],
      '穩健型': ['依法', '依據', '規定', '法條', '構成', '要件', '事實', '證據', '分析', '認為', '可能']
    };
    
    // 取得需要處理的律師（沒有案件數據的）
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE total_cases IS NULL OR total_cases = 0
      LIMIT 50
    `);
    
    let processed = 0;
    
    for (const lawyer of lawyers.rows || []) {
      // 1. 搜尋判決書全文
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jfull LIKE '%' || $1 || '%'
        LIMIT 100
      `, [lawyer.name]);
      
      const caseCount = cases.rows.length;
      
      if (caseCount === 0) continue;
      
      // 2. 計算出現次數 & 3. 分析風格
      const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      
      for (const c of cases.rows) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) scores[style]++;
          }
        }
      }
      
      // 找出最高分風格
      let maxStyle = '穩健型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; maxStyle = style; }
      }
      
      // 4. 更新資料庫
      await db.query(`
        UPDATE lawyer_profiles 
        SET total_cases = $1, style = $2 
        WHERE id = $3
      `, [caseCount, maxStyle, lawyer.id]);
      
      processed++;
    }
    
    res.json({ status: 'success', processed });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 批次處理律師分析（每次10位）
router.post('/batch-lawyer-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '攻擊型': ['質疑', '漏洞', '錯誤', '不成立', '矛盾', '反駁', '駁斥', '有利', '優勢', '應當', '違法'],
      '防禦型': ['否認', '抗辯', '程序', '合法', '正當', '權利', '保護', '異議', '救濟', '舉證責任', '撤銷', '駁回'],
      '妥協型': ['協商', '調解', '和解', '讓步', '共識', '合作', '善意', '體諒', '平衡', '務實'],
      '穩健型': ['依法', '依據', '規定', '法條', '構成', '要件', '事實', '證據', '分析', '認為', '可能']
    };
    
    // 每次處理10位律師
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE (total_cases IS NULL OR total_cases = 0)
      LIMIT 10
    `);
    
    if (lawyers.rows.length === 0) {
      return res.json({ status: 'done', message: 'All lawyers processed' });
    }
    
    let processed = 0;
    
    for (const lawyer of lawyers.rows) {
      try {
        const cases = await db.query(`
          SELECT jfull FROM judgments 
          WHERE jfull LIKE '%' || $1 || '%'
          LIMIT 50
        `, [lawyer.name]);
        
        const caseCount = cases.rows.length;
        if (caseCount === 0) continue;
        
        const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
        
        for (const c of cases.rows) {
          const text = c.jfull || '';
          for (const [style, keywords] of Object.entries(styleKeywords)) {
            for (const kw of keywords) {
              if (text.includes(kw)) scores[style]++;
            }
          }
        }
        
        let maxStyle = '穩健型';
        let maxScore = 0;
        for (const [style, score] of Object.entries(scores)) {
          if (score > maxScore) { maxScore = score; maxStyle = style; }
        }
        
        await db.query(`
          UPDATE lawyer_profiles 
          SET total_cases = $1, style = $2 
          WHERE id = $3
        `, [caseCount, maxStyle, lawyer.id]);
        
        processed++;
      } catch (e) {
        console.error(`Error processing ${lawyer.name}:`, e.message);
      }
    }
    
    // 取得剩餘數量
    const remaining = await db.query(`
      SELECT COUNT(*) as count FROM lawyer_profiles 
      WHERE total_cases IS NULL OR total_cases = 0
    `);
    
    res.json({ 
      status: 'success', 
      processed, 
      remaining: parseInt(remaining.rows[0].count),
      next: 'Call this endpoint again to continue'
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立律師-案件快取表
router.post('/build-lawyer-cache', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立快取表格
    await db.query(`
      CREATE TABLE IF NOT EXISTS lawyer_case_cache (
        id SERIAL PRIMARY KEY,
        lawyer_id INTEGER,
        lawyer_name TEXT,
        jid TEXT,
        court TEXT,
        case_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(()=>{});
    
    // 建立索引
    await db.query(`CREATE INDEX IF NOT EXISTS idx_lawyer_cache_name ON lawyer_case_cache(lawyer_name)`).catch(()=>{});
    await db.query(`CREATE INDEX IF NOT EXISTS idx_lawyer_cache_lawyer_id ON lawyer_case_cache(lawyer_id)`).catch(()=>{});
    
    // 取得所有律師
    const lawyers = await db.query(`SELECT id, name FROM lawyer_profiles LIMIT 500`);
    
    let cached = 0;
    
    for (const lawyer of lawyers.rows) {
      try {
        // 從判決書找出該律師的案件
        const cases = await db.query(`
          SELECT jid, SUBSTRING(jid FROM 1 FOR 4) as court, jcase
          FROM judgments 
          WHERE jfull LIKE '%' || $1 || '%'
          LIMIT 200
        `, [lawyer.name]);
        
        for (const c of cases.rows) {
          await db.query(`
            INSERT INTO lawyer_case_cache (lawyer_id, lawyer_name, jid, court, case_type)
            VALUES ($1, $2, $3, $4, $5)
          `, [lawyer.id, lawyer.name, c.jid, c.court, c.jcase]);
        }
        
        // 更新律師的案件數
        await db.query(`
          UPDATE lawyer_profiles SET total_cases = $1 WHERE id = $2
        `, [cases.rows.length, lawyer.id]);
        
        cached += cases.rows.length;
      } catch (e) {
        console.error(`Error caching ${lawyer.name}:`, e.message);
      }
    }
    
    res.json({ status: 'success', cached_records: cached, lawyers_processed: lawyers.rows.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 取得快取狀態
router.post('/get-cache-status', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const cacheCount = await db.query(`SELECT COUNT(*) as count FROM lawyer_case_cache`);
    const lawyerCount = await db.query(`SELECT COUNT(*) as count FROM lawyer_profiles WHERE total_cases > 0`);
    
    res.json({ 
      cache_records: parseInt(cacheCount.rows[0].count),
      lawyers_with_cases: parseInt(lawyerCount.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 快速批次分析（減少搜尋量）
router.post('/quick-batch-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '攻擊型': ['抗辯', '請求', '主張', '侵權', '違約', '損害賠償'],
      '防禦型': ['否認', '辯稱', '無過失', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '協商'],
      '穩健型': ['依法', '證據', '程序', '管轄']
    };
    
    // 每次處理5位，只搜尋20筆判決書
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE (total_cases IS NULL OR total_cases = 0)
      LIMIT 5
    `);
    
    if (lawyers.rows.length === 0) {
      return res.json({ status: 'done', message: 'All lawyers processed' });
    }
    
    let processed = 0;
    
    for (const lawyer of lawyers.rows) {
      try {
        // 限制只搜尋20筆
        const cases = await db.query(`
          SELECT jfull FROM judgments 
          WHERE jfull LIKE '%' || $1 || '%'
          LIMIT 20
        `, [lawyer.name]);
        
        const caseCount = cases.rows.length;
        if (caseCount === 0) continue;
        
        const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
        
        for (const c of cases.rows) {
          const text = c.jfull || '';
          for (const [style, keywords] of Object.entries(styleKeywords)) {
            for (const kw of keywords) {
              if (text.includes(kw)) scores[style]++;
            }
          }
        }
        
        let maxStyle = '穩健型';
        let maxScore = 0;
        for (const [style, score] of Object.entries(scores)) {
          if (score > maxScore) { maxScore = score; maxStyle = style; }
        }
        
        await db.query(`
          UPDATE lawyer_profiles 
          SET total_cases = $1, style = $2 
          WHERE id = $3
        `, [caseCount, maxStyle, lawyer.id]);
        
        processed++;
      } catch (e) {
        console.error(`Error: ${e.message}`);
      }
    }
    
    res.json({ status: 'success', processed, remaining: 'Call again to continue' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立律師案件快取表（優化版）
router.post('/build-lawyer-cache-v2', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立快取表
    await db.query(`
      CREATE TABLE IF NOT EXISTS lawyer_case_cache_v2 (
        id SERIAL PRIMARY KEY,
        lawyer_id INTEGER,
        lawyer_name TEXT,
        jid TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(()=>{});
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_lc_name ON lawyer_case_cache_v2(lawyer_name)`).catch(()=>{});
    
    // 每次處理 10 位律師
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE id NOT IN (SELECT DISTINCT lawyer_id FROM lawyer_case_cache_v2 WHERE lawyer_id IS NOT NULL)
      LIMIT 10
    `);
    
    if (lawyers.rows.length === 0) {
      return res.json({ status: 'done', message: 'All lawyers cached' });
    }
    
    let cached = 0;
    
    for (const lawyer of lawyers.rows) {
      try {
        const cases = await db.query(`
          SELECT jid FROM judgments 
          WHERE jfull LIKE '%' || $1 || '%'
          LIMIT 100
        `, [lawyer.name]);
        
        for (const c of cases.rows) {
          await db.query(`
            INSERT INTO lawyer_case_cache_v2 (lawyer_id, lawyer_name, jid)
            VALUES ($1, $2, $3)
          `, [lawyer.id, lawyer.name, c.jid]);
        }
        
        // 更新案件數
        await db.query(`
          UPDATE lawyer_profiles SET total_cases = $1 WHERE id = $2
        `, [cases.rows.length, lawyer.id]);
        
        cached += cases.rows.length;
      } catch (e) {
        console.error(`Error: ${e.message}`);
      }
    }
    
    const remaining = await db.query(`SELECT COUNT(*) as count FROM lawyer_profiles WHERE id NOT IN (SELECT DISTINCT lawyer_id FROM lawyer_case_cache_v2 WHERE lawyer_id IS NOT NULL)`);
    
    res.json({ status: 'success', cached, remaining: parseInt(remaining.rows[0].count), next: 'Call again to continue' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 分析法官風格
router.post('/batch-judge-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '嚴謹型': ['程序違法', '證據不足', '依法論', '不備要件', '舉證責任', '管轄錯誤', '程式不符'],
      '寬容型': ['酌情', '寬容', '給予機會', '從輕', '衡平', '特殊情況', '考量'],
      '效率型': ['和解', '調解', '撤回', '調處', '協議', '簡便'],
      '強硬型': ['駁回', '嚴懲', '不予採納', '維持', '確定', '無理由', '應予']
    };
    
    // 每次處理5位法官
    const judges = await db.query(`
      SELECT id, name, court FROM extracted_judges 
      GROUP BY id, name, court
      HAVING COUNT(*) > 0
      LIMIT 5
    `);
    
    if (judges.rows.length === 0) {
      return res.json({ status: 'done', message: 'No more judges' });
    }
    
    let processed = 0;
    
    for (const judge of judges.rows) {
      try {
        const cases = await db.query(`
          SELECT jfull FROM judgments 
          WHERE jid LIKE $1 || '%'
          LIMIT 20
        `, [judge.court]);
        
        if (cases.rows.length === 0) continue;
        
        const scores = { '嚴謹型': 0, '寬容型': 0, '效率型': 0, '強硬型': 0 };
        
        for (const c of cases.rows) {
          const text = c.jfull || '';
          for (const [style, keywords] of Object.entries(styleKeywords)) {
            for (const kw of keywords) {
              if (text.includes(kw)) scores[style]++;
            }
          }
        }
        
        let maxStyle = '嚴謹型';
        let maxScore = 0;
        for (const [style, score] of Object.entries(scores)) {
          if (score > maxScore) { maxScore = score; maxStyle = style; }
        }
        
        // 更新或新增法官資料
        await db.query(`
          INSERT INTO judge_profiles (name, court, total_cases, style)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (name) DO UPDATE SET style = EXCLUDED.style, total_cases = EXCLUDED.total_cases
        `, [judge.name, judge.court, cases.rows.length, maxStyle]);
        
        processed++;
      } catch (e) {
        console.error(`Error: ${e.message}`);
      }
    }
    
    res.json({ status: 'success', processed, next: 'Call again to continue' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立法官資料表並分析
router.post('/init-judge-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 建立法官資料表
    await db.query(`
      CREATE TABLE IF NOT EXISTS judge_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT,
        court TEXT,
        total_cases INTEGER DEFAULT 0,
        style TEXT,
        specialty TEXT
      )
    `).catch(()=>{});
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_judge_profiles_name ON judge_profiles(name)`).catch(()=>{});
    
    const styleKeywords = {
      '嚴謹型': ['程序違法', '證據不足', '依法論', '不備要件', '舉證責任'],
      '寬容型': ['酌情', '寬容', '給予機會', '從輕', '衡平'],
      '效率型': ['和解', '調解', '撤回', '調處'],
      '強硬型': ['駁回', '嚴懲', '維持', '確定', '無理由']
    };
    
    // 取得法官列表
    const judges = await db.query(`
      SELECT judge_name, court, COUNT(*) as cnt
      FROM extracted_judges
      GROUP BY judge_name, court
      LIMIT 10
    `);
    
    let processed = 0;
    
    for (const judge of judges.rows) {
      const name = judge.judge_name;
      const court = judge.court;
      const caseCount = parseInt(judge.cnt);
      
      // 取得判決書分析風格
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jid LIKE $1 || '%'
        LIMIT 20
      `, [court]);
      
      const scores = { '嚴謹型': 0, '寬容型': 0, '效率型': 0, '強硬型': 0 };
      
      for (const c of cases.rows || []) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) scores[style]++;
          }
        }
      }
      
      let maxStyle = '嚴謹型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; maxStyle = style; }
      }
      
      // 儲存
      await db.query(`
        INSERT INTO judge_profiles (name, court, total_cases, style)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET style = EXCLUDED.style, total_cases = EXCLUDED.total_cases
      `, [name, court, caseCount, maxStyle]);
      
      processed++;
    }
    
    res.json({ status: 'success', processed });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 建立法官資料表並分析v2
router.post('/init-judge-analysis-v2', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS judge_profiles_v2 (
        id SERIAL PRIMARY KEY,
        name TEXT,
        court TEXT,
        total_cases INTEGER DEFAULT 0,
        style TEXT,
        UNIQUE(name, court)
      )
    `).catch(()=>{});
    
    const styleKeywords = {
      '嚴謹型': ['程序違法', '證據不足', '依法論', '不備要件', '舉證責任'],
      '寬容型': ['酌情', '寬容', '給予機會', '從輕', '衡平'],
      '效率型': ['和解', '調解', '撤回', '調處'],
      '強硬型': ['駁回', '嚴懲', '維持', '確定', '無理由']
    };
    
    const judges = await db.query(`
      SELECT judge_name, court, COUNT(*) as cnt
      FROM extracted_judges
      GROUP BY judge_name, court
      LIMIT 10
    `);
    
    let processed = 0;
    
    for (const judge of judges.rows) {
      const name = judge.judge_name;
      const court = judge.court;
      const caseCount = parseInt(judge.cnt);
      
      const cases = await db.query(`
        SELECT jfull FROM judgments 
        WHERE jid LIKE $1 || '%'
        LIMIT 20
      `, [court]);
      
      const scores = { '嚴謹型': 0, '寬容型': 0, '效率型': 0, '強硬型': 0 };
      
      for (const c of cases.rows || []) {
        const text = c.jfull || '';
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          for (const kw of keywords) {
            if (text.includes(kw)) scores[style]++;
          }
        }
      }
      
      let maxStyle = '嚴謹型';
      let maxScore = 0;
      for (const [style, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; maxStyle = style; }
      }
      
      await db.query(`
        INSERT INTO judge_profiles_v2 (name, court, total_cases, style)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name, court) DO UPDATE SET style = EXCLUDED.style, total_cases = EXCLUDED.total_cases
      `, [name, court, caseCount, maxStyle]);
      
      processed++;
    }
    
    res.json({ status: 'success', processed });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 取得法官分析數量
router.post('/get-judge-analyzed-count', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`SELECT COUNT(*) as count FROM judge_profiles_v2 WHERE style IS NOT NULL`);
    res.json({ status: 'success', count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 穩定版分析（每次1位）
router.post('/stable-batch-analysis', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    const styleKeywords = {
      '攻擊型': ['抗辯', '請求', '主張', '侵權', '違約'],
      '防禦型': ['否認', '辯稱', '無過失', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '協商'],
      '穩健型': ['依法', '證據', '程序', '管轄']
    };
    
    // 每次只處理1位
    const lawyers = await db.query(`
      SELECT id, name FROM lawyer_profiles 
      WHERE (total_cases IS NULL OR total_cases = 0)
      LIMIT 1
    `);
    
    if (lawyers.rows.length === 0) {
      return res.json({ status: 'done', message: 'All lawyers processed' });
    }
    
    const lawyer = lawyers.rows[0];
    
    const cases = await db.query(`
      SELECT jfull FROM judgments 
      WHERE jfull LIKE '%' || $1 || '%'
      LIMIT 15
    `, [lawyer.name]);
    
    const caseCount = cases.rows.length;
    if (caseCount === 0) {
      return res.json({ status: 'skip', name: lawyer.name });
    }
    
    const scores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
    
    for (const c of cases.rows) {
      const text = c.jfull || '';
      for (const [style, keywords] of Object.entries(styleKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) scores[style]++;
        }
      }
    }
    
    let maxStyle = '穩健型';
    let maxScore = 0;
    for (const [style, score] of Object.entries(scores)) {
      if (score > maxScore) { maxScore = score; maxStyle = style; }
    }
    
    await db.query(`
      UPDATE lawyer_profiles SET total_cases = $1, style = $2 WHERE id = $3
    `, [caseCount, maxStyle, lawyer.id]);
    
    res.json({ status: 'success', processed: 1, name: lawyer.name, cases: caseCount, style: maxStyle });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 測試版：分析前10筆判決書
router.post('/test-10-judgments', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 風格關鍵詞
    const styleKeywords = {
      '攻擊型': ['抗辯', '請求', '主張', '侵權', '違約', '損害賠償'],
      '防禦型': ['否認', '辯稱', '無過失', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '協商'],
      '穩健型': ['依法', '證據', '程序', '管轄']
    };
    
    const judgeKeywords = {
      '嚴謹型': ['程序違法', '證據不足', '依法論', '不備要件'],
      '寬容型': ['酌情', '寬容', '給予機會', '從輕'],
      '效率型': ['和解', '調解', '撤回', '調處'],
      '強硬型': ['駁回', '嚴懲', '維持', '確定']
    };
    
    // 取得前10筆判決書
    const judgments = await db.query(`
      SELECT jid, jfull FROM judgments 
      ORDER BY jid ASC
      LIMIT 10
    `);
    
    const results = [];
    
    for (const j of judgments.rows) {
      const text = j.jfull || '';
      const jid = j.jid;
      
      // 提取法官（從判決書通常可見）
      const judgeMatches = text.match(/(?:法官|審判長|受命法官)[^\n]{0,20}/g) || [];
      
      // 提取律師
      const lawyerMatches = text.match(/(?:律師|訴訟代理人)[^\n]{0,20}/g) || [];
      
      // 提取檢察官
      const prosecutorMatches = text.match(/(?:檢察官|檢察署)[^\n]{0,20}/g) || [];
      
      // 計算法官風格
      const judgeScores = { '嚴謹型': 0, '寬容型': 0, '效率型': 0, '強硬型': 0 };
      for (const [style, keywords] of Object.entries(judgeKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) judgeScores[style]++;
        }
      }
      
      // 計算律師風格
      const lawyerScores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      for (const [style, keywords] of Object.entries(styleKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) lawyerScores[style]++;
        }
      }
      
      results.push({
        jid,
        judges: judgeMatches.slice(0, 3),
        lawyers: lawyerMatches.slice(0, 5),
        prosecutors: prosecutorMatches.slice(0, 3),
        judge_style: Object.entries(judgeScores).sort((a,b) => b[1]-a[1])[0][0],
        lawyer_style: Object.entries(lawyerScores).sort((a,b) => b[1]-a[1])[0][0]
      });
    }
    
    res.json({ status: 'success', count: results.length, results });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 測試版：分析前10筆判決書（含計時）
router.post('/test-10-timed', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const styleKeywords = {
      '攻擊型': ['抗辯', '請求', '主張', '侵權', '違約', '損害賠償'],
      '防禦型': ['否認', '辯稱', '無過失', '不成立'],
      '妥協型': ['和解', '調解', '撤回', '協商'],
      '穩健型': ['依法', '證據', '程序', '管轄']
    };
    
    const judgeKeywords = {
      '嚴謹型': ['程序違法', '證據不足', '依法論', '不備要件'],
      '寬容型': ['酌情', '寬容', '給予機會', '從輕'],
      '效率型': ['和解', '調解', '撤回', '調處'],
      '強硬型': ['駁回', '嚴懲', '維持', '確定']
    };
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    
    const results = [];
    let totalJudgeTime = 0;
    let totalLawyerTime = 0;
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const itemStart = Date.now();
      
      const text = j.jfull || '';
      
      // 提取法官
      const judgeTimeStart = Date.now();
      const judgeMatches = text.match(/(?:法官|審判長|受命法官)[^\n]{0,20}/g) || [];
      const judgeExtractTime = Date.now() - judgeTimeStart;
      totalJudgeTime += judgeExtractTime;
      
      // 提取律師
      const lawyerTimeStart = Date.now();
      const lawyerMatches = text.match(/(?:律師|訴訟代理人)[^\n]{0,20}/g) || [];
      const lawyerExtractTime = Date.now() - lawyerTimeStart;
      totalLawyerTime += lawyerExtractTime;
      
      // 提取檢察官
      const prosecutorMatches = text.match(/(?:檢察官|檢察署)[^\n]{0,20}/g) || [];
      
      // 法官風格分析
      const judgeScores = { '嚴謹型': 0, '寬容型': 0, '效率型': 0, '強硬型': 0 };
      for (const [style, keywords] of Object.entries(judgeKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) judgeScores[style]++;
        }
      }
      
      // 律師風格分析
      const lawyerScores = { '攻擊型': 0, '防禦型': 0, '妥協型': 0, '穩健型': 0 };
      for (const [style, keywords] of Object.entries(styleKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) lawyerScores[style]++;
        }
      }
      
      const itemTime = Date.now() - itemStart;
      
      results.push({
        index: i + 1,
        jid: j.jid,
        item_time_ms: itemTime,
        judge_extract_ms: judgeExtractTime,
        lawyer_extract_ms: lawyerExtractTime,
        judges_found: judgeMatches.length,
        lawyers_found: lawyerMatches.length,
        prosecutors_found: prosecutorMatches.length,
        judge_style: Object.entries(judgeScores).sort((a,b) => b[1]-a[1])[0][0],
        lawyer_style: Object.entries(lawyerScores).sort((a,b) => b[1]-a[1])[0][0]
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      avg_per_item_ms: Math.round(totalTime / results.length),
      total_judge_extract_ms: totalJudgeTime,
      total_lawyer_extract_ms: totalLawyerTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取優化版測試
router.post('/test-name-extraction', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    // 優化的姓名提取正則
    // 法官
    const judgePatterns = [
      /(?:法官|審判長|受命法官|陪席法官)[：:\s]*([\u4e00-\u9fa5]{2,4})/g,
      /裁定[\s\n]*([\u4e00-\u9fa5]{2,4})[\s\n]*法官/g,
      /判令[\s\n]*([\u4e00-\u9fa5]{2,4})/g
    ];
    
    // 律師
    const lawyerPatterns = [
      /(?:律師|訴訟代理人|選任辯護人)[\s\n]*([\u4e00-\u9fa5]{2,4})/g,
      /([\u4e00-\u9fa5]{2,4})律師/g,
      /(?:被告|原告|上訴人|被上訴人|告訴人|辯護人)[\s\n]*([\u4e00-\u9fa5]{2,4})/g
    ];
    
    // 檢察官
    const prosecutorPatterns = [
      /(?:檢察官|檢察署|檢察長)[\s\n]*([\u4e00-\u9fa5]{2,4})/g,
      /([\u4e00-\u9fa5]{2,4})檢察官/g
    ];
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 提取法官
      let judges = [];
      for (const pattern of judgePatterns) {
        const matches = text.match(pattern);
        if (matches) judges.push(...matches);
      }
      judges = [...new Set(judges)].slice(0, 5);
      
      // 提取律師
      let lawyers = [];
      for (const pattern of lawyerPatterns) {
        const matches = text.match(pattern);
        if (matches) lawyers.push(...matches);
      }
      lawyers = [...new Set(lawyers)].slice(0, 10);
      
      // 提取檢察官
      let prosecutors = [];
      for (const pattern of prosecutorPatterns) {
        const matches = text.match(pattern);
        if (matches) prosecutors.push(...matches);
      }
      prosecutors = [...new Set(prosecutors)].slice(0, 5);
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: judges,
        lawyers: lawyers,
        prosecutors: prosecutors
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 檢查判決書內容
router.post('/check-judgment-content', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 1`);
    
    if (result.rows.length > 0) {
      const jfull = result.rows[0].jfull || '';
      res.json({ 
        jid: result.rows[0].jid,
        length: jfull.length,
        sample: jfull.substring(0, 2000)
      });
    } else {
      res.json({ error: 'No judgments found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 姓名提取優化版v2
router.post('/test-name-extraction-v2', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：法官 姓名、審判長 姓名
      const judges = [];
      const judgeMatches = text.match(/[法官|審判長|受命法官|陪席法官][\s\n]*([\u4e00-\u9fa5]{2,4})/g);
      if (judgeMatches) {
        for (const m of judgeMatches) {
          const name = m.replace(/[法官|審判長|受命法官|陪席法官][\s\n]*/g, '').trim();
          if (name.length >= 2) judges.push(name);
        }
      }
      
      // 書記官
      const clerkMatch = text.match(/書記官[\s\n]*([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatch) judges.push(clerkMatch[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatches = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatches) {
        for (const m of lawyerMatches) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2 && !name.includes('律師')) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatches = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatches) {
        for (const m of prosecutorMatches) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取最終版
router.post('/test-name-extraction-v3', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：找到 "法官" 或 "審判長" 後面的2-4個中文字
      const judges = [];
      const judgePattern = /(?:法官|審判長|受命法官|陪席法官)[^a-zA-Z0-9\u4e00-\u9fa5]*([\u4e00-\u9fa5]{2,4})/g;
      let match;
      while ((match = judgePattern.exec(text)) !== null) {
        const name = match[1];
        // 過濾掉常見非姓名詞
        if (!['裁定', '主文', '事實', '理由', '證據', '法院', '本院', '案件', '當事人'].includes(name)) {
          judges.push(name);
        }
      }
      
      // 書記官
      const clerks = [];
      const clerkPattern = /書記官[^a-zA-Z0-9\u4e00-\u9fa5]*([\u4e00-\u9fa5]{2,4})/g;
      while ((match = clerkPattern.exec(text)) !== null) {
        clerks.push(match[1]);
      }
      
      // 律師
      const lawyers = [];
      const lawyerPattern = /([\u4e00-\u9fa5]{2,4})律師/g;
      while ((match = lawyerPattern.exec(text)) !== null) {
        const name = match[1];
        // 過濾
        if (!['律師', '律師聲', '律師請'].includes(name)) {
          lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorPattern = /([\u4e00-\u9fa5]{2,4})檢察官/g;
      while ((match = prosecutorPattern.exec(text)) !== null) {
        prosecutors.push(match[1]);
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取最終優化版
router.post('/test-name-extraction-v4', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：結尾的 "法官 姓名" 或 "法 官 姓名"
      const judges = [];
      const judgePatterns = [
        /法官[\s\n]*([\u4e00-\u9fa5]{2,4})[\s\n]*$/m,
        /([\u4e00-\u9fa5]{2,4})[\s\n]*法官[\s\n]*$/m,
        /審判長[\s\n]*([\u4e00-\u9fa5]{2,4})/,
        /受命法官[\s\n]*([\u4e00-\u9fa5]{2,4})/
      ];
      
      for (const pattern of judgePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          if (matches[1]) judges.push(matches[1]);
        }
      }
      
      // 書記官
      const clerks = [];
      const clerkMatches = text.match(/書記官[\s\n]*([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatches && clerkMatches[1]) clerks.push(clerkMatches[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatches = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatches) {
        for (const m of lawyerMatches) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatches = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatches) {
        for (const m of prosecutorMatches) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取最終優化版v5
router.post('/test-name-extraction-v5', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：支援多種空白格式
      const judges = [];
      const judgePatterns = [
        /法官\s+([\u4e00-\u9fa5]{2,4})/g,
        /法官　+([\u4e00-\u9fa5]{2,4})/g,
        /([\u4e00-\u9fa5]{2,4})\s+法官/g,
        /審判長\s+([\u4e00-\u9fa5]{2,4})/g
      ];
      
      for (const pattern of judgePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (match[1]) judges.push(match[1]);
        }
      }
      
      // 書記官
      const clerks = [];
      const clerkMatch = text.match(/書記官\s+([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatch && clerkMatch[1]) clerks.push(clerkMatch[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatch = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatch) {
        for (const m of lawyerMatch) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatch = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatch) {
        for (const m of prosecutorMatch) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取最終優化版v6
router.post('/test-name-extraction-v6', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：嘗試多種模式
      const judges = [];
      
      // 直接從結尾找 "法官" 後面的姓名
      const lastJudgeMatch = text.match(/法官\s*([\u4e00-\u9fa5]{2,4})/);
      if (lastJudgeMatch && lastJudgeMatch[1]) {
        judges.push(lastJudgeMatch[1]);
      }
      
      // 找 "簡易庭" 後面的法官
      const courtMatch = text.match(/簡易庭[^\u4e00-\u9fa5]*法官\s*([\u4e00-\u9fa5]{2,4})/);
      if (courtMatch && courtMatch[1]) {
        judges.push(courtMatch[1]);
      }
      
      // 書記官
      const clerks = [];
      const clerkMatch = text.match(/書記官\s*([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatch && clerkMatch[1]) clerks.push(clerkMatch[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatch = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatch) {
        for (const m of lawyerMatch) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatch = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatch) {
        for (const m of prosecutorMatch) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 檢查原始格式
router.post('/check-raw-format', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const result = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 1`);
    
    if (result.rows.length > 0) {
      const jfull = result.rows[0].jfull || '';
      // 找最後100個字
      const last100 = jfull.slice(-200);
      res.json({ 
        jid: result.rows[0].jid,
        last_chars: last100,
        length: jfull.length
      });
    } else {
      res.json({ error: 'No data' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 姓名提取最終優化版v7（根據實際格式）
router.post('/test-name-extraction-v7', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    const judgments = await db.query(`SELECT jid, jfull FROM judgments ORDER BY jid ASC LIMIT 10`);
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官：支援 "法 官  吳思怡" 格式（中間有空格）
      const judges = [];
      const judgePatterns = [
        /法\s*官\s+([\u4e00-\u9fa5]{2,4})/g,
        /簡易庭[^\n]*法\s*官\s+([\u4e00-\u9fa5]{2,4})/g,
        /法官\s*([\u4e00-\u9fa5]{2,4})/g,
        /審判長\s+([\u4e00-\u9fa5]{2,4})/g
      ];
      
      for (const pattern of judgePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (match[1]) judges.push(match[1]);
        }
      }
      
      // 書記官
      const clerks = [];
      const clerkMatch = text.match(/書記官\s+([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatch && clerkMatch[1]) clerks.push(clerkMatch[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatch = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatch) {
        for (const m of lawyerMatch) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatch = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatch) {
        for (const m of prosecutorMatch) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 姓名提取（有律師的判決書）
router.post('/test-with-lawyers', async (req, res) => {
  try {
    const db = require('../db/postgres');
    const startTime = Date.now();
    
    // 找有律師的判決書
    const judgments = await db.query(`
      SELECT jid, jfull FROM judgments 
      WHERE jfull LIKE '%律師%'
      ORDER BY jid ASC
      LIMIT 10
    `);
    
    const results = [];
    
    for (let i = 0; i < judgments.rows.length; i++) {
      const j = judgments.rows[i];
      const text = j.jfull || '';
      
      // 法官
      const judges = [];
      const judgeMatch = text.match(/法\s*官\s+([\u4e00-\u9fa5]{2,4})/);
      if (judgeMatch && judgeMatch[1]) judges.push(judgeMatch[1]);
      
      // 書記官
      const clerks = [];
      const clerkMatch = text.match(/書記官\s+([\u4e00-\u9fa5]{2,4})/);
      if (clerkMatch && clerkMatch[1]) clerks.push(clerkMatch[1]);
      
      // 律師
      const lawyers = [];
      const lawyerMatch = text.match(/([\u4e00-\u9fa5]{2,4})律師/g);
      if (lawyerMatch) {
        for (const m of lawyerMatch) {
          const name = m.replace('律師', '').trim();
          if (name.length >= 2) lawyers.push(name);
        }
      }
      
      // 檢察官
      const prosecutors = [];
      const prosecutorMatch = text.match(/([\u4e00-\u9fa5]{2,4})檢察官/g);
      if (prosecutorMatch) {
        for (const m of prosecutorMatch) {
          const name = m.replace('檢察官', '').trim();
          if (name.length >= 2) prosecutors.push(name);
        }
      }
      
      results.push({
        index: i + 1,
        jid: j.jid,
        judges: [...new Set(judges)].slice(0, 5),
        clerks: [...new Set(clerks)].slice(0, 3),
        lawyers: [...new Set(lawyers)].slice(0, 10),
        prosecutors: [...new Set(prosecutors)].slice(0, 5)
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    res.json({ 
      status: 'success', 
      count: results.length,
      total_time_ms: totalTime,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});


// 建立唯一約束
router.post('/setup-unique-constraints', async (req, res) => {
  try {
    const db = require('../db/postgres');
    
    // 律師表唯一約束
    await db.query(`
      ALTER TABLE lawyer_profiles ADD CONSTRAINT uk_lawyer_name UNIQUE (name)
    `).catch(() => {});
    
    // 法官表唯一約束
    await db.query(`
      ALTER TABLE judge_profiles ADD CONSTRAINT uk_judge_name UNIQUE (name)
    `).catch(() => {});
    
    res.json({ status: 'success', message: 'Unique constraints created' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});
