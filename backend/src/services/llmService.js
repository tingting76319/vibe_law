/**
 * LLM 服務 - 支援 MiniMax / OpenAI
 */
const axios = require('axios');
const config = require('../../config.json');

class LLMService {
  constructor() {
    this.config = config.llm || {};
    this.provider = this.config.provider || 'minimax';
    this.apiKey = this.config.apiKey || process.env.LLM_API_KEY;
    this.model = this.config.model || 'MiniMax-M2.5';
    console.log(`[LLMService] 初始化 - Provider: ${this.provider}, Model: ${this.model}`);
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
      } else {
        throw new Error(`不支援的 LLM provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('[LLMService] API 調用失敗:', error.message);
      return this.mockGenerate(prompt, context);
    }
  }

  // MiniMax API
  async callMiniMax(prompt, context) {
    const fullPrompt = `你是一位台灣法律專家。請根據以下context回答用戶問題。

Context:
${context}

用戶問題: ${prompt}

請提供專業的法律回答，並引用相關法規和判例。如果無法從 Context 找到答案，請說明並建議諮詢專業律師。`;

    const response = await axios.post(
      'https://api.minimax.chat/v1/text/chatcompletion_pro',
      {
        model: this.model,
        messages: [
          { role: 'system', content: '你是一位專業的台灣法律顧問，專長於民事、刑事、行政法規。請用繁體中文回答。' },
          { role: 'user', content: fullPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }
    throw new Error('MiniMax API 回應格式錯誤');
  }

  // OpenAI API
  async callOpenAI(prompt, context) {
    const fullPrompt = `你是一位台灣法律專家。請根據以下context回答用戶問題。

Context:
${context}

用戶問題: ${prompt}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model || 'gpt-4',
        messages: [
          { role: 'system', content: '你是一位專業的台灣法律顧問，專長於民事、刑事、行政法規。請用繁體中文回答。' },
          { role: 'user', content: fullPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }
    throw new Error('OpenAI API 回應格式錯誤');
  }

  // Mock 回應（無 API Key 時使用）
  mockGenerate(prompt, context) {
    const cases = context.match(/判例\d+[：:]/g) || [];
    const laws = context.match(/法規\d+[：:]/g) || [];
    
    return `根據您的問題「${prompt}」，系統已完成相關法律資料檢索。

${context ? `找到 ${cases.length} 個相關判例和 ${laws.length} 條相關法規。` : ''}

由於目前 LLM API Key 尚未設定，無法生成完整回答。請聯繫管理員設定 API Key。

---
⚠️ 本回答僅供參考，不構成法律意見。如有具體法律問題，請諮詢專業律師。`;
  }
}

module.exports = new LLMService();
