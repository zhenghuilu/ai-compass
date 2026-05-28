const { logger } = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误',
  });
}

module.exports = { errorHandler };
