# Changelog

All notable changes to this project will be documented in this file.

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
- 前端 RAG API 串接
- 手機版 UI 優化

## [v0.1] - 基礎搜尋版 (2026-03-01)

### Added
- 後端 Express API
- 6筆 Mock 判例資料
- 前端搜尋功能
- Graph RAG 框架
- GitHub Actions CI/CD
