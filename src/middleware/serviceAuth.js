const logger = require('../utils/logger');

/**
 * Middleware untuk autentikasi internal service
 * Memverifikasi X-Service-Key header dari analysis-worker
 */
const serviceAuth = (req, res, next) => {
  const serviceKey = req.headers['x-service-key'];
  const internalService = req.headers['x-internal-service'];

  if (!serviceKey || !internalService) {
    logger.warn('Service authentication failed: Missing headers', {
      ip: req.ip,
      path: req.path,
      headers: {
        'x-service-key': !!serviceKey,
        'x-internal-service': !!internalService
      }
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Internal service authentication required'
      }
    });
  }

  if (serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
    logger.warn('Service authentication failed: Invalid service key', {
      ip: req.ip,
      path: req.path,
      receivedKey: serviceKey ? 'present' : 'missing',
      expectedKey: process.env.INTERNAL_SERVICE_KEY ? 'present' : 'missing'
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid service key'
      }
    });
  }

  logger.debug('Service authentication successful', {
    service: internalService,
    path: req.path
  });

  next();
};

module.exports = { serviceAuth };