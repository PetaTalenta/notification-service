/**
 * Event Consumer Service for Notification Service
 * Consumes analysis events from RabbitMQ and processes notifications
 */

const rabbitmq = require('../config/rabbitmq');
const socketService = require('./socketService');
const logger = require('../utils/logger');

// Consumer state
let isConsuming = false;
let channel = null;

/**
 * Initialize event consumer
 */
const initialize = async () => {
  try {
    // Initialize RabbitMQ connection
    channel = await rabbitmq.initialize();
    
    logger.info('Event consumer initialized for notifications');
  } catch (error) {
    logger.error('Failed to initialize event consumer', { error: error.message });
    throw error;
  }
};

/**
 * Start consuming events from the queue
 */
const startConsuming = async () => {
  try {
    if (isConsuming) {
      logger.warn('Event consumer is already consuming messages');
      return;
    }

    if (!channel) {
      throw new Error('Event consumer not initialized');
    }

    // Start consuming events
    await channel.consume(rabbitmq.config.notificationsQueue, async (message) => {
      if (message) {
        try {
          const eventData = JSON.parse(message.content.toString());
          
          logger.debug('Received event', {
            eventType: eventData.eventType,
            jobId: eventData.jobId,
            userId: eventData.userId
          });

          // Process the event based on type
          await processEvent(eventData);

          // Acknowledge the message
          channel.ack(message);

          logger.debug('Event processed successfully', {
            eventType: eventData.eventType,
            jobId: eventData.jobId,
            userId: eventData.userId
          });

        } catch (error) {
          logger.error('Failed to process event', {
            error: error.message,
            messageId: message.properties.messageId
          });

          // Reject the message and don't requeue (send to DLQ)
          channel.nack(message, false, false);
        }
      }
    }, {
      noAck: false // Enable manual acknowledgment
    });

    isConsuming = true;
    logger.info('Event consumer started - consuming analysis events');

  } catch (error) {
    logger.error('Failed to start event consumer', { error: error.message });
    throw error;
  }
};

/**
 * Process individual event based on type
 * @param {Object} eventData - Event data from RabbitMQ
 */
const processEvent = async (eventData) => {
  const { eventType, userId, jobId } = eventData;

  switch (eventType) {
    case 'analysis.completed':
      await handleAnalysisCompleted(eventData);
      break;
    
    case 'analysis.failed':
      await handleAnalysisFailed(eventData);
      break;
    
    case 'analysis.started':
      await handleAnalysisStarted(eventData);
      break;
    
    default:
      logger.warn('Unknown event type received', {
        eventType,
        jobId,
        userId
      });
  }
};

/**
 * Handle analysis completed events
 * Phase 4: Enhanced with streamlined webhook payload
 * @param {Object} eventData - Event data
 */
const handleAnalysisCompleted = async (eventData) => {
  const { userId, jobId, resultId, metadata } = eventData;

  try {
    // Create concise webhook payload per spec (using database status: 'completed')
    const webhookPayload = {
      status: 'completed',
      result_id: resultId,
      assessment_name: metadata?.assessmentName || 'Unknown Assessment'
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-complete', webhookPayload);

    logger.info('Analysis complete notification sent via event (Phase 4)', {
      userId,
      jobId,
      result_id: resultId,
      status: 'completed',
      assessment_name: metadata?.assessmentName,
      sent
    });

  } catch (error) {
    logger.error('Failed to handle analysis completed event', {
      userId,
      jobId,
      resultId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Handle analysis failed events
 * Phase 4: Enhanced with streamlined webhook payload
 * @param {Object} eventData - Event data
 */
const handleAnalysisFailed = async (eventData) => {
  const { userId, jobId, errorMessage, metadata } = eventData;

  try {
    // Determine if this is an unknown assessment type
    const isUnknownAssessment = metadata?.errorType === 'UNSUPPORTED_ASSESSMENT_TYPE';
    const eventType = isUnknownAssessment ? 'analysis-unknown' : 'analysis-failed';

    // Create concise webhook payload per spec (using database status: 'failed')
    const webhookPayload = {
      status: 'failed',
      result_id: eventData.resultId || null,
      assessment_name: metadata?.assessmentName || 'Unknown Assessment',
      error_message: errorMessage
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, eventType, webhookPayload);

    logger.info(`Analysis ${isUnknownAssessment ? 'unknown' : 'failed'} notification sent via event (Phase 4)`, {
      userId,
      jobId,
      status: 'failed',
      assessment_name: metadata?.assessmentName,
      error_message: errorMessage,
      eventType,
      sent
    });

  } catch (error) {
    logger.error('Failed to handle analysis failed event', {
      userId,
      jobId,
      errorMessage,
      error: error.message
    });
    throw error;
  }
};

/**
 * Handle analysis started events (Week 2 Enhanced)
 * @param {Object} eventData - Event data
 */
const handleAnalysisStarted = async (eventData) => {
  const { userId, jobId, resultId, metadata } = eventData;

  try {
    // Create enhanced webhook payload with resultId (Week 2)
    const webhookPayload = {
      jobId,
      resultId: resultId || null,
      status: 'processing',
      assessment_name: metadata?.assessmentName || 'Unknown Assessment',
      message: 'Your analysis has started processing...',
      estimated_time: metadata?.estimatedProcessingTime || '1-3 minutes'
    };

    // Send notification to user via WebSocket
    const sent = socketService.sendToUser(userId, 'analysis-started', webhookPayload);

    logger.info('Analysis started notification sent via event (Week 2)', {
      userId,
      jobId,
      resultId,
      assessment_name: metadata?.assessmentName,
      sent
    });

  } catch (error) {
    logger.error('Failed to handle analysis started event', {
      userId,
      jobId,
      resultId: eventData.resultId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Stop consuming events
 */
const stopConsuming = async () => {
  try {
    if (channel && isConsuming) {
      await channel.cancel();
      isConsuming = false;
      logger.info('Event consumer stopped');
    }
  } catch (error) {
    logger.error('Failed to stop event consumer', { error: error.message });
    throw error;
  }
};

/**
 * Get consumer status
 * @returns {Object} - Consumer status
 */
const getStatus = () => {
  return {
    isConsuming,
    isConnected: channel !== null,
    queue: rabbitmq.config.notificationsQueue,
    exchange: rabbitmq.config.eventsExchange
  };
};

module.exports = {
  initialize,
  startConsuming,
  stopConsuming,
  getStatus,
  handleAnalysisCompleted,
  handleAnalysisFailed,
  handleAnalysisStarted
};
