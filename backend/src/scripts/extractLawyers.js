/**
 * 律師資料提取 Script
 * 從判決書中提取律師姓名
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function extractLawyersFromJudgment(jfull) {
  if (!jfull) return [];
  
  // 律師關鍵詞
  const keywords = ['律師', '訴訟代理人', '選任辯護人'];
  const lawyers = [];
  
  for (const keyword of keywords) {
    const pattern = new RegExp(keyword + '\\s*([^\\n\\r]{2,10})', 'g');
    let match;
    while ((match = pattern.exec(jfull)) !== null) {
      const name = match[1].trim();
      // 過濾無效名字
      if (name.length >= 2 && name.length <= 10 && !name.includes('法定')) {
        lawyers.push(name);
      }
    }
  }
  
  return [...new Set(lawyers)]; // 去重
}

async function createLawyersTable() {
  const client = await pool.connect();
  try {
    // 建立律師資料表
    await client.query(`
      CREATE TABLE IF NOT EXISTS extracted_lawyers (
        id SERIAL PRIMARY KEY,
        lawyer_name VARCHAR(100) NOT NULL,
        jid VARCHAR(200) NOT NULL,
        jyear VARCHAR(10),
        jcase VARCHAR(50),
        jdate VARCHAR(20),
        role VARCHAR(20), -- 原告律師/被告律師
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(jid, lawyer_name)
      )
    `);
    
    // 建立索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lawyer_name ON extracted_lawyers(lawyer_name);
    `);
    
    console.log('[extractLawyers] 律師資料表建立完成');
  } finally {
    client.release();
  }
}

async function extractAndStoreLawyers(limit = 1000) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT jid, jyear, jcase, jdate, jfull 
       FROM judgments 
       WHERE jfull IS NOT NULL 
       LIMIT $1`,
      [limit]
    );
    
    console.log(`[extractLawyers] 開始處理 ${result.rows.length} 筆判決書...`);
    
    let extractedCount = 0;
    
    for (const row of result.rows) {
      const lawyers = await extractLawyersFromJudgment(row.jfull);
      
      for (const lawyerName of lawyers) {
        try {
          await client.query(
            `INSERT INTO extracted_lawyers (lawyer_name, jid, jyear, jcase, jdate)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (jid, lawyer_name) DO NOTHING`,
            [lawyerName, row.jid, row.jyear, row.jcase, row.jdate]
          );
          extractedCount++;
        } catch (e) {
          // 忽略錯誤
        }
      }
    }
    
    console.log(`[extractLawyers] 完成！新增 ${extractedCount} 筆律師資料`);
    
    // 顯示統計
    const stats = await client.query(`
      SELECT lawyer_name, COUNT(*) as case_count 
      FROM extracted_lawyers 
      GROUP BY lawyer_name 
      ORDER BY case_count DESC 
      LIMIT 10
    `);
    
    console.log('\n=== 律師統計 (前10) ===');
    stats.rows.forEach(row => {
      console.log(`${row.lawyer_name}: ${row.case_count} 件`);
    });
    
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await createLawyersTable();
    await extractAndStoreLawyers(1000);
  } catch (error) {
    console.error('[extractLawyers] 錯誤:', error);
  } finally {
    await pool.end();
  }
}

main();
