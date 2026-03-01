/**
 * Cache Service - 快取服務
 * 支援內存快取與資料庫持久化快取
 */
const db = require('../db/connection');

// 內存快取
const memoryCache = new Map();

// 預設 TTL（分鐘）
const DEFAULT_TTL = 30;

class CacheService {
  constructor() {
    this.prefix = 'legal_rag:';
  }

  // 生成快取鍵
  _makeKey(key) {
    return `${this.prefix}${key}`;
  }

  // 設置快取
  set(key, value, ttlMinutes = DEFAULT_TTL) {
    const fullKey = this._makeKey(key);
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    
    // 內存快取
    memoryCache.set(fullKey, { value, expiresAt });
    
    // 資料庫快取（持久化）
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
        VALUES (?, ?, datetime('now', '+' || ? || ' minutes'), datetime('now'))
      `);
      stmt.run(fullKey, JSON.stringify(value), ttlMinutes);
    } catch (err) {
      console.warn('DB cache write failed:', err.message);
    }
    
    return true;
  }

  // 取得快取
  get(key) {
    const fullKey = this._makeKey(key);
    
    // 先檢查內存
    const memItem = memoryCache.get(fullKey);
    if (memItem && memItem.expiresAt > Date.now()) {
      return memItem.value;
    }
    
    // 內存過期或不存在，檢查資料庫
    try {
      const row = db.prepare(`
        SELECT value, expires_at FROM cache 
        WHERE key = ? AND expires_at > datetime('now')
      `).get(fullKey);
      
      if (row) {
        const value = JSON.parse(row.value);
        // 重建內存快取
        const expiresAt = new Date(row.expires_at).getTime();
        memoryCache.set(fullKey, { value, expiresAt });
        return value;
      }
    } catch (err) {
      console.warn('DB cache read failed:', err.message);
    }
    
    return null;
  }

  // 刪除快取
  delete(key) {
    const fullKey = this._makeKey(key);
    memoryCache.delete(fullKey);
    
    try {
      db.prepare('DELETE FROM cache WHERE key = ?').run(fullKey);
    } catch (err) {
      console.warn('DB cache delete failed:', err.message);
    }
    
    return true;
  }

  // 清空快取
  flush() {
    memoryCache.clear();
    
    try {
      db.prepare('DELETE FROM cache').run();
    } catch (err) {
      console.warn('DB cache flush failed:', err.message);
    }
    
    return true;
  }

  // 取得或設置（包含回調）
  async remember(key, ttlMinutes, callback) {
    let value = this.get(key);
    
    if (value === null) {
      value = await callback();
      this.set(key, value, ttlMinutes);
    }
    
    return value;
  }

  // 批量刪除（pattern matching）
  invalidatePattern(pattern) {
    const fullPattern = this._makeKey(pattern);
    const regex = new RegExp('^' + fullPattern.replace('*', '.*'));
    
    // 內存
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
    
    // 資料庫
    try {
      db.prepare('DELETE FROM cache WHERE key LIKE ?').run(fullPattern.replace('*', '%'));
    } catch (err) {
      console.warn('DB cache invalidate failed:', err.message);
    }
  }
}

// 建立快取表格
function initCacheTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
    `);
    console.log('✅ Cache table initialized');
  } catch (err) {
    console.error('❌ Cache table init failed:', err.message);
  }
}

module.exports = { cacheService: new CacheService(), initCacheTable };
