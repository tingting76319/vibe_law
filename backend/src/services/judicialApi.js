const axios = require('axios');

// 載入配置 - 從 backend 目錄相對路徑
const config = require('../../config.json');
const judicialRepository = require('../repositories/judicialRepository');

// Mock 資料
const mockData = require('../../data/mockData.json');

class JudicialAPI {
  constructor() {
    this.token = null;
    this.isMock = config.isMock !== false; // 預設 true，除非設為 false
    this.apiBaseUrl = config.apiBaseUrl;
    this.source = process.env.JUDICIAL_SOURCE || config.judicialSource || 'postgres';
    console.log(`[JudicialAPI] 初始化 - Mock模式: ${this.isMock}, 資料源: ${this.source}`);
  }

  // 檢查是否在服務時間內
  isServiceHour() {
    const now = new Date();
    const hour = (new Date().getTime() + 8*60*60*1000) % 24;
    return hour >= config.serviceHours.start && hour < config.serviceHours.end;
  }

  // 切換 Mock 模式
  setMockMode(enabled) {
    this.isMock = enabled;
    console.log(`[JudicialAPI] Mock模式已切換: ${this.isMock}`);
  }

  // 驗證取得 Token
  async authenticate() {
    if (this.source === 'postgres') {
      this.token = 'public-opendata-postgres';
      return { token: this.token, source: this.source };
    }

    if (this.isMock) {
      console.log('[Mock] 模擬驗證 API');
      this.token = 'mock_token_' + Date.now();
      return { token: this.token };
    }

    if (!this.isServiceHour()) {
      throw new Error('目前非本 API 服務時間 (00:00-06:00 (台灣時間))');
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/Auth`, {
        user: process.env.JUDICIAL_USER || config.user,
        password: process.env.JUDICIAL_PASSWORD || config.password
      });
      
      if (response.data.token) {
        this.token = response.data.token;
        return response.data;
      } else if (response.data.error) {
        throw new Error(response.data.error);
      }
    } catch (error) {
      throw new Error(`驗證失敗: ${error.message}`);
    }
  }

  // 取得裁判書異動清單
  async getJudgmentList() {
    if (this.source === 'postgres') {
      const rows = await judicialRepository.getJudgmentChangelog(100, 0);
      return [
        {
          date: new Date().toISOString().split('T')[0],
          list: rows.map((row) => row.jid).filter(Boolean)
        }
      ];
    }

    if (this.isMock) {
      console.log('[Mock] 模擬取得異動清單');
      const today = new Date().toISOString().split('T')[0];
      return [{
        date: today,
        list: mockData.cases.map(c => c.JID)
      }];
    }

    if (!this.token) {
      throw new Error('請先進行驗證');
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/JList`, {
        token: this.token
      });
      return response.data;
    } catch (error) {
      throw new Error(`取得清單失敗: ${error.message}`);
    }
  }

  // 取得裁判書內容
  async getJudgmentDoc(jid) {
    if (this.source === 'postgres') {
      const row = await judicialRepository.getJudgmentById(jid);
      if (!row) {
        throw new Error(`找不到裁判書: ${jid}`);
      }
      return this.normalizeCase(row);
    }

    if (this.isMock) {
      console.log('[Mock] 模擬取得裁判書:', jid);
      const caseData = mockData.cases.find(c => c.JID === jid);
      if (caseData) {
        return caseData;
      }
      // 如果找不到，回傳第一個案例
      return mockData.cases[0];
    }

    if (!this.token) {
      throw new Error('請先進行驗證');
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/JDoc`, {
        token: this.token,
        j: jid
      });
      return response.data;
    } catch (error) {
      throw new Error(`取得裁判書失敗: ${error.message}`);
    }
  }

  // 搜尋案例（本地 mock 功能）
  async searchCases(keyword) {
    if (this.source === 'postgres') {
      const rows = await judicialRepository.searchJudgments(keyword, 100);
      return rows.map((row) => this.normalizeCase(row));
    }

    // Mock 模式或真實模式都支援本地搜尋
    const keywordLower = keyword.toLowerCase();
    return mockData.cases.filter(c => {
      const text = (c.JTITLE + ' ' + (c.JFULLX?.JFULLCONTENT || '')).toLowerCase();
      return text.includes(keywordLower) || 
             (c.keywords || []).some(k => k.toLowerCase().includes(keywordLower));
    });
  }

  // 取得所有案例
  async getAllCases() {
    if (this.source === 'postgres') {
      const rows = await judicialRepository.getAllJudgments(500, 0);
      return rows.map((row) => this.normalizeCase(row));
    }

    return mockData.cases;
  }

  normalizeCase(row) {
    const jfull = row.jfull || row.JFULL || '';
    const jpdf = row.jpdf || row.JPDF || '';

    return {
      JID: row.jid || row.JID || '',
      JYEAR: row.jyear || row.JYEAR || '',
      JCASE: row.jcase || row.JCASE || '',
      JNO: row.jno || row.JNO || '',
      JDATE: row.jdate || row.JDATE || '',
      JTITLE: row.jtitle || row.JTITLE || '',
      JCOURT: row.jcourt || row.JCOURT || '',
      JFULL: jfull,
      JPDF: jpdf,
      JFULLX: {
        JFULLCONTENT: jfull,
        JFULLPDF: jpdf
      },
      relatedLaws: row.relatedlaws || row.related_laws || row.relatedLaws || [],
      keywords: row.keywords || []
    };
  }
}

module.exports = new JudicialAPI();
