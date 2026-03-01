const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const Query = {
  create(data) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO queries (id, user_id, question, answer, citations, model_used, response_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.user_id,
      data.question,
      data.answer,
      JSON.stringify(data.citations || []),
      data.model_used,
      data.response_time
    );
    return this.findById(id);
  },

  findById(id) {
    const query = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
    if (query) {
      query.citations = JSON.parse(query.citations || '[]');
    }
    return query;
  },

  findAll(limit = 100, offset = 0) {
    const queries = db.prepare('SELECT * FROM queries ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    return queries.map(q => {
      q.citations = JSON.parse(q.citations || '[]');
      return q;
    });
  },

  findByUserId(userId, limit = 50) {
    const queries = db.prepare('SELECT * FROM queries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
    return queries.map(q => {
      q.citations = JSON.parse(q.citations || '[]');
      return q;
    });
  },

  delete(id) {
    return db.prepare('DELETE FROM queries WHERE id = ?').run(id);
  }
};

module.exports = Query;
