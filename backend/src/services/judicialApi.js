const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 載入配置 - 從 backend 目錄相對路徑
const config = require('../../config.json');

// Mock 資料
const mockData = require('../../data/mockData.json');

class JudicialAPI {
  constructor() {
    this.token = null;
    this.isMock = config.isMock !== false; // 預設 true，除非設為 false
    this.apiBaseUrl = config.apiBaseUrl;
    console.log(`[JudicialAPI] 初始化 - Mock模式: ${this.isMock}`);
  }

  // 檢查是否在服務時間內
  isServiceHour() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= config.serviceHours.start && hour < config.serviceHours.end;
  }

  // 切換 Mock 模式
  setMockMode(enabled) {
    this.isMock = enabled;
    console.log(`[JudicialAPI] Mock模式已切換: ${this.isMock}`);
  }

  // 驗證取得 Token
  async authenticate() {
    if (this.isMock) {
      console.log('[Mock] 模擬驗證 API');
      this.token = 'mock_token_' + Date.now();
      return { token: this.token };
    }

    if (!this.isServiceHour()) {
      throw new Error('目前非本 API 服務時間 (00:00-06:00)');
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/Auth`, {
        user: config.user,
        password: config.password
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
    return mockData.cases;
  }
}

module.exports = new JudicialAPI();
