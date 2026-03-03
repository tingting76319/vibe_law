/**
 * Database Migration: Add Indexes for Performance
 * Run: node backend/src/scripts/addIndexes.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 開始建立索引...\n');
    
    // 1. 建立 jid 唯一索引（防止重複）
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_jid 
      ON cases(jid)
    `);
    console.log('✅ idx_cases_jid (UNIQUE) - 已建立');
    
    // 2. 建立搜尋索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_jcase 
      ON cases(jcase)
    `);
    console.log('✅ idx_cases_jcase - 已建立');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_jyear 
      ON cases(jyear)
    `);
    console.log('✅ idx_cases_jyear - 已建立');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_jtitle 
      ON cases(jtitle)
    `);
    console.log('✅ idx_cases_jtitle - 已建立');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_jdate 
      ON cases(jdate)
    `);
    console.log('✅ idx_cases_jdate - 已建立');
    
    // 3. 檢查重複資料
    const duplicateCheck = await client.query(`
      SELECT jid, COUNT(*) as count 
      FROM cases 
      GROUP BY jid 
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.log('\n⚠️ 發現重複資料:');
      duplicateCheck.rows.forEach(row => {
        console.log(`  - ${row.jid}: ${row.count} 筆`);
      });
      
      // 刪除重複資料（保留第一筆）
      await client.query(`
        DELETE FROM cases 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM cases 
          GROUP BY jid
        )
      `);
      console.log('\n✅ 重複資料已清除');
    } else {
      console.log('\n✅ 無重複資料');
    }
    
    console.log('\n✨ 索引建立完成！');
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addIndexes();
