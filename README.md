# Vibe Law / Legal-RAG

![CI](https://github.com/tingting76319/vibe_law/actions/workflows/ci-cd.yml/badge.svg)

本專案提供結合法官判例資料與 RAG 對話的 Legal-RAG 系統：

- `/api/judicial/*`：連接 PostgreSQL，支援全文搜尋、單一案例、異動清單、驗證測試。
- `/api/rag/*`：多輪對話、對話歷史、回答引用來源與相關法條。
- `backend/tests`：Vitest 測試套件可在 `DATABASE_URL` 指向 PostgreSQL 時 100% 通過。

## 快速開始

1. `cp .env.example .env`，把 `.env` 的 `DATABASE_URL` 換成你的 PostgreSQL。  
2. `npm install && npm install --prefix backend`。  
3. `npm run lint`、`npm run test:run`、`npm run build`，確認品質。  
4. `npm run dev` 可啟動 backend server。

## Release

- 最新版本：`v0.5.1`（內含 PostgreSQL + RAG 整合、GitHub Actions + release notes）  
- 釋出時請同步更新 `RELEASE.md`、`CHANGELOG.md`，再推送 `main` + `vX.Y.Z`，最後用 GitHub Release UI（或 `gh release create v0.5.1 -F RELEASE.md`）貼上 release notes。

## CI / Release Checklist

最終上線流程請參考 `RELEASE_CHECKLIST.md`，確保 `lint/test/build` 皆過、tag 已打並推送、release notes 已貼上 GitHub Release。
