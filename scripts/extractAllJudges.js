/**
 * 從所有判決書中提取法官資料
 * 使用方式: node scripts/extractAllJudges.js
 */
const db = require('../backend/src/db/postgres');

const JUDGE_PATTERN = /法\s*官\s*([^\n\r]{2,4})/g;
const CHIEF_PATTERN = /審判長\s*([^\n\r]{2,4})/g;

async function extractAllJudges() {
  console.log('🔍 開始提取法官資料...');
  
  try {
    // 取得所有判決書（分批處理）
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalExtracted = 0;
    const judgeMap = new Map();
    
    while (true) {
      console.log(`📥 處理中 (offset: ${offset})...`);
      
      const result = await db.query(`
        SELECT id, jid, jyear, jcase, jdate, jfull
        FROM judgments
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [BATCH_SIZE, offset]);
      
      if (result.rows.length === 0) break;
      
      // 提取法官
      for (const row of result.rows) {
        const judges = extractJudgesFromText(row.jfull);
        const court = row.jid?.substring(0, 4) || '';
        
        for (const name of judges) {
          const key = `${name}_${court}`;
          if (!judgeMap.has(key)) {
            judgeMap.set(key, {
              judge_name: name,
              court: court,
              jid: row.jid,
              jyear: row.jyear,
              jcase: row.jcase,
              jdate: row.jdate
            });
          }
        }
      }
      
      offset += BATCH_SIZE;
      console.log(`  已處理 ${offset} 筆判決書，找到 ${judgeMap.size} 位法官`);
      
      // 每10000筆儲存一次
      if (offset % 10000 === 0) {
        await saveJudgesToDb(Array.from(judgeMap.values()));
        totalExtracted += judgeMap.size;
        judgeMap.clear();
      }
    }
    
    // 儲存剩餘的
    if (judgeMap.size > 0) {
      await saveJudgesToDb(Array.from(judgeMap.values()));
      totalExtracted += judgeMap.size;
    }
    
    console.log('='.repeat(50));
    console.log(`✅ 完成！共提取 ${totalExtracted} 位法官`);
    
  } catch (e) {
    console.error('❌ 錯誤:', e.message);
  }
}

function extractJudgesFromText(jfull) {
  if (!jfull) return [];
  
  const judges = new Set();
  
  // 提取法官
  let match;
  while ((match = JUDGE_PATTERN.exec(jfull)) !== null) {
    const name = match[1].trim();
    if (isValidName(name)) judges.add(name);
  }
  
  // 提取審判長
  while ((match = CHIEF_PATTERN.exec(jfull)) !== null) {
    const name = match[1].trim();
    if (isValidName(name)) judges.add(name);
  }
  
  return Array.from(judges);
}

function isValidName(name) {
  if (!name || name.length < 2 || name.length > 4) return false;
  if (name.includes('法') || name.includes('官') || name.includes('簡')) return false;
  if (name.includes('審') || name.includes('判')) return false;
  return true;
}

async function saveJudgesToDb(judges) {
  console.log(`💾 儲存 ${judges.length} 位法官到資料庫...`);
  
  for (const judge of judges) {
    try {
      await db.query(`
        INSERT INTO extracted_judges (judge_name, court, jid, jyear, jcase, jdate)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [judge.judge_name, judge.court, judge.jid, judge.jyear, judge.jcase, judge.jdate]);
    } catch (e) {
      // 忽略錯誤
    }
  }
  
  console.log(`✅ 已儲存 ${judges.length} 位法官`);
}

// 執行
extractAllJudges();
