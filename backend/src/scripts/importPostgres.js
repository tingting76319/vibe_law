/**
 * 裁判書匯入腳本 - PostgreSQL 版本
 * 用於將 JSON 檔案匯入資料庫
 */
const { pool, query } = require('../db/postgres');
const fs = require('fs');
const path = require('path');

// 初始化表格
async function initTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS judgments (
      id SERIAL PRIMARY KEY,
      jid TEXT UNIQUE NOT NULL,
      jyear TEXT,
      jcase TEXT,
      jno TEXT,
      jdate TEXT,
      jtitle TEXT,
      jfull TEXT,
      jpdf TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 建立索引
  await query(`CREATE INDEX IF NOT EXISTS idx_judgments_jdate ON judgments(jdate)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_judgments_jcase ON judgments(jcase)`);
  
  console.log('[Init] 資料表已就緒');
}

// 插入裁判書
async function insertJudgment(item) {
  const text = `
    INSERT INTO judgments (jid, jyear, jcase, jno, jdate, jtitle, jfull, jpdf)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (jid) DO UPDATE SET
      jyear = EXCLUDED.jyear,
      jcase = EXCLUDED.jcase,
      jno = EXCLUDED.jno,
      jdate = EXCLUDED.jdate,
      jtitle = EXCLUDED.jtitle,
      jfull = EXCLUDED.jfull,
      jpdf = EXCLUDED.jpdf
  `;
  
  const values = [
    item.JID || item.jid,
    item.JYEAR || item.jyear,
    item.JCASE || item.jcase,
    item.JNO || item.jno,
    item.JDATE || item.jdate,
    item.JTITLE || item.jtitle,
    item.JFULL || item.jfull || item.JFULLX?.JFULLCONTENT || '',
    item.JPDF || item.jpdf || item.JFULLX?.JFULLPDF || ''
  ];
  
  try {
    await query(text, values);
    console.log(`[OK] 已匯入: ${item.JID || item.jid}`);
  } catch (e) {
    console.error(`[Error] 匯入失敗: ${e.message}`);
  }
}

// 匯入檔案
async function importFile(filePath) {
  console.log(`[Import] 讀取檔案: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  
  try {
    data = JSON.parse(content);
  } catch (e) {
    // 嘗試多行 JSON
    console.log('[Import] 嘗試解析多行 JSON...');
    const lines = content.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        await insertJudgment(item);
      } catch (e2) {
        console.error('[Error] 解析失敗:', e2.message);
      }
    }
    return;
  }
  
  if (Array.isArray(data)) {
    for (const item of data) {
      await insertJudgment(item);
    }
  } else {
    await insertJudgment(data);
  }
}

// 匯入目錄
async function importDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`[Import] 找到 ${jsonFiles.length} 個 JSON 檔案`);
  
  for (const file of jsonFiles) {
    const filePath = path.join(dirPath, file);
    await importFile(filePath);
  }
}

// 顯示統計
async function showStats() {
  const total = await query('SELECT COUNT(*) as count FROM judgments');
  console.log(`\n[Stats] 總裁判書數量: ${total.rows[0].count}`);
  
  const byYear = await query(`
    SELECT jyear, COUNT(*) as count 
    FROM judgments 
    GROUP BY jyear 
    ORDER BY jyear DESC
  `);
  
  console.log('[Stats] 年度分布:');
  for (const row of byYear.rows) {
    console.log(`  ${row.jyear}: ${row.count} 件`);
  }
}

// 主程式
async function main() {
  const args = process.argv.slice(2);
  
  // 測試連線
  const connected = await testConnection();
  if (!connected) {
    console.error('[Error] 無法連接到 PostgreSQL，請確認 DATABASE_URL 環境變數');
    process.exit(1);
  }
  
  await initTable();
  
  if (args.length === 0) {
    console.log('用法:');
    console.log('  DATABASE_URL=postgresql://... node importPostgres.js <檔案或目錄路徑>');
    console.log('  DATABASE_URL=postgresql://... node importPostgres.js ./judgments/');
    return;
  }
  
  const targetPath = args[0];
  
  if (fs.statSync(targetPath).isDirectory()) {
    await importDirectory(targetPath);
  } else {
    await importFile(targetPath);
  }
  
  await showStats();
  
  await pool.end();
}

main().catch(console.error);
