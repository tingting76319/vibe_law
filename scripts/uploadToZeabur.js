/**
 * 直接上傳判決書到 Zeabur 資料庫
 * 使用批量 API 端點
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ZEABUR_URL = process.env.ZEABUR_URL || 'https://vibe-law.zeabur.app';
const DATA_DIR = path.join(__dirname, '..', 'data', 'judgments');

const REQUIRED = ['JID', 'JYEAR', 'JCASE', 'JNO', 'JDATE', 'JTITLE'];

function validateItem(item) {
  for (const field of REQUIRED) {
    if (!item[field]) return false;
  }
  return true;
}

async function uploadToZeabur() {
  console.log('📤 開始上傳判決書至 Zeabur...');
  console.log(`📡 目標: ${ZEABUR_URL}`);
  
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  console.log(`📋 共有 ${files.length} 個檔案`);
  
  let success = 0;
  let error = 0;
  let skip = 0;
  
  // 每次上傳 100 個
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`📤 上傳中 (${i + 1}-${Math.min(i + BATCH_SIZE, files.length)}/${files.length})...`);
    
    const items = [];
    for (const file of batch) {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const item = JSON.parse(content);
        
        if (!validateItem(item)) {
          skip++;
          continue;
        }
        
        items.push({
          jid: item.JID,
          jyear: item.JYEAR,
          jcase: item.JCASE,
          jno: item.JNO,
          jdate: item.JDATE,
          jtitle: item.JTITLE,
          jfull: item.JFULLX?.JFULLCONTENT || '',
          jpdf: item.JFULLX?.JFULLPDF || ''
        });
      } catch (e) {
        error++;
      }
    }
    
    if (items.length === 0) continue;
    
    // 嘗試上傳
    try {
      // 使用批量儲存端點（如果存在）
      const res = await axios.post(`${ZEABUR_URL}/api/judicial/bulk-save`, { items }, { 
        timeout: 120000 
      });
      success += items.length;
      console.log(`✅ 成功上傳 ${items.length} 筆`);
    } catch (e) {
      // 如果沒有 bulk API，每個單獨上傳
      console.log(`⚠️ 批量上傳失敗，嘗試單一上傳...`);
      
      for (const item of items) {
        try {
          await axios.post(`${ZEABUR_URL}/api/judicial/save`, item, { timeout: 30000 });
          success++;
        } catch (e2) {
          error++;
        }
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('='.repeat(50));
  console.log('✅ 上傳完成！');
  console.log(`📊 成功: ${success}`);
  console.log(`❌ 錯誤: ${error}`);
  console.log(`⏭️  跳過: ${skip}`);
  
  return { success, error, skip };
}

if (require.main === module) {
  uploadToZeabur()
    .then(r => process.exit(0))
    .catch(e => {
      console.error('Fatal error:', e);
      process.exit(1);
    });
}

module.exports = { uploadToZeabur };
