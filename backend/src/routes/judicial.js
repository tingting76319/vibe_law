const express = require('express');
const router = express.Router();
const judicialApi = require('../services/judicialApi');

// 測試 API 連線
router.get('/test', async (req, res) => {
  try {
    const result = await judicialApi.authenticate();
    res.json({ status: 'success', message: 'API 連線成功 (Mock模式)', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得所有案例 (Mock)
router.get('/cases', async (req, res) => {
  try {
    const cases = await judicialApi.getAllCases();
    res.json({ status: 'success', data: cases });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 搜尋案例 (Mock)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ status: 'error', message: '請輸入搜尋關鍵字' });
    }
    const cases = await judicialApi.searchCases(q);
    res.json({ status: 'success', data: cases, count: cases.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得單一案例
router.get('/cases/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const caseData = await judicialApi.getJudgmentDoc(jid);
    res.json({ status: 'success', data: caseData });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取得裁判書異動清單
router.get('/changelog', async (req, res) => {
  try {
    const list = await judicialApi.getJudgmentList();
    res.json({ status: 'success', data: list });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 驗證 Token
router.post('/auth', async (req, res) => {
  try {
    const result = await judicialApi.authenticate();
    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
