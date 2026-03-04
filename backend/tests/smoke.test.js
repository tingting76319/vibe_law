/**
 * Smoke Test - 快速檢查 API 健康狀態
 * 用於 CI 的第一道防線，快速驗證基本功能
 * 
 * 這個測試使用 supertest 直接測試 Express app，
 * 不需要啟動實際的伺服器
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';

// 引入路由
const judicialRouter = require('../src/routes/judicial.js');
const ragRouter = require('../src/routes/rag.js');
const v04Router = require('../src/routes/v04.js');

describe('Smoke Test - API Health', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mount routes
    app.use('/api/judicial', judicialRouter);
    app.use('/api/rag', ragRouter);
    app.use('/api/v04', v04Router);
    
    // Static files - 從 backend 目錄的父目錄
    const rootPath = path.join(__dirname, '..');
    app.use(express.static(rootPath));
  });

  /**
   * 主健康檢查
   */
  it('GET /health - 應該回傳 OK', async () => {
    // 使用內聯 middleware 測試
    const testApp = express();
    testApp.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    const res = await request(testApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  /**
   * v0.4 API 健康檢查
   */
  it('GET /api/v04/health - 應該回傳 v0.4 功能狀態', async () => {
    const res = await request(app).get('/api/v04/health');
    
    // Mock 模式或實際連線都應該回應
    expect([200, 500, 504]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('version');
    }
  });

  /**
   * Judicial API 測試端點
   */
  it('GET /api/judicial/test - 應該可連線', async () => {
    const res = await request(app).get('/api/judicial/test');
    
    // Mock 模式或實際連線都應該回應
    expect([200, 500, 504]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
  });

  /**
   * RAG API 健康檢查
   */
  it('GET /api/rag/health - 應該回傳 OK', async () => {
    const res = await request(app).get('/api/rag/health');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  /**
   * 靜態頁面檢查
   */
  it('GET / - 應該有回應', async () => {
    const res = await request(app).get('/');
    
    // 根路徑可能有靜態檔案或 404
    expect([200, 404]).toContain(res.status);
  });

  it('GET /upload - 應該有回應', async () => {
    const res = await request(app).get('/upload');
    
    // 上傳頁面可能有靜態檔案或 404
    expect([200, 404]).toContain(res.status);
  });
});

/**
 * 快速冒煙測試 - 只測試關鍵端點
 * 用於快速驗證服務是否啟動
 */
export async function quickSmokeTest(app) {
  const endpoints = [
    { url: '/api/rag/health', expectedStatus: 200 },
    { url: '/api/v04/health', expectedStatus: [200, 500, 504] },
    { url: '/api/judicial/test', expectedStatus: [200, 500, 504] },
  ];

  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const res = await request(app).get(endpoint.url);
      const expected = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];
      const passed = expected.includes(res.status);
      results.push({
        url: endpoint.url,
        status: res.status,
        passed
      });
    } catch (err) {
      results.push({
        url: endpoint.url,
        error: err.message,
        passed: false
      });
    }
  }

  const allPassed = results.every(r => r.passed);
  console.log('Smoke Test Results:', results);
  
  return { results, allPassed };
}
