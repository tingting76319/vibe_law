# Changelog

All notable changes to this project will be documented in this file.

## [v0.7.0] - 法官/法院邏輯引擎 MVP (2026-03-03)

### Added
- **法院 Service**
  - 新增 `backend/src/services/courtService.js` - 法院資料庫服務
  - 提供法院資料、判決模式分析、趨勢統計

- **法官 API 路由**
  - 新增 `backend/src/routes/judges.js` - 法官相關 API
  - 端點：`/api/judges/profile/:judgeId`, `/api/judges/trends/:judgeId`, `/api/judges/trends/annual`

- **法院 API 路由**
  - 新增 `backend/src/routes/courts.js` - 法院相關 API
  - 端點：`/api/courts/profile/:courtId`, `/api/courts/analysis/:courtId`, `/api/courts/trends/*`

### Changed
- **主程式更新**
  - `backend/src/index.js` - 註冊法官/法院 API 路由
  - 版本號更新至 v0.7
  - 新增 `/api/v07/health` 健康檢查端點

### Features (特徵管線)
- 判決統計 API - `/api/judges/trends/annual`
- 法官趨勢分析 API - `/api/judges/trends/:judgeId`
- 法院判決模式 API - `/api/courts/trends/court-patterns`
- 案件類型分布 API - `/api/courts/trends/case-distribution`
- 上訴維持率 API - `/api/courts/trends/appeal-rate`


## [v0.6.1] - 法規資料庫串接版 (2026-03-03)

### Added
- **法規資料庫 Service**
  - 新增 `backend/src/services/lawService.js` - 法規資料管理服務
  - 新增 `backend/src/services/uploadPipeline.js` - 強化版上傳管線（含重試、錯誤追蹤）
  
- **法規資料 Repository**
  - 新增 `backend/src/repositories/lawRepository.js` - 法規資料庫操作
  
- **法規 API 路由**
  - 新增 `backend/src/routes/laws.js` - 法規搜尋、詳情、匯入 API
  - 端點：`/api/laws/search`, `/api/laws/:lawId`, `/api/laws/categories`, `/api/laws/stats`, `/api/laws/import`, `/api/laws/batch-import`

- **法規資料表 Migration**
  - 新增 `backend/src/db/lawsMigration.js` - PostgreSQL 法規資料表建立
  - 包含：laws, law_amendments, law_search_history 表

- **法規研究文件**
  - 新增 `docs/LAWS_API_RESEARCH.md` - 全國法規資料庫 API 研究紀錄

### Changed
- **上傳 Pipeline 強化**
  - `backend/src/services/uploadPipeline.js` - 新增超時重試機制
  - 錯誤追蹤：錯誤日誌寫入檔案、API 可查詢錯誤詳情
  - 重試配置：最多 3 次重試，支援 ECONNRESET, ETIMEDOUT 等錯誤

- **上傳路由更新**
  - `backend/src/routes/upload.js` - 使用 uploadPipeline 服務
  - 新增 `/api/upload/jobs/:jobId/errors` 端點查詢錯誤詳情

- **主程式更新**
  - `backend/src/index.js` - 註冊法規 API 路由

### Known Issues
- 全國法規資料庫無公開 API，需手動匯入或使用政府開放資料

## [v0.6.0-beta.1] - API 契約強化與測試閘道版 (2026-03-04)

### Added
- 新增 `backend/src/repositories/judicialRepository.js`，集中司法查詢 SQL 並提供 timeout 保護。
- 新增 `backend/src/utils/apiResponse.js`，統一回應格式為 `status/data/error/meta`。
- 新增 `backend/src/utils/validation.js`，提供 query/body 基礎驗證。
- 新增 repository 單元測試 `backend/tests/judicialRepository.unit.test.js`。
- 新增 v0.6 規劃文件 `NEXT_VERSION_PLAN_v0.6.md`。

### Changed
- 重構 `backend/src/routes/judicial.js`，改為 repository + validation 架構。
- `GET /api/judicial/changelog` 由 stub 改為實際資料查詢。
- `POST /api/judicial/auth` 由 stub 改為帳密驗證（`JUDICIAL_AUTH_USER`、`JUDICIAL_AUTH_PASSWORD`）。
- 調整 `backend/tests/api.test.js` 為契約導向驗證，補上 auth/changelog 行為測試。
- 擴大 coverage gate 到 `routes/repositories/services/utils`，並啟用 `@vitest/coverage-v8`。
- 更新 `.gitignore` 以排除 coverage 產物。
- 新增 `MVP_VERSION_SPLIT_PLAN.md`，並在 `VERSION_PLAN.md` 加入導引，將版本切分改為以 MVP 交付為核心。

## [v0.5.1] - 法官趨勢＋RAG 融合版 (2026-03-03)

### Added
- PostgreSQL 連線穩定化：所有 `/api/judicial` 路由都會回傳 `status: 'success'` 或 `status: 'error'`，404 會附帶錯誤訊息
- 新增 `/api/judicial/changelog`、`/api/judicial/auth`、`/api/judicial/test`，提供 mock token、資料變動與連線自查
- RAG API 拆出 `history`/`clear`，`ask` 支援 `sessionId`、引用來源、相關法條
- CI 新增 `lint`/`test:run`/`build` script；unit-test job 現在由 `DATABASE_URL` secret 指向實體資料庫

### Changed
- `package.json`、`package-lock.json` 和 `backend/package-lock.json` 以支援新的 script/依賴
- `eslint.config.js` 改成 CommonJS，避免 `npm run lint` 出現 ESM warning
- `backend/tests/api.test.js` 允許 404 回應並檢查 `status` 欄位，完整覆蓋 PostgreSQL 行為

## [v0.4] - 判決書整理優化版 (規劃中)

### Added
- (規劃中) 批次上傳優化
- (規劃中) 資料驗證與清理
- (規劃中) 關鍵字萃取
- (規劃中) 向量嵌入 (Embedding)
- (規劃中) 相似案例搜尋優化
- PostgreSQL 資料庫支援
- ZIP/JSON 上傳功能
- 判決書匯入 API
- 網頁上傳介面

### Changed
- 最佳化資料庫連線
- 調整上傳限制至 1GB

## [v0.5] - RAG 問答優化版 (規劃中)

### Added
- (規劃中) LLM API 整合
- (規劃中) 上下文優化
- (規劃中) 引用來源顯示
- (規劃中) 多輪對話支援

## [v0.3] - 法官數位孿生版 (2026-03-01)

### Added
- 法官數位孿生 API
- 判決預測服務
- 相似案例推薦
- 法官行為分析
- 完整測試框架 (Vitest + Playwright)
- CI/CD 自動化測試閘道

## [v0.2] - RAG 問答版 (2026-03-01)

### Added
- RAG 問答模組
- LLM 服務整合
- 前端 RAG API 串接手機版 UI 優化

## [v0.1] - 基礎搜尋版 (2026-03-01)

### Added
- 後端 Express API
- 6筆 Mock 判例資料
- 前端搜尋功能
- Graph RAG 框架
- GitHub Actions CI/CD
