const DB_QUERY_TIMEOUT_MS = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '5000', 10);

// ===== 記憶體快取設定 =====
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時
const caseTypeStatsCache = {
  data: null,
  timestamp: null
};

function createTimeoutError() {
 const error = new Error('資料庫查詢逾時，請稍後再試');
 error.code = 'DB_TIMEOUT';
 return error;
}

// 快取輔助函數
function getCachedCaseTypeStats() {
 if (!caseTypeStatsCache.data) return null;
 if (Date.now() - caseTypeStatsCache.timestamp > CACHE_TTL_MS) {
   // 快取過期，清除
   caseTypeStatsCache.data = null;
   caseTypeStatsCache.timestamp = null;
   return null;
 }
 return caseTypeStatsCache.data;
}

function setCachedCaseTypeStats(data) {
 caseTypeStatsCache.data = data;
 caseTypeStatsCache.timestamp = Date.now();
}

function createJudicialRepository(dbClient) {
 async function queryWithTimeout(text, params = []) {
  let timeoutId;

  try {
   const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError()), DB_QUERY_TIMEOUT_MS);
   });

   return await Promise.race([dbClient.query(text, params), timeoutPromise]);
  } finally {
   clearTimeout(timeoutId);
  }
 }

 return {
  // ===== 判決分類相關 API =====

  /**
   * 取得各類案件數量統計
   * 分類: 民事、刑事、行政、家事、少年、憲法
   * 使用快取機制，快取時間 1 小時
   */
  async getCaseTypeStats() {
   // 檢查快取
   const cached = getCachedCaseTypeStats();
   if (cached) {
    console.log('[getCaseTypeStats] 使用快取資料');
    return cached;
   }

   console.log('[getCaseTypeStats] 查詢資料庫...');
   const result = await queryWithTimeout(`
    SELECT 
     CASE 
      WHEN jfull LIKE '%民事%' OR jcase LIKE '%民事%' OR jtitle LIKE '%民事%' THEN '民事'
      WHEN jfull LIKE '%刑事%' OR jcase LIKE '%刑事%' OR jtitle LIKE '%刑事%' THEN '刑事'
      WHEN jfull LIKE '%行政%' OR jcase LIKE '%行政%' OR jtitle LIKE '%行政%' THEN '行政'
      WHEN jfull LIKE '%家事%' OR jcase LIKE '%家事%' OR jtitle LIKE '%家事%' THEN '家事'
      WHEN jfull LIKE '%少年%' OR jcase LIKE '%少年%' OR jtitle LIKE '%少年%' THEN '少年'
      WHEN jfull LIKE '%憲法%' OR jcase LIKE '%憲法%' OR jtitle LIKE '%憲法%' THEN '憲法'
      ELSE '其他'
     END as case_type,
     COUNT(*)::int as count
    FROM judgments
    GROUP BY case_type
    ORDER BY count DESC
   `);
   
   // 設定快取
   setCachedCaseTypeStats(result.rows);
   return result.rows;
  },

  /**
   * 清除判決分類統計快取（需要強制刷新時呼叫）
   */
  clearCaseTypeStatsCache() {
   caseTypeStatsCache.data = null;
   caseTypeStatsCache.timestamp = null;
   console.log('[getCaseTypeStats] 快取已清除');
  },

  /**
   * 依案件類型搜尋
   * @param {string} caseType - 案件類型 (civil/criminal/administrative/family/juvenile/constitutional)
   * @param {number} limit 
   * @param {number} offset 
   */
  async getCasesByType(caseType, limit = 50, offset = 0) {
   const typeMap = {
    'civil': ['民事'],
    'criminal': ['刑事'],
    'administrative': ['行政'],
    'family': ['家事'],
    'juvenile': ['少年'],
    'constitutional': ['憲法']
   };
   
   const keywords = typeMap[caseType] || [caseType];
   const keywordConditions = keywords.map((_, i) => ` LIKE $${i + 1} OR jcase LIKE $${i + 1} OR jtitle LIKE $${i + 1}`).join(' OR ');
   const params = keywords.map(k => `%${k}%`);
   
   const result = await queryWithTimeout(
    `SELECT * FROM judgments WHERE ${keywordConditions} ORDER BY jdate DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
   );
   
   return result.rows;
  },

  /**
   * 取得單一案件的分類資訊
   * @param {string} jid 
   */
  async getCaseClassification(jid) {
   const row = await queryWithTimeout(
    'SELECT jcase, jtitle FROM judgments WHERE jid = $1',
    [jid]
   );
   
   if (!row.rows[0]) return null;
   
   const { jcase, jtitle } = row.rows[0];
   const text = jcase + ' ' + jtitle;
   
   let caseType = '其他';
   if (text.includes('民事')) caseType = '民事';
   else if (text.includes('刑事')) caseType = '刑事';
   else if (text.includes('行政')) caseType = '行政';
   else if (text.includes('家事')) caseType = '家事';
   else if (text.includes('少年')) caseType = '少年';
   else if (text.includes('憲法')) caseType = '憲法';
   
   return {
    jid,
    caseType,
    court: null,
    caseNumber: jcase,
    title: jtitle
   };
  },

  // ===== 現有 API =====

  async searchJudgments(keyword, limit = 50) {
   const searchTerm = `%${keyword}%`;
   const result = await queryWithTimeout(
    `
     SELECT * FROM judgments
     WHERE jtitle ILIKE $1
       OR jfull ILIKE $1
       OR jcase ILIKE $1
     ORDER BY jdate DESC
     LIMIT $2
    `,
    [searchTerm, limit]
   );

   return result.rows;
  },

  async getAllJudgments(limit = 50, offset = 0) {
   const result = await queryWithTimeout(
    `
     SELECT * FROM judgments
     ORDER BY jdate DESC
     LIMIT $1 OFFSET $2
    `,
    [limit, offset]
   );

   return result.rows;
  },

  async getJudgmentById(jid) {
   const result = await queryWithTimeout('SELECT * FROM judgments WHERE jid = $1', [jid]);
   return result.rows[0] || null;
  },

  async getJudgmentChangelog(limit = 20, offset = 0) {
   const result = await queryWithTimeout(
    `
     SELECT *
     FROM judgments
     ORDER BY jdate DESC NULLS LAST
     LIMIT $1 OFFSET $2
    `,
    [limit, offset]
   );

   return result.rows.map((row) => ({
    jid: row.jid || row.JID || null,
    title: row.jtitle || row.jtitle || null,
    caseNumber: row.jcase || row.jcase || null,
    court: row.jcase || row.jcase || null,
    date: row.jdate || row.JDATE || null
   }));
  },

  async getJudgmentCount() {
   const result = await queryWithTimeout('SELECT COUNT(*)::int AS count FROM judgments');
   return result.rows[0]?.count || 0;
  },

  // ===== Hybrid Search (混合搜尋) =====
  
  /**
   * 混合搜尋 - 結合關鍵字與向量相似度
   * @param {string} query - 搜尋關鍵詞
   * @param {number} limit - 回傳結果數量
   * @param {number} keywordWeight - 關鍵字權重 (0-1)
   * @param {number} vectorWeight - 向量權重 (0-1)
   */
  async hybridSearch(query, limit = 20, keywordWeight = 0.5, vectorWeight = 0.5) {
   const searchTerm = `%${query}%`;
   
   // 關鍵字搜尋
   const keywordResults = await queryWithTimeout(
    `
     SELECT 
      jid, jtitle, , jcase, jdate, jfull,
      (CASE WHEN jtitle ILIKE $1 THEN 3 ELSE 0 END +
       CASE WHEN jfull ILIKE $1 THEN 1 ELSE 0 END +
       CASE WHEN jcase ILIKE $1 THEN 2 ELSE 0 END) as keyword_score
     FROM judgments
     WHERE jtitle ILIKE $1 OR jfull ILIKE $1 OR jcase ILIKE $1
     ORDER BY keyword_score DESC
     LIMIT $2
    `,
    [searchTerm, limit * 2]
   );

   // 向量搜尋 (如果有 embedding 欄位)
   let vectorResults = [];
   try {
    vectorResults = await queryWithTimeout(
     `
      SELECT 
       jid, jtitle, , jcase, jdate, jfull,
       1 as vector_score
      FROM judgments
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> (
       SELECT embedding FROM judgments 
       WHERE jtitle ILIKE $1 LIMIT 1
      )::vector
      LIMIT $2
     `,
     [searchTerm, limit * 2]
    );
   } catch (e) {
    // 如果沒有向量搜尋支援，回傳空陣列
    console.log('[HybridSearch] 向量搜尋不支援，使用純關鍵字搜尋');
   }

   // 合併結果
   const merged = new Map();
   
   // 加入關鍵字結果
   keywordResults.rows.forEach((row, idx) => {
    const normalizedScore = (1 - idx / keywordResults.rows.length) * keywordWeight;
    merged.set(row.jid, {
     ...row,
     keyword_score: row.keyword_score,
     vector_score: 0,
     combined_score: normalizedScore,
     source: 'keyword'
    });
   });

   // 加入向量結果
   vectorResults.rows.forEach((row, idx) => {
    const normalizedScore = (1 - idx / vectorResults.rows.length) * vectorWeight;
    if (merged.has(row.jid)) {
     const existing = merged.get(row.jid);
     existing.vector_score = row.vector_score;
     existing.combined_score = existing.combined_score + normalizedScore;
     existing.source = 'hybrid';
    } else {
     merged.set(row.jid, {
      ...row,
      keyword_score: 0,
      vector_score: row.vector_score,
      combined_score: normalizedScore,
      source: 'vector'
     });
    }
   });

   // 排序並回傳
   const sortedResults = Array.from(merged.values())
    .sort((a, b) => b.combined_score - a.combined_score)
    .slice(0, limit);

   return sortedResults;
  },

  // ===== 效能優化: 預編譯查詢快取 =====
  
  async getCachedJudgmentById(jid) {
   // 使用 LIMIT 1 優化
   const result = await queryWithTimeout(
    'SELECT * FROM judgments WHERE jid = $1 LIMIT 1',
    [jid]
   );
   return result.rows[0] || null;
  }
 };
}

const db = require('../db/postgres');

module.exports = createJudicialRepository(db);
module.exports.createJudicialRepository = createJudicialRepository;
