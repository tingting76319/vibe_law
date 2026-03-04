/**
 * 每日判決書同步腳本
 * - 從司法院 API 下載最新判決書
 * - 驗證格式後先儲存到本地端
 * - 每日台灣時間 00:00 執行
 * 
 * 使用方式:
 *   node scripts/judicialDailySync.js [startDate] [endDate]
 *   node scripts/judicialDailySync.js 2026-03-01 2026-03-04
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API 配置
const TOKEN = process.env.JUDICIAL_TOKEN || 'f3971ee888544532a2075d403934878e';
const API_BASE = 'https://data.judicial.gov.tw/jdg/api';

// 儲存目錄
const DATA_DIR = path.join(__dirname, '..', 'data', 'judgments');
const LOG_FILE = path.join(__dirname, 'logs', 'daily-sync.log');

// 確保目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  console.log(message);
}

// 驗證必要欄位
const REQUIRED_FIELDS = ['JID', 'JYEAR', 'JCASE', 'JNO', 'JDATE', 'JTITLE'];

function validateItem(item) {
  if (!item || typeof item !== 'object') {
    return { valid: false, field: 'item is null or not an object' };
  }
  
  for (const field of REQUIRED_FIELDS) {
    const value = item[field];
    if (!value) {
      return { valid: false, field };
    }
  }
  return { valid: true };
}

function sanitizeFilename(jid) {
  // 移除不合法的檔案名字元
  return jid.replace(/[,\/\\:*?"<>|]/g, '_');
}

async function downloadAndSync(startDate = null, endDate = null) {
  console.log('📥 開始下載判決書...');
  console.log(`📅 日期範圍: ${startDate || '最新'} - ${endDate || '最新'}`);
  
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  let validationErrors = [];
  
  try {
    // 1. 取得異動清單
    console.log('🔄 取得異動清單...');
    const listRes = await axios.post(`${API_BASE}/JList`, { token: TOKEN }, { timeout: 60000 });
    let allJudgments = listRes.data;
    
    // 2. 篩選日期範圍
    if (startDate && endDate) {
      allJudgments = allJudgments.filter(item => item.date >= startDate && item.date <= endDate);
    }
    
    // 3. 收集所有 JID
    const allJids = [];
    for (const day of allJudgments) {
      allJids.push(...day.list);
    }
    
    console.log(`📋 共有 ${allJids.length} 筆判決書 ID`);
    
    // 4. 批量下載
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < allJids.length; i += BATCH_SIZE) {
      const batch = allJids.slice(i, i + BATCH_SIZE);
      const progress = `${i + 1}-${Math.min(i + BATCH_SIZE, allJids.length)}/${allJids.length}`;
      console.log(`📥 下載中 (${progress})...`);
      
      // 並發下載
      const downloadPromises = batch.map(async (jid) => {
        try {
          const docRes = await axios.post(`${API_BASE}/JDoc`, { token: TOKEN, j: jid }, { timeout: 30000 });
          return docRes.data;
        } catch (e) {
          console.error(`❌ 下載失敗: ${jid}`, e.message);
          return { error: true, jid, message: e.message };
        }
      });
      
      const batchResults = await Promise.all(downloadPromises);
      
      // 處理每個結果
      for (const item of batchResults) {
        // 跳过下载失败的项目
        if (!item || item.error) {
          errorCount++;
          continue;
        }
        
        // 驗證格式
        const validation = validateItem(item);
        if (!validation.valid) {
          console.error(`⚠️ 格式驗證失敗: 缺少欄位 ${validation.field}, JID: ${item.JID || 'unknown'}`);
          validationErrors.push({ JID: item.JID, missingField: validation.field });
          
          // 格式不符，停止並儲存現有進度
          console.error('🛑 格式不符，停止下載！');
          break;
        }
        
        // 儲存到檔案
        try {
          const filename = sanitizeFilename(item.JID) + '.json';
          const filepath = path.join(DATA_DIR, filename);
          fs.writeFileSync(filepath, JSON.stringify(item, null, 2), 'utf8');
          successCount++;
        } catch (e) {
          console.error(`❌ 儲存失敗: ${item.JID}`, e.message);
          errorCount++;
        }
      }
      
      // 如果驗證失敗，停止下載
      if (validationErrors.length > 0) {
        break;
      }
      
      // 避免請求過快
      await new Promise(r => setTimeout(r, 200));
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('='.repeat(50));
    console.log('✅ 同步完成！');
    console.log(`📁 儲存至: ${DATA_DIR}`);
    console.log(`📊 成功: ${successCount} 筆`);
    console.log(`❌ 錯誤: ${errorCount} 筆`);
    console.log(`⏱️ 耗時: ${duration} 秒`);
    
    return {
      success: validationErrors.length === 0,
      successCount,
      errorCount,
      skipCount,
      duration,
      savedTo: DATA_DIR
    };
    
  } catch (e) {
    console.error('❌ 同步失敗:', e.message);
    return {
      success: false,
      reason: e.message,
      successCount,
      errorCount,
      skipCount
    };
  }
}

// 匯出函數
module.exports = { downloadAndSync };

// 直接執行
if (require.main === module) {
  const args = process.argv.slice(2);
  const startDate = args[0] || null;
  const endDate = args[1] || null;
  
  downloadAndSync(startDate, endDate)
    .then(result => {
      console.log('\n📋 最終結果:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(e => {
      console.error('Fatal error:', e);
      process.exit(1);
    });
}
