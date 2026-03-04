/**
 * 法規資料庫 API
 * 
 * Endpoint:
 * - GET /api/laws/search?q=keyword - 搜尋法規
 * - GET /api/laws/:lawId - 取得法規详情
 * - GET /api/laws/category/:category - 依類別取得法規
 * - GET /api/laws/categories - 取得所有類別
 * - GET /api/laws/stats - 取得統計
 * - POST /api/laws/import - 匯入法規
 * - POST /api/laws/batch-import - 批次匯入
 */
const express = require('express');
const lawService = require('../services/lawService');

const router = express.Router();

/**
 * 搜尋法規
 * GET /api/laws/search?q=keyword&limit=20&offset=0&category=刑法
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit, offset, category } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: '請提供搜尋關鍵字' });
    }
    
    const results = await lawService.search(q, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      category
    });
    
    res.json(results);
  } catch (error) {
    console.error('[Laws API] 搜尋錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 取得單一法規
 * GET /api/laws/:lawId
 */
router.get('/:lawId', async (req, res) => {
  try {
    const result = await lawService.getLaw(req.params.lawId);
    res.json(result);
  } catch (error) {
    console.error('[Laws API] 取得法規錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 依類別取得法規
 * GET /api/laws/category/:category?limit=50&offset=0
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await lawService.getByCategory(
      req.params.category,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );
    res.json(result);
  } catch (error) {
    console.error('[Laws API] 取得類別法規錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 取得所有類別
 * GET /api/laws/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const result = await lawService.getCategories();
    res.json(result);
  } catch (error) {
    console.error('[Laws API] 取得類別錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 取得統計資訊
 * GET /api/laws/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await lawService.getStats();
    res.json(result);
  } catch (error) {
    console.error('[Laws API] 取得統計錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 匯入單一法規
 * POST /api/laws/import
 */
router.post('/import', async (req, res) => {
  try {
    const result = await lawService.importLaw(req.body);
    res.json(result);
  } catch (error) {
    console.error('[Laws API] 匯入錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批次匯入法規
 * POST /api/laws/batch-import
 */
router.post('/batch-import', async (req, res) => {
  try {
    const { laws } = req.body;
    
    if (!Array.isArray(laws)) {
      return res.status(400).json({ success: false, error: '請提供法規陣列' });
    }
    
    const result = await lawService.importLaws(laws);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Laws API] 批次匯入錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
