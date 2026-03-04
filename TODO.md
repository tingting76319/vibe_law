# 開發待辦提醒

## v0.6.1 修改項目

### 資料庫優化
- [ ] 執行 `node backend/src/scripts/addIndexes.js` 建立索引
- [ ] 清除重複資料

### 功能優化
- [ ] Upload pipeline 強化
- [ ] 法規資料庫串接（全國法規資料庫 API）

---

## v0.7.0 - 法官/法院邏輯引擎 MVP (3週)

### Research 1 進度 (特徵工程 + Graph RAG 規格)

#### ✅ 已完成
- [x] 特徵工程設計文件 (`docs/FEATURE_ENGINEERING.md`)
  - 法官判決特徵提取 (基礎特徵、判決風格、專長領域、計算特徵)
  - 法院判決模式分析 (基礎特徵、判決結果特徵、法院差異特徵)
  - 案由分布統計 (基礎統計、結果關聯、法院關聯、法官專長匹配)
  - 特徵表設計與 API 規格

- [x] Graph RAG 規格文件 (`docs/GRAPH_RAG_SPEC.md`)
  - 節點定義 (Court, Judge, Case, CaseType, Law)
  - 邊定義 (核心關係: BELONGS_TO, PRESIDES, FILED_AT 等)
  - 檢索策略 (單跳/雙跳/聚合查詢)
  - 圖譜實現架構與 API 設計
  - Neo4j Schema 設計

#### 📋 待 Coder2 後續實作
- [ ] 特徵提取腳本與資料庫遷移
- [ ] court_features, judge_features, case_type_features 表
- [ ] Graph RAG API 端點實作

---

## v0.8.0 預備
- 律師資料庫 MVP
- 媒合引擎

---

*建立於: 2026-03-03*
*更新於: 2026-03-03 (Research1 交付物完成)*
