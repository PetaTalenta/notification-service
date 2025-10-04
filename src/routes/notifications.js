const express = require('express');
const router = express.Router();

const { serviceAuth } = require('../middleware/serviceAuth');
const { validateNotification } = require('../utils/validator');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * POST /notifications/analysis-started
 * Endpoint untuk menerima notifikasi ketika analisis dimulai
 * Enhanced payload: status, assessment_name
 */
router.post('/analysis-started', serviceAuth, validateNotification, (req, res) => {
  try {
    const { userId, jobId, status, assessment_name, message } = req.body;

    // Create streamlined webhook payload
    const webhookPayload = {
      jobId,
      status,
      assessment_name,
      message: message || 'Analysis processing started...'
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-started', webhookPayload);

    logger.info('Analysis started notification processed (Phase 4)', {
      userId,
      jobId,
      status,
      assessment_name,
      sent
    });

    res.json({
      success: true,
      message: 'Notification sent',
      data: {
        userId,
        jobId,
        status,
        assessment_name,
        sent
      }
    });

  } catch (error) {
    logger.error('Error processing analysis started notification', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process notification'
      }
    });
  }
});

/**
 * POST /notifications/analysis-complete
 * Endpoint untuk menerima notifikasi dari analysis-worker ketika analisis selesai
 * Enhanced payload: status='berhasil', result_id, assessment_name
 */
router.post('/analysis-complete', serviceAuth, validateNotification, (req, res) => {
  try {
    const { userId, jobId, result_id, status, assessment_name } = req.body;

    // Normalize status to database value: 'completed'
    const normalizedStatus = 'completed';

    // Create concise webhook payload per spec
    const webhookPayload = {
      status: normalizedStatus,
      result_id,
      assessment_name
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-complete', webhookPayload);

    logger.info('Analysis complete notification processed (Phase 4)', {
      userId,
      jobId,
      result_id,
      status,
      assessment_name,
      sent
    });

    res.json({
      success: true,
      message: 'Notification sent',
      data: {
        userId,
        jobId,
        result_id,
        status,
        assessment_name,
        sent
      }
    });

  } catch (error) {
    logger.error('Error processing analysis complete notification', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process notification'
      }
    });
  }
});

/**
 * POST /notifications/analysis-failed
 * Endpoint untuk menerima notifikasi ketika analisis gagal
 * Enhanced payload: status='gagal', assessment_name, error_message
 */
router.post('/analysis-failed', serviceAuth, validateNotification, (req, res) => {
  try {
    const { userId, jobId, status, assessment_name, error_message, result_id } = req.body;

    // Normalize status to database value: 'failed'
    const normalizedStatus = 'failed';

    // Create concise webhook payload per spec
    const webhookPayload = {
      status: normalizedStatus,
      result_id: result_id || null,
      assessment_name,
      error_message
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-failed', webhookPayload);

    logger.info('Analysis failed notification processed (Phase 4)', {
      userId,
      jobId,
      status,
      assessment_name,
      error_message,
      sent
    });

    res.json({
      success: true,
      message: 'Notification sent',
      data: {
        userId,
        jobId,
        status,
        assessment_name,
        error_message,
        sent
      }
    });

  } catch (error) {
    logger.error('Error processing analysis failed notification', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process notification'
      }
    });
  }
});

/**
 * POST /notifications/analysis-unknown
 * Endpoint untuk menerima notifikasi ketika jenis asesmen tidak dikenal
 * Enhanced payload: status='gagal', assessment_name, error_message
 */
router.post('/analysis-unknown', serviceAuth, validateNotification, (req, res) => {
  try {
    const { userId, jobId, status, assessment_name, error_message, result_id } = req.body;

    // Normalize status to database value: 'failed'
    const normalizedStatus = 'failed';

    // Create concise webhook payload for unknown assessment type per spec
    const webhookPayload = {
      status: normalizedStatus,
      result_id: result_id || null,
      assessment_name,
      error_message
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-unknown', webhookPayload);

    logger.warn('Unknown assessment type notification processed (Phase 4)', {
      userId,
      jobId,
      status,
      assessment_name,
      error_message,
      sent
    });

    res.json({
      success: true,
      message: 'Unknown assessment notification sent',
      data: {
        userId,
        jobId,
        status,
        assessment_name,
        error_message,
        sent
      }
    });

  } catch (error) {
    logger.error('Error processing unknown assessment notification', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process notification'
      }
    });
  }
});

/**
 * GET /notifications/status
 * Endpoint untuk memeriksa status service dan koneksi
 */
router.get('/status', serviceAuth, (req, res) => {
  try {
    const connections = socketService.getConnectionCount();
    
    res.json({
      success: true,
      service: 'notification-service',
      status: 'operational',
      connections,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting service status', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get service status'
      }
    });
  }
});

module.exports = router;
