/**
 * RAG 問答 API 路由
 */
const express = require('express');
const router = express.Router();
const judicialApi = require('../services/judicialApi');
const llmService = require('../services/llmService');

// RAG 問答
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ 
        status: 'error', 
        message: '請輸入問題' 
      });
    }

    console.log(`[RAG] 收到問題: ${question}`);

    // 1. 檢索相關資料
    const searchResults = await judicialApi.searchCases(question);
    const allCases = await judicialApi.getAllCases();
    
    // 2. 建構 Context
    const context = buildContext(searchResults, allCases);
    
    // 3. 生成回答
    const answer = await llmService.generate(question, context);

    res.json({
      status: 'success',
      data: {
        question,
        answer,
        relatedCases: searchResults.slice(0, 5).map(c => ({
          id: c.JID,
          title: c.JTITLE,
          court: c.JCOURT,
          year: c.JYEAR,
          caseNumber: c.JCASE
        })),
        sources: searchResults.slice(0, 3).map(c => ({
          type: 'case',
          id: c.JID,
          title: c.JTITLE
        }))
      }
    });
  } catch (error) {
    console.error('[RAG] 問答失敗:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// 建構檢索 Context
function buildContext(searchResults, allCases) {
  const parts = [];
  
  // 加入搜尋到的判例
  if (searchResults && searchResults.length > 0) {
    parts.push('## 相關判例：');
    searchResults.slice(0, 3).forEach((c, i) => {
      parts.push(`\n判例${i+1}：${c.JTITLE}`);
      parts.push(`法院：${c.JCOURT}，案號：${c.JYEAR}年 ${c.JCASE}`);
      parts.push(`摘要：${(c.JFULLX?.JFULLCONTENT || c.JABSTRACT || '').substring(0, 500)}`);
    });
  }
  
  // 加入相關法規（從 Mock 資料）
  const lawData = allCases[0]?.relatedLaws || [];
  if (lawData.length > 0) {
    parts.push('\n## 相關法規：');
    lawData.forEach(law => {
      parts.push(`- ${law}`);
    });
  }
  
  return parts.join('\n');
}

// 健康檢查
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    llmProvider: llmService.provider,
    model: llmService.model
  });
});

module.exports = router;
