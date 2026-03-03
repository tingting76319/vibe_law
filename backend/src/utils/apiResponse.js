function buildPayload(status, payload = {}, meta) {
  const base = { status, ...payload };
  if (meta && Object.keys(meta).length > 0) {
    base.meta = meta;
  }
  return base;
}

function success(res, data, meta = {}, statusCode = 200) {
  return res.status(statusCode).json(buildPayload('success', { data }, meta));
}

function error(res, statusCode, message, meta = {}) {
  return res.status(statusCode).json(
    buildPayload(
      'error',
      {
        message,
        error: {
          message
        }
      },
      meta
    )
  );
}

module.exports = {
  success,
  error
};
