# Release Notes

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
