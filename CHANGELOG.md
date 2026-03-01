# CHANGELOG - Legal-RAG

All notable changes to this project will be documented in this file.

## [v0.2.0] - 2026-03-01

### Added
- **RAG API 串接**: 前端現在可以呼叫 `/api/rag/ask` 端點取得 AI 生成的回答
- **載入指示器**: 問答時顯示 Loading 狀態，提升使用者體驗
- **本地備援機制**: 當 RAG API 不可用時，自動切換使用本地問答系統

### Improved
- **搜尋結果呈現**:
  - 判例卡片增加 hover 動畫效果
  - 標籤改為flex-wrap支援更多關鍵字顯示
  - 摘要文字限制行數，保持整齊外觀
- **手機版顯示優化**:
  - 全面響應式設計，支援 768px 和 480px 斷點
  - 熱門問題卡片改為橫向排列，節省空間
  - 問答區域標籤改為垂直堆疊
  - 法規標籤自動換行
  - 調整字體大小和間距
- **互動細節**:
  - 按鈕增加 active 狀態回饋
  - 問答項目增加淡入動畫
  - 載入旋轉動畫

### Fixed
- 修復部分 CSS 屬性相容性問題（如 background-clip）

---

## [v0.1.0] - 2026-02-?? (Initial Release)

### Added
- 基礎搜尋功能
- 熱門問題快速點擊
- 判例資料展示
- 法規查詢（民法、刑法、行政法、民事訴訟法）
- 基礎問答系統
