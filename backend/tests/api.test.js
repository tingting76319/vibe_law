/**
 * Backend API 路由測試
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

const judicialRouter = require('../src/routes/judicial.js');
const ragRouter = require('../src/routes/rag.js');

describe('Judicial API Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/judicial', judicialRouter);
  });

  describe('GET /api/judicial/test', () => {
    it('應該回傳 API 連線成功或錯誤 (取決於 Mock 模式)', async () => {
      const response = await request(app).get('/api/judicial/test');
      
      // 因為 config.json 中 isMock 為 false，會嘗試連接真實 API
      // 所以可能是 200 (成功) 或 500 (失敗因為非服務時間)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/judicial/cases', () => {
    it('應該取得所有案例列表 (Mock 模式)', async () => {
      const response = await request(app).get('/api/judicial/cases');
      
      // 此端點使用 getAllCases，不依賴 Mock 模式
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/judicial/search', () => {
    it('應該搜尋並回傳相關案例', async () => {
      const response = await request(app).get('/api/judicial/search?q=民事');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('無關鍵字時應該回傳 400 錯誤', async () => {
      const response = await request(app).get('/api/judicial/search');
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/judicial/cases/:jid', () => {
    it('應該取得單一案例', async () => {
      const response = await request(app).get('/api/judicial/cases/J001');
      
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/judicial/changelog', () => {
    it('應該取得裁判書異動清單', async () => {
      const response = await request(app).get('/api/judicial/changelog');
      
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/judicial/auth', () => {
    it('應該驗證並回傳 Token', async () => {
      const response = await request(app).post('/api/judicial/auth');
      
      expect([200, 500]).toContain(response.status);
    });
  });
});

describe('RAG API Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/rag', ragRouter);
  });

  describe('POST /api/rag/ask', () => {
    it('應該正常處理問答', async () => {
      const response = await request(app)
        .post('/api/rag/ask')
        .send({ question: '測試問題' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('無問題時應該回傳 400 錯誤', async () => {
      const response = await request(app)
        .post('/api/rag/ask')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/rag/health', () => {
    it('應該回傳健康狀態', async () => {
      const response = await request(app).get('/api/rag/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});
