const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const User = {
  create(email, name = null, role = 'user') {
    const id = uuidv4();
    const stmt = db.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)');
    stmt.run(id, email, name, role);
    return this.findById(id);
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findAll() {
    return db.prepare('SELECT * FROM users').all();
  },

  update(id, data) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
};

module.exports = User;
