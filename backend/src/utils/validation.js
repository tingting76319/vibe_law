function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function parsePagination(query, options = {}) {
  const defaultLimit = options.defaultLimit || 50;
  const maxLimit = options.maxLimit || 100;

  const limit = parseInteger(query.limit, defaultLimit);
  const offset = parseInteger(query.offset, 0);

  if (limit === null || limit <= 0) {
    return { error: 'limit 必須是正整數' };
  }

  if (offset === null || offset < 0) {
    return { error: 'offset 必須是大於等於 0 的整數' };
  }

  return {
    limit: Math.min(limit, maxLimit),
    offset
  };
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { error: `${fieldName} 為必填欄位` };
  }

  return { value: value.trim() };
}

module.exports = {
  parsePagination,
  requireNonEmptyString
};
