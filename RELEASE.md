# Release Notes

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

## v0.5 - 法官趨勢＋RAG 融合版 (2026-03-03)

### 🎉 New Features

#### 法官趨勢分析＋RAG 問答
- 整合 PostgreSQL 判例資料與多輪 RAG 問答，能同步呈現引用來源、相關案例與關聯法條
- 對話狀態會儲存在 memory map，支援 `sessionId` 讓多輪上下文保持穩定
- 新增 `/api/judicial/changelog`、`/api/judicial/auth`、`/api/judicial/test`，改寫錯誤回應都會帶 `status: 'error'`
- CI pipeline 現在有 `lint`、`test:run`、`build` script 並透過 GitHub Actions 互相串接

### API Endpoints
```
POST /api/rag/ask       - RAG 問答（多輪+來源）
POST /api/rag/clear     - 清除對話歷史
GET  /api/rag/history   - 取得對話歷史
GET  /api/rag/health    - RAG 健康檢查
GET  /api/judicial/search?q=...  - 判例全文搜尋
GET  /api/judicial/cases         - 取得所有案例
GET  /api/judicial/cases/:jid    - 查單一案例（找不到回 404）
GET  /api/judicial/changelog     - 裁判書異動清單（暫時回傳空資料）
POST /api/judicial/auth          - 模擬登入回傳 mock token
GET  /api/judicial/test          - 檢查 PostgreSQL 連線
```

### 測試與品質
- 單元測試 (Vitest) - 15/15，已連上雲端 PostgreSQL
- GitHub Actions CI 操作 `lint`、`unit-test`、`build` job
- RAG multi-turn + citation workflow 已在本地端驗證

---

## v0.3 - 法官數位孿生版 (2026-03-01)

### 🎉 New Features

#### 法官數位孿生
- **法官行為分析** - 分析法官歷史判決模式、裁判風格
- **判決預測** - 根據案件特徵預測判決結果
- **相似案例推薦** - 向量相似度計算，精準推薦相關判例
- **法官檔案頁面** - 完整法官資料、統計數據、歷史判決

#### API Endpoints
```
法官列表:         GET  /api/judge/judges
法官搜尋:         GET  /api/judge/judges/search?q=
法官行為分析:      GET  /api/judge/judges/:id/analysis
裁判風格向量:     GET  /api/judge/judges/:id/style-vector
判決預測:         POST /api/judge/predict
相似案例:         POST /api/judge/similar
```

#### 測試與品質
- 單元測試 (Vitest) - 15 tests passed
- E2E 測試 (Playwright)
- CI/CD 自動化測試閘道

---

## v0.2 - RAG 問答版 (2026-03-01)

### 🎉 New Features
- RAG 問答模組
- LLM 服務整合 (MiniMax/OpenAI)
- 前端 RAG API 串接
- 手機版 UI 優化

### API Endpoints
```
POST /api/rag/ask    - RAG 問答
GET  /api/rag/health - RAG 健康檢查
```

---

## v0.1 - 基礎搜尋版 (2026-03-01)

### 🎉 New Features
- 後端 Express API
- 6筆 Mock 判例資料
- 前端搜尋功能
- Graph RAG 框架
- GitHub Actions CI/CD

### API Endpoints
```
GET /api/judicial/cases     - 取得所有案例
GET /api/judicial/search?q= - 搜尋案例
GET /api/judicial/cases/:jid - 取得單一案例
```

---

## 🚀 Upcoming

- [ ] LLM API Key 整合 (AI 問答)
- [ ] 司法院真實 API 串接 (凌晨時段)
- [ ] Zeabur 部署上線
- [ ] v1.0 正式版

---

## 📞 Support

如有問題，請開 GitHub Issue：
https://github.com/tingting76319/vibe_law/issues
