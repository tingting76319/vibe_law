const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const EvalRun = {
  create(data) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO eval_runs (id, eval_name, dataset, model, metrics, results, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.eval_name,
      data.dataset,
      data.model,
      JSON.stringify(data.metrics || {}),
      JSON.stringify(data.results || {}),
      data.status || 'pending'
    );
    return this.findById(id);
  },

  findById(id) {
    const evalRun = db.prepare('SELECT * FROM eval_runs WHERE id = ?').get(id);
    if (evalRun) {
      evalRun.metrics = JSON.parse(evalRun.metrics || '{}');
      evalRun.results = JSON.parse(evalRun.results || '{}');
    }
    return evalRun;
  },

  findAll(limit = 50) {
    const runs = db.prepare('SELECT * FROM eval_runs ORDER BY started_at DESC LIMIT ?').all(limit);
    return runs.map(r => {
      r.metrics = JSON.parse(r.metrics || '{}');
      r.results = JSON.parse(r.results || '{}');
      return r;
    });
  },

  update(id, data) {
    const fields = [];
    const values = [];
    
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.results !== undefined) { fields.push('results = ?'); values.push(JSON.stringify(data.results)); }
    if (data.completed_at !== undefined) { fields.push('completed_at = ?'); values.push(data.completed_at); }
    
    if (fields.length === 0) return this.findById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE eval_runs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM eval_runs WHERE id = ?').run(id);
  }
};

module.exports = EvalRun;
