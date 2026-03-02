/**
 * RAG 問答 API 路由 v0.5
 * 支持多輪對話和引用來源顯示
 */
const express = require('express');
const router = express.Router();
const judicialApi = require('../services/judicialApi');
const llmService = require('../services/llmService');

// 對話歷史存儲（內存存儲，生產環境應用 Redis/資料庫）
const conversations = new Map();

// 對話歷史上限
const MAX_HISTORY = 10;

/**
 * 獲取或創建對話
 */
function getOrCreateConversation(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, {
      id: sessionId,
      messages: [],
      createdAt: new Date().toISOString()
    });
  }
  return conversations.get(sessionId);
}

/**
 * 添加訊息到對話歷史
 */
function addMessageToConversation(sessionId, role, content, metadata = {}) {
  const conversation = getOrCreateConversation(sessionId);
  conversation.messages.push({
    role,
    content,
    metadata,
    timestamp: new Date().toISOString()
  });
  
  // 限制歷史長度
  if (conversation.messages.length > MAX_HISTORY) {
    conversation.messages = conversation.messages.slice(-MAX_HISTORY);
  }
  
  return conversation;
}

/**
 * 清空對話歷史
 */
router.post('/clear', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessionId && conversations.has(sessionId)) {
    conversations.delete(sessionId);
  }
  
  res.json({
    status: 'success',
    message: '對話歷史已清除'
  });
});

/**
 * 獲取對話歷史
 */
router.get('/history', (req, res) => {
  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({
      status: 'error',
      message: '缺少 sessionId'
    });
  }
  
  const conversation = getOrCreateConversation(sessionId);
  
  res.json({
    status: 'success',
    data: {
      messages: conversation.messages,
      createdAt: conversation.createdAt
    }
  });
});

// RAG 問答 v0.5 - 支持多輪對話
router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId } = req.body;
    
    // 使用 sessionId 或生成臨時 ID
    const session = sessionId || `session_${Date.now()}`;
    
    if (!question) {
      return res.status(400).json({ 
        status: 'error', 
        message: '請輸入問題' 
      });
    }

    console.log(`[RAG v0.5] 收到問題 (session: ${session}): ${question}`);

    // 1. 檢索相關資料
    const searchResults = await judicialApi.searchCases(question);
    const allCases = await judicialApi.getAllCases();
    
    // 2. 建構 Context（含引用來源）
    const { context, sources } = buildContextWithSources(searchResults, allCases);
    
    // 3. 獲取對話歷史
    const conversation = getOrCreateConversation(session);
    
    // 4. 生成回答（包含歷史上下文）
    const answer = await llmService.generateWithHistory(
      question, 
      context, 
      conversation.messages
    );

    // 5. 保存到對話歷史
    addMessageToConversation(session, 'user', question, { sources });
    addMessageToConversation(session, 'assistant', answer, { sources });

    // 6. 格式化回應（含引用來源）
    const responseData = {
      question,
      answer,
      sessionId: session,
      sources,
      relatedCases: searchResults.slice(0, 5).map(c => ({
        id: c.JID,
        title: c.JTITLE,
        court: c.JCOURT,
        year: c.JYEAR,
        caseNumber: c.JCASE,
        date: c.JDATE,
        relatedLaws: c.relatedLaws || [],
        relevanceScore: calculateRelevance(c, question)
      })),
      conversationLength: conversation.messages.length
    };

    res.json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    console.error('[RAG v0.5] 問答失敗:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

/**
 * 計算相關性分數
 */
function calculateRelevance(caseData, question) {
  const questionLower = question.toLowerCase();
  const titleLower = (caseData.JTITLE || '').toLowerCase();
  const contentLower = (caseData.JFULLX?.JFULLCONTENT || '').toLowerCase();
  const keywordsLower = (caseData.keywords || []).join(' ').toLowerCase();
  
  let score = 0;
  
  // 標題匹配
  const titleWords = questionLower.split(' ').filter(w => w.length > 1);
  titleWords.forEach(word => {
    if (titleLower.includes(word)) score += 3;
  });
  
  // 關鍵詞匹配
  titleWords.forEach(word => {
    if (keywordsLower.includes(word)) score += 2;
  });
  
  // 內容匹配
  titleWords.forEach(word => {
    if (contentLower.includes(word)) score += 1;
  });
  
  return Math.min(score / 10, 1); // 標準化到 0-1
}

/**
 * 建構檢索 Context（含引用來源）
 */
function buildContextWithSources(searchResults, allCases) {
  const contextParts = [];
  const sources = [];
  
  // 加入搜尋到的判例
  if (searchResults && searchResults.length > 0) {
    contextParts.push('## 相關判例：');
    searchResults.slice(0, 5).forEach((c, i) => {
      const caseId = `${c.JYEAR}年${c.JCASE}第${c.JNO}號`;
      contextParts.push(`\n【判例${i+1}】${c.JTITLE}`);
      contextParts.push(`法院：${c.JCOURT || '最高法院'}，案號：${caseId}`);
      contextParts.push(`相關法規：${(c.relatedLaws || []).join('、')}`);
      contextParts.push(`摘要：${(c.JFULLX?.JFULLCONTENT || c.JABSTRACT || '').substring(0, 600)}`);
      
      // 添加來源引用
      sources.push({
        type: 'case',
        id: c.JID,
        title: c.JTITLE,
        caseNumber: caseId,
        court: c.JCOURT,
        year: c.JYEAR,
        date: c.JDATE,
        relatedLaws: c.relatedLaws || [],
        content: (c.JFULLX?.JFULLCONTENT || '').substring(0, 800)
      });
    });
  }
  
  // 加入相關法規
  const lawData = allCases[0]?.relatedLaws || [];
  const uniqueLaws = [...new Set(lawData)];
  
  if (uniqueLaws.length > 0) {
    contextParts.push('\n## 相關法規：');
    uniqueLaws.forEach(law => {
      contextParts.push(`- ${law}`);
      sources.push({
        type: 'law',
        name: law,
        description: getLawDescription(law)
      });
    });
  }
  
  return {
    context: contextParts.join('\n'),
    sources
  };
}

/**
 * 獲取法規描述
 */
function getLawDescription(lawName) {
  const lawDescriptions = {
    '民法第184條': '侵權行為損害賠償請求權',
    '民法第193條': '侵害他人之身體或健康者之賠償',
    '民法第195條': '不法侵害他人之身體、健康、名譽、自由、信用、隱私、貞操，或不法侵害其他人格法益者之賠償',
    '民法第213條': '負損害賠償責任者，除法律另有規定或契約另有訂定外，應回復他方損害發生前之原狀',
    '民法第216條': '損害賠償，除法律另有規定或契約另有訂定外，應以填補他方所受損害及所失利益為限',
    '民法第1049條': '夫妻兩願離婚者，得自行離婚',
    '民法第1052條': '夫妻之一方，有下列情形之一者，他方得向法院請求離婚',
    '民法第1030條之1': '法定財產制關係消滅時，夫或妻現存之婚後財產，扣除婚姻關係存續所負債務後，應平均分配',
    '民法第424條': '租賃物有瑕疵者，承租得不支付租金',
    '民法第429條': '租賃物之修缮，除契約另有訂定外，由出租人負擔',
    '刑法第335條': '意圖為自己或第三人不法之所有，而侵占自己持有他人之物者，處五年以下有期徒刑',
    '刑法第276條': '因過失致人於死者，處二年以下有期徒刑、拘役或二千元以下罰金',
    '刑法第284條': '因過失傷害人者，處六月以下有期徒刑、拘役或五百元以下罰金'
  };
  
  return lawDescriptions[lawName] || '相關法規';
}

// 健康檢查
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '0.5',
    llmProvider: llmService.provider,
    model: llmService.model,
    features: [
      'multi-turn conversation',
      'source citations',
      'context-aware responses'
    ]
  });
});

module.exports = router;
