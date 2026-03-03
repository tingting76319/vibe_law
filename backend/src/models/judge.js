const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const Judge = {
  create(data) {
    const id = data.id || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO judge_profiles (id, name, court, position, tenure_start, tenure_end, specialty, bio, judgment_stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.court,
      data.position,
      data.tenure_start,
      data.tenure_end,
      data.specialty,
      data.bio,
      JSON.stringify(data.judgment_stats || {})
    );
    return this.findById(id);
  },

  findById(id) {
    const judge = db.prepare('SELECT * FROM judge_profiles WHERE id = ?').get(id);
    if (judge) {
      judge.judgment_stats = JSON.parse(judge.judgment_stats || '{}');
    }
    return judge;
  },

  findAll() {
    const judges = db.prepare('SELECT * FROM judge_profiles ORDER BY name').all();
    return judges.map(j => {
      j.judgment_stats = JSON.parse(j.judgment_stats || '{}');
      return j;
    });
  },

  findByName(name, limit = 10) {
    const judges = db.prepare('SELECT * FROM judge_profiles WHERE name LIKE ? LIMIT ?').all(`%${name}%`, limit);
    return judges.map(j => {
      j.judgment_stats = JSON.parse(j.judgment_stats || '{}');
      return j;
    });
  },

  findByCourt(court) {
    const judges = db.prepare('SELECT * FROM judge_profiles WHERE court LIKE ? ORDER BY name').all(`%${court}%`);
    return judges.map(j => {
      j.judgment_stats = JSON.parse(j.judgment_stats || '{}');
      return j;
    });
  },

  update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['name', 'court', 'position', 'tenure_start', 'tenure_end', 'specialty', 'bio', 'judgment_stats'];
    
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        if (field === 'judgment_stats') {
          values.push(JSON.stringify(data[field]));
        } else {
          values.push(data[field]);
        }
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE judge_profiles SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM judge_profiles WHERE id = ?').run(id);
  }
};

module.exports = Judge;
