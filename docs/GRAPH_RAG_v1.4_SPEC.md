# Legal RAG v1.4 - Graph RAG 強化規格書

**版本**: v1.4.0  
**模組**: 圖譜脈絡分析引擎  
**作者**: Research1 (演算法設計)  
**日期**: 2026-03-04

---

## 1. 概述

本文檔定義 v1.4 版本的 Graph RAG 強化功能，專注於：
1. **同一判決的歷史脈絡**：追蹤案件上訴、發回、更審流程
2. **法官相似案件歷史脈絡**：法官審理案件的模式分析與相似案件匹配

---

## 2. 資料結構分析

### 2.1 司法院案件ID編碼規則

根據 mockData.json 分析，案件ID格式為：
```
CDEV,{年度},{案件類型},{案件編號},{日期},{流水號}
```

| 流水號 | 意義 |
|--------|------|
| 1 | 第一審（地方法院） |
| 2 | 第二審（高等法院）- 上訴審 |
| 3 | 高等法院更審 |
| 4 | 最高法院發回更審 |
| 5 | 最高法院駁回上訴 |
| 6+ | 歷審 |

次更### 2.2 上訴/發回/更審關聯邏輯

```
┌─────────────────────────────────────────────────────────────────────┐
│                        案件生命週期                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [地方法院] ──上訴──► [高等法院] ──上訴──► [最高法院]              │
│      │                   │                   │                      │
│      │                   │ 發回             │ 發回                 │
│      ▼                   ▼                   ▼                      │
│   更審(1)             更審(2)              更審(3)                  │
│      │                   │                                           │
│      └───────────────────┴─────────────────────────────────►       │
│                     (同一案件多個判決)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 案件關聯識別邏輯

```javascript
// 案件編號組合鍵（用於關聯同一案件的不同審級）
function getCaseGroupKey(caseData) {
  // 忽略流水號，取基本編號
  const parts = caseData.jid.split(',');
  return `${parts[1]}-${parts[2]}-${parts[3]}`; // e.g., "105-民事-1552"
}

// 判斷案件審級
function getCaseLevel(caseData) {
  const level = parseInt(caseData.jid.split(',')[5]);
  if (level === 1) return 'FIRST';         // 第一審
  if (level === 2) return 'SECOND';        // 第二審（上訴）
  if (level === 3) return 'RETRY_1';       // 高等法院更審
  if (level === 4) return 'SUPREME_RETRY'; // 最高法院發回更審
  if (level === 5) return 'SUPREME_REJECT'; // 最高法院駁回
  return `RETRY_${level - 3}`;              // 後續更審
}
```

---

## 3. 資料表設計建議

### 3.1 新增資料表：case_history（案件歷史脈絡）

```sql
CREATE TABLE IF NOT EXISTS case_history (
  id TEXT PRIMARY KEY,
  
  -- 案件關聯識別
  case_group_key TEXT NOT NULL,    -- 案件群組識別碼 (e.g., "105-民事-1552")
  root_case_id TEXT NOT NULL,      -- 原始案件ID
  
  -- 審級資訊
  case_id TEXT NOT NULL,           -- 當前案件ID
  level INTEGER NOT NULL,          -- 審級 (1=一審, 2=二審, 3=更審...)
  level_name TEXT NOT NULL,        -- 審級名稱
  
  -- 法院資訊
  court TEXT NOT NULL,             -- 審理法院
  court_level TEXT NOT NULL,       -- 法院層級 (地方法院/高等法院/最高法院)
  
  -- 日期
  case_date TEXT,                  -- 判決日期
  sequence_order INTEGER,          -- 時序順序
  
  -- 關聯
  previous_case_id TEXT,           -- 前一審案件ID (可為NULL)
  next_case_id TEXT,               -- 後一審案件ID (可為NULL)
  related_case_ids TEXT,           -- 相關案件ID列表 (JSON)
  
  -- 類型
  history_type TEXT,               -- APPEAL/RETRY/REVERSAL
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (root_case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_case_history_group ON case_history(case_group_key);
CREATE INDEX idx_case_history_root ON case_history(root_case_id);
CREATE INDEX idx_case_history_level ON case_history(level);
CREATE INDEX idx_case_history_court ON case_history(court);
```

### 3.2 新增資料表：judge_similarity_cache（法官相似案件快取）

```sql
CREATE TABLE IF NOT EXISTS judge_similarity_cache (
  id TEXT PRIMARY KEY,
  
  -- 法官識別
  judge_id TEXT NOT NULL,
  
  -- 基準案件
  base_case_id TEXT NOT NULL,
  
  -- 相似案件
  similar_case_id TEXT NOT NULL,
  
  -- 相似度分數
  similarity_score REAL NOT NULL,
  
  -- 相似維度 (JSON)
  similarity_factors TEXT,         -- {
                                   --   caseType: 0.9,
                                   --   factPattern: 0.85,
                                   --   legalIssues: 0.8,
                                   --   result: 0.75
                                   -- }
  
  -- 計算參數
  algorithm_version TEXT DEFAULT 'v1.4',
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (base_case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (similar_case_id) REFERENCES cases(id) ON DELETE CASCADE,
  
  UNIQUE(judge_id, base_case_id, similar_case_id)
);

CREATE INDEX idx_judge_sim_judge ON judge_similarity_cache(judge_id);
CREATE INDEX idx_judge_sim_case ON judge_similarity_cache(base_case_id);
CREATE INDEX idx_judge_sim_score ON judge_similarity_cache(similarity_score DESC);
```

### 3.3 擴充 judge_profiles 表

```sql
-- 新增法官特徵欄位（支援相似案件匹配）
ALTER TABLE judge_profiles ADD COLUMN recent_judgment_pattern TEXT;
ALTER TABLE judge_profiles ADD COLUMN consistent_issues TEXT;
ALTER TABLE judge_profiles ADD COLUMN style_fingerprint TEXT;
```

### 3.4 擴充 cases 表

```sql
-- 新增案件特徵欄位
ALTER TABLE cases ADD COLUMN fact_pattern TEXT;       -- 事實模式
ALTER TABLE cases ADD COLUMN legal_issues TEXT;       -- 法律爭點
ALTER TABLE cases ADD COLUMN case_group_key TEXT;     -- 案件群組
ALTER TABLE cases ADD COLUMN case_level INTEGER;      -- 審級
ALTER TABLE cases ADD COLUMN related_case_ids TEXT;   -- 相關案件
```

---

## 4. 法官相似案件匹配演算法

### 4.1 演算法架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                    法官相似案件匹配流程                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ 案件特徵    │    │ 向量嵌入    │    │ 法官指紋   │             │
│  │ 提取模組    │───►│ 生成模組    │───►│ 計算模組    │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                             │                       │
│                                             ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    多維度相似度計算                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ 案由     │ │ 事實    │ │ 法律    │ │ 判決    │       │   │
│  │  │ 相似度   │ │ 模式    │ │ 爭點    │ │ 結果    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    排名與篩選                                │   │
│  │  - 相似度閾值 >= 0.7                                         │   │
│  │  - 法官親自審理                                               │   │
│  │  - 排除當前案件                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 特徵提取

```javascript
// 案件特徵結構
const caseFeatures = {
  // 1. 案由特徵
  caseType: {
    primary: string,      // 主要案由 (e.g., "民事侵權")
    secondary: string,    // 次要案由
    category: string,    // 大類 (e.g., "民事")
  },
  
  // 2. 事實模式特徵
  factPattern: {
    parties: number,     // 當事人數量
    disputeType: string,  // 爭議類型 (財產/人身/權利)
    complexity: number,   // 事實複雜度 0-1
    timeline: number,    // 時間跨度 (天)
    evidenceCount: number,// 證據數量
  },
  
  // 3. 法律爭點特徵
  legalIssues: {
    issues: string[],     // 爭點列表
    issueTypes: string[], // 爭點類型 (請求權/過失/因果關係)
    lawCount: number,     // 涉及法條數量
  },
  
  // 4. 判決結果特徵
  judgmentResult: {
    category: string,     // 結果類型 (勝訴/敗訴/部分勝訴)
    amount: number,       // 標的金額
    penalty: string,      // 刑罰內容 (刑事)
    hasAppeal: boolean,   // 是否上訴
  },
  
  // 5. 法院特徵
  court: {
    level: string,        // 法院層級
    region: string,       // 區域
  },
};
```

### 4.3 多維度相似度計算

```javascript
/**
 * 法官相似案件匹配演算法
 * 
 * 輸出：相似案件列表，含各維度相似度與法官匹配度
 */
async function findJudgeSimilarCases(judgeId, baseCaseId, options = {}) {
  const {
    limit = 10,
    minSimilarity = 0.7,
    includeFactors = true,
    timeRange = null,  // { from: '2020-01-01', to: '2024-12-31' }
  } = options;
  
  // 1. 取得法官指紋
  const judgeFingerprint = await getJudgeFingerprint(judgeId);
  
  // 2. 取得基準案件特徵
  const baseFeatures = await extractCaseFeatures(baseCaseId);
  
  // 3. 取得法官歷史案件
  let historicalCases = await getJudgeCases(judgeId, {
    excludeCaseId: baseCaseId,
    timeRange,
  });
  
  // 4. 計算多維度相似度
  const similarities = await Promise.all(
    historicalCases.map(async (case) => {
      const caseFeatures = await extractCaseFeatures(case.id);
      
      return {
        caseId: case.id,
        scores: {
          // 案由相似度 (40%)
          caseType: calculateCaseTypeSimilarity(
            baseFeatures.caseType, 
            caseFeatures.caseType
          ),
          
          // 事實模式相似度 (25%)
          factPattern: calculateFactPatternSimilarity(
            baseFeatures.factPattern,
            caseFeatures.factPattern
          ),
          
          // 法律爭點相似度 (20%)
          legalIssues: calculateLegalIssuesSimilarity(
            baseFeatures.legalIssues,
            caseFeatures.legalIssues
          ),
          
          // 判決結果相似度 (15%)
          judgmentResult: calculateResultSimilarity(
            baseFeatures.judgmentResult,
            caseFeatures.judgmentResult
          ),
        },
        // 加權總分
        totalScore: 0,
      };
    })
  );
  
  // 5. 計算加權總分
  const weights = {
    caseType: 0.40,
    factPattern: 0.25,
    legalIssues: 0.20,
    judgmentResult: 0.15,
  };
  
  similarities.forEach((sim) => {
    sim.totalScore = 
      sim.scores.caseType * weights.caseType +
      sim.scores.factPattern * weights.factPattern +
      sim.scores.legalIssues * weights.legalIssues +
      sim.scores.judgmentResult * weights.judgmentResult;
  });
  
  // 6. 過濾與排序
  const filtered = similarities
    .filter((sim) => sim.totalScore >= minSimilarity)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
  
  // 7. 格式化輸出
  return formatSimilarCasesOutput(filtered, {
    includeFactors,
    judgeFingerprint,
  });
}

/**
 * 各維度相似度計算函數
 */

// 案由相似度 - Jaccard + 編輯距離
function calculateCaseTypeSimilarity(a, b) {
  const categorySim = a.category === b.category ? 1.0 : 0.5;
  const primarySim = levenshteinSimilarity(a.primary, b.primary);
  const secondarySim = a.secondary && b.secondary 
    ? levenshteinSimilarity(a.secondary, b.secondary) 
    : 0;
  
  return (categorySim * 0.3 + primarySim * 0.5 + secondarySim * 0.2);
}

// 事實模式相似度 - 向量距離
function calculateFactPatternSimilarity(a, b) {
  const disputeTypeSim = a.disputeType === b.disputeType ? 1.0 : 0.3;
  const complexitySim = 1 - Math.abs(a.complexity - b.complexity);
  const evidenceSim = 1 - Math.abs(a.evidenceCount - b.evidenceCount) / 
    Math.max(a.evidenceCount, b.evidenceCount, 1);
  
  return (disputeTypeSim * 0.4 + complexitySim * 0.3 + evidenceSim * 0.3);
}

// 法律爭點相似度 - Jaccard
function calculateLegalIssuesSimilarity(a, b) {
  const issueSetA = new Set(a.issues);
  const issueSetB = new Set(b.issues);
  
  const intersection = [...issueSetA].filter(x => issueSetB.has(x)).length;
  const union = new Set([...issueSetA, ...issueSetB]).size;
  
  const jaccard = union > 0 ? intersection / union : 0;
  
  // 考慮法律數量相似度
  const lawCountSim = 1 - Math.abs(a.lawCount - b.lawCount) / 
    Math.max(a.lawCount, b.lawCount, 1);
  
  return jaccard * 0.7 + lawCountSim * 0.3;
}

// 判決結果相似度
function calculateResultSimilarity(a, b) {
  const categorySim = a.category === b.category ? 1.0 : 
    (a.category.includes('部分') && b.category.includes('部分') ? 0.7 : 0.3);
  
  // 金額接近度
  let amountSim = 0;
  if (a.amount > 0 && b.amount > 0) {
    const ratio = Math.min(a.amount, b.amount) / Math.max(a.amount, b.amount);
    amountSim = ratio;
  } else {
    amountSim = 1.0; // 無金額案件視為相似
  }
  
  return categorySim * 0.6 + amountSim * 0.4;
}
```

### 4.4 法官指紋計算

```javascript
/**
 * 法官指紋 - 法官判決風格的數學表示
 * 用於匹配相似案件時考慮法官個人風格
 */
async function calculateJudgeFingerprint(judgeId) {
  const cases = await getJudgeCases(judgeId, { limit: 500 });
  
  // 統計分析
  const stats = {
    // 案件類型分佈
    caseTypeDistribution: {},
    // 結果傾向
    resultTendency: { win: 0, lose: 0, partial: 0 },
    // 平均刑罰/賠償
    avgAmount: 0,
    // 常用爭點
    commonIssues: [],
    // 審理速度
    avgDuration: 0,
  };
  
  cases.forEach((c) => {
    // 統計邏輯...
  });
  
  // 生成指紋向量
  const fingerprint = {
    vector: [
      stats.resultTendency.win / cases.length,
      stats.resultTendency.lose / cases.length,
      stats.avgAmount,
      // ... 更多維度
    ],
    signature: md5(JSON.stringify(stats)), // 用於快取比對
    computedAt: new Date().toISOString(),
  };
  
  return fingerprint;
}
```

---

## 5. API 規格設計

### 5.1 案件歷史脈絡 API

#### 5.1.1 取得案件完整歷史脈絡

```
GET /api/judicial/cases/:caseId/history
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "caseId": "CDEV,105,民事,1552,20170517,1",
    "caseGroupKey": "105-民事-1552",
    
    "timeline": [
      {
        "caseId": "CDEV,105,民事,1552,20170517,1",
        "level": 1,
        "levelName": "第一審",
        "court": "臺灣臺北地方法院",
        "courtLevel": "地方法院",
        "date": "2017-05-17",
        "result": "判處被告應賠償原告60萬元",
        "historyType": "INITIAL"
      },
      {
        "caseId": "CDEV,105,民事,1552,20170517,2",
        "level": 2,
        "levelName": "第二審",
        "court": "臺灣高等法院",
        "courtLevel": "高等法院",
        "date": "2018-03-15",
        "result": "駁回上訴，維持原判",
        "historyType": "APPEAL"
      }
    ],
    
    "currentStatus": "CLOSED",
    "totalAppeals": 1,
    "totalRetrials": 0,
    
    "summary": {
      "finalResult": "原告部分勝訴",
      "duration": "10個月",
      "proceduralHistory": "一審上訴駁回"
    }
  }
}
```

#### 5.1.2 取得案件上訴/發回紀錄

```
GET /api/judicial/cases/:caseId/appeal-records
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "rootCase": "CDEV,105,民事,1552,20170517,1",
    "totalJudgments": 2,
    
    "appeals": [
      {
        "fromCase": "CDEV,105,民事,1552,20170517,1",
        "toCase": "CDEV,105,民事,1552,20170517,2",
        "type": "APPEAL",
        "filedDate": "2017-06-01",
        "resultDate": "2018-03-15",
        "result": "駁回上訴",
        "reason": "上訴無理由"
      }
    ],
    
    "retrials": [],
    
    "reversals": []
  }
}
```

### 5.2 法官相似案件 API

#### 5.2.1 取得法官相似案件

```
GET /api/judicial/judges/:judgeId/similar-cases
```

**Query Parameters:**
| 參數 | 類型 | 說明 | 預設 |
|------|------|------|------|
| caseId | string | 基準案件ID | null |
| limit | integer | 回傳數量 | 10 |
| minSimilarity | float | 最低相似度 | 0.7 |
| caseType | string | 篩選案由 | null |
| timeFrom | string | 起始日期 | null |
| timeTo | string | 結束日期 | null |

**Response:**
```json
{
  "status": "success",
  "data": {
    "judgeId": "judge_001",
    "judgeName": "張志明",
    "baseCase": {
      "caseId": "CDEV,105,民事,1552,20170517,1",
      "title": "車禍損害賠償",
      "caseType": "民事侵權"
    },
    
    "similarCases": [
      {
        "caseId": "CDEV,104,民事,892,20160320,1",
        "title": "過失傷害賠償",
        "caseType": "民事侵權",
        "caseDate": "2016-03-20",
        "court": "臺灣臺北地方法院",
        "result": "判處賠償80萬元",
        
        "similarity": {
          "total": 0.85,
          "factors": {
            "caseType": 0.92,
            "factPattern": 0.88,
            "legalIssues": 0.80,
            "judgmentResult": 0.75
          }
        },
        
        "differences": [
          "標的金額較高",
          "涉及第三人責任"
        ]
      }
    ],
    
    "pagination": {
      "total": 156,
      "limit": 10,
      "offset": 0
    },
    
    "algorithm": "v1.4",
    "computedAt": "2026-03-04T12:00:00Z"
  }
}
```

#### 5.2.2 取得法官歷史案件脈絡分析

```
GET /api/judicial/judges/:judgeId/case-patterns
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "judgeId": "judge_001",
    "judgeName": "張志明",
    
    "fingerprint": {
      "primarySpecialty": "民事侵權",
      "secondarySpecialties": ["醫療糾紛", "不動產糾紛"],
      "resultTendency": {
        "plaintiffWinRate": 0.68,
        "defendantWinRate": 0.22,
        "partialWinRate": 0.10
      },
      "avgCaseDuration": 8.5,
      "commonIssues": [
        "過失責任認定",
        "因果關係",
        "損害賠償範圍"
      ]
    },
    
    "patternAnalysis": {
      "recentTrend": "傾向調解",
      "consistency": 0.82,
      "predictability": 0.78,
      
      "caseTypeBreakdown": [
        { "type": "民事侵權", "count": 120, "percentage": 45 },
        { "type": "醫療糾紛", "count": 60, "percentage": 22 },
        { "type": "不動產", "count": 40, "percentage": 15 }
      ],
      
      "yearlyTrend": [
        { "year": 111, "totalCases": 150, "winRate": 0.70 },
        { "year": 112, "totalCases": 165, "winRate": 0.68 },
        { "year": 113, "totalCases": 180, "winRate": 0.65 }
      ]
    },
    
    "recommendedStrategy": {
      "approach": "調解導向",
      "reason": "法官調解意願高，成功率達60%",
      "keyPoints": [
        "準備完整調解方案",
        "強調和解意願",
        "避免過度對抗"
      ]
    }
  }
}
```

### 5.3 圖譜脈絡查詢 API

#### 5.3.1 查詢案件圖譜脈絡

```
POST /api/graph/case-context
```

**Request:**
```json
{
  "caseId": "CDEV,105,民事,1552,20170517,1",
  "options": {
    "includeHistory": true,
    "includeSimilar": true,
    "includeJudge": true,
    "maxSimilarCases": 5
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "case": {
      "id": "CDEV,105,民事,1552,20170517,1",
      "title": "車禍損害賠償",
      "caseType": "民事侵權",
      "court": "臺灣臺北地方法院",
      "date": "2017-05-17",
      "result": "判處被告應賠償原告60萬元"
    },
    
    "history": {
      "timeline": [...],
      "summary": "一審上訴駁回"
    },
    
    "judge": {
      "id": "judge_001",
      "name": "張志明",
      "specialty": ["民事侵權", "醫療糾紛"],
      "recentCases": [...]
    },
    
    "similarCases": [
      {
        "caseId": "...",
        "similarity": 0.85,
        "keyFactors": [...]
      }
    ],
    
    "relatedCases": [
      {
        "caseId": "CDEV,105,民事,1552,20170517,2",
        "relation": "APPEAL",
        "result": "駁回上訴"
      }
    ]
  }
}
```

---

## 6. 實現優先順序

### Phase 1 (Week 1) - 資料層
- [ ] 設計並建立 case_history 資料表
- [ ] 設計並建立 judge_similarity_cache 資料表
- [ ] 實作案件群組 key 計算邏輯
- [ ] 實作案件歷史脈絡資料填充程式

### Phase 2 (Week 2) - 演算法層
- [ ] 實作案件特徵提取模組
- [ ] 實作多維度相似度計算
- [ ] 實作法官指紋計算
- [ ] 實作相似案件匹配引擎

### Phase 3 (Week 3) - API 層
- [ ] 實作案件歷史脈絡 API
- [ ] 實作法官相似案件 API
- [ ] 實作圖譜脈絡查詢 API
- [ ] 整合 Graph RAG 生成回覆

### Phase 4 (Week 4) - 優化
- [ ] 建立相似度快取機制
- [ ] 效能優化（批次處理）
- [ ] 測試與調優

---

## 7. 驗收標準

### 功能驗收
- [ ] 案件歷史脈絡 API 正確回傳完整上訴/發回/更審資料
- [ ] 法官相似案件 API 正確匹配相似案件
- [ ] 相似度計算準確率 >= 85%（抽樣驗證）

### 效能驗收
- [ ] 案件歷史查詢響應時間 < 300ms
- [ ] 相似案件查詢響應時間 < 500ms
- [ ] 批次處理 1000 件案件 < 30 秒

### 資料品質驗收
- [ ] 案件歷史脈絡完整率 >= 95%
- [ ] 法官指紋計算正確率 >= 90%
- [ ] 快取命中率 >= 70%

---

## 8. 待優化項目

- 動態相似度權重調整（根據法官回饋）
- 跨法官相似案件分析
- 案件趨勢預測整合
- 圖譜視覺化呈現

---

## 附錄：相關技術規格

### A. Neo4j 圖譜節點擴充

```cypher
// 案件歷史節點
CREATE (ch:CASE_HISTORY {
  id: 'history_001',
  case_group_key: '105-民事-1552',
  case_id: 'CDEV,105,民事,1552,20170517,1',
  level: 1,
  level_name: '第一審',
  court: '臺灣臺北地方法院',
  court_level: '地方法院',
  case_date: '2017-05-17',
  history_type: 'INITIAL'
});

// 歷史案件關係
CREATE (ch1:CASE_HISTORY {id: 'history_001'})-[:PRECEDES {
  type: 'APPEAL',
  filed_date: '2017-06-01',
  result_date: '2018-03-15'
}]->(ch2:CASE_HISTORY {id: 'history_002'});
```

### B. 關聯式查詢範本

```sql
-- 查詢案件完整歷史
SELECT 
  ch.*,
  c.title,
  c.result
FROM case_history ch
JOIN cases c ON ch.case_id = c.id
WHERE ch.case_group_key = (
  SELECT case_group_key 
  FROM case_history 
  WHERE case_id = :targetCaseId
)
ORDER BY ch.sequence_order;

-- 查詢法官相似案件
SELECT 
  c.*,
  jsc.similarity_score,
  jsc.similarity_factors
FROM judge_similarity_cache jsc
JOIN cases c ON jsc.similar_case_id = c.id
WHERE jsc.judge_id = :judgeId
  AND jsc.base_case_id != :excludeCaseId
  AND jsc.similarity_score >= :minSimilarity
ORDER BY jsc.similarity_score DESC
LIMIT :limit;
```
