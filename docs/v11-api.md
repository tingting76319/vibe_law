# Legal RAG v1.1 API Documentation

## 新增功能

### 1. 判決分類 API

#### 1.1 取得各類案件數量統計
```
GET /api/judicial/stats/case-types
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "民事": 150,
    "刑事": 80,
    "行政": 45,
    "家事": 30,
    "少年": 15,
    "憲法": 5,
    "其他": 20,
    "total": 345
  }
}
```

#### 1.2 依案件類型搜尋
```
GET /api/judicial/cases/type/:caseType
```

**Parameters:**
- `caseType`: civil | criminal | administrative | family | juvenile | constitutional
- `limit`: 回傳數量 (預設 20, 最大 100)
- `offset`: 分頁位移 (預設 0)

**Example:**
```
GET /api/judicial/cases/type/civil?limit=10
```

#### 1.3 取得單一案件分類
```
GET /api/judicial/cases/:jid/classification
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "jid": "...",
    "caseType": "民事",
    "court": "臺灣臺北地方法院",
    "caseNumber": "112年度民事字第1234號",
    "title": "xxx案件"
  }
}
```

---

### 2. Hybrid Search 混合搜尋

結合關鍵字與向量相似度的混合搜尋。

```
GET /api/judicial/search/hybrid
```

**Parameters:**
- `q`: 搜尋關鍵詞 (必填)
- `limit`: 回傳數量 (預設 20, 最大 100)
- `kw`: 關鍵字權重 0-1 (預設 0.5)
- `vw`: 向量權重 0-1 (預設 0.5)

**Example:**
```
GET /api/judicial/search/hybrid?q=過失傷害&kw=0.7&vw=0.3&limit=10
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "query": "過失傷害",
    "results": [
      {
        "jid": "...",
        "jtitle": "過失傷害案件",
        "keyword_score": 3,
        "vector_score": 0.8,
        "combined_score": 0.85,
        "source": "hybrid"
      }
    ],
    "metadata": {
      "limit": 10,
      "keywordWeight": 0.7,
      "vectorWeight": 0.3,
      "resultCount": 10
    }
  }
}
```

---

### 3. 效能優化

#### 資料庫索引
- `idx_judgments_case_type` - 案件分類索引
- `idx_judgments_title_gin` - 標題全文檢索
- `idx_judgments_full_gin` - 內容全文檢索
- `idx_judgments_date_court` - 日期+法院複合索引
- `idx_judgments_embedding_cosine` - 向量搜尋索引 (pgvector)

#### 查詢優化
- 使用 LIMIT 1 優化單一查詢
- 查詢逾時保護 (5秒)
- 預設分頁大小優化
