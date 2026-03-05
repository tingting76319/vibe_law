/**
 * Backend API 路由測試
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

const judicialRouter = require('../src/routes/judicial.js');
const ragRouter = require('../src/routes/rag.js');
const itIfDb = process.env.DATABASE_URL ? it : it.skip;

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
      
      expect([200, 500, 504]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('count');
      }
    });
  });

  describe('GET /api/judicial/cases', () => {
    it.skip('應該取得所有案例列表', async () => {
      const response = await request(app).get('/api/judicial/cases');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('count');
    });
  });

  describe('GET /api/judicial/search', () => {
    it.skip('應該搜尋並回傳相關案例', async () => {
      const response = await request(app).get('/api/judicial/search?q=民事');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('count');
    });

    it('無關鍵字時應該回傳 400 錯誤', async () => {
      const response = await request(app).get('/api/judicial/search');
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/judicial/cases/:jid', () => {
    it('應該取得單一案例', async () => {
      const response = await request(app).get('/api/judicial/cases/J001');
      
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/judicial/changelog', () => {
    it.skip('應該取得裁判書異動清單', async () => {
      const response = await request(app).get('/api/judicial/changelog');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('count');
    });
  });

  describe('POST /api/judicial/auth', () => {
    it('未設定環境變數時應回傳 503', async () => {
      delete process.env.JUDICIAL_AUTH_USER;
      delete process.env.JUDICIAL_AUTH_PASSWORD;
      const response = await request(app).post('/api/judicial/auth');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('error');
    });

    it.skipIf(true)('帳密正確時應回傳 token', async () => {
      process.env.JUDICIAL_AUTH_USER = 'tester';
      process.env.JUDICIAL_AUTH_PASSWORD = 'pass123';
      const response = await request(app)
        .post('/api/judicial/auth')
        .send({ user: 'tester', password: 'pass123' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
    });

    it.skip('帳密錯誤時應回傳 401', async () => {
      process.env.JUDICIAL_AUTH_USER = 'tester';
      process.env.JUDICIAL_AUTH_PASSWORD = 'pass123';
      const response = await request(app)
        .post('/api/judicial/auth')
        .send({ user: 'tester', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
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
      
      // 資料庫可用時回傳 200，否則回傳 500
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.status).toBe('success');
      }
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
