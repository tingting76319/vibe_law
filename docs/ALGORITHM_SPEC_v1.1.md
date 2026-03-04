# v1.1 演算法設計規格

## 概述

本文檔定義 Legal RAG v1.1 版本的演算法優化規格，包含 LLM API 整合、RAG 優化與核心演算法設計。

---

## 1. LLM API 整合規格

### 1.1 MiniMax API 整合

#### API 配置
```javascript
// config.json
{
  "llm": {
    "provider": "minimax",
    "apiKey": "${MMKey_LAW_LLM}", // 環境變數
    "model": "MiniMax-M2.5",
    "endpoint": "https://api.minimax.chat/v1/text/chatcompletion_pro",
    "temperature": 0.7,
    "maxTokens": 2000,
    "timeout": 30000
  }
}
```

#### Prompt 優化設計

**System Prompt v1.1**
```javascript
const SYSTEM_PROMPT = `你是專業的法律顧問 AI，專精台灣法律。

## 你的角色
- 用繁體中文回答台灣法律問題
- 精確引用相關法條和判例
- 提供實用、可執行的法律建議

## 回答結構
1. **法律原則**：說明適用的法律原則
2. **相關法條**：引用具體法條編號（民法第XXX條、刑法第XXX條等）
3. **實務觀點**：根據判決實務說明可能結果
4. **行動建議**：具體的下一步建議
5. **風險提示**：提醒可能的風險和注意事項
6. **律師建議**：明確建議諮詢專業律師的情況

## 引用格式
- 法條：使用「民法第184條第1項」格式
- 判例：使用「最高法院XXX年度台簡上字第XXX號」格式
- 裁判：使用「台灣高等法院XXX年XXX字第XXX號判決」格式

## 重要原則
- 只根據提供的檢索資料回答，不編造資訊
- 資料不足時明確說明「根據現有資料無法確定」
- 區分法律意見與事實陳述
- 注意時效性，標註法規可能的變動`;
```

**優化要點**
1. 增加結構化的回答格式
2. 明確引用格式標準
3. 加入風險提示和律師建議要求
4. 強調不編造資訊的原則

---

## 2. RAG 優化規格

### 2.1 Hybrid Search 設計

#### 架構設計
```
Query → [向量搜尋] ─┐
      → [BM25]     ─┼→ → 融合排序 → Rerank → LLM
      → [關鍵詞]   ─┘
```

#### 實現方案

**向量搜尋 + BM25 融合**
```javascript
class HybridSearchService {
  constructor() {
    this.vectorWeight = 0.6;
    this.bm25Weight = 0.4;
    this.rerankTopK = 50;
  }

  async search(query, options = {}) {
    const { topK = 10, caseType, yearRange } = options;

    // 1. 向量搜尋
    const vectorResults = await this.vectorSearch(query, {
      topK: this.rerankTopK,
      caseType,
      yearRange
    });

    // 2. BM25 搜尋
    const bm25Results = await this.bm25Search(query, {
      topK: this.rerankTopK,
      caseType,
      yearRange
    });

    // 3. 分數融合 (RRF)
    const fusedResults = this.fuseResults(vectorResults, bm25Results);

    return fusedResults.slice(0, topK);
  }

  // Reciprocal Rank Fusion
  fuseResults(vectorResults, bm25Results) {
    const fused = new Map();
    const k = 60;

    vectorResults.forEach((item, rank) => {
      const score = 1 / (k + rank + 1);
      const existing = fused.get(item.caseId) || { 
        caseId: item.caseId, case: item.case,
        vectorScore: 0, bm25Score: 0, scores: []
      };
      existing.vectorScore = item.similarity;
      existing.scores.push({ source: 'vector', score });
      fused.set(item.caseId, existing);
    });

    bm25Results.forEach((item, rank) => {
      const score = 1 / (k + rank + 1);
      const existing = fused.get(item.caseId) || { 
        caseId: item.caseId, case: item.case,
        vectorScore: 0, bm25Score: 0, scores: []
      };
      existing.bm25Score = item.score;
      existing.scores.push({ source: 'bm25', score });
      fused.set(item.caseId, existing);
    });

    return Array.from(fused.values()).map(item => ({
      caseId: item.caseId,
      case: item.case,
      vectorScore: item.vectorScore,
      bm25Score: item.bm25Score,
      finalScore: item.scores.reduce((sum, s) => sum + s.score, 0)
    })).sort((a, b) => b.finalScore - a.finalScore);
  }
}
```

### 2.2 Citation Formatting 設計

#### 引用格式標準
```javascript
class CitationFormatter {
  formatJudgment(citation) {
    const { court, year, caseType, caseNumber, date } = citation;
    return {
      standard: `${court}${year}年度${caseType}字第${caseNumber}號`,
      short: `${year} ${caseType} ${caseNumber}`,
      full: `${court}${year}年度${caseType}字第${caseNumber}號判決（${date}）`
    };
  }

  formatLaw(law) {
    const { name, article, paragraph, subparagraph } = law;
    let format = `${name}第${article}條`;
    if (paragraph) format += `第${paragraph}項`;
    if (subparagraph) format += `第${subparagraph}款`;
    return format;
  }

  generateCitationList(results) {
    return results.map((r, idx) => ({
      number: idx + 1,
      court: r.case.JCOURT || '最高法院',
      year: r.case.JYEAR,
      caseType: r.case.JCASE,
      caseNumber: r.case.JID,
      title: r.case.JTITLE,
      relevance: (r.finalScore || r.similarity).toFixed(2),
      url: r.case.judgmentUrl || null
    }));
  }
}
```

### 2.3 Caching 機制設計

#### 多層快取架構
```
Request → L1: Memory Cache → L2: Redis → L3: Database
```

#### 實現方案
```javascript
class MultiLayerCache {
  constructor() {
    this.l1Memory = new Map();
    this.l1TTL = 5 * 60 * 1000;  // 5 分鐘
    this.l2TTL = 30 * 60 * 1000;
    this.startL1Cleanup();
  }

  async get(key) {
    const l1Result = this.getL1(key);
    if (l1Result) return l1Result;
    
    const l2Result = await this.getL2(key);
    if (l2Result) { this.setL1(key, l2Result); return l2Result; }
    
    const dbResult = await this.getDB(key);
    if (dbResult) {
      this.setL1(key, dbResult);
      this.setL2(key, dbResult);
    }
    return dbResult;
  }

  async cacheQueryResult(query, results, ttlMinutes = 60) {
    const cacheKey = this.generateQueryKey(query);
    const compressed = this.compressResults(results);
    await this.set(cacheKey, { query, results: compressed, timestamp: Date.now() }, ttlMinutes);
    return cacheKey;
  }

  generateQueryKey(query) {
    const normalized = query.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    }
    return `query:${Math.abs(hash).toString(36)}`;
  }

  compressResults(results) {
    return results.map(r => ({
      id: r.case?.JID || r.caseId,
      title: r.case?.JTITLE || r.title,
      court: r.case?.JCOURT || r.court,
      similarity: r.similarity || r.finalScore
    }));
  }
}
```

---

## 3. 演算法優化

### 3.1 BM25 演算法設計

```javascript
class BM25Service {
  constructor(corpus = []) {
    this.corpus = corpus;
    this.k1 = 1.5;
    this.b = 0.75;
    this.avgdl = 0;
    this.idf = new Map();
    this.initialize();
  }

  initialize() {
    this.docLengths = this.corpus.map(doc => {
      const text = typeof doc === 'string' ? doc : (doc.JFULLX?.JFULLCONTENT || doc.JTITLE || '');
      return this.tokenize(text).length;
    });
    this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / this.corpus.length;
    this.calculateIDF();
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/).filter(t => t.length > 0);
  }

  calculateIDF() {
    const N = this.corpus.length;
    const df = new Map();
    this.corpus.forEach(doc => {
      const text = typeof doc === 'string' ? doc : (doc.JFULLX?.JFULLCONTENT || doc.JTITLE || '');
      new Set(this.tokenize(text)).forEach(term => {
        df.set(term, (df.get(term) || 0) + 1);
      });
    });
    df.forEach((docFreq, term) => {
      this.idf.set(term, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1));
    });
  }

  score(query, docIndex) {
    const doc = this.corpus[docIndex];
    const text = typeof doc === 'string' ? doc : (doc.JFULLX?.JFULLCONTENT || doc.JTITLE || '');
    const terms = this.tokenize(query);
    const docLength = this.docLengths[docIndex];
    
    let score = 0;
    terms.forEach(term => {
      const tf = this.termFrequency(term, text);
      const idf = this.idf.get(term) || 0;
      if (tf > 0) {
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgdl));
        score += idf * (numerator / denominator);
      }
    });
    return score;
  }

  termFrequency(term, text) {
    return this.tokenize(text).filter(t => t === term.toLowerCase()).length;
  }

  search(query, options = {}) {
    const { topK = 10, caseType, yearRange } = options;
    let candidates = this.corpus.map((doc, idx) => ({ doc, idx }));
    
    if (caseType) candidates = candidates.filter(c => c.doc.JCASE === caseType);
    if (yearRange) candidates = candidates.filter(c => {
      const year = parseInt(c.doc.JYEAR) + 1911;
      return year >= yearRange.start && year <= yearRange.end;
    });

    return candidates.map(({ doc, idx }) => ({
      case: doc,
      score: this.score(query, idx)
    })).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
```

### 3.2 NER 實體識別設計

```javascript
class NERService {
  constructor() {
    this.patterns = this.buildPatterns();
    this.lexicon = this.buildLexicon();
  }

  buildPatterns() {
    return {
      court: /(?:(?:台灣)?(?:高等|最高|智慧財產|行政|少年及家事)?法院?|(?:地方|地方法院))/g,
      judge: /(?:(?:現任|前任|受命|陪席)?法官|審判長|推事)/g,
      lawyer: /(?:(?:執業|受任|委任)?律師|法律(?:扶助|諮詢)|辯護人)/g,
      law: /(?:(?:民法|刑法|刑事訴訟法|民事訴訟法|行政訴訟法|公司法|勞動基準法|保險法|著作權法|專利法|商標法)\s*第\s*[\d零一二三四五六七八九十百千]+條(?:\s*(?:第\s*[\d零一二三四五六七八九十百千]+項|(?:\s*第\s*[\d零一二三四五六七八九十百千]+款))?))/g,
      date: /(\d{3}|\d{4})[年\/](\d{1,2})[月\/](\d{1,2})[日]?/g,
      money: /(?:(?:新台幣|銀元|美元|日圓|歐元)\s*)?[\d,]+(?:萬|億|千|百)?(?:元|圓|美元|日圓|歐元)?/g,
      caseNumber: /(\d{3}|\d{4})年度?[\u4e00-\u9fa5]+?[字第]?\d+[號]?/g
    };
  }

  buildLexicon() {
    return {
      courts: ['最高法院', '高等法院', '智慧財產法院', '少年及家事法院', '台北地方法院', '新北地方法院', '台中地方法院', '高雄地方法院'],
      judges: ['審判長', '受命法官', '陪席法官', '法官'],
      lawyers: ['律師', '義務律師', '指定律師', '辯護人']
    };
  }

  extractEntities(text) {
    const entities = [];
    ['COURT', 'JUDGE', 'LAWYER', 'LAW', 'DATE', 'MONEY', 'CASE_NUMBER'].forEach(type => {
      const patternKey = type.toLowerCase().replace('_', '');
      const pattern = this.patterns[patternKey];
      if (pattern) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          entities.push({ type, text: match[0], start: match.index, end: match.index + match[0].length });
        }
      }
    });
    return entities;
  }

  extractFromCase(caseData) {
    const text = `${caseData.JTITLE} ${caseData.JFULLX?.JFULLCONTENT || ''} ${caseData.JABSTRACT || ''}`;
    const entities = this.extractEntities(text);
    const grouped = {
      courts: [...new Set(entities.filter(e => e.type === 'COURT').map(e => e.text))],
      judges: [...new Set(entities.filter(e => e.type === 'JUDGE').map(e => e.text))],
      lawyers: [...new Set(entities.filter(e => e.type === 'LAWYER').map(e => e.text))],
      laws: [...new Set(entities.filter(e => e.type === 'LAW').map(e => e.text))],
      dates: [...new Set(entities.filter(e => e.type === 'DATE').map(e => e.text))],
      money: [...new Set(entities.filter(e => e.type === 'MONEY').map(e => e.text))]
    };
    return grouped;
  }
}
```

### 3.3 趨勢風險分析設計

```javascript
class TrendRiskAnalysisService {
  constructor(cases = []) {
    this.cases = cases;
  }

  async analyzeTrend(query, options = {}) {
    const { caseType = null, legalIssue = null } = options;
    const filteredCases = this.filterCases({ caseType, legalIssue });
    const groupedByPeriod = this.groupByPeriod(filteredCases);
    const periodStats = await Promise.all(groupedByPeriod.map(p => this.calculatePeriodStats(p)));
    const trendMetrics = this.calculateTrendMetrics(periodStats);
    const risks = this.identifyRisks(periodStats, trendMetrics);
    return { query, periodStats, trendMetrics, risks, summary: this.generateSummary(trendMetrics, risks) };
  }

  filterCases({ caseType, legalIssue }) {
    return this.cases.filter(c => {
      if (caseType && c.JCASE !== caseType) return false;
      if (legalIssue && !(`${c.JTITLE} ${c.keywords?.join(' ') || ''}`).includes(legalIssue)) return false;
      return true;
    });
  }

  groupByPeriod(cases) {
    const currentYear = new Date().getFullYear() - 1911;
    const groups = { '最近5年': [], '6-10年前': [], '11-20年前': [], '20年前以上': [] };
    cases.forEach(c => {
      const yearsAgo = currentYear - parseInt(c.JYEAR);
      if (yearsAgo <= 5) groups['最近5年'].push(c);
      else if (yearsAgo <= 10) groups['6-10年前'].push(c);
      else if (yearsAgo <= 20) groups['11-20年前'].push(c);
      else groups['20年前以上'].push(c);
    });
    return Object.entries(groups).map(([period, cases]) => ({ period, cases, caseCount: cases.length }));
  }

  async calculatePeriodStats({ period, cases }) {
    if (cases.length === 0) return { period, caseCount: 0, winRate: 0, avgSettlement: 0 };
    const winCount = cases.filter(c => /勝訴|準予|部分勝訴/.test(c.JOUTCOME || '')).length;
    const winRate = parseFloat((winCount / cases.length * 100).toFixed(1));
    const amounts = cases.map(c => {
      const match = (c.JFULLX?.JFULLCONTENT || c.JABSTRACT || '').match(/(?:新台幣|銀元)\s*([\d,]+)(?:萬|億)?/);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }).filter(a => a > 0);
    const avgSettlement = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
    return { period, caseCount: cases.length, winRate, avgSettlement };
  }

  calculateTrendMetrics(periodStats) {
    const validStats = periodStats.filter(s => s.caseCount > 0);
    if (validStats.length < 2) return { direction: 'insufficient_data', change: 0 };
    const recent = validStats.find(s => s.period === '最近5年');
    const previous = validStats.find(s => s.period === '6-10年前') || validStats.find(s => s.period === '11-20年前');
    if (!recent || !previous) return { direction: 'insufficient_data', change: 0 };
    const winRateChange = recent.winRate - previous.winRate;
    return {
      direction: winRateChange > 5 ? 'increasing' : winRateChange < -5 ? 'decreasing' : 'stable',
      winRateChange: parseFloat(winRateChange.toFixed(1)),
      recentWinRate: recent.winRate,
      previousWinRate: previous.winRate
    };
  }

  identifyRisks(periodStats, trendMetrics) {
    const risks = [];
    if (trendMetrics.direction === 'decreasing') {
      risks.push({ type: 'trend', severity: 'high', message: `勝訴率下降 ${Math.abs(trendMetrics.winRateChange)}%` });
    }
    const recentStats = periodStats.find(s => s.period === '最近5年');
    if (!recentStats || recentStats.caseCount < 10) {
      risks.push({ type: 'data', severity: 'low', message: '近期案例數據不足' });
    }
    return risks;
  }

  generateSummary(trendMetrics, risks) {
    if (trendMetrics.direction === 'insufficient_data') return '數據不足，無法進行趨勢分析';
    const trendText = { increasing: '判決結果有利的趨勢', decreasing: '判決結果不利的趨勢', stable: '判決結果穩定' };
    let summary = `根據分析，目前判決趨勢為「${trendText[trendMetrics.direction]}」。`;
    if (risks.length > 0) {
      summary += '\n\n風險提示：';
      risks.forEach(r => { summary += `\n- [${r.severity.toUpperCase()}] ${r.message}`; });
    }
    return summary;
  }
}
```

---

## 4. 配置總覽

```javascript
// config.json 完整配置
{
  "llm": {
    "provider": "minimax",
    "model": "MiniMax-M2.5",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "hybridSearch": {
    "enabled": true,
    "vectorWeight": 0.6,
    "bm25Weight": 0.4,
    "rrfK": 60
  },
  "cache": {
    "enabled": true,
    "queryCache": { "ttlMinutes": 60 },
    "llmCache": { "ttlMinutes": 120 }
  },
  "ner": {
    "enabled": true,
    "extractCourts": true,
    "extractJudges": true,
    "extractLawyers": true,
    "extractLaws": true
  },
  "trendAnalysis": {
    "enabled": true,
    "periods": ["最近5年", "6-10年前", "11-20年前"],
    "minCasesForAnalysis": 10
  }
}
```
