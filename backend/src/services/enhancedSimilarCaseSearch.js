/**
 * Enhanced Similar Case Search Service - 增強相似案例搜尋服務 v0.4
 * 整合向量嵌入、關鍵字萃取、判決書處理
 */

const VectorEmbeddingService = require('./vectorEmbeddingService');
const KeywordExtractionService = require('./keywordExtractionService');
const JudgmentDocumentService = require('./judgmentDocumentService');
const similarCaseRecommendation = require('./similarCaseRecommendation');
const mockData = require('../../data/mockData.json');

class EnhancedSimilarCaseSearch {
  constructor() {
    this.cases = mockData.cases || [];
    this.vectorService = VectorEmbeddingService;
    this.keywordService = KeywordExtractionService;
    this.judgmentService = JudgmentDocumentService;
  }

  /**
   * 搜尋相似案例 - 主方法
   * @param {string|object} query - 搜尋關鍵詞或案例物件
   * @param {object} options - 搜尋選項
   */
  async searchSimilarCases(query, options = {}) {
    const {
      topK = 10,
      method = 'hybrid', // 'vector' | 'keyword' | 'hybrid' | 'semantic'
      caseType = null,
      yearRange = null,
      minSimilarity = 0.1,
      includeDetails = true,
      useVectorSearch = true,
      useKeywordMatch = true,
      useSemanticMatch = true
    } = options;

    let results = [];

    // 轉換查詢為案例格式
    const queryCase = this.buildQueryCase(query);

    // 根據方法選擇搜尋策略
    switch (method) {
      case 'vector':
        results = await this.vectorSearch(queryCase, { topK, caseType, yearRange, minSimilarity });
        break;
      case 'keyword':
        results = await this.keywordSearch(queryCase, { topK, caseType, yearRange });
        break;
      case 'semantic':
        results = await this.semanticSearch(queryCase, { topK, caseType, yearRange });
        break;
      case 'hybrid':
      default:
        results = await this.hybridSearch(queryCase, {
          topK,
          caseType,
          yearRange,
          minSimilarity,
          useVectorSearch,
          useKeywordMatch,
          useSemanticMatch
        });
        break;
    }

    // 格式化結果
    if (includeDetails) {
      return this.formatResults(results, queryCase);
    }

    return results;
  }

  // 建立查詢案例物件
  buildQueryCase(query) {
    if (typeof query === 'string') {
      // 從文字提取關鍵詞
      const keywords = this.keywordService.extractKeywords(query, { maxKeywords: 10 });
      const relatedLaws = this.keywordService.extractRelatedLaws(query);
      const legalIssues = this.keywordService.extractLegalIssues(query);
      const caseType = this.keywordService.extractKeywords(query, {
        includeCaseType: true,
        includeLegalIssues: false,
        maxKeywords: 1
      });

      return {
        JID: 'QUERY',
        JTITLE: query,
        JCASE: caseType[0]?.label || '民事',
        JYEAR: new Date().getFullYear().toString(),
        JDATE: new Date().toISOString().split('T')[0],
        JFULLX: { JFULLCONTENT: query },
        keywords: keywords.map(k => k.keyword),
        relatedLaws,
        legalIssues
      };
    }
    return query;
  }

  // 向量搜尋
  async vectorSearch(queryCase, options) {
    const { topK, caseType, yearRange, minSimilarity } = options;
    
    const candidates = this.filterCandidates({ caseType, yearRange });
    
    const queryVector = await this.vectorService.embedCase(queryCase);
    
    const results = await Promise.all(
      candidates.map(async (c) => {
        const caseVector = await this.vectorService.embedCase(c);
        const similarity = this.vectorService.cosineSimilarity(queryVector, caseVector);
        
        return {
          case: c,
          similarity,
          vectorSimilarity: similarity,
          method: 'vector'
        };
      })
    );

    return results
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 關鍵詞匹配搜尋
  keywordSearch(queryCase, options) {
    const { topK, caseType, yearRange } = options;
    
    const candidates = this.filterCandidates({ caseType, yearRange });
    const queryKeywords = new Set(queryCase.keywords || []);
    const queryLaws = new Set(queryCase.relatedLaws || []);

    const results = candidates.map(c => {
      const caseKeywords = new Set((c.keywords || []).map(k => k.toLowerCase()));
      const caseLaws = new Set((c.relatedLaws || []).map(l => l.toLowerCase()));
      
      // 計算關鍵詞匹配分數
      let keywordScore = 0;
      queryKeywords.forEach(k => {
        if (caseKeywords.has(k.toLowerCase())) keywordScore += 1;
      });
      
      // 計算法條匹配分數
      let lawScore = 0;
      queryLaws.forEach(l => {
        if (caseLaws.has(l.toLowerCase())) lawScore += 1;
      });
      
      // 標準化
      const maxPossibleKeywords = Math.max(queryKeywords.size, 1);
      const maxPossibleLaws = Math.max(queryLaws.size, 1);
      
      const normalizedKeywordScore = keywordScore / maxPossibleKeywords;
      const normalizedLawScore = lawScore / maxPossibleLaws;
      
      // 最終分數 (關鍵詞權重 0.6, 法條權重 0.4)
      const similarity = (normalizedKeywordScore * 0.6) + (normalizedLawScore * 0.4);

      return {
        case: c,
        similarity,
        keywordScore,
        lawScore,
        method: 'keyword'
      };
    });

    return results
      .filter(r => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 語意搜尋
  semanticSearch(queryCase, options) {
    // 使用原有的similarCaseRecommendation服務
    const results = similarCaseRecommendation.findSimilarCases(queryCase, {
      topK: options.topK,
      caseType: options.caseType,
      yearRange: options.yearRange ? {
        start: options.yearRange.start + 1911,
        end: options.yearRange.end + 1911
      } : null
    });

    // similarCaseRecommendation 返回的格式是 { id, title, similarity: { score }, ... }
    // 需要轉換為 { case: { JID, ... }, similarity: ... }
    return results.map(r => ({
      case: {
        JID: r.id,
        JTITLE: r.title,
        JCASE: r.caseType,
        JYEAR: r.year,
        JDATE: r.date,
        JFULLX: { JFULLCONTENT: r.summary || '' },
        keywords: r.keywords || [],
        relatedLaws: r.relatedLaws || []
      },
      similarity: r.similarity?.score || r.similarity,
      method: 'semantic'
    }));
  }

  // 混合搜尋
  async hybridSearch(queryCase, options) {
    const {
      topK,
      caseType,
      yearRange,
      minSimilarity,
      useVectorSearch,
      useKeywordMatch,
      useSemanticMatch
    } = options;

    // 各方法權重
    const weights = {
      vector: useVectorSearch ? 0.4 : 0,
      keyword: useKeywordMatch ? 0.3 : 0,
      semantic: useSemanticMatch ? 0.3 : 0
    };

    // 正規化權重
    const totalWeight = weights.vector + weights.keyword + weights.semantic;
    if (totalWeight > 0) {
      weights.vector /= totalWeight;
      weights.keyword /= totalWeight;
      weights.semantic /= totalWeight;
    }

    // 執行各類搜尋
    const searchPromises = [];
    
    if (useVectorSearch) {
      searchPromises.push(this.vectorSearch(queryCase, { topK: topK * 2, caseType, yearRange, minSimilarity: 0 }));
    }
    
    if (useKeywordMatch) {
      searchPromises.push(this.keywordSearch(queryCase, { topK: topK * 2, caseType, yearRange }));
    }
    
    if (useSemanticMatch) {
      searchPromises.push(this.semanticSearch(queryCase, { topK: topK * 2, caseType, yearRange }));
    }

    const searchResults = await Promise.all(searchPromises);
    
    // 合併結果
    const mergedResults = new Map();

    searchResults.forEach(results => {
      results.forEach(r => {
        const caseId = r.case.JID;
        
        if (mergedResults.has(caseId)) {
          const existing = mergedResults.get(caseId);
          existing.vectorSimilarity = Math.max(existing.vectorSimilarity || 0, r.vectorSimilarity || 0);
          existing.keywordSimilarity = Math.max(existing.keywordSimilarity || 0, r.keywordScore ? r.keywordScore / 10 : 0);
          existing.semanticSimilarity = Math.max(existing.semanticSimilarity || 0, r.similarity || 0);
        } else {
          mergedResults.set(caseId, {
            case: r.case,
            vectorSimilarity: r.vectorSimilarity || 0,
            keywordSimilarity: r.keywordScore ? r.keywordScore / 10 : 0,
            semanticSimilarity: r.similarity || 0,
            methods: [r.method]
          });
        }
      });
    });

    // 計算加權相似度
    const finalResults = Array.from(mergedResults.values()).map(r => ({
      case: r.case,
      similarity: (
        r.vectorSimilarity * weights.vector +
        r.keywordSimilarity * weights.keyword +
        r.semanticSimilarity * weights.semantic
      ),
      breakdown: {
        vector: r.vectorSimilarity,
        keyword: r.keywordSimilarity,
        semantic: r.semanticSimilarity
      },
      methods: r.methods
    }));

    return finalResults
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 過濾候選案例
  filterCandidates({ caseType, yearRange }) {
    let candidates = [...this.cases];

    if (caseType) {
      candidates = candidates.filter(c => c.JCASE === caseType);
    }

    if (yearRange) {
      candidates = candidates.filter(c => {
        const year = parseInt(c.JYEAR) + 1911;
        return year >= yearRange.start && year <= yearRange.end;
      });
    }

    return candidates;
  }

  // 格式化結果
  formatResults(results, queryCase) {
    return results.map(r => {
      const c = r.case;
      
      return {
        id: c.JID,
        title: c.JTITLE,
        year: c.JYEAR,
        caseType: c.JCASE,
        date: c.JDATE,
        court: c.JCOURT,
        summary: c.JFULLX?.JFULLCONTENT?.substring(0, 200) || c.JABSTRACT?.substring(0, 200) || '',
        keywords: c.keywords || [],
        relatedLaws: c.relatedLaws || [],
        similarity: {
          score: r.similarity,
          percentage: (r.similarity * 100).toFixed(1) + '%',
          breakdown: r.breakdown || null
        },
        matchDetails: this.getMatchDetails(queryCase, c),
        methods: r.methods || null
      };
    });
  }

  // 取得匹配詳情
  getMatchDetails(queryCase, targetCase) {
    const details = [];

    // 案件類型匹配
    if (queryCase.JCASE === targetCase.JCASE) {
      details.push({ type: 'caseType', message: '案件類型相同' });
    }

    // 關鍵詞匹配
    const queryKeywords = new Set((queryCase.keywords || []).map(k => k.toLowerCase()));
    const targetKeywords = new Set((targetCase.keywords || []).map(k => k.toLowerCase()));
    const matchingKeywords = [...queryKeywords].filter(k => targetKeywords.has(k));
    
    if (matchingKeywords.length > 0) {
      details.push({ 
        type: 'keywords', 
        message: `共同關鍵詞：${matchingKeywords.slice(0, 5).join('、')}` 
      });
    }

    // 法條匹配
    const queryLaws = new Set((queryCase.relatedLaws || []).map(l => l.toLowerCase()));
    const targetLaws = new Set((targetCase.relatedLaws || []).map(l => l.toLowerCase()));
    const matchingLaws = [...queryLaws].filter(l => targetLaws.has(l));
    
    if (matchingLaws.length > 0) {
      details.push({ 
        type: 'laws', 
        message: `相關法條：${matchingLaws.slice(0, 5).join('、')}` 
      });
    }

    return details;
  }

  // 獲取搜尋建議
  getSearchSuggestions(keyword) {
    const suggestions = [];
    
    // 從關鍵詞庫獲取建議
    const extractedKeywords = this.keywordService.extractKeywords(keyword, { maxKeywords: 5 });
    
    if (extractedKeywords.length > 0) {
      suggestions.push({
        type: 'keyword',
        items: extractedKeywords.map(k => k.keyword)
      });
    }

    // 從相關法條獲取建議
    const relatedLaws = this.keywordService.extractRelatedLaws(keyword);
    if (relatedLaws.length > 0) {
      suggestions.push({
        type: 'law',
        items: relatedLaws.slice(0, 5)
      });
    }

    return suggestions;
  }

  // 批量搜尋
  async batchSearch(queries, options = {}) {
    return Promise.all(
      queries.map(async (query, idx) => ({
        query: typeof query === 'string' ? query : query.JTITLE,
        results: await this.searchSimilarCases(query, options),
        index: idx
      }))
    );
  }

  // 獲取服務統計
  getStats() {
    return {
      totalCases: this.cases.length,
      caseTypes: this.cases.reduce((acc, c) => {
        acc[c.JCASE] = (acc[c.JCASE] || 0) + 1;
        return acc;
      }, {}),
      vectorService: this.vectorService.getVocabularyInfo(),
      keywordBank: this.keywordService.getKeywordBankStats()
    };
  }
}

module.exports = new EnhancedSimilarCaseSearch();
