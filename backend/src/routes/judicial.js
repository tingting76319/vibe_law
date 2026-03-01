/**
 * Judicial API - PostgreSQL 版本
 */
const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// 搜尋案例
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: '請輸入搜尋關鍵字' });
    }
    
    const searchTerm = `%${q}%`;
    
    const result = await query(`
      SELECT * FROM judgments 
      WHERE jtitle ILIKE $1 
         OR jfull ILIKE $1 
         OR jcase ILIKE $1
      ORDER BY jdate DESC
      LIMIT 50
    `, [searchTerm]);
    
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
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(`
      SELECT * FROM judgments 
      ORDER BY jdate DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
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
    const { jid } = req.params;
    
    const result = await query(`
      SELECT * FROM judgments WHERE jid = $1
    `, [jid]);
    
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
    const result = await query('SELECT COUNT(*) as count FROM judgments');
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
