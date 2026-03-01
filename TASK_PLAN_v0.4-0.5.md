# v0.4 - 判決書整理優化

## 工作項目

### Coder 2 (後端)
1. **批次上傳優化**
   - 支援大檔案分片上傳
   - 顯示上傳進度
   
2. **資料驗證與清理**
   - JSON 格式驗證
   - 重複資料檢測
   - 資料正規化

3. **關鍵字萃取**
   - 自動萃取案件關鍵字
   - 案由分類

### Research 1 (RAG)
4. **向量嵌入 (Embedding)**
   - 選擇 Embedding 模型
   - 建立向量索引
   - 相似度搜尋

5. **相似案例搜尋優化**
   - 向量相似度計算
   - 多維度排序

---

# v0.5 - RAG 問答優化

## 工作項目

### Research 1 (RAG)
1. **LLM API Key 設定**
   - MiniMax API 整合
   - API Key 管理介面

2. **上下文優化**
   - Context 擷取優化
   - Token 數量控制

3. **引用來源顯示**
   - 引用判例編號
   - 引用法條

### Coder 1 (前端)
4. **多輪對話支援**
   - 對話歷史
   - 上下文延續

---

# Git 版本控制 (本地)

## 準備提交的變更

### 已修改檔案
- VERSION_PLAN.md
- backend/src/routes/judicial.js
- backend/src/routes/upload.js
- backend/src/index.js
- zeabur.json
- package.json
- upload.html

### CHANGELOG.md 草稿

```markdown
## [v0.4] - 判決書整理優化版

### Added
- PostgreSQL 資料庫支援
- ZIP/JSON 上傳功能
- 判決書匯入 API

### Changed
- 最佳化資料庫連線

## [v0.5] - RAG 問答優化版

### Added
- (進行中) 向量嵌入
- (進行中) 相似案例搜尋
- (進行中) LLM API 整合

### Changed
- (進行中) 上下文優化
```

### Tag 準備
- v0.4 - 判決書整理優化版
- v0.5 - RAG 問答優化版
