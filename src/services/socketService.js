const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const unifiedAuthService = require('./unifiedAuthService');

class SocketService {
  constructor() {
    this.io = null;
    this.userConnections = new Map(); // userId -> Set of socket IDs
    this.offlineNotificationCount = new Map(); // userId -> count of offline notifications
  }

  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('Socket service initialized');
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`, {
        service: 'notification-service',
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Handle authentication
      socket.on('authenticate', (data) => {
        this.authenticateSocket(socket, data.token);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Handle reconnection
      socket.on('reconnecting', (attemptNumber) => {
        logger.info(`Socket reconnecting: ${socket.id}`, {
          socketId: socket.id,
          attemptNumber,
          userId: socket.userId
        });
      });

      // Set timeout for authentication
      setTimeout(() => {
        if (!socket.userId) {
          logger.warn(`Socket ${socket.id} not authenticated within timeout`);
          socket.emit('auth_error', { message: 'Authentication timeout' });
          socket.disconnect();
        }
      }, 10000); // 10 seconds timeout
    });
  }

  async authenticateSocket(socket, token) {
    try {
      if (!token) {
        socket.emit('auth_error', { message: 'Token required' });
        return;
      }

      // Use unified auth service to verify token (supports both JWT and Firebase)
      const user = await unifiedAuthService.verifyToken(token);

      if (!user) {
        socket.emit('auth_error', { message: 'Invalid or expired token' });
        socket.disconnect();
        return;
      }

      socket.userId = user.id;
      socket.userEmail = user.email;
      socket.tokenType = user.tokenType;

      // Add to user connections map
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id).add(socket.id);

      // Join user-specific room
      socket.join(`user:${user.id}`);

      socket.emit('authenticated', {
        success: true,
        userId: user.id,
        email: user.email,
        tokenType: user.tokenType
      });

      logger.info(`Socket authenticated for user ${user.email}`, {
        socketId: socket.id,
        userId: user.id,
        tokenType: user.tokenType
      });

    } catch (error) {
      logger.warn(`Socket authentication failed: ${error.message}`, {
        socketId: socket.id
      });

      socket.emit('auth_error', {
        message: 'Authentication failed'
      });
      socket.disconnect();
    }
  }

  handleDisconnect(socket, reason = 'unknown') {
    if (socket.userId) {
      const userSockets = this.userConnections.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userConnections.delete(socket.userId);
        }
      }

      logger.info(`Socket disconnected for user ${socket.userEmail}`, {
        service: 'notification-service',
        socketId: socket.id,
        userId: socket.userId,
        reason: reason,
        remainingConnections: userSockets ? userSockets.size : 0
      });
    } else {
      logger.info(`Unauthenticated socket disconnected: ${socket.id}`, {
        service: 'notification-service',
        socketId: socket.id,
        reason: reason
      });
    }
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    const room = `user:${userId}`;
    const socketCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;

    if (socketCount > 0) {
      this.io.to(room).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.info(`Notification sent to user ${userId}`, {
        event,
        socketCount,
        data: data
      });

      // Reset offline notification count when user is online
      if (this.offlineNotificationCount.has(userId)) {
        this.offlineNotificationCount.delete(userId);
      }

      return true;
    } else {
      // Implement aggregated logging to reduce noise
      const currentCount = (this.offlineNotificationCount.get(userId) || 0) + 1;
      this.offlineNotificationCount.set(userId, currentCount);

      // Only log every 10th notification or first notification to reduce log noise
      if (currentCount === 1 || currentCount % 10 === 0) {
        logger.debug(`User ${userId} offline - ${currentCount} notification(s) attempted`, {
          event,
          totalAttempts: currentCount
        });
      }

      return false;
    }
  }

  // Get connection statistics
  getConnectionCount() {
    return {
      total: this.io.sockets.sockets.size,
      authenticated: this.userConnections.size,
      users: Array.from(this.userConnections.keys()).length
    };
  }

  // Get detailed connection info for debugging
  getConnectionDetails() {
    const connections = [];
    this.userConnections.forEach((socketIds, userId) => {
      socketIds.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          connections.push({
            userId,
            socketId,
            userEmail: socket.userEmail,
            connected: socket.connected,
            connectedAt: socket.handshake.time,
            remoteAddress: socket.handshake.address
          });
        }
      });
    });
    return connections;
  }

  // Force disconnect user (for debugging)
  disconnectUser(userId) {
    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
      logger.info(`Force disconnected all sockets for user ${userId}`);
      return true;
    }
    return false;
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.info(`Broadcast sent to all users`, { event, data });
  }
}

module.exports = new SocketService();