/**
 * Lawyer Service - 律師資料庫服務
 * v1.5 - 使用 PostgreSQL
 */
const db = require('../db/postgres');

class LawyerService {
  constructor() {
    this.cacheTTL = 30;
  }

  // 取得所有律師 (從判決書中提取)
  async getAllLawyers(forceRefresh = false) {
    try {
      // 嘗試從 lawyer_profiles 表查詢
      const result = await db.query(`
        SELECT * FROM lawyer_profiles 
        ORDER BY name
        LIMIT 100
      `);
      
      if (result.rows.length > 0) {
        return result.rows.map(l => ({
          id: l.id,
          name: l.name,
          bar_number: l.bar_number,
          court: l.court || '各法院',
          specialty: l.specialty || '綜合',
          phone: l.phone || '',
          email: l.email || ''
        }));
      }
      
      // 如果沒有律師資料，回傳空陣列
      return [];
    } catch (e) {
      console.error('[getAllLawyers] Error:', e.message);
      return [];
    }
  }

  // 依 ID 取得律師
  async getLawyerById(lawyerId) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles WHERE id = $1
      `, [lawyerId]);
      
      if (result.rows.length === 0) return null;
      
      return result.rows[0];
    } catch (e) {
      console.error('[getLawyerById] Error:', e.message);
      return null;
    }
  }

  // 搜尋律師
  async searchLawyers(q, limit = 20) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles 
        WHERE name LIKE '%' || $1 || '%' OR bar_number LIKE '%' || $1 || '%'
        LIMIT $2
      `, [q, limit]);
      
      return result.rows.map(l => ({
        id: l.id,
        name: l.name,
        bar_number: l.bar_number,
        court: l.court || '各法院',
        specialty: l.specialty || '綜合'
      }));
    } catch (e) {
      console.error('[searchLawyers] Error:', e.message);
      return [];
    }
  }

  // 依法院取得律師
  async getLawyersByCourt(court) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles 
        WHERE court LIKE '%' || $1 || '%'
        LIMIT 50
      `, [court]);
      
      return result.rows;
    } catch (e) {
      console.error('[getLawyersByCourt] Error:', e.message);
      return [];
    }
  }
}

module.exports = new LawyerService();
