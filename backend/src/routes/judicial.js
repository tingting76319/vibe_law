/**
 * Judicial API - PostgreSQL 版本
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const judicialRepository = require('../repositories/judicialRepository');
const { success, error } = require('../utils/apiResponse');
const { parsePagination, requireNonEmptyString } = require('../utils/validation');

function mapDataError(res, err) {
  if (err.code === 'DB_TIMEOUT') {
    return error(res, 504, err.message);
  }

  return error(res, 500, err.message || '系統發生錯誤');
}

// 搜尋案例
router.get('/search', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.query.q, '搜尋關鍵字');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const rows = await judicialRepository.searchJudgments(validated.value);
    return success(res, rows, { count: rows.length });
  } catch (err) {
    console.error('[Judicial] 搜尋錯誤:', err);
    return mapDataError(res, err);
  }
});

// 取得所有案例
router.get('/cases', async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return error(res, 400, pagination.error);
    }

    const rows = await judicialRepository.getAllJudgments(pagination.limit, pagination.offset);
    return success(res, rows, {
      count: rows.length,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (err) {
    return mapDataError(res, err);
  }
});

// 取得單一案例
router.get('/cases/:jid', async (req, res) => {
  try {
    const validated = requireNonEmptyString(req.params.jid, 'jid');
    if (validated.error) {
      return error(res, 400, validated.error);
    }

    const row = await judicialRepository.getJudgmentById(validated.value);
    if (!row) {
      return error(res, 404, '找不到該裁判書');
    }

    return success(res, row);
  } catch (err) {
    return mapDataError(res, err);
  }
});

// 裁判書異動清單
router.get('/changelog', async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    if (pagination.error) {
      return error(res, 400, pagination.error);
    }

    const rows = await judicialRepository.getJudgmentChangelog(pagination.limit, pagination.offset);
    return success(res, rows, {
      count: rows.length,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (err) {
    return mapDataError(res, err);
  }
});

// API 帳密驗證
router.post('/auth', async (req, res) => {
  const configuredUser = process.env.JUDICIAL_AUTH_USER;
  const configuredPassword = process.env.JUDICIAL_AUTH_PASSWORD;

  if (!configuredUser || !configuredPassword) {
    return error(res, 503, 'auth 功能尚未設定');
  }

  const user = typeof req.body?.user === 'string' ? req.body.user : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!user || !password) {
    return error(res, 400, 'user 與 password 為必填欄位');
  }

  if (user !== configuredUser || password !== configuredPassword) {
    return error(res, 401, '帳號或密碼錯誤');
  }

  const issuedAt = Date.now();
  const expiresIn = 3600;
  const payload = `${user}:${issuedAt}:${crypto.randomUUID()}`;
  const token = Buffer.from(payload).toString('base64url');

  return success(res, {
    token,
    tokenType: 'Bearer',
    expiresIn,
    issuedAt
  });
});

// 測試連線
router.get('/test', async (req, res) => {
  try {
    const count = await judicialRepository.getJudgmentCount();
    return success(
      res,
      {
        message: 'PostgreSQL 連線成功',
        count
      },
      {}
    );
  } catch (err) {
    return mapDataError(res, err);
  }
});

module.exports = router;
