const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const Case = {
  create(data) {
    const id = data.id || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO cases (id, court, year, case_number, type, title, summary, content, result, related_laws, keywords, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.court,
      data.year,
      data.case_number,
      data.type,
      data.title,
      data.summary,
      data.content,
      data.result,
      JSON.stringify(data.related_laws || []),
      JSON.stringify(data.keywords || []),
      data.date
    );
    return this.findById(id);
  },

  findById(id) {
    const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (caseData) {
      caseData.related_laws = JSON.parse(caseData.related_laws || '[]');
      caseData.keywords = JSON.parse(caseData.keywords || '[]');
    }
    return caseData;
  },

  findAll(limit = 100, offset = 0) {
    const cases = db.prepare('SELECT * FROM cases ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset);
    return cases.map(c => {
      c.related_laws = JSON.parse(c.related_laws || '[]');
      c.keywords = JSON.parse(c.keywords || '[]');
      return c;
    });
  },

  search(query, type = null, court = null, limit = 20) {
    let sql = `
      SELECT * FROM cases 
      WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?)
    `;
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (court) {
      sql += ' AND court = ?';
      params.push(court);
    }
    
    sql += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);
    
    const cases = db.prepare(sql).all(...params);
    return cases.map(c => {
      c.related_laws = JSON.parse(c.related_laws || '[]');
      c.keywords = JSON.parse(c.keywords || '[]');
      return c;
    });
  },

  update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['court', 'year', 'case_number', 'type', 'title', 'summary', 'content', 'result', 'related_laws', 'keywords', 'date'];
    
    for (const field of allowed) {
      if (data[field] !== undefined) {
        const dbField = field === 'case_number' ? 'case_number' : field;
        fields.push(`${dbField} = ?`);
        if (field === 'related_laws' || field === 'keywords') {
          values.push(JSON.stringify(data[field]));
        } else {
          values.push(data[field]);
        }
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE cases SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM cases WHERE id = ?').run(id);
  },

  count() {
    return db.prepare('SELECT COUNT(*) as count FROM cases').get().count;
  }
};

module.exports = Case;
