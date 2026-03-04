# Graph RAG 規格文件

**版本**: v0.7.0 MVP  
**模組**: 法官/法院邏輯引擎  
**作者**: Research1 (演算法設計)  
**日期**: 2026-03-03

---

## 1. 概述

本文檔定義 Graph RAG (Knowledge Graph + Retrieval-Augmented Generation) 的圖譜結構與檢索策略，用於支援法官判決邏輯分析與趨勢查詢。

### 1.1 設計目標

- 建立法官、案件、法院、案由之間的關係圖譜
- 支援多跳檢索 (Multi-hop Query)
- 實現可解釋的判決趨勢分析

### 1.2 圖譜架構

```
           ┌─────────────┐
           │    COURT    │
           └──────┬──────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   ┌─────────┐ ┌─────────┐ ┌─────────────┐
   │  JUDGE  │◄─────────►│  CASE_TYPE   │
   └────┬────┘           └──────────────┘
        │
        │ (1:N)
        ▼
   ┌─────────┐
   │  CASE   │
   └────┬────┘
        │
        ├──► LAW (法條)
        ├──► RESULT (判決結果)
        └──► CITATION (引用)
```

---

## 2. 節點定義 (Node Types)

### 2.1 Court (法院)

```javascript
{
  id: "court_臺灣臺北地方法院",
  type: "COURT",
  properties: {
    name: "臺灣臺北地方法院",
    level: "地方法院",
    region: "北部",
    total_cases: 1500,
    established: "1920-01-01"
  }
}
```

### 2.2 Judge (法官)

```javascript
{
  id: "judge_001",
  type: "JUDGE",
  properties: {
    name: "張志明",
    court: "臺灣高等法院",
    court_level: "高等法院",
    position: "法官",
    tenure_start: "2010-03-01",
    // 特徵
    specialty: ["民事侵權", "醫療糾紛"],
    style_approach: "嚴謹細緻",
    judgment_stats: {
      totalCases: 1500,
      winRate: 0.72,
      avgDuration: 8.5
    }
  }
}
```

### 2.3 Case (案件)

```javascript
{
  id: "case_test_001",
  type: "CASE",
  properties: {
    title: "車禍過失傷害案件",
    court: "臺灣臺北地方法院",
    case_type: "刑事",
    year: 111,
    result: "判處被告有期徒刑6個月",
    date: "2022-03-15",
    keywords: ["過失", "車禍", "傷害"]
  }
}
```

### 2.4 CaseType (案由)

```javascript
{
  id: "casetype_刑事",
  type: "CASE_TYPE",
  properties: {
    name: "刑事",
    category: "刑名",
    total_count: 5000,
    court_count: 50,
    win_rate: 0.65  // 原告/上訴方勝率
  }
}
```

### 2.5 Law (法條)

```javascript
{
  id: "law_刑法284",
  type: "LAW",
  properties: {
    article: "284",
    law_name: "刑法",
    title: "過失傷害罪",
    category: "刑事"
  }
}
```

---

## 3. 邊定義 (Edge Types)

### 3.1 核心關係

| 邊類型 | 來源 → 目標 | 說明 | 屬性 |
|--------|-------------|------|------|
| `BELONGS_TO` | JUDGE → COURT | 法官所屬法院 | { since: date } |
| `PRESIDES` | JUDGE → CASE | 法官審理案件 | { role: "主審"/"陪審" } |
| `FILED_AT` | CASE → COURT | 案件所屬法院 | { year, case_number } |
| `HAS_TYPE` | CASE → CASE_TYPE | 案件案由 | {} |
| `CITES` | CASE → LAW | 案件引用法條 | { article_num } |
| `HAS_RESULT` | CASE → RESULT | 案件判決結果 | { category } |
| `SPECIALIZES_IN` | JUDGE → CASE_TYPE | 法官專長案由 | { confidence: 0.0-1.0 } |

### 3.2 衍生關係

| 邊類型 | 說明 | 計算方式 |
|--------|------|----------|
| `SIMILAR_TO` | 案件相似 | 向量相似度 > 0.85 |
| `PRECEDES` | 案件先例關係 | 相同案由 + 相近事實 + 較早日期 |
| `APPEALED_FROM` | 上訴關係 | 案件ID關聯 |

---

## 4. 圖譜檢索策略

### 4.1 單跳查詢 (Single Hop)

**查詢**: "張志明法官審理過哪些案件?"

```cypher
MATCH (j:JUDGE {name: "張志明"})-[:PRESIDES]->(c:CASE)
RETURN c.title, c.case_type, c.result
```

### 4.2 雙跳查詢 (Two Hop)

**查詢**: "臺灣高等法院法官擅長哪些案由?"

```cypher
MATCH (court:COURT {name: "臺灣高等法院"})<-[:BELONGS_TO]-(j:JUDGE)
MATCH (j)-[:SPECIALIZES_IN]->(ct:CASE_TYPE)
RETURN ct.name, COUNT(*) as expertise_count
ORDER BY expertise_count DESC
```

### 4.3 聚合查詢 (Aggregation)

**查詢**: "各法院對同一案由的判決差異"

```cypher
MATCH (ct:CASE_TYPE {name: "民事"})
MATCH (c:CASE)-[:HAS_TYPE]->(ct)
MATCH (c)-[:FILED_AT]->(court:COURT)
MATCH (c)-[:HAS_RESULT]->(r:RESULT)
RETURN court.name, r.category, COUNT(*) as count
ORDER BY court.name, count DESC
```

---

## 5. Graph RAG 實現架構

### 5.1 架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                      Query Input                             │
│  "臺灣臺北地方法院法官對醫療糾紛案件的判決趨勢為何?"           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Intent Classification                       │
│  - 法院趨勢查詢 (Court Trend)                                │
│  - 法官專長查詢 (Judge Expertise)                            │
│  - 案由分析 (Case Type Analysis)                             │
│  - 判決預測 (Judgment Prediction)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Graph    │ │ Vector   │ │ Keyword  │
    │ Retrieval│ │ Retrieval│ │ Search   │
    └────┬─────┘ └────┬─────┘ └────┬─────┘
         │            │            │
         └────────────┼────────────┘
                      ▼
         ┌────────────────────────┐
         │   Context Fusion       │
         │   (Re-ranking)         │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   LLM Generation        │
         │   (with Citations)      │
         └────────────────────────┘
```

### 5.2 檢索管線

```javascript
// 圖譜檢索流程
async function graphRAG(query, context) {
  // 1. 意圖分類
  const intent = await classifyIntent(query);
  
  // 2. 實體抽取
  const entities = await extractEntities(query);
  
  // 3. 圖譜檢索
  let graphResults = [];
  if (entities.courts || entities.judges || entities.caseTypes) {
    graphResults = await queryGraph(entities, intent);
  }
  
  // 4. 向量檢索 (補充語義相關性)
  const vectorResults = await queryVectorStore(query, context);
  
  // 5. 融合與重排
  const fusedResults = await fuseAndRerank(graphResults, vectorResults);
  
  // 6. 生成回覆
  const response = await generateWithCitations(fusedResults, query);
  
  return response;
}
```

---

## 6. 預設圖譜查詢範本

### 6.1 法官-案件關係圖

```javascript
// 查詢單一法官的所有案件
const judgeCaseQuery = {
  cypher: `
    MATCH (j:JUDGE {id: $judgeId})-[p:PRESIDES]->(c:CASE)
    OPTIONAL MATCH (c)-[:HAS_TYPE]->(ct:CASE_TYPE)
    OPTIONAL MATCH (c)-[:HAS_RESULT]->(r:RESULT)
    RETURN c.id, c.title, c.case_type, c.result, ct.name as caseType, 
           p.role, c.date
    ORDER BY c.date DESC
    LIMIT $limit
  `,
  params: { judgeId: "judge_001", limit: 100 }
};

// 查詢法官在某案由的判決傾向
const judgeCaseTypeTrend = {
  cypher: `
    MATCH (j:JUDGE {id: $judgeId})-[:PRESIDES]->(c:CASE)-[:HAS_TYPE]->(ct:CASE_TYPE {name: $caseType})
    MATCH (c)-[:HAS_RESULT]->(r:RESULT)
    RETURN r.category as result, COUNT(*) as count
    ORDER BY count DESC
  `,
  params: { judgeId: "judge_001", caseType: "民事" }
};
```

### 6.2 法院-案由關係圖

```javascript
// 查詢法院的案由分布
const courtCaseTypeDistribution = {
  cypher: `
    MATCH (court:COURT {name: $courtName})<-[:FILED_AT]-(c:CASE)
    MATCH (c)-[:HAS_TYPE]->(ct:CASE_TYPE)
    RETURN ct.name as caseType, COUNT(*) as count
    ORDER BY count DESC
  `,
  params: { courtName: "臺灣臺北地方法院" }
};

// 跨法院案由比較
const courtComparison = {
  cypher: `
    MATCH (c:CASE)-[:HAS_TYPE]->(ct:CASE_TYPE {name: $caseType})
    MATCH (c)-[:FILED_AT]->(court:COURT)
    MATCH (c)-[:HAS_RESULT]->(r:RESULT)
    RETURN court.name as court, r.category as result, COUNT(*) as count
    ORDER BY court.name, count DESC
  `,
  params: { caseType: "刑事" }
};
```

### 6.3 判決趨勢圖

```javascript
// 年度趨勢查詢
const yearlyTrend = {
  cypher: `
    MATCH (c:CASE)-[:HAS_TYPE]->(ct:CASE_TYPE {name: $caseType})
    MATCH (c)-[:FILED_AT]->(court:COURT {name: $courtName})
    RETURN c.year as year, COUNT(*) as caseCount,
           collect(DISTINCT c.result)[0..5] as sampleResults
    ORDER BY year
  `,
  params: { caseType: "民事", courtName: "臺灣臺北地方法院" }
};

// 法官風格趨勢分析
const judgeStyleTrend = {
  cypher: `
    MATCH (j:JUDGE {id: $judgeId})-[:PRESIDES]->(c:CASE)
    WITH j, c, c.year as year
    MATCH (c)-[:HAS_RESULT]->(r:RESULT)
    RETURN year, r.category as result, COUNT(*) as count
    ORDER BY year, count DESC
  `,
  params: { judgeId: "judge_001" }
};
```

---

## 7. Neo4j Schema 設計

### 7.1 節點標籤

```cypher
CREATE INDEX court_name IF NOT EXISTS FOR (n:COURT) ON (n.name);
CREATE INDEX judge_id IF NOT EXISTS FOR (n:JUDGE) ON (n.id);
CREATE INDEX judge_name IF NOT EXISTS FOR (n:JUDGE) ON (n.name);
CREATE INDEX case_id IF NOT EXISTS FOR (n:CASE) ON (n.id);
CREATE INDEX case_type IF NOT EXISTS FOR (n:CASE_TYPE) ON (n.name);
CREATE INDEX law_article IF NOT EXISTS FOR (n:LAW) ON (n.article);
```

### 7.2 關係索引

```cypher
CREATE INDEX judges_court IF NOT EXISTS FOR ()-[r:BELONGS_TO]->() ON (r.since);
CREATE INDEX presiding_since IF NOT EXISTS FOR ()-[r:PRESIDES]->() ON (r.since);
```

---

## 8. API 設計

### 8.1 圖譜查詢 API

```javascript
// POST /api/graph/query
{
  query: "法官張志明最近審理的醫療糾紛案件結果如何?",
  options: {
    depth: 2,           // 檢索深度
    limit: 10,          // 返回結果數
    includeVector: true // 是否包含向量相似結果
  }
}

// Response
{
  results: [
    {
      node: { type: "CASE", id: "...", title: "...", result: "..." },
      path: "JUDGE -> PRESIDES -> CASE",
      relevance: 0.95
    }
  ],
  citations: ["case_001", "case_002"],
  generated_summary: "..."
}
```

### 8.2 趨勢分析 API

```javascript
// GET /api/analysis/trend?court=臺灣臺北地方法院&caseType=民事&yearFrom=110&yearTo=112
{
  court: "臺灣臺北地方法院",
  caseType: "民事",
  period: { from: 110, to: 112 },
  trends: [
    { year: 110, caseCount: 150, winRate: 0.68, avgDuration: 45 },
    { year: 111, caseCount: 180, winRate: 0.72, avgDuration: 42 },
    { year: 112, caseCount: 200, winRate: 0.70, avgDuration: 40 }
  ],
  courtComparison: [
    { court: "臺灣臺北地方法院", winRate: 0.70 },
    { court: "臺灣臺中地方法院", winRate: 0.65 }
  ]
}
```

---

## 9. 實現優先順序

### Phase 1 (MVP - Week 1)
- [x] Court, Judge, Case, CaseType 節點定義
- [x] BELONGS_TO, PRESIDES, FILED_AT, HAS_TYPE 邊
- [x] 基礎單跳/雙跳查詢
- [x] Neo4j Schema 與索引

### Phase 2 (MVP - Week 2)
- [ ] CITES 邊 (法條關聯)
- [ ] 向量檢索整合
- [ ] Context Fusion 實現

### Phase 3 (MVP - Week 3)
- [ ] SIMILAR_TO 邊建構
- [ ] Re-ranking 優化
- [ ] 完整 Graph RAG 管線

---

## 10. 驗收標準

- [ ] 圖譜節點數 >= 實際數據量
- [ ] 單跳查詢響應時間 < 200ms
- [ ] 雙跳查詢響應時間 < 500ms
- [ ] 查詢結果引用完整率 >= 95%
- [ ] Graph RAG 生成回覆相關性 >= 4.0/5.0

---

## 11. 待後續優化

- 動態圖譜更新 (CDC 機制)
- 實體消歧 (Entity Disambiguation)
- 時序圖譜 (Temporal Graph)
- 子圖匹配 (Subgraph Matching)
