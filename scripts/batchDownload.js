const axios = require('axios');

const TOKEN = 'f3971ee888544532a2075d403934878e';
const API_BASE = 'https://data.judicial.gov.tw/jdg/api';

async function batchDownload(startDate = null, endDate = null) {
  // 1. 取得異動清單
  console.log('📥 取得判決書異動清單...');
  const listRes = await axios.post(`${API_BASE}/JList`, { token: TOKEN });
  const allJudgments = listRes.data;
  
  console.log(`找到 ${allJudgments.length} 個日期的資料`);
  
  // 2. 篩選日期範圍（可選）
  let filteredJudgments = allJudgments;
  if (startDate && endDate) {
    filteredJudgments = allJudgments.filter(item => 
      item.date >= startDate && item.date <= endDate
    );
  }
  
  // 3. 收集所有判決書 ID
  const allJids = [];
  for (const day of filteredJudgments) {
    allJids.push(...day.list);
  }
  
  console.log(`共有 ${allJids.length} 筆判決書`);
  
  // 4. 批量下載（每次最多 100 筆，避免超時）
  const results = [];
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < allJids.length; i += BATCH_SIZE) {
    const batch = allJids.slice(i, i + BATCH_SIZE);
    console.log(`📥 下載中 (${i + 1}-${Math.min(i + BATCH_SIZE, allJids.length)}/${allJids.length})...`);
    
    const promises = batch.map(async (jid) => {
      try {
        const docRes = await axios.post(`${API_BASE}/JDoc`, { token: TOKEN, j: jid });
        return docRes.data;
      } catch (e) {
        console.error(`❌ 下載失敗: ${jid}`, e.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r !== null));
    
    // 避免請求過快
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`✅ 完成！成功下載 ${results.length} 筆判決書`);
  return results;
}

// 使用範例
// 下載特定日期範圍
batchDownload('2026-02-26', '2026-02-26')
  .then(results => console.log(results))
  .catch(console.error);
