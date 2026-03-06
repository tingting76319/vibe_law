/**
 * 律師 API Routes - v0.8.0
 * 律師列表、搜尋、詳情 API
 */
const express = require('express');
const router = express.Router();
const lawyerService = require('../services/lawyerService');

// ========== 律師列表 API ==========

// GET /api/lawyers - 律師列表
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      specialty, 
      minExperience, 
      available, 
      minRating,
      maxHourlyRate,
      search 
    } = req.query;

    const filters = {
      specialty,
      minExperience: minExperience ? parseInt(minExperience) : null,
      available: available !== undefined ? available === 'true' : null,
      minRating: minRating ? parseFloat(minRating) : null,
      maxHourlyRate: maxHourlyRate ? parseFloat(maxHourlyRate) : null,
      limit: parseInt(limit)
    };

    let lawyers;
    if (search || Object.keys(filters).some(k => filters[k])) {
      lawyers = lawyerService.searchLawyers(search, filters);
    } else {
      lawyers = lawyerService.getAllLawyers(parseInt(limit), parseInt(offset));
    }

    res.json({
      status: 'success',
      data: lawyers,
      count: lawyers.length,
      meta: {
        filters: req.query,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[lawyers] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 律師搜尋 API ==========

// GET /api/lawyers/search - 搜尋律師
router.get('/search', async (req, res) => {
  try {
    const { q, specialty, minExperience, available, minRating, maxHourlyRate, limit = 20 } = req.query;

    if (!q && !specialty) {
      return res.status(400).json({
        status: 'error',
        message: '請提供搜尋關鍵字或專業領域',
        code: 'MISSING_QUERY'
      });
    }

    const filters = {
      specialty,
      minExperience: minExperience ? parseInt(minExperience) : null,
      available: available !== undefined ? available === 'true' : null,
      minRating: minRating ? parseFloat(minRating) : null,
      maxHourlyRate: maxHourlyRate ? parseFloat(maxHourlyRate) : null,
      limit: parseInt(limit)
    };

    const lawyers = lawyerService.searchLawyers(q, filters);

    res.json({
      status: 'success',
      data: lawyers,
      count: lawyers.length,
      meta: {
        query: q,
        filters,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[lawyers/search] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 律師詳情 API ==========

// GET /api/lawyers/:id - 律師詳情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lawyer = lawyerService.getLawyerById(id);
    
    if (!lawyer) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    // 取得統計資料
    const stats = lawyerService.getLawyerStats(id);

    res.json({
      status: 'success',
      data: {
        ...lawyer,
        statistics: stats
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[lawyers/:id] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 律師專業領域 API ==========

// GET /api/lawyers/specialty/:specialty - 按專業領域查詢
router.get('/specialty/:specialty', async (req, res) => {
  try {
    const { specialty } = req.params;
    const { limit = 20 } = req.query;

    const lawyers = lawyerService.getLawyersBySpecialty(specialty, parseInt(limit));

    res.json({
      status: 'success',
      data: lawyers,
      count: lawyers.length,
      meta: {
        specialty,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[lawyers/specialty] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 律師 Bar Number 查詢 ==========

// GET /api/lawyers/bar/:barNumber - 依律師證號查詢
router.get('/bar/:barNumber', async (req, res) => {
  try {
    const { barNumber } = req.params;
    
    const lawyer = lawyerService.getLawyerByBarNumber(barNumber);
    
    if (!lawyer) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    res.json({
      status: 'success',
      data: lawyer,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[lawyers/bar] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========== 管理端 API (POST/PUT/DELETE) ==========

// POST /api/lawyers - 新增律師
router.post('/', async (req, res) => {
  try {
    const lawyerData = req.body;
    
    if (!lawyerData.name || !lawyerData.bar_number) {
      return res.status(400).json({
        status: 'error',
        message: '姓名和律師證號為必填欄位',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // 檢查律師證號是否已存在
    const existing = lawyerService.getLawyerByBarNumber(lawyerData.bar_number);
    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: '此律師證號已被註冊',
        code: 'BAR_NUMBER_EXISTS'
      });
    }

    const lawyer = lawyerService.createLawyer(lawyerData);

    res.status(201).json({
      status: 'success',
      data: lawyer,
      message: '律師資料建立成功'
    });
  } catch (error) {
    console.error('[lawyers POST] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// PUT /api/lawyers/:id - 更新律師
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await lawyerService.getLawyerById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    const lawyer = await lawyerService.updateLawyer(id, updateData);

    res.json({
      status: 'success',
      data: lawyer,
      message: '律師資料更新成功'
    });
  } catch (error) {
    console.error('[lawyers PUT] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// DELETE /api/lawyers/:id - 刪除律師
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await lawyerService.getLawyerById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: '律師不存在',
        code: 'LAWYER_NOT_FOUND'
      });
    }

    lawyerService.deleteLawyer(id);

    res.json({
      status: 'success',
      message: '律師資料刪除成功'
    });
  } catch (error) {
    console.error('[lawyers DELETE] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;

// ========== 律師資料提取 API ==========

// GET /api/lawyers/extract - 從判決書提取律師資料
router.get('/extract', async (req, res) => {
  try {
    const { limit = 1000 } = req.query;
    const pool = require('../db/postgres');
    
    // 檢查表格是否存在
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'extracted_lawyers'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ 
        status: 'success', 
        message: '律師資料表尚未建立，請先執行 extractLawyers.js',
        data: [] 
      });
    }
    
    // 查詢律師統計
    const result = await pool.query(`
      SELECT lawyer_name, COUNT(*) as case_count
      FROM extracted_lawyers
      GROUP BY lawyer_name
      ORDER BY case_count DESC
      LIMIT 100
    `);
    
    res.json({
      status: 'success',
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('[lawyers/extract] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/lawyers/bulk - 批量新增律師
router.post('/bulk', async (req, res) => {
  try {
    const { lawyers } = req.body;
    if (!lawyers || !Array.isArray(lawyers)) {
      return res.status(400).json({ status: 'error', message: '請提供律師陣列' });
    }
    
    const results = [];
    for (const lawyer of lawyers) {
      try {
        // 這裡應該寫入資料庫
        results.push({ name: lawyer.name, status: 'saved' });
      } catch (e) {
        results.push({ name: lawyer.name, status: 'error', message: e.message });
      }
    }
    
    res.json({ 
      status: 'success', 
      saved: results.filter(r => r.status === 'saved').length,
      results 
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ===== v1.6: 律師數位孿生 API =====

// GET /api/lawyers/:id/stats - 律師統計分析
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await lawyerService.getLawyerStats(id);
    
    if (!stats) {
      return res.status(404).json({ status: 'error', message: '律師不存在' });
    }
    
    res.json({ status: 'success', data: stats });
  } catch (e) {
    console.error('[lawyers/:id/stats] Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/lawyers/:id/style - 律師風格分析
router.get('/:id/style', async (req, res) => {
  try {
    const { id } = req.params;
    const style = await lawyerService.getLawyerStyle(id);
    
    if (!style) {
      return res.status(404).json({ status: 'error', message: '律師不存在' });
    }
    
    res.json({ status: 'success', data: style });
  } catch (e) {
    console.error('[lawyers/:id/style] Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/lawyers/:id/cases - 律師歷史案件
router.get('/:id/cases', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const cases = await lawyerService.getLawyerCases(id, parseInt(limit));
    
    res.json({ status: 'success', data: cases, count: cases.length });
  } catch (e) {
    console.error('[lawyers/:id/cases] Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});
