/**
 * Backend Services 單元測試
 * 
 * 注意：此測試需要 config.json 中 isMock 為 true
 * 或在測試環境中覆蓋配置
 */
import { describe, it, expect, vi } from 'vitest';

// 直接引入 config 並修改
const path = require('path');
const fs = require('fs');

// 備份原 config
const configPath = path.join(__dirname, '../../config.json');

describe('JudicialAPI Service 基本測試', () => {
  
  describe('模組載入測試', () => {
    it('應該能夠載入 judicialApi 模組', () => {
      // 嘗試載入模組
      const judicialApi = require('../src/services/judicialApi.js');
      expect(judicialApi).toBeDefined();
    });

    it('應該能夠載入 llmService 模組', () => {
      const llmService = require('../src/services/llmService.js');
      expect(llmService).toBeDefined();
    });
  });

  describe('路由載入測試', () => {
    it('應該能夠載入 judicial 路由', () => {
      const router = require('../src/routes/judicial.js');
      expect(router).toBeDefined();
      expect(router).toHaveProperty('get');
    });

    it('應該能夠載入 rag 路由', () => {
      const router = require('../src/routes/rag.js');
      expect(router).toBeDefined();
      expect(router).toHaveProperty('post');
    });
  });

  describe('Express App 測試', () => {
    it('應該能夠建立 Express app', () => {
      const express = require('express');
      const app = express();
      
      expect(app).toBeDefined();
      expect(typeof app.get).toBe('function');
    });
  });
});
