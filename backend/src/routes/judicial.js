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
