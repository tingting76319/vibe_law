/**
 * PostgreSQL 資料庫連線
 */
const { Pool } = require('pg');

// 從環境變數讀取連線資訊
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('[PostgreSQL] 已連接到資料庫');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] 連線錯誤:', err.message);
});

// 測試連線
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('[PostgreSQL] 連線成功:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('[PostgreSQL] 連線失敗:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection
};
