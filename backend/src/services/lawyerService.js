/**
 * Lawyer Service - 律師資料庫服務
 * v1.6 - 律師數位孿生
 */
const db = require('../db/postgres');

class LawyerService {
  constructor() {
    this.cacheTTL = 30;
  }

  // 取得所有律師列表
  async getAllLawyers(limit = 50, offset = 0) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles 
        ORDER BY total_cases DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      return result.rows || [];
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
  async searchLawyers(query, filters = {}) {
    try {
      const { specialty, court, limit = 20 } = filters;
      let sql = 'SELECT * FROM lawyer_profiles WHERE 1=1';
      const params = [];
      let paramNum = 1;
      
      if (query) {
        params.push('%' + query + '%');
        sql += ` AND (name LIKE $${paramNum} OR specialty LIKE $${paramNum})`;
        paramNum++;
      }
      if (specialty) {
        params.push('%' + specialty + '%');
        sql += ` AND specialty LIKE $${paramNum}`;
        paramNum++;
      }
      if (court) {
        params.push('%' + court + '%');
        sql += ` AND court LIKE $${paramNum}`;
        paramNum++;
      }
      
      params.push(limit);
      sql += ` LIMIT $${paramNum}`;
      
      const result = await db.query(sql, params);
      return result.rows || [];
    } catch (e) {
      console.error('[searchLawyers] Error:', e.message);
      return [];
    }
  }

  // 依專長取得律師
  async getLawyersBySpecialty(specialty, limit = 50) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles 
        WHERE specialty LIKE '%' || $1 || '%'
        LIMIT $2
      `, [specialty, limit]);
      return result.rows || [];
    } catch (e) {
      console.error('[getLawyersBySpecialty] Error:', e.message);
      return [];
    }
  }

  // 依律師證號取得律師
  async getLawyerByBarNumber(barNumber) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles WHERE bar_number = $1
      `, [barNumber]);
      return result.rows[0] || null;
    } catch (e) {
      console.error('[getLawyerByBarNumber] Error:', e.message);
      return null;
    }
  }

  // v1.6: 取得律師統計分析
  async getLawyerStats(lawyerId) {
    try {
      const lawyer = await this.getLawyerById(lawyerId);
      if (!lawyer) return null;
      
      return {
        lawyer: {
          id: lawyer.id,
          name: lawyer.name,
          specialty: lawyer.specialty,
          win_rate: lawyer.win_rate,
          total_cases: lawyer.total_cases
        },
        case_stats: []
      };
    } catch (e) {
      console.error('[getLawyerStats] Error:', e.message);
      return null;
    }
  }

  // v1.6: 取得律師風格分析
  async getLawyerStyle(lawyerId) {
    try {
      const lawyer = await this.getLawyerById(lawyerId);
      if (!lawyer) return null;
      
      const styles = {
        '攻擊型': '喜歡主動出擊，積極舉證',
        '防禦型': '善於防守，強調對方過失',
        '妥協型': '傾向和解，減少風險',
        '穩健型': '證據导向，謹慎行事'
      };
      
      return {
        lawyer_id: lawyer.id,
        name: lawyer.name,
        style: lawyer.style || '穩健型',
        style_description: styles[lawyer.style] || styles['穩健型'],
        experience_years: lawyer.experience_years || 0
      };
    } catch (e) {
      console.error('[getLawyerStyle] Error:', e.message);
      return null;
    }
  }

  // v1.6: 取得律師歷史案件
  async getLawyerCases(lawyerId, limit = 20) {
    try {
      const lawyer = await this.getLawyerById(lawyerId);
      if (!lawyer) return [];
      return [];
    } catch (e) {
      console.error('[getLawyerCases] Error:', e.message);
      return [];
    }
  }

  // v1.6: 新增律師
  async createLawyer(data) {
    try {
      const result = await db.query(`
        INSERT INTO lawyer_profiles (name, bar_number, specialty, court, win_rate, total_cases, style, experience_years)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        data.name, data.bar_number || '', data.specialty || '', data.court || '',
        data.win_rate || 0, data.total_cases || 0, data.style || '穩健型',
        data.experience_years || 0
      ]);
      return result.rows[0];
    } catch (e) {
      console.error('[createLawyer] Error:', e.message);
      return null;
    }
  }

  // v1.6: 批量新增律師
  async bulkCreateLawyers(lawyers) {
    const results = [];
    for (const lawyer of lawyers) {
      const result = await this.createLawyer(lawyer);
      results.push(result);
    }
    return results;
  }
}

module.exports = new LawyerService();
