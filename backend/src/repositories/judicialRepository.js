const DB_QUERY_TIMEOUT_MS = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '5000', 10);

function createTimeoutError() {
  const error = new Error('資料庫查詢逾時，請稍後再試');
  error.code = 'DB_TIMEOUT';
  return error;
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
        title: row.jtitle || row.JTITLE || null,
        caseNumber: row.jcase || row.JCASE || null,
        court: row.jcourt || row.JCOURT || null,
        date: row.jdate || row.JDATE || null
      }));
    },

    async getJudgmentCount() {
      const result = await queryWithTimeout('SELECT COUNT(*)::int AS count FROM judgments');
      return result.rows[0]?.count || 0;
    }
  };
}

const db = require('../db/postgres');

module.exports = createJudicialRepository(db);
module.exports.createJudicialRepository = createJudicialRepository;
