/**
 * 法官資料提取 Script
 * 從判決書中提取法官姓名
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function extractJudgesFromJudgment(jfull) {
  if (!jfull) return [];
  
  // 法官姓名格式：通常是 "法　官　XXX" 或 "審判長法　官　XXX"
  // 使用正則表達式匹配
  const judgePattern = /法\s*官\s*([^\n\r]{2,4})/g;
  const judges = [];
  let match;
  
  while ((match = judgePattern.exec(jfull)) !== null) {
    const name = match[1].trim();
    // 過濾無效名字
    if (name.length >= 2 && name.length <= 4) {
      judges.push(name);
    }
  }
  
  return [...new Set(judges)]; // 去重
}

async function createJudgesTable() {
  const client = await pool.connect();
  try {
    // 建立法官資料表
    await client.query(`
      CREATE TABLE IF NOT EXISTS extracted_judges (
        id SERIAL PRIMARY KEY,
        judge_name VARCHAR(100) NOT NULL,
        jid VARCHAR(200) NOT NULL,
        jyear VARCHAR(10),
        jcase VARCHAR(50),
        jdate VARCHAR(20),
        court VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(jid, judge_name)
      )
    `);
    
    // 建立索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_judge_name ON extracted_judges(judge_name);
    `);
    
    console.log('[extractJudges] 法官資料表建立完成');
  } finally {
    client.release();
  }
}

async function extractAndStoreJudges(limit = 1000) {
  const client = await pool.connect();
  try {
    // 取得判決書
    const result = await client.query(
      `SELECT jid, jyear, jcase, jdate, jfull 
       FROM judgments 
       WHERE jfull IS NOT NULL 
       LIMIT $1`,
      [limit]
    );
    
    console.log(`[extractJudges] 開始處理 ${result.rows.length} 筆判決書...`);
    
    let extractedCount = 0;
    
    for (const row of result.rows) {
      const judges = await extractJudgesFromJudgment(row.jfull);
      
      for (const judgeName of judges) {
        try {
          await client.query(
            `INSERT INTO extracted_judges (judge_name, jid, jyear, jcase, jdate)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (jid, judge_name) DO NOTHING`,
            [judgeName, row.jid, row.jyear, row.jcase, row.jdate]
          );
          extractedCount++;
        } catch (e) {
          // 忽略重複錯誤
        }
      }
    }
    
    console.log(`[extractJudges] 完成！新增 ${extractedCount} 筆法官資料`);
    
    // 顯示統計
    const stats = await client.query(`
      SELECT judge_name, COUNT(*) as case_count 
      FROM extracted_judges 
      GROUP BY judge_name 
      ORDER BY case_count DESC 
      LIMIT 10
    `);
    
    console.log('\n=== 法官統計 (前10) ===');
    stats.rows.forEach(row => {
      console.log(`${row.judge_name}: ${row.case_count} 件`);
    });
    
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await createJudgesTable();
    await extractAndStoreJudges(1000);
  } catch (error) {
    console.error('[extractJudges] 錯誤:', error);
  } finally {
    await pool.end();
  }
}

main();
