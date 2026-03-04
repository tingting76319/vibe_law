/**
 * LLM 服務 v0.6 - 支援 MiniMax / OpenAI / Claude
 * 支持多輪對話上下文
 * v0.6: 增加 API 逾時至 60 秒，增加 fallback 回應
 */
const axios = require('axios');
const config = require('../../config.json');

// LLM API 逾時時間 (60 秒)
const LLM_API_TIMEOUT_MS = 60000;

class LLMService {
  constructor() {
    this.config = config.llm || {};
    this.provider = this.config.provider || 'minimax';
    // 優先使用環境變數，再使用 config
    this.apiKey = process.env.MMKey_LAW_LLM || this.config.apiKey || '';
    this.model = this.config.model || 'MiniMax-M2.5';
    console.log(`[LLMService v0.6] 初始化 - Provider: ${this.provider}, Model: ${this.model}`);
    console.log(`[LLMService] API Key 狀態: ${this.apiKey ? '已設定' : '未設定'}`);
  }

  /**
   * 生成回答（支援多輪對話歷史）
   */
  async generateWithHistory(question, context = '', conversationHistory = []) {
    if (!this.apiKey) {
      console.warn('[LLMService] 無 API Key，回傳 mock 回應');
      return this.mockGenerate(question, context, conversationHistory);
    }

    try {
      if (this.provider === 'minimax') {
        return await this.callMiniMax(question, context, conversationHistory);
      } else if (this.provider === 'openai') {
        return await this.callOpenAI(question, context, conversationHistory);
      } else if (this.provider === 'anthropic') {
        return await this.callAnthropic(question, context, conversationHistory);
      }
    } catch (error) {
      console.error('[LLMService] API 調用失敗:', error.message);
      return this.generateFallbackResponse(question, context, error);
    }
  }

  /**
   * 兼容舊版 generate 方法
   */
  async generate(prompt, context = '') {
    return this.generateWithHistory(prompt, context, []);
  }

  // Fallback 回應（當 API 逾時或失敗時）
  generateFallbackResponse(question, context, error) {
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    
    if (isTimeout) {
      console.warn('[LLMService] API 逾時，回傳 fallback 回應');
      return `⏱️ **伺服器忙碌中**

您的問題已收到，但 AI 服務回應時間較長。

**您可以：**
1. 稍後再試一次
2. 嘗試簡化問題
3. 或許您可以先參考以下相關資料：

${context ? `📋 **相關法條資訊**\n${context.substring(0, 1000)}` : '請嘗試搜尋相關法律資訊後再詢問 AI'}

---
💡 **提示**：如需立即協助，建議直接諮詢專業律師。`;
    }

    // 其他錯誤
    console.warn('[LLMService] API 錯誤，回傳 fallback 回應');
    return this.mockGenerate(question, context, []);
  }

  // Mock 回應（當沒有 API Key 時）
  mockGenerate(question, context, history) {
    // 根據問題類型生成相關回應
    const q = question.toLowerCase();
    let response = '';
    
    if (q.includes('車禍') || q.includes('車輛') || q.includes('交通事故')) {
      response = `根據您提供的問題，以下是車禍損害賠償的重點說明：

## 責任認定
車禍發生時，原則上依據過失責任原則定責。根據民法第184條，因過失不法侵害他人權利者，應負損害賠償責任。

## 請求項目
1. **醫療費用**（民法第193條）- 包括健保未給付部分
2. **財產損失** - 車輛修復費用
3. **精神慰撫金**（民法第195條）- 視傷勢嚴重程度而定
4. **誤工損失** - 不能工作期間的薪資損失

## 刑事責任
- 過失傷害：刑法第284條
- 過失致死：刑法第276條

## 處理建議
1. 立即報警並取得事故證明
2. 保留現場照片
3. 盡快就醫並保留單據
4. 必要時聘請律師協助`;
    } else if (q.includes('離婚')) {
      response = `關於離婚問題，以下是您需要知道的：

## 離婚方式
1. **協議離婚**：雙方同意，簽訂離婚協議書，至少2名證人
2. **裁判離婚**：需符合民法第1052條法定事由

## 財產分配
依民法第1030條之1，婚後財產原則上平均分配（剩餘財產分配請求權）

## 子女監護權
以子女最佳利益為原則，可協議或由法院裁定`;
    } else {
      response = `感謝您的提問。根據相關法律資料：

${context ? `以下是搜尋到的相關資料：

${context.substring(0, 800)}` : ''}

---
⚠️ 注意：以上資訊僅供參考，不構成法律意見。如有具體法律問題，建議諮詢專業律師。`;
    }

    // 加入對話歷史摘要
    if (history && history.length > 0) {
      const recentHistory = history.slice(-4); // 只取最近4條
      const historySummary = recentHistory
        .map(m => `${m.role === 'user' ? '用戶' : '助手'}：${m.content.substring(0, 100)}...`)
        .join('\n');
      
      response = `【對話歷史】
${historySummary}

【當前問題】
${question}

【回答】
${response}`;
    }

    return response;
  }

  // MiniMax API - 逾時 60 秒
  async callMiniMax(question, context, history) {
    const messages = this.buildMessages(question, context, history);
    
    const response = await axios.post(
      'https://api.minimax.chat/v1/text/chatcompletion_pro',
      {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: LLM_API_TIMEOUT_MS
      }
    );

    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }

    throw new Error('MiniMax API 回應格式錯誤');
  }

  // OpenAI API - 逾時 60 秒
  async callOpenAI(question, context, history) {
    const messages = this.buildMessages(question, context, history);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.config.openaiModel || 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: LLM_API_TIMEOUT_MS
      }
    );

    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }

    throw new Error('OpenAI API 回應格式錯誤');
  }

  // Anthropic Claude API - 逾時 60 秒
  async callAnthropic(question, context, history) {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages = this.buildMessagesForClaude(question, history);
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.config.anthropicModel || 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: LLM_API_TIMEOUT_MS
      }
    );

    if (response.data.content && response.data.content[0]) {
      return response.data.content[0].text;
    }

    throw new Error('Anthropic API 回應格式錯誤');
  }

  /**
   * 建構訊息陣列
   */
  buildMessages(question, context, history) {
    const messages = [];
    
    // System prompt
    const systemPrompt = this.buildSystemPrompt(context);
    messages.push({ role: 'system', content: systemPrompt });
    
    // 加入對話歷史
    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    // 加入當前問題
    messages.push({ role: 'user', content: question });
    
    return messages;
  }

  /**
   * 建構 Anthropic 格式的訊息
   */
  buildMessagesForClaude(question, history) {
    const messages = [];
    
    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }
    
    messages.push({ role: 'user', content: question });
    
    return messages;
  }

  /**
   * 建構 System Prompt
   */
  buildSystemPrompt(context) {
    return `你是專業的法律顧問 AI，專精台灣法律。

## 你的角色
- 用繁體中文回答
- 引用相關法條和判例
- 提供實用建議

## 回答格式
1. 先說明法律原則
2. 引用相關法條（使用條文編號）
3. 根據資料給出建議
4. 提醒尋求專業律師

## 參考資料
${context || '無相關資料'}

## 重要提醒
- 只根據提供的資料回答，不要編造
- 如果資料不足，明確說明
- 永遠提醒用戶尋求專業法律意見`;
  }
}

module.exports = new LLMService();
