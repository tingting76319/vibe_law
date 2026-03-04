/**
 * 將本地判決書上傳至 Zeabur 資料庫
 * 使用現有的 /api/upload 端點
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

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
  
  // 建立單一 ZIP 檔案上傳
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  
  let validCount = 0;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
      const item = JSON.parse(content);
      
      if (!validateItem(item)) {
        console.log(`⚠️ 格式不符，跳過: ${file}`);
        skip++;
        continue;
      }
      
      zip.addFile(file, Buffer.from(content));
      validCount++;
    } catch (e) {
      console.error(`❌ 讀取失敗: ${file}`, e.message);
      error++;
    }
  }
  
  console.log(`✅ 有效檔案: ${validCount}, 跳過: ${skip}, 錯誤: ${error}`);
  
  if (validCount === 0) {
    console.log('沒有檔案需要上傳');
    return { success: 0, error, skip };
  }
  
  // 儲存 ZIP 檔
  const zipPath = path.join(__dirname, '..', 'data', 'judgments.zip');
  zip.writeZip(zipPath);
  console.log(`📦 已建立 ZIP: ${zipPath}`);
  
  // 上傳
  try {
    console.log('📤 上傳中...');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(zipPath));
    
    const res = await axios.post(`${ZEABUR_URL}/api/upload`, form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 600000 // 10 分鐘
    });
    
    console.log('✅ 上傳成功！');
    console.log('📊 Job ID:', res.data?.jobId || res.data?.data?.jobId);
    
    // 檢查進度
    if (res.data?.jobId || res.data?.data?.jobId) {
      const jobId = res.data.jobId || res.data.data.jobId;
      console.log(`🔄 檢查 Job: ${jobId}`);
      
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const statusRes = await axios.get(`${ZEABUR_URL}/api/upload/jobs/${jobId}`);
          const status = statusRes.data;
          console.log(`📊 狀態: ${status.status}, 進度: ${status.progress || 0}%`);
          
          if (status.status === 'completed') {
            console.log('✅ 上傳完成！');
            success = validCount;
            break;
          } else if (status.status === 'failed') {
            console.error('❌ 上傳失敗:', status.error);
            error = validCount;
            break;
          }
        } catch (e) {
          console.log('⚠️ 無法取得狀態');
        }
      }
    }
    
  } catch (e) {
    console.error('❌ 上傳失敗:', e.message);
    error = validCount;
  }
  
  // 清理
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  console.log('='.repeat(50));
  console.log('📊 最終結果:');
  console.log(`✅ 成功: ${success}`);
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
