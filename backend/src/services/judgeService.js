/**
 * Judge Service - 法官資料庫服務
 * v1.5 - 使用 PostgreSQL
 */
const db = require('../db/postgres');

class JudgeService {
  constructor() {
    this.cacheTTL = 30;
  }

  // 取得所有法官
  async getAllJudges(forceRefresh = false) {
    try {
      // 從判決書中提取法官名單
      const result = await db.query(`
        SELECT DISTINCT 
          SUBSTRING(jid FROM 1 FOR 4) as court_code,
          jyear
        FROM judgments 
        WHERE jid IS NOT NULL
        ORDER BY court_code
        LIMIT 50
      `);
      
      // 轉換為法官格式
      const judges = result.rows.map((row, idx) => ({
        id: `judge_${row.court_code}_${row.jyear}`,
        name: `${row.court_code}法官`,
        court: row.court_code,
        court_level: this.getCourtLevel(row.court_code),
        position: '法官',
        specialty: '綜合',
        year: row.jyear
      }));
      
      return judges;
    } catch (e) {
      console.error('[getAllJudges] Error:', e.message);
      return [];
    }
  }

  getCourtLevel(code) {
    if (!code) return '地方法院';
    if (code.includes('最高')) return '最高法院';
    if (code.includes('高等')) return '高等法院';
    return '地方法院';
  }

  // 依 ID 取得法官
  async getJudgeById(judgeId) {
    try {
      const result = await db.query(`
        SELECT * FROM judgments 
        WHERE jid LIKE '${judgeId}%'
        LIMIT 1
      `);
      
      if (result.rows.length === 0) return null;
      
      return {
        id: judgeId,
        name: `${judgeId}法官`,
        court: judgeId.substring(0, 4)
      };
    } catch (e) {
      console.error('[getJudgeById] Error:', e.message);
      return null;
    }
  }

  // 搜尋法官
  async searchJudges(q) {
    try {
      const result = await db.query(`
        SELECT DISTINCT SUBSTRING(jid FROM 1 FOR 4) as court
        FROM judgments 
        WHERE jid LIKE '%${q}%'
        LIMIT 20
      `);
      
      return result.rows.map(row => ({
        id: `judge_${row.court}`,
        name: `${row.court}法官`,
        court: row.court
      }));
    } catch (e) {
      console.error('[searchJudges] Error:', e.message);
      return [];
    }
  }

  // 依法院取得法官
  async getJudgesByCourt(court) {
    try {
      const result = await db.query(`
        SELECT DISTINCT SUBSTRING(jid FROM 1 FOR 4) as court
        FROM judgments 
        WHERE jid LIKE '${court}%'
        LIMIT 20
      `);
      
      return result.rows.map(row => ({
        id: `judge_${row.court}`,
        name: `${row.court}法官`,
        court: row.court
      }));
    } catch (e) {
      console.error('[getJudgesByCourt] Error:', e.message);
      return [];
    }
  }
}

module.exports = new JudgeService();
