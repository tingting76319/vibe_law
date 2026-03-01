/**
 * Judicial API - PostgreSQL 版本
 */
const express = require('express');
const router = express.Router();

// 搜尋案例
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: '請輸入搜尋關鍵字' });
    }
    
    // 直接使用 pg
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const searchTerm = `%${q}%`;
    
    const result = await pool.query(`
      SELECT * FROM judgments 
      WHERE jtitle ILIKE $1 
         OR jfull ILIKE $1 
         OR jcase ILIKE $1
      ORDER BY jdate DESC
      LIMIT 50
    `, [searchTerm]);
    
    await pool.end();
    
    res.json({
      status: 'success',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('[Judicial] 搜尋錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 取得所有案例
router.get('/cases', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(`
      SELECT * FROM judgments 
      ORDER BY jdate DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    await pool.end();
    
    res.json({
      status: 'success',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取得單一案例
router.get('/cases/:jid', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const { jid } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM judgments WHERE jid = $1
    `, [jid]);
    
    await pool.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '找不到該裁判書' });
    }
    
    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 測試連線
router.get('/test', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const result = await pool.query('SELECT COUNT(*) as count FROM judgments');
    await pool.end();
    
    res.json({ 
      status: 'success', 
      message: 'PostgreSQL 連線成功',
      count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
