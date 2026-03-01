/**
 * LLM 服務 - 支援 MiniMax / OpenAI
 */
const axios = require('axios');
const config = require('../../config.json');

class LLMService {
  constructor() {
    this.config = config.llm || {};
    this.provider = this.config.provider || 'minimax';
    // 優先使用環境變數，再使用 config
    this.apiKey = process.env.MMKey_LAW_LLM || this.config.apiKey || '';
    this.model = this.config.model || 'MiniMax-M2.5';
    console.log(`[LLMService] 初始化 - Provider: ${this.provider}, Model: ${this.model}`);
    console.log(`[LLMService] API Key 狀態: ${this.apiKey ? '已設定' : '未設定'}`);
  }

  // 生成回答
  async generate(prompt, context = '') {
    if (!this.apiKey) {
      console.warn('[LLMService] 無 API Key，回傳 mock 回應');
      return this.mockGenerate(prompt, context);
    }

    try {
      if (this.provider === 'minimax') {
        return await this.callMiniMax(prompt, context);
      } else if (this.provider === 'openai') {
        return await this.callOpenAI(prompt, context);
      }
    } catch (error) {
      console.error('[LLMService] API 調用失敗:', error.message);
      return this.mockGenerate(prompt, context);
    }
  }

  // Mock 回應（當沒有 API Key 時）
  mockGenerate(prompt, context) {
    return `由於目前 LLM API Key 尚未設定，無法生成完整回答。請聯繫管理員設定 API Key。

提示：請在 Zeabur 環境變數中設定 MMKey_LAW_LLM

---
參考資料：
${context.substring(0, 500)}...`;
  }

  // MiniMax API
  async callMiniMax(prompt, context) {
    const systemPrompt = `你是專業的法律顧問 AI，請根據以下法律資料回答用戶問題。

參考資料：
${context}

請用繁體中文回答，並引用相關法條和判例。`;

    const response = await axios.post(
      'https://api.minimax.chat/v1/text/chatcompletion_pro',
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }

    throw new Error('MiniMax API 回應格式錯誤');
  }

  // OpenAI API
  async callOpenAI(prompt, context) {
    const systemPrompt = `你是專業的法律顧問 AI，請根據以下法律資料回答用戶問題。

參考資料：
${context}

請用繁體中文回答，並引用相關法條和判例。`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }

    throw new Error('OpenAI API 回應格式錯誤');
  }
}

module.exports = new LLMService();
