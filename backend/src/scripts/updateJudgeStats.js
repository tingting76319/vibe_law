/**
 * 法官案件統計預先計算 Script
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateJudgeStats() {
  const client = await pool.connect();
  try {
    // 建立預先計算表
    await client.query(`
      CREATE TABLE IF NOT EXISTS judge_case_stats (
        id SERIAL PRIMARY KEY,
        judge_name VARCHAR(100) NOT NULL UNIQUE,
        case_count INT DEFAULT 0,
        case_types JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 查詢法官統計（修正 SQL）
    const result = await client.query(`
      SELECT 
        judge_name,
        COUNT(*) as case_count
      FROM extracted_judges
      WHERE judge_name NOT LIKE '%法%' 
        AND judge_name NOT LIKE '%簡%'
        AND judge_name NOT LIKE '%審%'
        AND length(judge_name) BETWEEN 2 AND 4
      GROUP BY judge_name
      HAVING COUNT(*) > 1
    `);
    
    console.log(`[updateJudgeStats] 更新 ${result.rows.length} 位法官統計...`);
    
    for (const row of result.rows) {
      await client.query(`
        INSERT INTO judge_case_stats (judge_name, case_count)
        VALUES ($1, $2)
        ON CONFLICT (judge_name) DO UPDATE SET
          case_count = EXCLUDED.case_count,
          updated_at = CURRENT_TIMESTAMP
      `, [row.judge_name, row.case_count]);
    }
    
    console.log('[updateJudgeStats] 完成！');
    
    // 顯示前10
    const top = await client.query(`
      SELECT judge_name, case_count FROM judge_case_stats
      ORDER BY case_count DESC LIMIT 10
    `);
    
    console.log('\n=== 法官統計 (前10) ===');
    top.rows.forEach(r => console.log(`${r.judge_name}: ${r.case_count} 件`));
    
  } finally {
    client.release();
  }
}

updateJudgeStats()
  .then(() => pool.end())
  .catch(e => { console.error(e); pool.end(); });
