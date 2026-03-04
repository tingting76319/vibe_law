/**
 * 建立案件分類統計表 case_type_stats
 * 用於預先計算各類案件數量，避免即時查詢逾時
 */
const { pool } = require('./postgres');

async function createCaseTypeStatsTable() {
  const client = await pool.connect();
  
  try {
    // 建立表（如果不存在）
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_type_stats (
        id SERIAL PRIMARY KEY,
        case_type VARCHAR(20) NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('[Migration] case_type_stats 表建立完成');
    
    // 建立索引以加速查詢
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_case_type_stats_case_type ON case_type_stats(case_type);
    `);
    
    console.log('[Migration] 索引建立完成');
    
    // 執行初始統計
    await updateCaseTypeStats(client);
    
    console.log('[Migration] 初始統計完成');
    
    return true;
  } catch (error) {
    console.error('[Migration] 建立表失敗:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新案件分類統計
 * @param {PoolClient} client - PostgreSQL client（可選）
 */
async function updateCaseTypeStats(clientArg = null) {
  const useExternalClient = clientArg !== null;
  const client = useExternalClient ? clientArg : await pool.connect();
  
  try {
    console.log('[updateCaseTypeStats] 開始更新統計...');
    
    // 初始化所有類型
    const defaultTypes = ['民事', '刑事', '行政', '家事', '少年', '憲法', '其他'];
    
    for (const type of defaultTypes) {
      await client.query(`
        INSERT INTO case_type_stats (case_type, count, updated_at)
        VALUES ($1, 0, NOW())
        ON CONFLICT (case_type) 
        DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
      `, [type]);
    }
    
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
    
    // 更新統計資料
    for (const row of statsResult.rows) {
      await client.query(`
        INSERT INTO case_type_stats (case_type, count, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (case_type) 
        DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
      `, [row.case_type, row.count]);
    }
    
    console.log(`[updateCaseTypeStats] 統計更新完成，共 ${statsResult.rows.length} 類案件`);
    
    return statsResult.rows;
  } catch (error) {
    console.error('[updateCaseTypeStats] 更新失敗:', error.message);
    throw error;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
  }
}

// 執行遷移
if (require.main === module) {
  createCaseTypeStatsTable()
    .then(() => {
      console.log('[Migration] 遷移完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] 遷移失敗:', err);
      process.exit(1);
    });
}

module.exports = {
  createCaseTypeStatsTable,
  updateCaseTypeStats
};
