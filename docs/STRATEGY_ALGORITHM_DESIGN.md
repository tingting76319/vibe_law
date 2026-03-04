# 訴訟策略 MVP - 演算法設計規格書

## v0.9.0 - 4 週開發

---

## 1. 系統概述

### 1.1 目標
達成 MVP 目標 #3：律師風格對齊的訴狀/策略輸出

### 1.2 核心功能
| 功能 | 說明 |
|------|------|
| 訴狀分析 | 自動解讀訴狀內容、提取關鍵爭點、案件難度評估 |
| 趨勢預測 | 法官判斷趨勢預測、可能判決結果、風險評估 |
| 策略生成 | 開庭前建議、質詢要點、辯護方向 |

### 1.3 輸入輸出

```
輸入：
├── 訴狀/起訴狀/答辯狀（文字）
├── 案件上下文
│   ├── 案件類型
│   ├── 管轄法院
│   ├── 法官資訊
│   └── 當事人資訊
├── 證據摘要
└── 可選：被告/原告背景

輸出：
├── 案件分析報告
│   ├── 關鍵爭點列表
│   ├── 案件難度評分
│   └── 法律依據
├── 趨勢預測報告
│   ├── 法官判決趨勢
│   ├── 類似案例結果
│   └── 風險評估
└── 策略建議
    ├── 開庭前準備清單
    ├── 質詢要點
    └── 辯護方向建議
```

---

## 2. 演算法架構

### 2.1 整體流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         輸入處理層                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 文字解析 │  │ 結構化   │  │ 實體抽取 │  │ 上下文   │            │
│  │ 模組     │  │ 提取     │  │ (NER)    │  │ 建構     │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         分析引擎層                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    訴狀分析器                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ 爭點提取   │  │ 難度評估   │  │ 證據分析   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    趨勢預測器                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ 法官画像   │  │ 判決預測   │  │ 風險評估   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         策略生成層                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    策略生成器                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ 開庭前建議 │  │ 質詢要點   │  │ 辯護方向   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 模組依賴

```
llmService (LLM 服務)
    │
    ├── 風格對齊 Prompt
    ├── 結構化輸出解析
    └── 事實驗證

similarCaseRecommendation (相似案例)
    │
    ├── 歷史案例檢索
    ├── 關鍵字匹配
    └── 向量相似度

lawyerBehaviorAnalysis (律師風格)
    │
    ├── 風格向量提取
    └── 歷史文本分析

judgeTrendAnalysis (法官趨勢)
    │
    ├── 判決模式分析
    └── 法官画像構建
```

---

## 3. 訴狀分析模組

### 3.1 功能定義

| 功能 | 輸入 | 輸出 |
|------|------|------|
| 自動解讀訴狀 | 原始訴狀文字 | 結構化案件摘要 |
| 提取關鍵爭點 | 案件摘要 | 爭點列表（含信心度） |
| 案件難度評估 | 爭點 + 證據 | 難度分數 + 評估理由 |

### 3.2 演算法：自動解讀訴狀

#### 3.2.1 文字解析流程

```
輸入文字
    │
    ▼
┌─────────────────┐
│ 1. 段落分割     │ 依據換行、標點符號分割
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 2. 句子級別     │ 識別起訴人、被告、訴訟標的、
│    結構化提取   │ 請求項目、事實陳述
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 3. 關鍵資訊     │ 使用 LLM 提取關鍵實體
│    實體抽取     │ 與關係
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ 4. 結構化輸出   │ 標準化案件資料結構
└─────────────────┘
```

#### 3.2.2 實體抽取類型

```javascript
// 案件結構化資料格式
{
  caseInfo: {
    caseType: string,           // 案件類型
    caseSubType: string,        // 案件子類型
    court: string,              // 管轄法院
    caseValue: number,          // 訴訟標的金額
  },
  parties: {
    plaintiff: {
      name: string,
      type: string,             // 自然人/法人
      role: string,
    },
    defendant: {
      name: string,
      type: string,
      role: string,
    }
  },
  claims: [
    {
      type: string,             // 請求類型
      amount: number,           // 請求金額
      basis: string,            // 法律依據
      description: string,      // 請求內容
    }
  ],
  facts: [
    {
      fact: string,             // 事實陳述
      evidence: string[],       // 相關證據
      date: string,             // 相關日期
    }
  ],
  legalBasis: [
    {
      law: string,              // 法條
      article: string,          // 條文內容
      relevance: number,        // 相關性 0-1
    }
  ],
  timeline: [
    {
      event: string,
      date: string,
      type: string,             // 起訴/答辯/調解
    }
  ]
}
```

### 3.3 演算法：關鍵爭點提取

#### 3.3.1 爭點識別流程

```
案件事實 + 法律依據
        │
        ▼
┌───────────────────────────┐
│ Step 1: 事實爭點候選     │
│ 生成                     │
│ - 證據能力爭點           │
│ - 證明力爭點             │
│ - 法律適用爭點           │
│ - 法律解釋爭點           │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Step 2: 候選排序與篩選   │
│ - 重要性評分             │
│ - 與案件核心關聯度       │
│ - 勝訴影響度             │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Step 3: 輸出結構化       │
│ 爭點列表                 │
└───────────────────────────┘
```

#### 3.3.2 爭點評分公式

```javascript
/**
 * 爭點重要性評分
 * Score = w1 * CoreRelevance + w2 * VictoryImpact + w3 * EvidenceStrength
 * 
 * 權重配置：
 * - CoreRelevance (核心關聯度): 0.4
 * - VictoryImpact (勝訴影響度): 0.35
 * - EvidenceStrength (證據支撐): 0.25
 */
function calculateIssueScore(issue, caseData) {
  const coreRelevance = assessCoreRelevance(issue, caseData.claims);
  const victoryImpact = assessVictoryImpact(issue, caseData.legalBasis);
  const evidenceStrength = assessEvidenceStrength(issue, caseData.facts);
  
  const weights = { coreRelevance: 0.4, victoryImpact: 0.35, evidenceStrength: 0.25 };
  
  return (
    coreRelevance * weights.coreRelevance +
    victoryImpact * weights.victoryImpact +
    evidenceStrength * weights.evidenceStrength
  );
}
```

#### 3.3.3 爭點類型模板

| 爭點類型 | 典型問題 | 評估維度 |
|----------|----------|----------|
| 請求權基礎 | 是否存在民法第184條請求權？ | 事實構成要件 |
| 過失責任 | 被告是否有過失？ | 行為標準判斷 |
| 因果關係 | 行為與損害間是否有因果？ | 條件說/相當因果說 |
| 損害賠償範圍 | 請求金額是否合理？ | 損益相抵 |
| 證據能力 | 證據是否具有證據能力？ | 證據禁止 |
| 舉證責任 | 舉證責任如何分配？ | 法律規定 |

### 3.4 演算法：案件難度評估

#### 3.4.1 難度維度

```javascript
// 難度評估維度
const difficultyDimensions = {
  // 1. 法律複雜度
  legalComplexity: {
    factors: [
      '涉及法條數量',
      '法律競合程度',
      '學說見解分歧',
      '國外法參考程度',
    ],
    weight: 0.25,
  },
  
  // 2. 事實複雜度
  factComplexity: {
    factors: [
      '事實認定困難度',
      '證據數量',
      '證據矛盾程度',
      '時效考量',
    ],
    weight: 0.20,
  },
  
  // 3. 當事人複雜度
  partyComplexity: {
    factors: [
      '當事人數量',
      '當事人類型多樣性',
      '當事人背景',
    ],
    weight: 0.10,
  },
  
  // 4. 程序複雜度
  procedureComplexity: {
    factors: [
      '訴訟程序階段',
      '上訴可能性',
      '假扣押/假處分需求',
      '調解可能性',
    ],
    weight: 0.15,
  },
  
  // 5. 法官/法院因素
  courtFactor: {
    factors: [
      '法官專長領域',
      '法院判決趨勢',
      '法官獨立性',
    ],
    weight: 0.15,
  },
  
  // 6. 策略複雜度
  strategyComplexity: {
    factors: [
      '辯護策略多樣性',
      '談判空間',
      '替代方案可行性',
    ],
    weight: 0.15,
  },
};
```

#### 3.4.2 難度評分計算

```javascript
/**
 * 案件難度評分
 * 輸出：0-100 分，分為 5 個等級
 * 
 * 等級定義：
 * - 0-20:  簡單案件 (Simple)
 * - 21-40: 普通案件 (Standard)  
 * - 41-60: 複雜案件 (Complex)
 * - 61-80: 困難案件 (Difficult)
 * - 81-100: 極困難案件 (Very Difficult)
 */
async function assessDifficulty(caseData, context) {
  // 1. 各維度獨立評分
  const dimensionScores = {};
  
  for (const [dimension, config] of Object.entries(difficultyDimensions)) {
    const factorScores = await Promise.all(
      config.factors.map(factor => evaluateFactor(factor, caseData))
    );
    
    dimensionScores[dimension] = {
      score: average(factorScores),
      factors: factorScores,
      weight: config.weight,
    };
  }
  
  // 2. 加權計算總分
  const totalScore = Object.values(dimensionScores).reduce(
    (sum, d) => sum + d.score * d.weight, 0
  );
  
  // 3. 生成評估理由
  const reasons = generateDifficultyReasons(dimensionScores);
  
  return {
    score: Math.round(totalScore),
    level: getDifficultyLevel(totalScore),
    breakdown: dimensionScores,
    reasons,
    recommendations: getDifficultyRecommendations(totalScore),
  };
}
```

---

## 4. 趨勢預測模組

### 4.1 功能定義

| 功能 | 輸入 | 輸出 |
|------|------|------|
| 法官判決趨勢 | 法官ID + 案件類型 | 判決傾向分析 |
| 可能判決結果 | 案件資料 + 趨勢 | 結果概率分佈 |
| 風險評估 | 判決預測 + 案件 | 風險點列表 |

### 4.2 演算法：法官画像構建

#### 4.2.1 画像數據結構

```javascript
// 法官画像
{
  judgeId: string,
  basicInfo: {
    name: string,
    court: string,
    tenure: number,         // 任期年數
    specialty: string[],    // 專長領域
  },
  
  // 判決模式
  judgmentPatterns: {
    // 按案件類型分類
    byCaseType: {
      [caseType: string]: {
        totalCases: number,
        plaintiffWinRate: number,
        defendantWinRate: number,
        settlementRate: number,
        averageDuration: number,
      }
    },
    
    // 按判決類型
    byResult: {
      fullSupport: number,
      partialSupport: number,
      dismissal: number,
      transfer: number,
    },
  },
  
  // 判決風格
  style: {
    tendency: 'conservative' | 'moderate' | 'progressive',
    evidenceStandard: 'strict' | 'balanced' | 'lenient',
    penaltySeverity: 'light' | 'moderate' | 'severe',
    mediationWillingness: number,  // 0-1
  },
  
  // 趨勢數據
  trends: {
    recentChanges: [],      // 近期變化
    consistency: number,    // 一致性 0-1
    predictability: number, // 可預測性 0-1
  },
}
```

#### 4.2.2 判決傾向分析

```javascript
/**
 * 分析法官對特定案件類型的判決傾向
 * 
 * 輸入：judgeId, caseType, caseFacts
 * 輸出：判決傾向報告
 */
async function analyzeJudgmentTendency(judgeId, caseType, caseFacts) {
  // 1. 獲取法官歷史判決
  const historicalCases = await getJudgeCases(judgeId, caseType);
  
  // 2. 提取判決模式
  const patterns = extractPatterns(historicalCases);
  
  // 3. 分析當前案件特徵與歷史案件的相似度
  const similarity = calculateCaseSimilarity(caseFacts, historicalCases);
  
  // 4. 生成傾向預測
  const tendency = predictTendency(patterns, similarity);
  
  return {
    tendency: tendency.type,           // 傾向類型
    confidence: tendency.confidence,   // 信心度
    supportingCases: tendency.support,  // 支援案例
    reasoning: tendency.reasoning,    // 推理過程
    caveats: tendency.caveats,         // 注意事項
  };
}
```

### 4.3 演算法：判決結果預測

#### 4.3.1 預測模型架構

```
輸入特徵
    │
    ├── 案件特徵 (Case Features)
    │   ├── 案件類型
    │   ├── 訴訟標的
    │   ├── 爭點數量
    │   └── 證據強度
    │
    ├── 法官特徵 (Judge Features)
    │   ├── 歷史勝率
    │   ├── 判決風格
    │   └── 專長領域
    │
    ├── 當事人特徵 (Party Features)
    │   ├── 當事人類型
    │   ├── 律師經驗
    │   └── 歷史訴訟紀錄
    │
    └── 上下文特徵 (Context Features)
        ├── 相似案例結果
        ├── 法條適用趨勢
        └── 法院整體傾向
              │
              ▼
┌─────────────────────────────────────────┐
│           預測引擎                       │
│  ┌─────────────────────────────────────┐│
│  │ Feature Engineering                 ││
│  │ + Vector Similarity Matching       ││
│  │ + Rule-based Scoring                ││
│  │ + ML Model (可選)                   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              │
              ▼
輸出結果
    │
    ├── 判決結果概率分佈
    │   ├── 原告完全勝訴: 25%
    │   ├── 原告部分勝訴: 35%
    │   ├── 被告完全勝訴: 20%
    │   ├── 和解/調解: 15%
    │   └── 其他: 5%
    │
    ├── 預測理由
    │   ├── 相似案例參考
    │   ├── 法官傾向分析
    │   └── 風險因素
    │
    └── 置信度評估
```

#### 4.3.2 預測演算法

```javascript
/**
 * 判決結果預測
 * 
 * 採用混合方法：
 * 1. 相似案例加權 (50%)
 * 2. 法官傾向分析 (30%)
 * 3. 規則引擎 (20%)
 */
async function predictJudgment(caseData, judgeId, options = {}) {
  const { includeDetails = true } = options;
  
  // 1. 相似案例預測 (50%)
  const similarPrediction = await similarCaseBasedPrediction(caseData);
  
  // 2. 法官傾向預測 (30%)
  const judgePrediction = await judgeBasedPrediction(caseData, judgeId);
  
  // 3. 規則引擎預測 (20%)
  const ruleBasedPrediction(casePrediction = await ruleData);
  
  // 4. 加權融合
  const finalPrediction = mergePredictions([
    { prediction: similarPrediction, weight: 0.5 },
    { prediction: judgePrediction, weight: 0.3 },
    { prediction: rulePrediction, weight: 0.2 },
  ]);
  
  // 5. 生成詳細報告
  return {
    prediction: finalPrediction.predictedOutcome,
    probability: finalPrediction.probabilityDistribution,
    confidence: finalPrediction.confidence,
    factors: {
      positive: finalPrediction.positiveFactors,
      negative: finalPrediction.negativeFactors,
      neutral: finalPrediction.neutralFactors,
    },
    references: {
      similarCases: similarPrediction.cases,
      judgeTendency: judgePrediction.summary,
      legalBasis: rulePrediction.applicableRules,
    },
    caveats: generateCaveats(finalPrediction),
  };
}
```

### 4.4 演算法：風險評估

#### 4.4.1 風險類型

```javascript
// 風險類型定義
const riskTypes = {
  // 法律風險
  legalRisk: {
    description: '法律適用風險',
    factors: [
      '法律競合',
      '學說見解不利',
      '法條解釋風險',
      '新規範適用',
    ],
  },
  
  // 事實風險
  factualRisk: {
    description: '事實認定風險',
    factors: [
      '證據不足',
      '證據矛盾',
      '事實認定困難',
      '證人可信度',
    ],
  },
  
  // 程序風險
  proceduralRisk: {
    description: '程序風險',
    factors: [
      '時效完成',
      '送達問題',
      '程序瑕疵',
      '管轄錯誤',
    ],
  },
  
  // 當事人風險
  partyRisk: {
    description: '當事人相關風險',
    factors: [
      '當事人信用',
      '當事人配合度',
      '律師經驗',
    ],
  },
  
  // 外部風險
  externalRisk: {
    description: '外部因素風險',
    factors: [
      '法官異動',
      '政策變化',
      '社會矚目程度',
      '媒體影響',
    ],
  },
};
```

#### 4.4.2 風險評分

```javascript
/**
 * 風險評估
 * 
 * 輸出風險矩陣：
 * {
 *   risks: [
 *     {
 *       type: string,
 *       severity: 'low' | 'medium' | 'high' | 'critical',
 *       probability: number,    // 發生概率 0-1
 *       impact: number,         // 影響程度 0-1
 *       score: number,         // 風險分數 = probability * impact
 *       description: string,
 *       mitigation: string[],  // 緩解建議
 *     }
 *   ],
 *   overallRisk: {
 *     score: number,            // 總體風險 0-100
 *     level: string,           // 等級
 *     summary: string,
 *   }
 * }
 */
async function assessRisks(caseData, prediction) {
  // 1. 識別各類型風險
  const identifiedRisks = [];
  
  for (const [type, config] of Object.entries(riskTypes)) {
    for (const factor of config.factors) {
      const riskScore = await evaluateRiskFactor(
        factor, 
        caseData, 
        prediction
      );
      
      if (riskScore.probability > 0.2) {
        identifiedRisks.push({
          type: config.description,
          factor,
          severity: getSeverity(riskScore.score),
          probability: riskScore.probability,
          impact: riskScore.impact,
          score: riskScore.score,
          description: riskScore.description,
          mitigation: riskScore.mitigation,
        });
      }
    }
  }
  
  // 2. 計算總體風險
  const overallRisk = calculateOverallRisk(identifiedRisks);
  
  return {
    risks: identifiedRisks.sort((a, b) => b.score - a.score),
    overallRisk,
    recommendations: generateRiskRecommendations(identifiedRisks),
  };
}
```

---

## 5. 策略生成模組

### 5.1 功能定義

| 功能 | 輸入 | 輸出 |
|------|------|------|
| 開庭前建議 | 案件分析 + 趨勢預測 | 準備清單 + 優先事項 |
| 質詢要點 | 案件資料 + 法官風格 | 問題清單 + 時機建議 |
| 辯護方向 | 案件分析 + 風險評估 | 策略選項 + 建議 |

### 5.2 演算法：開庭前建議

#### 5.2.1 建議類型

```javascript
// 開庭前建議結構
{
  // 1. 文件準備
  documentPreparation: {
    required: [
      {
        document: string,
        purpose: string,
        deadline: string,
        priority: 'high' | 'medium' | 'low',
      }
    ],
    optional: [],
  },
  
  // 2. 證據準備
  evidencePreparation: {
    gather: [],       // 需要收集的證據
    organize: [],    // 需整理的證據
    authenticate: [], // 需認證的證據
  },
  
  // 3. 證人準備
  witnessPreparation: {
    call: [],         // 需要傳喚的證人
    prepare: [],      // 需要準備的問題
    exclude: [],      // 建議排除的證人
  },
  
  // 4. 法律研究
  legalResearch: {
    precedents: [],   // 需要研究的判例
    doctrines: [],    // 需要準備的學說
    arguments: [],    // 需要準備的法律論點
  },
  
  // 5. 策略準備
  strategyPreparation: {
    openingStatement: string,  // 開陳述要點
    keyArguments: [],          // 關鍵論點
    rebuttalPoints: [],        // 反駁要點
  },
  
  // 6. 時間線
  timeline: [
    {
      event: string,
      date: string,
      daysBeforeHearing: number,
    }
  ],
}
```

#### 5.2.2 建議生成演算法

```javascript
/**
 * 生成開庭前建議
 */
async function generatePreTrialRecommendations(caseAnalysis, trendPrediction) {
  const recommendations = {
    documentPreparation: [],
    evidencePreparation: [],
    witnessPreparation: [],
    legalResearch: [],
    strategyPreparation: [],
    timeline: [],
  };
  
  // 1. 根據案件難度生成文件建議
  if (caseAnalysis.difficulty.level === 'Complex' ||
      caseAnalysis.difficulty.level === 'Difficult') {
    recommendations.documentPreparation.push(
      ...generateDetailedDocumentList(caseAnalysis.issues)
    );
  } else {
    recommendations.documentPreparation.push(
      ...generateBasicDocumentList(caseAnalysis.caseType)
    );
  }
  
  // 2. 根據爭點生成證據建議
  for (const issue of caseAnalysis.issues) {
    const evidenceNeeds = analyzeEvidenceNeeds(issue, caseAnalysis.facts);
    recommendations.evidencePreparation.push(...evidenceNeeds);
  }
  
  // 3. 根據法官風格生成證人策略
  if (trendPrediction.judgeStyle.mediationWillingness > 0.6) {
    recommendations.witnessPreparation.push({
      recommendation: '考慮在開庭前申請調解',
      reason: '法官調解意願高',
    });
  }
  
  // 4. 根據趨勢生成法律研究重點
  recommendations.legalResearch.push(
    ...generateLegalResearchFocus(trendPrediction)
  );
  
  // 5. 生成時間線
  recommendations.timeline = generateTimeline(caseAnalysis.hearingDate);
  
  return recommendations;
}
```

### 5.3 演算法：質詢要點

#### 5.3.1 質詢類型

```javascript
// 質詢類型定義
const crossExaminationTypes = {
  // 對原告/檢方證人
  forWitness: {
    impeachment: '質疑證人可信度',
    clarification: '澄清事實細節',
    contradiction: '指出證詞矛盾',
    explanation: '要求解釋不合理處',
  },
  
  // 對被告
  forDefendant: {
    admission: '獲取有利自認',
    explanation: '要求解釋行為',
    alibi: '質詢不在場證明',
    motive: '質詢動機',
  },
  
  // 對專家證人
  forExpert: {
    methodology: '質疑鑑定方法',
    qualifications: '挑戰專業資格',
    conclusion: '挑戰結論可靠性',
    bias: '指出潛在偏見',
  },
};
```

#### 5.3.2 質詢生成

```javascript
/**
 * 根據案件資料和法官風格生成質詢要點
 */
async function generateCrossExaminationPoints(caseData, judgeStyle) {
  const points = {
    questions: [],
    timing: [],
    strategies: [],
  };
  
  // 1. 根據證據生成基礎問題
  for (const evidence of caseData.evidence) {
    const relatedQuestions = generateEvidenceQuestions(evidence);
    points.questions.push(...relatedQuestions);
  }
  
  // 2. 根據法官風格調整問題類型
  if (judgeStyle.evidenceStandard === 'strict') {
    // 嚴格法官：注重證據能力與證明力
    points.strategies.push({
      type: '證據導向',
      focus: '質疑證據的合法性和證明力',
      questions: generateEvidenceFocusQuestions(caseData),
    });
  } else if (judgeStyle.evidenceStandard === 'lenient') {
    // 寬鬆法官：注重事實陳述
    points.strategies.push({
      type: '事實導向',
      focus: '澄清事實細節',
      questions: generateFactFocusQuestions(caseData),
    });
  }
  
  // 3. 根據案件類型生成特定問題
  const typeSpecificQuestions = generateTypeSpecificQuestions(
    caseData.caseType,
    caseData.issues
  );
  points.questions.push(...typeSpecificQuestions);
  
  // 4. 生成時機建議
  points.timing = generateTimingRecommendations(
    points.questions,
    judgeStyle
  );
  
  return {
    summary: {
      totalQuestions: points.questions.length,
      estimatedDuration: estimateDuration(points.questions),
    },
    questions: points.questions,
    strategies: points.strategies,
    timing: points.timing,
    warnings: generateWarnings(points.questions, judgeStyle),
  };
}
```

### 5.4 演算法：辯護方向

#### 5.4.1 策略選項

```javascript
// 辯護策略類型
const defenseStrategies = {
  // 攻擊型
  aggressive: {
    name: '攻擊型策略',
    description: '積極反擊，質疑對方主張',
    适用场景: '證據充分、對方弱點明顯',
  },
  
  // 防禦型
  defensive: {
    name: '防禦型策略',
    description: '鞏固防線，降低損失',
    适用场景: '證據劣勢、尋求和解',
  },
  
  // 調解型
  mediation: {
    name: '調解導向策略',
    description: '尋求和解，避免訴訟風險',
    适用场景: '訴訟成本過高、雙方關係重要',
  },
  
  // 拖延型
  delaying: {
    name: '拖延策略',
    description: '爭取時間，等待有利變化',
    适用场景: '時效問題、等待新證據',
  },
};
```

#### 5.4.2 策略生成

```javascript
/**
 * 根據案件分析、風險評估、法官風格生成辯護方向
 */
async function generateDefenseStrategy(caseAnalysis, riskAssessment, judgeStyle) {
  // 1. 評估各策略適用性
  const strategyOptions = [];
  
  for (const [type, config] of Object.entries(defenseStrategies)) {
    const suitability = await assessStrategySuitability(
      type,
      caseAnalysis,
      riskAssessment,
      judgeStyle
    );
    
    strategyOptions.push({
      type,
      name: config.name,
      description: config.description,
      suitability: suitability.score,
      pros: suitability.pros,
      cons: suitability.cons,
      keyActions: suitability.actions,
    });
  }
  
  // 2. 選擇最佳策略
  const recommended = strategyOptions
    .sort((a, b) => b.suitability - a.suitability)[0];
  
  // 3. 生成詳細策略建議
  const detailedStrategy = generateDetailedStrategy(
    recommended,
    caseAnalysis,
    riskAssessment
  );
  
  // 4. 生成替代方案
  const alternatives = generateAlternatives(
    strategyOptions,
    recommended,
    caseAnalysis
  );
  
  return {
    recommended: {
      strategy: recommended.type,
      name: recommended.name,
      score: recommended.suitability,
      rationale: detailedStrategy.rationale,
      keyActions: detailedStrategy.actions,
      timeline: detailedStrategy.timeline,
    },
    alternatives: alternatives,
    riskMitigation: generateRiskMitigation(
      riskAssessment,
      recommended.type
    ),
    successFactors: identifySuccessFactors(
      caseAnalysis,
      recommended.type
    ),
  };
}
```

---

## 6. 風格對齊機制

### 6.1 律師風格向量

```javascript
// 律師風格向量
{
  styleVector: {
    aggressiveness: 0.7,           // 攻擊程度
    formality: 0.8,               // 正式程度
    detailOrientation: 0.6,        // 細節導向
    emotionalAppeal: 0.4,         // 情感訴求
    technicalFocus: 0.7,          // 技術焦點
    narrativeStyle: 'linear',     // 論述風格: linear/circular/structured
    
    // 語言特徵
    language: {
      complexity: 'moderate',      // high/moderate/low
      legalJargon: 0.8,            // 法律術語使用程度
      readability: 0.5,            // 可讀性
    },
    
    // 策略偏好
    preferences: {
      prefersSettlement: false,
      prefersTrial: true,
      usesExpertWitnesses: true,
      prefersMedia: false,
    }
  },
  
  // 歷史文本風格樣本
  styleSamples: [
    {
      type: 'opening_statement',
      text: '...',
      features: {},
    },
    {
      type: 'cross_examination',
      text: '...',
      features: {},
    },
  ],
}
```

### 6.2 風格對齊 Prompt

```javascript
/**
 * 根據律師風格調整輸出
 */
function alignToLawyerStyle(baseOutput, lawyerStyle) {
  const styleInstructions = {
    // 調整語氣
    tone: getToneAdjustment(lawyerStyle.aggressiveness),
    
    // 調整詳細程度
    detailLevel: getDetailAdjustment(lawyerStyle.detailOrientation),
    
    // 調整結構
    structure: getStructureAdjustment(lawyerStyle.narrativeStyle),
    
    // 調整術語使用
    jargonUsage: getJargonAdjustment(lawyerStyle.language.legalJargon),
  };
  
  return applyStyleTransformations(baseOutput, styleInstructions);
}
```

---

## 7. 輸出格式標準

### 7.1 完整報告結構

```json
{
  "reportId": "report_xxx",
  "generatedAt": "2024-03-04T00:00:00Z",
  
  // 案件資訊
  "caseInfo": {
    "caseId": "case_xxx",
    "caseType": "民事侵權",
    "court": "臺灣高等法院",
    "judgeId": "judge_xxx",
    "hearingDate": "2024-03-15",
  },
  
  // 訴狀分析
  "pleadingAnalysis": {
    "summary": "案件摘要...",
    "issues": [
      {
        "id": 1,
        "title": "過失責任認定",
        "description": "被告是否存在過失...",
        "importance": 0.85,
        "type": "法律爭點",
        "recommendedDefense": "建議辯護方向...",
      }
    ],
    "difficulty": {
      "score": 65,
      "level": "Complex",
      "breakdown": {
        "legalComplexity": 0.7,
        "factComplexity": 0.6,
        "partyComplexity": 0.3,
        "procedureComplexity": 0.5,
        "courtFactor": 0.7,
        "strategyComplexity": 0.6,
      }
    },
    "legalBasis": [
      {"law": "民法第184條", "relevance": 0.95},
      {"law": "民法第193條", "relevance": 0.80},
    ]
  },
  
  //