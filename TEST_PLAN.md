# TEST_PLAN.md - 測試計劃

## 版本資訊
- **版本**: 1.0.0
- **建立日期**: 2026-03-01
- **作者**: Coder 3 (測試與 CI/CD)

---

## 1. 測試目標

確保每個版本在推送到 GitHub 前都經過完整測試，達到：
- ✅ 程式碼品質穩定
- ✅ 功能完整性驗證
- ✅ 回歸測試通過
- ✅ 自動化部署閘道

---

## 2. 測試類型

### 2.1 單元測試 (Unit Tests)
| 範圍 | 工具 | 目標 |
|------|------|------|
| Backend API 路由 | Vitest + Supertest | 測試 API 端點 |
| Backend Services | Vitest | 測試業務邏輯 |
| Models | Vitest | 測試資料模型 |

### 2.2 整合測試 (Integration Tests)
| 範圍 | 工具 | 目標 |
|------|------|------|
| Backend API 整合 | Vitest | 測試 API 與服務互動 |
| Database | Vitest | 測試資料庫連線與操作 |

### 2.3 E2E 測試 (End-to-End)
| 範圍 | 工具 | 目標 |
|------|------|------|
| 前端功能 | Playwright | 測試完整使用者流程 |
| API 功能 | Playwright | 測試 API 整合 |

---

## 3. 測試案例

### 3.1 Backend API 測試

#### `GET /api/judicial/test`
- [ ] 驗證 API 連線成功
- [ ] 回傳 status: success

#### `GET /api/judicial/cases`
- [ ] 取得所有案例列表
- [ ] 回傳資料格式正確

#### `GET /api/judicial/search?q=<keyword>`
- [ ] 搜尋關鍵字，回傳相關案例
- [ ] 無關鍵字回傳 400 錯誤

#### `GET /api/judicial/cases/:jid`
- [ ] 取得單一案例詳細資料
- [ ] 案例不存在時處理

#### `POST /api/rag/ask`
- [ ] 正常問答流程
- [ ] 無問題時回傳 400 錯誤

#### `GET /api/rag/health`
- [ ] 健康檢查回應正常

### 3.2 Service 測試

#### JudicialAPI
- [ ] `authenticate()` - 模擬驗證成功
- [ ] `searchCases()` - 搜尋功能正確
- [ ] `getAllCases()` - 取得案例列表
- [ ] `getJudgmentDoc()` - 取得裁判書內容

#### LLMService
- [ ] `generate()` - 生成回答

---

## 4. 測試環境

### 4.1 本地開發
```bash
# 安裝依賴
npm install

# 單元測試
npm run test

# E2E 測試
npm run test:e2e

# 完整 CI 測試
npm run ci
```

### 4.2 CI/CD 環境
- Node.js 20
- Ubuntu Latest
- SQLite (測試用)

---

## 5. CI/CD 流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Push/PR   │───▶│   Lint      │───▶│   Unit      │───▶│   E2E       │
│             │    │   Check     │    │   Tests     │    │   Tests     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                      │
                                                                      ▼
                                                               ┌─────────────┐
                                                               │   Build     │
                                                               │   Artifact  │
                                                               └─────────────┘
                                                                      │
                                                                      ▼
                                                               ┌─────────────┐
                                                               │  Deploy     │ (僅 master)
                                                               │  Gateway    │
                                                               └─────────────┘
```

### 閘道規則
1. **Lint 失敗** → 阻止合併
2. **單元測試失敗** → 阻止合併
3. **E2E 測試失敗** → 阻止合併
4. **只有全部通過** → 才能推送到 master

---

## 6. 測試覆蓋率目標

| 類型 | 目標 |
|------|------|
| Backend Routes | 80% |
| Backend Services | 70% |
| Critical Functions | 100% |

---

## 7. 測試資料

### Mock 資料
- 使用 `backend/data/mockData.json` 作為測試資料來源
- E2E 測試使用本地伺服器

---

## 8. 維護

- **每日**: 檢視 CI 失敗紀錄
- **每週**: 更新測試案例
- **發布前**: 完整回歸測試

---

## 9. 聯繫

如有測試問題，請聯繫 Coder 3
