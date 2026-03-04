# Release Notes

## v1.0.0 - 正式版 (2026-03-04)

### 🎉 正式版發布

本版本為 Legal-RAG v1.0 正式版，整合所有模組並完成測試覆蓋。

### New Features

#### 完整功能整合

**訴訟策略模組 (v0.9)**
- 訴狀分析：自動解讀原告/被告訴狀內容
- 趨勢預測：法官判斷趨勢預測、風險評估
- 策略生成：開庭前建議、質詢要點、辯護方向

**律師媒合模組 (v0.8)**
- 律師資料庫：律師基本資料、專長領域
- 案件-律師匹配：智能匹配演算法
- 推薦系統：根據案件特徵推薦最適律師

**法官/法院模組 (v0.7)**
- 法官檔案：判決統計、風格分類
- 法院分析：判決模式、趨勢統計
- 上訴維持率分析

**法規資料庫 (v0.6)**
- 法規搜尋與查詢
- 法規類別管理
- 批次匯入功能

**強化上傳管線 (v0.6.1)**
- 超時重試機制
- 錯誤追蹤與日誌
- 並發穩定性優化

### Quality and Testing

- **測試覆蓋**: 34 個測試通過 (3 個跳過，需 PostgreSQL)
- **程式碼品質**: ESLint 檢查通過
- **單元測試**: judicialRepository, services, API tests
- **整合測試**: smoke tests, upload flow tests

### API Endpoints

```
# 主系統
GET  /health                    - 健康檢查 (v1.0)

# 訴訟策略 API
POST /api/strategy/analyze-petition   - 訴狀分析
POST /api/strategy/predict-trend      - 趨勢預測
POST /api/strategy/generate-strategy  - 策略生成

# 律師媒合 API  
GET  /api/lawyers               - 律師列表
GET  /api/lawyers/search        - 律師搜尋
POST /api/matching/match        - 案件媒合
POST /api/matching/recommend    - 律師推薦

# 法官/法院 API
GET  /api/judges/profile/:id    - 法官檔案
GET  /api/judges/trends/:id     - 法官趨勢
GET  /api/courts/profile/:id    - 法院檔案
GET  /api/courts/analysis/:id   - 法院分析

# 法規 API
GET  /api/laws/search           - 法規搜尋
GET  /api/laws/:id              - 法規詳情

# 核心 API
GET  /api/judicial/search       - 判例搜尋
POST /api/rag/ask              - RAG 問答
POST /api/upload/upload        - 檔案上傳
```

### 技術規格

- **後端**: Node.js + Express
- **資料庫**: SQLite (本地) + PostgreSQL (雲端)
- **快取**: better-sqlite3
- **測試框架**: Vitest
- **程式碼檢查**: ESLint

### Known Issues

- LLM API Key 未設定，AI 問答功能需設定金鑰
- PostgreSQL 未連接，部分 API 需要資料庫支援

### 安裝說明

```bash
# 安裝依賴
npm install
npm install --prefix backend

# 設定環境變數
cp .env.example .env
# 編輯 .env 設定 DATABASE_URL

# 啟動開發伺服器
npm run dev

# 執行測試
npm run lint
npm run test:run
```

### 下一步

- [ ] 串接真實 LLM API
- [ ] 部署至正式環境
- [ ] 建立監控系統
- [ ] 完善使用者文件

---

## v0.6.0-beta.1 - API 契約強化與測試閘道版 (2026-03-04)

### New Features

#### API 契約與資料層強化
- 新增 `backend/src/repositories/judicialRepository.js`，改為共用 DB client 並集中 SQL 查詢，避免 route 每次 request 建立連線池。
- 新增 `backend/src/utils/apiResponse.js` 與 `backend/src/utils/validation.js`，統一 API 回應格式與輸入驗證。
- `GET /api/judicial/changelog` 改為實際查詢資料庫並支援分頁。
- `POST /api/judicial/auth` 改為帳密驗證流程（由 `JUDICIAL_AUTH_USER`、`JUDICIAL_AUTH_PASSWORD` 控制）。

### Quality and Testing
- 新增 repository 單元測試：`backend/tests/judicialRepository.unit.test.js`。
- API 測試更新為契約驗證（包含 `meta`、401/503 auth 錯誤路徑）。
- backend coverage gate 擴大至 routes/repositories/services/utils，並啟用 `@vitest/coverage-v8`。
- 實測結果：`npm --prefix backend run test` 與 `npm --prefix backend run test:coverage` 全數通過（21 tests）。

### MVP Roadmap (new planning baseline)
- 已建立 `MVP_VERSION_SPLIT_PLAN.md` 作為主規劃：
  - `v0.6.1` 基線穩定
  - `v0.7.0` 法官/法院邏輯引擎 MVP
  - `v0.8.0` 律師媒合 MVP
  - `v0.9.0` 律師策略與訴狀生成 MVP
  - `v1.0.0` MVP GA 上線版
- 核心北極星：最短時間媒合合適辯護律師 + 提供個案最佳訴訟策略。

### API Endpoints (updated)
```
GET  /api/judicial/search?q=...   - 判例全文搜尋（含驗證與一致回應格式）
GET  /api/judicial/cases          - 取得所有案例（分頁）
GET  /api/judicial/cases/:jid     - 取得單一案例（找不到回 404）
GET  /api/judicial/changelog      - 取得最新裁判資料清單（分頁）
POST /api/judicial/auth           - 帳密驗證並簽發 token（環境變數控制）
GET  /api/judicial/test           - 檢查 PostgreSQL 連線狀態
```

---

