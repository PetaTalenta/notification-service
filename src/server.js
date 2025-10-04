const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const notificationRoutes = require('./routes/notifications');
const socketService = require('./services/socketService');
const eventConsumer = require('./services/eventConsumer');

const app = express();
const server = http.createServer(app);

// CORS configuration - Unlimited access
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true
};

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Initialize socket service
socketService.initialize(io);

// Initialize event consumer for event-driven architecture
const initializeEventConsumer = async () => {
  try {
    await eventConsumer.initialize();
    await eventConsumer.startConsuming();
    logger.info('Event consumer initialized and started');
  } catch (error) {
    logger.error('Failed to initialize event consumer', { error: error.message });
    // Don't exit the process, continue with HTTP-based notifications as fallback
  }
};

// Start event consumer (async, non-blocking)
initializeEventConsumer();

// Routes
app.use('/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: socketService.getConnectionCount(),
    eventConsumer: eventConsumer.getStatus()
  });
});

// Debug endpoint for connection details
app.get('/debug/connections', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    connections: socketService.getConnectionDetails(),
    summary: socketService.getConnectionCount()
  });
});

// Debug endpoint to force disconnect user
app.post('/debug/disconnect/:userId', (req, res) => {
  const { userId } = req.params;
  const disconnected = socketService.disconnectUser(userId);

  res.json({
    success: disconnected,
    message: disconnected ? `User ${userId} disconnected` : `User ${userId} not found`,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
});

const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
  logger.info(`Notification Service running on port ${PORT}`);
});

module.exports = { app, server, io };