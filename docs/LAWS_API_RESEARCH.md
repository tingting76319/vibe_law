# 法規資料庫 API 研究

## 全國法規資料庫 (law.moj.gov.tw)

### 研究發現

1. **無公開 REST API**
   - 全國法規資料庫沒有提供公開的 REST API
   - 嘗試過的 endpoint 都不存在：
     - `/api/`
     - `/api/v1/`
     - `/odata/`

2. **開放資料平台**
   - 政府資料開放平台提供法規資料集
   - 位置：https://data.gov.tw/dataset/15105
   - 需要進一步研究下載格式

3. **網頁爬蟲方案（不建議）**
   - 可以從網頁爬取法規內容
   - 但可能違反使用條款
   - 需要處理大量頁面

### 替代方案

1. **手動匯入**
   - 提供 JSON 格式的匯入 API
   - 讓管理員可以從其他來源匯入法規

2. **政府開放資料**
   - 研究 data.gov.tw 的法規資料集
   - 下載並匯入資料庫

3. **第三方 API**
   - 可以考慮付費的法律資料庫 API
   - 如：LawBank 專業版

## 法規資料表設計

### laws 表
- law_id: 法規編號（如 "刑法第100條"）
- law_name: 法規名稱
- law_category: 法規類別
- chapter/section: 章節
- article: 條號
- content: 條文內容
- effective_date: 生效日期
- related_laws: 相關法規

### 法規類別
- 刑法 (criminal)
- 民法 (civil)
- 行政法 (administrative)
- 商事法 (commercial)
- 勞動法 (labor)
- 智慧財產權法 (ip)
- 憲法 (constitutional)

## API 端點

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /api/laws/search | 搜尋法規 |
| GET | /api/laws/:lawId | 取得法規詳情 |
| GET | /api/laws/category/:category | 依類別取得法規 |
| GET | /api/laws/categories | 取得所有類別 |
| GET | /api/laws/stats | 取得統計 |
| POST | /api/laws/import | 匯入單一法規 |
| POST | /api/laws/batch-import | 批次匯入法規 |
