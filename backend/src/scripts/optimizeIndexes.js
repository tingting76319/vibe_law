/**
 * 資料庫索引優化腳本
 * v1.1 - 判決分類與效能優化
 */
const db = require('../db/postgres');

async function optimizeIndexes() {
  console.log('開始資料庫索引優化...');
  
  const indexes = [
    // 判決分類相關索引
    {
      name: 'idx_judgments_case_type',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_case_type ON judgments (
        CASE 
          WHEN jcourt LIKE '%民事%' OR jcase LIKE '%民事%' OR jtitle LIKE '%民事%' THEN 'civil'
          WHEN jcourt LIKE '%刑事%' OR jcase LIKE '%刑事%' OR jtitle LIKE '%刑事%' THEN 'criminal'
          WHEN jcourt LIKE '%行政%' OR jcase LIKE '%行政%' OR jtitle LIKE '%行政%' THEN 'administrative'
          WHEN jcourt LIKE '%家事%' OR jcase LIKE '%家事%' OR jtitle LIKE '%家事%' THEN 'family'
          WHEN jcourt LIKE '%少年%' OR jcase LIKE '%少年%' OR jtitle LIKE '%少年%' THEN 'juvenile'
          WHEN jcourt LIKE '%憲法%' OR jcase LIKE '%憲法%' OR jtitle LIKE '%憲法%' THEN 'constitutional'
          ELSE 'other'
        END
      )`
    },
    // 搜尋優化 - 全文檢索索引
    {
      name: 'idx_judgments_title_gin',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_title_gin ON judgments USING gin(to_tsvector('simple', jtitle))`
    },
    {
      name: 'idx_judgments_full_gin',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_full_gin ON judgments USING gin(to_tsvector('simple', jfull))`
    },
    // 向量搜尋索引 (如果支援 pgvector)
    {
      name: 'idx_judgments_embedding_cosine',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_embedding_cosine ON judgments 
        USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100)`
    },
    // 效能優化: 複合索引
    {
      name: 'idx_judgments_date_court',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_date_court ON judgments (jdate DESC, jcourt)`
    },
    {
      name: 'idx_judgments_case_year',
      sql: `CREATE INDEX IF NOT EXISTS idx_judgments_case_year ON judgments (jcase, jyear)`
    },
    // 快取查詢優化
    {
      name: 'idx_judgments_jid_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_judgments_jid_unique ON judgments (jid)`
    }
  ];

  for (const idx of indexes) {
    try {
      await db.query(idx.sql);
      console.log(`✅ 建立索引: ${idx.name}`);
    } catch (err) {
      // 忽略已存在的索引
      if (err.code === '42P07' || err.message.includes('already exists')) {
        console.log(`⏭️  索引已存在: ${idx.name}`);
      } else if (err.message.includes('pgvector') || err.message.includes('does not exist')) {
        console.log(`⚠️  跳過 (功能不支援): ${idx.name}`);
      } else {
        console.error(`❌ 索引建立失敗: ${idx.name}`, err.message);
      }
    }
  }

  // 分析表以優化查詢規劃
  try {
    await db.query('ANALYZE judgments');
    console.log('✅ 資料表分析完成');
  } catch (err) {
    console.error('❌ 資料表分析失敗:', err.message);
  }

  console.log('索引優化完成!');
}

// 執行優化
if (require.main === module) {
  optimizeIndexes()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('索引優化失敗:', err);
      process.exit(1);
    });
}

module.exports = { optimizeIndexes };
