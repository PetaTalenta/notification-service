/**
 * RabbitMQ Configuration for Notification Service
 */

const amqp = require('amqplib');
const logger = require('../utils/logger');

// RabbitMQ configuration
const config = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  eventsExchange: process.env.EVENTS_EXCHANGE_NAME || 'atma_events_exchange',
  notificationsQueue: process.env.EVENTS_QUEUE_NAME_NOTIFICATIONS || 'analysis_events_notifications',
  routingKeys: {
    analysisCompleted: 'analysis.completed',
    analysisFailed: 'analysis.failed',
    analysisStarted: 'analysis.started'
  },
  options: {
    durable: true,
    persistent: true
  }
};

// Connection and channel variables
let connection = null;
let channel = null;

/**
 * Initialize RabbitMQ connection and setup exchange/queue for event consumption
 * @returns {Promise<Object>} - RabbitMQ channel
 */
const initialize = async () => {
  try {
    // Create connection
    logger.info('Connecting to RabbitMQ for event consumption...');
    connection = await amqp.connect(config.url);

    // Handle connection close
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      setTimeout(reconnect, 5000);
    });

    // Handle connection error
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
      setTimeout(reconnect, 5000);
    });

    // Create channel
    channel = await connection.createChannel();

    // Set prefetch count for fair dispatch
    await channel.prefetch(parseInt(process.env.CONSUMER_PREFETCH || '10'));

    // Setup events exchange (should already exist from analysis-worker)
    await channel.assertExchange(config.eventsExchange, 'topic', {
      durable: config.options.durable
    });

    // Setup notifications queue
    await channel.assertQueue(config.notificationsQueue, {
      durable: config.options.durable,
      arguments: {
        'x-dead-letter-exchange': `${config.eventsExchange}_dlx`,
        'x-dead-letter-routing-key': 'notifications.dlq'
      }
    });

    // Bind queue to exchange with routing keys
    await channel.bindQueue(config.notificationsQueue, config.eventsExchange, config.routingKeys.analysisCompleted);
    await channel.bindQueue(config.notificationsQueue, config.eventsExchange, config.routingKeys.analysisFailed);
    await channel.bindQueue(config.notificationsQueue, config.eventsExchange, config.routingKeys.analysisStarted);

    logger.info('RabbitMQ connected for notifications', {
      queue: config.notificationsQueue,
      exchange: config.eventsExchange,
      routingKeys: config.routingKeys
    });

    return channel;
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ for notifications', { error: error.message });
    throw error;
  }
};

/**
 * Reconnect to RabbitMQ
 */
const reconnect = async () => {
  try {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logger.error('Error closing existing RabbitMQ connection', { error: err.message });
      }
    }

    await initialize();
  } catch (error) {
    logger.error('Failed to reconnect to RabbitMQ', { error: error.message });
    setTimeout(reconnect, 5000);
  }
};

/**
 * Get RabbitMQ channel (initialize if needed)
 * @returns {Promise<Object>} - RabbitMQ channel
 */
const getChannel = async () => {
  if (!channel) {
    await initialize();
  }
  return channel;
};

/**
 * Close RabbitMQ connection
 */
const close = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    logger.info('RabbitMQ connection closed gracefully');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection', { error: error.message });
    throw error;
  }
};

/**
 * Check if RabbitMQ connection is healthy
 * @returns {Promise<boolean>} - Connection status
 */
const checkHealth = async () => {
  try {
    if (!connection || !channel) {
      return false;
    }

    // Check if connection is still open
    return connection.connection && !connection.connection.closed;
  } catch (error) {
    logger.error('Error checking RabbitMQ health', { error: error.message });
    return false;
  }
};

module.exports = {
  config,
  initialize,
  getChannel,
  close,
  checkHealth
};
