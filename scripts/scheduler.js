/**
 * 判決書同步排程器
 * 每日台灣時間 00:00 執行
 * (UTC 16:00)
 */
const cron = require('node-cron');
const { downloadAndSync } = require('./judicialDailySync');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'logs', 'daily-sync.log');

// 確保日誌目錄存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  console.log(logMessage);
}

// 台灣時間 00:00 = UTC 16:00 (每天)
// cron 表達式: 秒 分 時 日 月 周
// UTC 16:00 = "0 0 16 * * *"
const CRON_EXPRESSION = '0 0 16 * * *';

console.log('🕐 判決書同步排程器已啟動');
console.log(`📅 排程: 每日台灣時間 00:00 (UTC 16:00)`);
console.log(`📝 日誌: ${LOG_FILE}`);

// 立即執行一次（測試用）
// downloadAndSync().then(log);

// 排程執行
cron.schedule(CRON_EXPRESSION, async () => {
  log('='.repeat(50));
  log('🕐 開始每日判決書同步');
  
  try {
    const result = await downloadAndSync();
    
    const message = result.success 
      ? `✅ 同步完成！新增/更新: ${result.successCount} 筆, 錯誤: ${result.errorCount} 筆, 耗時: ${result.duration}秒`
      : `❌ 同步失敗: ${result.reason}`;
    
    log(message);
    
    // 可以選擇發送通知（如 LINE 或 Email）
    // await sendNotification(message);
    
  } catch (e) {
    log(`❌ 排程執行錯誤: ${e.message}`);
  }
  
  log('='.repeat(50));
});

log('✅ 排程器已啟動，等待執行...');
