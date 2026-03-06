/**
 * Lawyer Service - 律師資料庫服務
 * v1.6 - 律師數位孿生
 */
const db = require('../db/postgres');

class LawyerService {
  constructor() {
    this.cacheTTL = 30;
  }

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

  async getLawyerById(lawyerId) {
    try {
      const result = await db.query(`SELECT * FROM lawyer_profiles WHERE id = $1`, [lawyerId]);
      return result.rows[0] || null;
    } catch (e) {
      console.error('[getLawyerById] Error:', e.message);
      return null;
    }
  }

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

  async getLawyersBySpecialty(specialty, limit = 50) {
    try {
      const result = await db.query(`
        SELECT * FROM lawyer_profiles WHERE specialty LIKE '%' || $1 || '%' LIMIT $2
      `, [specialty, limit]);
      return result.rows || [];
    } catch (e) {
      console.error('[getLawyersBySpecialty] Error:', e.message);
      return [];
    }
  }

  async getLawyerByBarNumber(barNumber) {
    try {
      const result = await db.query(`SELECT * FROM lawyer_profiles WHERE bar_number = $1`, [barNumber]);
      return result.rows[0] || null;
    } catch (e) {
      console.error('[getLawyerByBarNumber] Error:', e.message);
      return null;
    }
  }

  async getLawyerStats(lawyerId) {
    try {
      const lawyer = await this.getLawyerById(lawyerId);
      if (!lawyer) return null;
      return {
        lawyer: { id: lawyer.id, name: lawyer.name, specialty: lawyer.specialty, win_rate: lawyer.win_rate, total_cases: lawyer.total_cases },
        case_stats: []
      };
    } catch (e) {
      console.error('[getLawyerStats] Error:', e.message);
      return null;
    }
  }

  async getLawyerStyle(lawyerId) {
    try {
      const lawyer = await this.getLawyerById(lawyerId);
      if (!lawyer) return null;
      const styles = { '攻擊型': '喜歡主動出擊', '防禦型': '善於防守', '妥協型': '傾向和解', '穩健型': '證據导向' };
      return { lawyer_id: lawyer.id, name: lawyer.name, style: lawyer.style || '穩健型', style_description: styles[lawyer.style] || styles['穩健型'] };
    } catch (e) {
      console.error('[getLawyerStyle] Error:', e.message);
      return null;
    }
  }

  async getLawyerCases(lawyerId, limit = 20) {
    return [];
  }

  async createLawyer(data) {
    try {
      const result = await db.query(`
        INSERT INTO lawyer_profiles (name, bar_number, specialty, court, win_rate, total_cases, style, experience_years)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [data.name, data.bar_number || '', data.specialty || '', data.court || '', data.win_rate || 0, data.total_cases || 0, data.style || '穩健型', data.experience_years || 0]);
      return result.rows[0];
    } catch (e) {
      console.error('[createLawyer] Error:', e.message);
      return null;
    }
  }

  async updateLawyer(id, data) {
    try {
      const fields = [];
      const values = [];
      let paramNum = 1;
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramNum}`);
          values.push(value);
          paramNum++;
        }
      }
      if (fields.length === 0) return null;
      values.push(id);
      const result = await db.query(`UPDATE lawyer_profiles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramNum} RETURNING *`, values);
      return result.rows[0] || null;
    } catch (e) {
      console.error('[updateLawyer] Error:', e.message);
      return null;
    }
  }

  async deleteLawyer(id) {
    try {
      await db.query('DELETE FROM lawyer_profiles WHERE id = $1', [id]);
      return true;
    } catch (e) {
      console.error('[deleteLawyer] Error:', e.message);
      return false;
    }
  }
}

module.exports = new LawyerService();
