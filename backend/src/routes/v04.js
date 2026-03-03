/**
 * v0.4 API Routes - 向量嵌入、相似案例搜尋、關鍵字萃取、判決書處理
 */

const express = require('express');
const router = express.Router();

// 引入服務
const vectorEmbeddingService = require('../services/vectorEmbeddingService');
const keywordExtractionService = require('../services/keywordExtractionService');
const judgmentDocumentService = require('../services/judgmentDocumentService');
const enhancedSimilarCaseSearch = require('../services/enhancedSimilarCaseSearch');
const similarCaseRecommendation = require('../services/similarCaseRecommendation');

// ==================== 向量嵌入服務 ====================

// 向量化文本
router.post('/vector/embed', async (req, res) => {
  try {
    const { text, caseData } = req.body;
    
    if (!text && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text 或 caseData'
      });
    }

    let embedding;
    if (caseData) {
      embedding = await vectorEmbeddingService.embedCase(caseData);
    } else {
      embedding = await vectorEmbeddingService.embedText(text);
    }

    res.json({
      status: 'success',
      data: {
        embedding,
        dimensions: embedding.length,
        text: text || caseData?.JTITLE || ''
      }
    });
  } catch (error) {
    console.error('[Vector] 向量化失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 批量向量化
router.post('/vector/embed/batch', async (req, res) => {
  try {
    const { cases } = req.body;
    
    if (!cases || !Array.isArray(cases)) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案例陣列'
      });
    }

    const embeddings = await vectorEmbeddingService.embedCases(cases);

    res.json({
      status: 'success',
      data: {
        count: embeddings.length,
        embeddings
      }
    });
  } catch (error) {
    console.error('[Vector] 批量向量化失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 計算相似度
router.post('/vector/similarity', async (req, res) => {
  try {
    const { text1, text2, case1, case2 } = req.body;

    let vec1, vec2;
    
    if (case1 && case2) {
      vec1 = await vectorEmbeddingService.embedCase(case1);
      vec2 = await vectorEmbeddingService.embedCase(case2);
    } else if (text1 && text2) {
      vec1 = await vectorEmbeddingService.embedText(text1);
      vec2 = await vectorEmbeddingService.embedText(text2);
    } else {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text1/text2 或 case1/case2'
      });
    }

    const cosineSimilarity = vectorEmbeddingService.cosineSimilarity(vec1, vec2);
    const euclideanDistance = vectorEmbeddingService.euclideanDistance(vec1, vec2);

    res.json({
      status: 'success',
      data: {
        cosineSimilarity,
        euclideanDistance,
        normalizedSimilarity: (cosineSimilarity + 1) / 2 // 轉換到 0-1
      }
    });
  } catch (error) {
    console.error('[Vector] 相似度計算失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 獲取詞彙表信息
router.get('/vector/vocabulary', (req, res) => {
  try {
    const info = vectorEmbeddingService.getVocabularyInfo();
    
    res.json({
      status: 'success',
      data: info
    });
  } catch (error) {
    console.error('[Vector] 獲取詞彙表失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== 關鍵字萃取服務 ====================

// 萃取關鍵詞
router.post('/keyword/extract', (req, res) => {
  try {
    const { text, caseData, options = {} } = req.body;

    if (!text && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text 或 caseData'
      });
    }

    let keywords;
    if (caseData) {
      keywords = keywordExtractionService.extractFromCase(caseData, options);
    } else {
      keywords = keywordExtractionService.extractKeywords(text, options);
    }

    res.json({
      status: 'success',
      data: {
        keywords,
        count: keywords.length
      }
    });
  } catch (error) {
    console.error('[Keyword] 萃取失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 萃取相關法條
router.post('/keyword/laws', (req, res) => {
  try {
    const { text, caseData } = req.body;

    if (!text && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text 或 caseData'
      });
    }

    const laws = keywordExtractionService.extractRelatedLaws(text || caseData);

    res.json({
      status: 'success',
      data: {
        laws,
        count: laws.length
      }
    });
  } catch (error) {
    console.error('[Keyword] 法條萃取失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 萃取法律爭點
router.post('/keyword/issues', (req, res) => {
  try {
    const { text, caseData } = req.body;

    if (!text && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text 或 caseData'
      });
    }

    const issues = keywordExtractionService.extractLegalIssues(text || caseData);

    res.json({
      status: 'success',
      data: {
        issues,
        count: issues.length
      }
    });
  } catch (error) {
    console.error('[Keyword] 爭點萃取失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 批量萃取關鍵詞
router.post('/keyword/extract/batch', (req, res) => {
  try {
    const { cases, options = {} } = req.body;

    if (!cases || !Array.isArray(cases)) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案例陣列'
      });
    }

    const results = keywordExtractionService.extractBatch(cases, options);

    res.json({
      status: 'success',
      data: {
        count: results.length,
        results
      }
    });
  } catch (error) {
    console.error('[Keyword] 批量萃取失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 獲取關鍵詞庫統計
router.get('/keyword/stats', (req, res) => {
  try {
    const stats = keywordExtractionService.getKeywordBankStats();
    
    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    console.error('[Keyword] 獲取統計失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== 判決書資料處理服務 ====================

// 解析判決書
router.post('/judgment/parse', (req, res) => {
  try {
    const { text, caseData } = req.body;

    if (!text && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 text 或 caseData'
      });
    }

    const parsed = judgmentDocumentService.parseJudgment(text || caseData);

    res.json({
      status: 'success',
      data: parsed
    });
  } catch (error) {
    console.error('[Judgment] 解析失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 結構化輸出判決書
router.post('/judgment/structure', (req, res) => {
  try {
    const { caseData } = req.body;

    if (!caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 caseData'
      });
    }

    const structured = judgmentDocumentService.toStructuredFormat(caseData);

    res.json({
      status: 'success',
      data: structured
    });
  } catch (error) {
    console.error('[Judgment] 結構化失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 驗證判決書
router.post('/judgment/validate', (req, res) => {
  try {
    const { caseData } = req.body;

    if (!caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 caseData'
      });
    }

    const validation = judgmentDocumentService.validateJudgment(caseData);

    res.json({
      status: 'success',
      data: validation
    });
  } catch (error) {
    console.error('[Judgment] 驗證失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 批量處理判決書
router.post('/judgment/process/batch', (req, res) => {
  try {
    const { cases } = req.body;

    if (!cases || !Array.isArray(cases)) {
      return res.status(400).json({
        status: 'error',
        message: '請提供案例陣列'
      });
    }

    const processed = judgmentDocumentService.processBatch(cases);

    res.json({
      status: 'success',
      data: {
        count: processed.length,
        cases: processed
      }
    });
  } catch (error) {
    console.error('[Judgment] 批量處理失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== 相似案例搜尋服務 ====================

// 增強相似案例搜尋
router.post('/search/similar', async (req, res) => {
  try {
    const { query, caseData, options = {} } = req.body;

    if (!query && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 query 或 caseData'
      });
    }

    const results = await enhancedSimilarCaseSearch.searchSimilarCases(
      query || caseData,
      options
    );

    res.json({
      status: 'success',
      data: {
        count: results.length,
        results,
        query: typeof query === 'string' ? query : query?.JTITLE || ''
      }
    });
  } catch (error) {
    console.error('[Search] 相似案例搜尋失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 向量相似案例搜尋
router.post('/search/vector', async (req, res) => {
  try {
    const { query, caseData, options = {} } = req.body;

    if (!query && !caseData) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 query 或 caseData'
      });
    }

    const queryCase = typeof query === 'string' 
      ? { JTITLE: query, JFULLX: { JFULLCONTENT: query }, keywords: [] }
      : query;

    const results = await vectorEmbeddingService.searchSimilar(query, {
      ...options,
      caseData
    });

    res.json({
      status: 'success',
      data: {
        count: results.length,
        results: results.map(r => ({
          case: r.case,
          similarity: r.similarity,
          distance: r.distance
        }))
      }
    });
  } catch (error) {
    console.error('[Search] 向量搜尋失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 原始相似案例搜尋（向量化版本）
router.post('/search/legacy', async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 query'
      });
    }

    const results = similarCaseRecommendation.searchRelatedCases(query, options);

    res.json({
      status: 'success',
      data: {
        count: results.length,
        results
      }
    });
  } catch (error) {
    console.error('[Search] 原始搜尋失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 搜尋建議
router.get('/search/suggestions', (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.status(400).json({
        status: 'error',
        message: '請提供關鍵詞'
      });
    }

    const suggestions = enhancedSimilarCaseSearch.getSearchSuggestions(keyword);

    res.json({
      status: 'success',
      data: suggestions
    });
  } catch (error) {
    console.error('[Search] 建議失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 批量搜尋
router.post('/search/batch', async (req, res) => {
  try {
    const { queries, options = {} } = req.body;

    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        status: 'error',
        message: '請提供查詢陣列'
      });
    }

    const results = await enhancedSimilarCaseSearch.batchSearch(queries, options);

    res.json({
      status: 'success',
      data: {
        count: results.length,
        results
      }
    });
  } catch (error) {
    console.error('[Search] 批量搜尋失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== 統計資訊 ====================

// 獲取服務統計
router.get('/stats', (req, res) => {
  try {
    const stats = enhancedSimilarCaseSearch.getStats();
    
    res.json({
      status: 'success',
      data: {
        ...stats,
        version: '0.4'
      }
    });
  } catch (error) {
    console.error('[Stats] 獲取統計失敗:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.4',
    services: {
      vector: 'ok',
      keyword: 'ok',
      judgment: 'ok',
      search: 'ok'
    }
  });
});

module.exports = router;
