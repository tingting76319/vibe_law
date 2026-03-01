# Legal-RAG 數據上傳說明

## 📁 數據資料夾位置

```
legal-rag/
├── data/
│   ├── upload/          # 上傳資料夾（放你的資料）
│   └── upload/cases_template.json  # 範例模板
```

## 📝 上傳格式

### 判例資料 (JSON)

```json
[
    {
        "id": "獨特編號",
        "court": "法院名稱",
        "year": 年度,
        "caseNumber": "案號",
        "type": "民事/刑事/行政",
        "title": "判例標題",
        "summary": "判例摘要",
        "result": "判決結果",
        "relatedLaws": ["相關法規1", "相關法規2"],
        "keywords": ["關鍵字1", "關鍵字2"],
        "date": "2020-01-01"
    }
]
```

## 🚀 上傳步驟

### 方法一：GitHub 直接上傳

1. 前往 GitHub 倉庫：https://github.com/tingting76319/EnvTest
2. 進入 `legal-rag/data/upload/` 資料夾
3. 點擊 **Add file** → **Upload files**
4. 選擇你的 JSON 檔案
5. 填寫 commit 訊息
6. 點擊 **Commit changes**

### 方法二：本地端推送

```bash
# 1. 複製倉庫
git clone https://github.com/tingting76319/EnvTest.git
cd EnvTest

# 2. 將資料放入 legal-rag/data/upload/

# 3. 推送
git add .
git commit -m "新增判例資料"
git push
```

## ⚠️ 注意事項

1. 檔案格式必須為 **UTF-8** 編碼的 **JSON**
2. 陣列格式請參考 `cases_template.json`
3. 上傳後需要修改 `js/data/cases.js` 來載入你的資料
4. 或我可以幫你修改程式自動讀取 `data/upload/` 資料夾

---

需要我幫你修改程式，讓它自動讀取上傳的資料嗎？
