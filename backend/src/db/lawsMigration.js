/**
 * 法規資料庫 Migration - PostgreSQL
 * 建立法規相關資料表
 */
const db = require('../db/postgres');

async function runMigration() {
  console.log('[Migration] 開始建立法規資料表...');

  try {
    // 法規主表
    await db.query(`
      CREATE TABLE IF NOT EXISTS laws (
        id SERIAL PRIMARY KEY,
        law_id VARCHAR(50) UNIQUE NOT NULL,  -- 法規編號，如 "刑法第100條"
        law_name VARCHAR(255) NOT NULL,       -- 法規名稱
        law_category VARCHAR(100),           -- 法規類別
        chapter VARCHAR(255),                 -- 章
        section VARCHAR(255),                 -- 節
        article VARCHAR(50),                 -- 條號
        title VARCHAR(500),                  -- 條文標題
        content TEXT,                         -- 條文內容
        original_content TEXT,                -- 原始內容（未正規化）
        effective_date DATE,                  -- 生效日期
        promulgate_date DATE,                 -- 發布日期
        amendment_count INTEGER DEFAULT 0,   -- 修法次數
        related_laws TEXT,                    -- 相關法規 (JSON array)
        keywords TEXT,                        -- 關鍵字 (JSON array)
        source VARCHAR(100) DEFAULT 'law.moj.gov.tw',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[Migration] laws 表建立完成');

    // 法規異動紀錄表
    await db.query(`
      CREATE TABLE IF NOT EXISTS law_amendments (
        id SERIAL PRIMARY KEY,
        law_id VARCHAR(50) NOT NULL,
        amendment_date DATE NOT NULL,
        amendment_type VARCHAR(20),           -- '新增', '修訂', '廢止'
        before_content TEXT,
        after_content TEXT,
        description TEXT,
        source_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (law_id) REFERENCES laws(law_id) ON DELETE CASCADE
      )
    `);
    console.log('[Migration] law_amendments 表建立完成');

    // 法規搜尋歷史表
    await db.query(`
      CREATE TABLE IF NOT EXISTS law_search_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        query VARCHAR(500) NOT NULL,
        results_count INTEGER,
        clicked_law_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[Migration] law_search_history 表建立完成');

    // 建立索引
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_laws_law_id ON laws(law_id);
      CREATE INDEX IF NOT EXISTS idx_laws_law_name ON laws(law_name);
      CREATE INDEX IF NOT EXISTS idx_laws_category ON laws(law_category);
      CREATE INDEX IF NOT EXISTS idx_laws_article ON laws(article);
      CREATE INDEX IF NOT EXISTS idx_laws_effective_date ON laws(effective_date);
      CREATE INDEX IF NOT EXISTS idx_laws_content_gin ON laws USING gin(to_tsvector('zhparser', content));
      CREATE INDEX IF NOT EXISTS idx_law_amendments_law_id ON law_amendments(law_id);
      CREATE INDEX IF NOT EXISTS idx_law_amendments_date ON law_amendments(amendment_date);
      CREATE INDEX IF NOT EXISTS idx_law_search_history_query ON law_search_history(query);
      CREATE INDEX IF NOT EXISTS idx_law_search_history_created ON law_search_history(created_at);
    `);
    console.log('[Migration] 索引建立完成');

    console.log('[Migration] 法規資料表 migration 完成');
    return true;
  } catch (error) {
    console.error('[Migration] 錯誤:', error.message);
    throw error;
  }
}

// 執行 migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('[Migration] 完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] 失敗:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };
