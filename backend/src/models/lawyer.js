/**
 * Lawyer Model - 律師資料模型
 * v0.8.0 - 律師媒合 MVP
 */
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const Lawyer = {
  create(data) {
    const id = data.id || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO lawyer_profiles (
        id, name, gender, bar_number, law_firm, position,
        contact_email, contact_phone, office_address,
        years_of_experience, education, bar_admission_year,
        specialty, expertise, court_admission, languages,
        bio, style_vector, rating, case_stats,
        win_rate_by_court, win_rate_by_type, hourly_rate,
        availability_status, success_rate, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      id,
      data.name,
      data.gender,
      data.bar_number,
      data.law_firm,
      data.position,
      data.contact_email,
      data.contact_phone,
      data.office_address,
      data.years_of_experience,
      data.education,
      data.bar_admission_year,
      JSON.stringify(data.specialty || []),
      JSON.stringify(data.expertise || []),
      JSON.stringify(data.court_admission || []),
      JSON.stringify(data.languages || []),
      data.bio,
      JSON.stringify(data.style_vector || {}),
      data.rating,
      JSON.stringify(data.case_stats || {}),
      JSON.stringify(data.win_rate_by_court || {}),
      JSON.stringify(data.win_rate_by_type || {}),
      data.hourly_rate,
      data.availability_status || 'available',
      data.success_rate || 0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    return this.findById(id);
  },

  findById(id) {
    const lawyer = db.prepare('SELECT * FROM lawyer_profiles WHERE id = ?').get(id);
    if (!lawyer) return null;
    return this._parseJsonFields(lawyer);
  },

  findAll(limit = 50, offset = 0) {
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles 
      ORDER BY rating DESC, years_of_experience DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  findByBarNumber(barNumber) {
    const lawyer = db.prepare('SELECT * FROM lawyer_profiles WHERE bar_number = ?').get(barNumber);
    if (!lawyer) return null;
    return this._parseJsonFields(lawyer);
  },

  findByLawFirm(lawFirm) {
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles WHERE law_firm LIKE ?
    `).all(`%${lawFirm}%`);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  findBySpecialty(specialty, limit = 20) {
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles 
      WHERE specialty LIKE ? OR expertise LIKE ?
      ORDER BY rating DESC
      LIMIT ?
    `).all(`%${specialty}%`, `%${specialty}%`, limit);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  findByCourt(court, limit = 20) {
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles 
      WHERE court_admission LIKE ?
      ORDER BY rating DESC
      LIMIT ?
    `).all(`%${court}%`, limit);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  findAvailable(limit = 20) {
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles 
      WHERE availability_status = 'available'
      ORDER BY rating DESC, success_rate DESC
      LIMIT ?
    `).all(limit);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  // 搜尋律師 - 支援查詢字串和篩選條件
  search(query, filters = {}, limit = 20) {
    const conditions = [];
    const params = [];
    
    // 處理查詢字串
    if (query) {
      const q = `%${query}%`;
      conditions.push('(name LIKE ? OR law_firm LIKE ? OR specialty LIKE ? OR expertise LIKE ?)');
      params.push(q, q, q, q);
    }
    
    // 處理篩選條件
    const filtersObj = typeof filters === 'object' ? filters : {};
    
    if (filtersObj.specialty) {
      conditions.push('(specialty LIKE ? OR expertise LIKE ?)');
      params.push(`%${filtersObj.specialty}%`, `%${filtersObj.specialty}%`);
    }
    
    if (filtersObj.minExperience) {
      conditions.push('years_of_experience >= ?');
      params.push(filtersObj.minExperience);
    }
    
    if (filtersObj.available === true) {
      conditions.push("availability_status = 'available'");
    }
    
    if (filtersObj.minRating) {
      conditions.push('rating >= ?');
      params.push(filtersObj.minRating);
    }
    
    if (filtersObj.maxHourlyRate) {
      conditions.push('hourly_rate <= ?');
      params.push(filtersObj.maxHourlyRate);
    }
    
    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    // 處理 limit
    const finalLimit = filtersObj.limit || limit || 20;
    params.push(finalLimit);
    
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles 
      ${whereClause}
      ORDER BY rating DESC, success_rate DESC
      LIMIT ?
    `).all(...params);
    
    return lawyers.map(l => this._parseJsonFields(l));
  },

  findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const lawyers = db.prepare(`
      SELECT * FROM lawyer_profiles WHERE id IN (${placeholders})
    `).all(...ids);
    return lawyers.map(l => this._parseJsonFields(l));
  },

  update(id, data) {
    const fields = [];
    const values = [];
    
    const allowed = [
      'name', 'gender', 'bar_number', 'law_firm', 'position',
      'contact_email', 'contact_phone', 'office_address',
      'years_of_experience', 'education', 'bar_admission_year',
      'specialty', 'expertise', 'court_admission', 'languages',
      'bio', 'style_vector', 'rating', 'case_stats',
      'win_rate_by_court', 'win_rate_by_type', 'hourly_rate',
      'availability_status', 'success_rate'
    ];
    
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        if (['specialty', 'expertise', 'court_admission', 'languages', 
             'style_vector', 'case_stats', 'win_rate_by_court', 'win_rate_by_type'].includes(field)) {
          values.push(JSON.stringify(data[field]));
        } else {
          values.push(data[field]);
        }
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE lawyer_profiles SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  },

  updateCaseStats(id, caseResult) {
    const lawyer = this.findById(id);
    if (!lawyer) return null;
    
    const stats = lawyer.case_stats || {
      total_cases: 0,
      wins: 0,
      losses: 0,
      settlements: 0,
      appeals: 0,
      avg_case_value: 0
    };
    
    stats.total_cases++;
    if (caseResult === 'win') stats.wins++;
    else if (caseResult === 'loss') stats.losses++;
    else if (caseResult === 'settlement') stats.settlements++;
    if (caseResult === 'appeal') stats.appeals++;
    
    return this.update(id, { case_stats: stats });
  },

  delete(id) {
    return db.prepare('DELETE FROM lawyer_profiles WHERE id = ?').run(id);
  },

  // 取得律師統計資料
  getStats(id) {
    const lawyer = this.findById(id);
    if (!lawyer) return null;
    
    const stats = lawyer.case_stats || {
      total_cases: 0,
      wins: 0,
      losses: 0,
      settlements: 0,
      appeals: 0,
      avg_case_value: 0
    };
    
    const winRate = stats.total_cases > 0 
      ? Math.round((stats.wins / stats.total_cases) * 100) 
      : lawyer.success_rate || 0;
    
    return {
      total_cases: stats.total_cases,
      wins: stats.wins,
      losses: stats.losses,
      settlements: stats.settlements,
      win_rate: winRate,
      years_of_experience: lawyer.years_of_experience || 0,
      rating: lawyer.rating || 0,
      hourly_rate: lawyer.hourly_rate || 0,
      court_admission: lawyer.court_admission || [],
      specialty: lawyer.specialty || [],
      expertise: lawyer.expertise || []
    };
  },

  // 取得所有可用的專業領域列表
  getAllSpecialties() {
    const lawyers = this.findAll(1000, 0);
    const specialtySet = new Set();
    
    lawyers.forEach(lawyer => {
      if (lawyer.specialty) {
        lawyer.specialty.forEach(s => specialtySet.add(s));
      }
      if (lawyer.expertise) {
        lawyer.expertise.forEach(e => specialtySet.add(e));
      }
    });
    
    return Array.from(specialtySet).sort();
  },

  // 取得所有執業法院列表
  getAllCourts() {
    const lawyers = this.findAll(1000, 0);
    const courtSet = new Set();
    
    lawyers.forEach(lawyer => {
      if (lawyer.court_admission) {
        lawyer.court_admission.forEach(c => courtSet.add(c));
      }
    });
    
    return Array.from(courtSet).sort();
  },

  _parseJsonFields(lawyer) {
    if (!lawyer) return null;
    const jsonFields = ['specialty', 'expertise', 'court_admission', 'languages', 
                        'style_vector', 'case_stats', 'win_rate_by_court', 'win_rate_by_type'];
    
    for (const field of jsonFields) {
      if (lawyer[field] && typeof lawyer[field] === 'string') {
        try {
          lawyer[field] = JSON.parse(lawyer[field]);
        } catch (e) {
          lawyer[field] = null;
        }
      }
    }
    return lawyer;
  }
};

module.exports = Lawyer;
