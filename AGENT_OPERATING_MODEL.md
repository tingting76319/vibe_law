# Vibe Law 多代理分工架構 (基於 v0.6.0-beta.1)

## 1. 文件目的
本文件定義本專案 AI 代理的長期分工與協作流程，作為後續版本（v0.6+）的統一參考。

## 2. 當前版本基線
- 版本：`v0.6.0-beta.1`
- 目前能力重點：
  - Judicial API 契約統一（`status/data/error/meta`）
  - `changelog/auth` 具備可用行為
  - 後端測試與 coverage gate 已啟用
  - 大檔 upload 改為背景工作 + job 輪詢

## 3. 代理角色與職責

### Leader 1
- 主責：
  - 版本路線圖、里程碑規劃、跨代理依賴排程
  - 進度盤點與風險管理（blocking issue、scope 控管）
  - 對外統一回報（Telegram）
- **Model**: MiniMax-M2.5
- 交付物：
  - 每週版本計劃、每日進度摘要、風險清單、release checklist
- KPI：
  - 里程碑達成率、逾期項目數、阻塞解除時間

### Coder 1 (Frontend/UI/UX)
- 主責：
  - 前端頁面、互動流程、元件化與使用者體驗
  - 上傳、查詢、RAG 回應、法官分析等頁面的可用性優化
- **Model**: OpenCode + MiniMax-M2.5-free
- **Fallback**: 如果 OpenCode 無反應，使用 MiniMax-M2.5-free
- 交付物：
  - UI 變更 PR、互動規格、前端測試案例（E2E 或互動測試）
- KPI：
  - UI 缺陷率、核心流程成功率、行動裝置可用性

### Coder 2 (Backend/Database)
- 主責：
  - API、資料庫 schema、效能與穩定性
  - RAG 後端、auth、upload pipeline、資料一致性
- **Model**: OpenCode + MiniMax-M2.5-free
- **Fallback**: 如果 OpenCode 無反應，使用 MiniMax-M2.5-free
- 交付物：
  - API/DB 變更 PR、migration、後端測試與效能報告
- KPI：
  - API 可用率、錯誤率、p95 latency、資料正確率

### Coder 3 (Testing/CI/CD)
- 主責：
  - 測試策略設計（unit/integration/e2e）
  - CI/CD pipeline、coverage gate、release gate
  - 對 Coder 1/2 產出做整合驗證
- **Model**: OpenCode + MiniMax-M2.5-free
- **Fallback**: 如果 OpenCode 無反應，使用 MiniMax-M2.5-free
- 交付物：
  - 測試矩陣、CI workflow、部署驗證報告
- KPI：
  - 測試覆蓋率、CI 綠燈率、回歸缺陷攔截率

### Research 1 (RAG/Graph RAG/數位孿生)
- 主責：
  - 法律專家系統演算法設計（RAG + Graph RAG）
  - 律師/法官判決行為分析與數位孿生模型
  - 評估資料集、訓練與推論品質監控
- **Model**: OpenCode + MiniMax-M2.5-free
- **Fallback**: 如果 OpenCode 無反應，使用 MiniMax-M2.5-free
- 交付物：
  - 演算法設計文件、實驗報告、評估指標、模型版本紀錄
- KPI：
  - 檢索命中率、回答品質分數、判決預判準確度

## 4. 責任邊界 (RACI 簡版)
- 版本規劃：Leader1(A), Coder1/2/3 + Research1(C)
- 前端功能：Coder1(A), Coder2(C), Coder3(RV), Leader1(I)
- 後端/DB：Coder2(A), Coder3(RV), Research1(C), Leader1(I)
- 測試/CI/CD：Coder3(A), Coder1/2(C), Leader1(I)
- 演算法/模型：Research1(A), Coder2(C), Coder3(RV), Leader1(I)
- Release：Leader1(A), Coder3(R), Coder1/2 + Research1(C)

說明：
- A = 最終負責 (Accountable)
- R = 執行 (Responsible)
- C = 諮詢 (Consulted)
- RV = 驗證 (Review/Validation)
- I = 知會 (Informed)

## 5. 工作流與交接規則

### 5.1 Sprint 節奏 (建議 1 週)
1. 週一：Leader1 發布 sprint scope + 依賴圖
2. 週二至週四：各代理開發/驗證/實驗
3. 週五：整合測試、release 決策與文件更新

### 5.2 PR 交接條件
- Coder1/2 提 PR 前必須附：
  - 變更摘要、風險、測試證據
  - 若涉及 API，必附契約變更
- Coder3 合併前必須確認：
  - CI 綠燈
  - coverage 達標
  - 回歸測試結果
- Research1 進模型到主線前必須附：
  - 指標改善證據與可回滾策略

### 5.3 Blocking 升級
- 任一代理卡關 > 4 小時：回報 Leader1
- 任一高風險項（上線/資料/資安）立即升級，停止 merge 直到風險解除

### 5.4 無反應處理
- 如果 Coder 1/2/3 或 Research 1 使用 OpenCode + MiniMax-M2.5-free 無反應：
  - **提示**: "請切換到 MiniMax-M2.5-free 模型重試"
  - 如果仍無回應，Leader1 需要介入處理

## 6. Telegram 定時回報機制 (Leader1 主導)

### 6.1 回報時間 (Asia/Taipei)
- 每日三次：`09:30`、`14:00`、`18:30`
- 每週總結：週五 `18:30`

### 6.2 回報內容格式
```
[Vibe Law Daily Sync | YYYY-MM-DD HH:mm]
Version: v0.6.x
Overall: Green / Yellow / Red

Leader1:
- 今日里程碑：
- 主要風險：
- 需要決策：

Coder1:
- 完成：
- 進行中：
- 阻塞：

Coder2:
- 完成：
- 進行中：
- 阻塞：

Coder3:
- 測試結果：
- CI/CD 狀態：
- 風險：

Research1:
- 實驗進度：
- 指標變化：
- 下一步：
```

### 6.3 狀態燈號規則
- Green：里程碑按時、無 P0 阻塞
- Yellow：有阻塞但 24 小時內可解除
- Red：核心功能/部署/資料風險，可能影響版本交付

## 7. 版本控制規範
- 分支：`codex/<agent>/<topic>`
- commit：`type(scope): summary`
- tag：
  - beta：`vX.Y.Z-beta.N`
  - release：`vX.Y.Z`
- release gate：
  - CI 全綠
  - coverage 達標
  - 文件（RELEASE/CHANGELOG）更新

## 8. v0.6 下一步建議分工
- Leader1：追蹤 v0.6 里程碑與風險看板，建立 Telegram 自動回報
- Coder1：上傳頁面進度可視化與錯誤可讀性優化（大檔/逾時/重試）
- Coder2：RAG session 永續化（Redis/PG）與查詢效能優化
- Coder3：建立 integration test fixture + 擴充 coverage 到更多 route/service
- Research1：Graph RAG 法官/律師關係圖 MVP 與判決預判基準測試

---

## 附錄：Agent Model 設定總覽

| Agent | Model | Fallback |
|-------|-------|----------|
| Leader1 | MiniMax-M2.5 | - |
| Coder 1 | OpenCode + MiniMax-M2.5-free | MiniMax-M2.5-free |
| Coder 2 | OpenCode + MiniMax-M2.5-free | MiniMax-M2.5-free |
| Coder 3 | OpenCode + MiniMax-M2.5-free | MiniMax-M2.5-free |
| Research 1 | OpenCode + MiniMax-M2.5-free | MiniMax-M2.5-free |

*最後更新: 2026-03-03*
