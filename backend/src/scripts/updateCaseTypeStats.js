/**
 * 定時更新案件分類統計
 * 用於背景排程 (cron job)
 * 
 * 使用方式:
 *   node src/scripts/updateCaseTypeStats.js
 * 
 * Cron 範例 (每天凌晨 3 點執行):
 *   0 3 * * * cd /path/to/backend && node src/scripts/updateCaseTypeStats.js
 */
const { pool } = require('../db/postgres');

async function updateCaseTypeStats() {
  const client = await pool.connect();
  
  try {
    console.log(`[${new Date().toISOString()}] [updateCaseTypeStats] 開始更新統計...`);
    
    // 實際統計各類案件數量
    const statsResult = await client.query(`
      SELECT 
        CASE 
          WHEN jfull LIKE '%民事%' OR jcase LIKE '%民事%' OR jtitle LIKE '%民事%' THEN '民事'
          WHEN jfull LIKE '%刑事%' OR jcase LIKE '%刑事%' OR jtitle LIKE '%刑事%' THEN '刑事'
          WHEN jfull LIKE '%行政%' OR jcase LIKE '%行政%' OR jtitle LIKE '%行政%' THEN '行政'
          WHEN jfull LIKE '%家事%' OR jcase LIKE '%家事%' OR jtitle LIKE '%家事%' THEN '家事'
          WHEN jfull LIKE '%少年%' OR jcase LIKE '%少年%' OR jtitle LIKE '%少年%' THEN '少年'
          WHEN jfull LIKE '%憲法%' OR jcase LIKE '%憲法%' OR jtitle LIKE '%憲法%' THEN '憲法'
          ELSE '其他'
        END as case_type,
        COUNT(*)::int as count
      FROM judgments
      GROUP BY case_type
    `);
    
    // 確保所有類型都有記錄（初始化）
    const defaultTypes = ['民事', '刑事', '行政', '家事', '少年', '憲法', '其他'];
    
    for (const type of defaultTypes) {
      const existing = statsResult.rows.find(r => r.case_type === type);
      const count = existing ? existing.count : 0;
      
      await client.query(`
        INSERT INTO case_type_stats (case_type, count, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (case_type) 
        DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
      `, [type, count]);
    }
    
    console.log(`[${new Date().toISOString()}] [updateCaseTypeStats] 統計更新完成`);
    
    // 顯示更新後的統計
    const finalResult = await client.query('SELECT * FROM case_type_stats ORDER BY count DESC');
    console.log('[updateCaseTypeStats] 最新統計:');
    finalResult.rows.forEach(row => {
      console.log(`  ${row.case_type}: ${row.count} 件 (更新於 ${row.updated_at})`);
    });
    
    return finalResult.rows;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [updateCaseTypeStats] 更新失敗:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// 執行更新
if (require.main === module) {
  updateCaseTypeStats()
    .then(() => {
      console.log('[updateCaseTypeStats] 腳本執行完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[updateCaseTypeStats] 腳本執行失敗:', err);
      process.exit(1);
    });
}

module.exports = { updateCaseTypeStats };
