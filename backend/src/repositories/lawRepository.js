/**
 * 法規資料 Repository
 * 處理法規資料庫操作
 */
const db = require('../db/postgres');

const DB_QUERY_TIMEOUT_MS = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '5000', 10);

function createTimeoutError() {
  const error = new Error('資料庫查詢逾時，請稍後再試');
  error.code = 'DB_TIMEOUT';
  return error;
}

function createLawRepository(dbClient) {
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
    /**
     * 搜尋法規
     */
    async searchLaws(keyword, options = {}) {
      const { limit = 20, offset = 0, category = null } = options;
      
      let query = `
        SELECT * FROM laws
        WHERE (law_name ILIKE $1 OR content ILIKE $1 OR article ILIKE $1)
      `;
      const params = [`%${keyword}%`];
      
      if (category) {
        query += ` AND law_category = $2`;
        params.push(category);
      }
      
      query += ` ORDER BY law_name, article::int LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await queryWithTimeout(query, params);
      return result.rows;
    },

    /**
     * 取得單一法規
     */
    async getLawById(lawId) {
      const result = await queryWithTimeout(
        'SELECT * FROM laws WHERE law_id = $1',
        [lawId]
      );
      return result.rows[0] || null;
    },

    /**
     * 依類別取得法規列表
     */
    async getLawsByCategory(category, limit = 50, offset = 0) {
      const result = await queryWithTimeout(
        `SELECT * FROM laws WHERE law_category = $1 
         ORDER BY law_name, article::int 
         LIMIT $2 OFFSET $3`,
        [category, limit, offset]
      );
      return result.rows;
    },

    /**
     * 取得所有法規類別
     */
    async getCategories() {
      const result = await queryWithTimeout(`
        SELECT law_category, COUNT(*) as count 
        FROM laws 
        GROUP BY law_category 
        ORDER BY law_category
      `);
      return result.rows;
    },

    /**
     * 取得法規異動歷史
     */
    async getLawAmendments(lawId, limit = 20) {
      const result = await queryWithTimeout(
        `SELECT * FROM law_amendments 
         WHERE law_id = $1 
         ORDER BY amendment_date DESC 
         LIMIT $2`,
        [lawId, limit]
      );
      return result.rows;
    },

    /**
     * 新增或更新法規
     */
    async upsertLaw(lawData) {
      const text = `
        INSERT INTO laws (
          law_id, law_name, law_category, chapter, section, article,
          title, content, original_content, effective_date, promulgate_date,
          amendment_count, related_laws, keywords
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (law_id) DO UPDATE SET
          law_name = EXCLUDED.law_name,
          law_category = EXCLUDED.law_category,
          chapter = EXCLUDED.chapter,
          section = EXCLUDED.section,
          article = EXCLUDED.article,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          original_content = EXCLUDED.original_content,
          effective_date = EXCLUDED.effective_date,
          promulgate_date = EXCLUDED.promulgate_date,
          amendment_count = laws.amendment_count + 1,
          related_laws = EXCLUDED.related_laws,
          keywords = EXCLUDED.keywords,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [
        lawData.law_id,
        lawData.law_name,
        lawData.law_category,
        lawData.chapter,
        lawData.section,
        lawData.article,
        lawData.title,
        lawData.content,
        lawData.original_content,
        lawData.effective_date,
        lawData.promulgate_date,
        lawData.amendment_count || 0,
        JSON.stringify(lawData.related_laws || []),
        JSON.stringify(lawData.keywords || [])
      ];
      
      const result = await queryWithTimeout(text, values);
      return result.rows[0];
    },

    /**
     * 記錄搜尋歷史
     */
    async logSearch(userId, query, resultsCount, clickedLawId = null) {
      const text = `
        INSERT INTO law_search_history (user_id, query, results_count, clicked_law_id)
        VALUES ($1, $2, $3, $4)
      `;
      await queryWithTimeout(text, [userId, query, resultsCount, clickedLawId]);
    },

    /**
     * 取得法規總數
     */
    async getTotalCount() {
      const result = await queryWithTimeout('SELECT COUNT(*)::int AS count FROM laws');
      return result.rows[0]?.count || 0;
    }
  };
}

const dbInstance = require('../db/postgres');
module.exports = createLawRepository(dbInstance);
module.exports.createLawRepository = createLawRepository;
