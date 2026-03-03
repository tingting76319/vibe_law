/**
 * PostgreSQL 資料庫連線
 */
const { Pool } = require('pg');
const { URL } = require('url');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function resolveSslConfig() {
  const envSsl = (
    process.env.DATABASE_SSL ||
    process.env.DB_SSL ||
    process.env.PGSSLMODE ||
    ''
  ).toLowerCase();

  if (envSsl === 'true' || envSsl === 'require' || envSsl === '1') {
    return { rejectUnauthorized: false };
  }

  if (envSsl === 'false' || envSsl === 'disable' || envSsl === '0') {
    return false;
  }

  // Fallback: respect sslmode in DATABASE_URL when provided.
  try {
    if (connectionString) {
      const url = new URL(connectionString);
      const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase();
      if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full') {
        return { rejectUnauthorized: false };
      }
      if (sslmode === 'disable') {
        return false;
      }
    }
  } catch (err) {
    console.warn('[PostgreSQL] DATABASE_URL 解析失敗，改用 non-SSL 連線');
  }

  // Default to non-SSL for compatibility with DB providers that reject SSL.
  return false;
}

// 從環境變數讀取連線資訊
const pool = new Pool({
  connectionString,
  ssl: resolveSslConfig()
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
