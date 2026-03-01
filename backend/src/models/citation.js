const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const Citation = {
  create(data) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO citations (id, query_id, case_id, relevance_score, chunk_text)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.query_id, data.case_id, data.relevance_score, data.chunk_text);
    return this.findById(id);
  },

  findById(id) {
    return db.prepare('SELECT * FROM citations WHERE id = ?').get(id);
  },

  findByQueryId(queryId) {
    return db.prepare('SELECT * FROM citations WHERE query_id = ? ORDER BY relevance_score DESC').all(queryId);
  },

  findByCaseId(caseId) {
    return db.prepare('SELECT * FROM citations WHERE case_id = ?').all(caseId);
  },

  delete(id) {
    return db.prepare('DELETE FROM citations WHERE id = ?').run(id);
  },

  deleteByQueryId(queryId) {
    return db.prepare('DELETE FROM citations WHERE query_id = ?').run(queryId);
  }
};

module.exports = Citation;
