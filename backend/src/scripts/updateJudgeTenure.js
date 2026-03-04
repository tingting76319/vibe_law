/**
 * 法官任職年限統計 Script
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateJudgeTenure() {
  const client = await pool.connect();
  try {
    // 建立法官任職年限表
    await client.query(`
      CREATE TABLE IF NOT EXISTS judge_tenure_stats (
        id SERIAL PRIMARY KEY,
        judge_name VARCHAR(100) NOT NULL UNIQUE,
        first_year INT,
        last_year INT,
        tenure_years INT,
        case_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 計算法官任職年限
    const result = await client.query(`
      SELECT 
        judge_name,
        MIN(CAST(jyear AS INT)) as first_year,
        MAX(CAST(jyear AS INT)) as last_year,
        COUNT(*) as case_count
      FROM extracted_judges
      WHERE judge_name NOT LIKE '%法%' 
        AND judge_name NOT LIKE '%簡%'
        AND judge_name NOT LIKE '%審%'
        AND length(judge_name) BETWEEN 2 AND 4
        AND jyear ~ '^[0-9]+$'
      GROUP BY judge_name
      HAVING COUNT(*) > 1
    `);
    
    console.log(`[updateJudgeTenure] 計算 ${result.rows.length} 位法官任職年限...`);
    
    for (const row of result.rows) {
      const tenureYears = row.last_year - row.first_year + 1;
      
      await client.query(`
        INSERT INTO judge_tenure_stats (judge_name, first_year, last_year, tenure_years, case_count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (judge_name) DO UPDATE SET
          first_year = EXCLUDED.first_year,
          last_year = EXCLUDED.last_year,
          tenure_years = EXCLUDED.tenure_years,
          case_count = EXCLUDED.case_count,
          updated_at = CURRENT_TIMESTAMP
      `, [row.judge_name, row.first_year, row.last_year, tenureYears, row.case_count]);
    }
    
    console.log('[updateJudgeTenure] 完成！');
    
    // 顯示前10
    const top = await client.query(`
      SELECT judge_name, first_year, last_year, tenure_years, case_count 
      FROM judge_tenure_stats
      ORDER BY tenure_years DESC, case_count DESC
      LIMIT 10
    `);
    
    console.log('\n=== 法官任職年限 (前10) ===');
    console.log('法官\t\t首次\t最近\t年數\t案件數');
    console.log('------\t\t----\t----\t----\t----');
    top.rows.forEach(r => {
      console.log(`${r.judge_name}\t\t${r.first_year}\t${r.last_year}\t${r.tenure_years}\t${r.case_count}`);
    });
    
  } finally {
    client.release();
  }
}

updateJudgeTenure()
  .then(() => pool.end())
  .catch(e => { console.error(e); pool.end(); });
