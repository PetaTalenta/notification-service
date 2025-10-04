/**
 * Vue.js Composable untuk ATMA WebSocket Notifications
 * 
 * Usage:
 * import { useNotificationSocket } from './composables/useNotificationSocket';
 * 
 * const { isConnected, isAuthenticated, notifications, clearNotifications } = 
 *   useNotificationSocket(authToken);
 */

import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { io } from 'socket.io-client';

// Configuration - Updated to use API Gateway
const SOCKET_URL = process.env.VUE_APP_API_GATEWAY_URL || 'http://localhost:3000';
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;

export function useNotificationSocket(token) {
  const socket = ref(null);
  const isConnected = ref(false);
  const isAuthenticated = ref(false);
  const notifications = ref([]);
  const connectionError = ref(null);

  // Computed properties
  const connectionStatus = computed(() => {
    if (connectionError.value) return 'error';
    if (isConnected.value && isAuthenticated.value) return 'authenticated';
    if (isConnected.value) return 'connected';
    return 'disconnected';
  });

  const unreadCount = computed(() => {
    return notifications.value.filter(n => !n.read).length;
  });

  // Methods
  const clearNotifications = () => {
    notifications.value = [];
  };

  const markAsRead = (id) => {
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  };

  const markAllAsRead = () => {
    notifications.value.forEach(n => n.read = true);
  };

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  };

  const addNotification = (type, data) => {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      timestamp: new Date().toISOString(),
      read: false,
      ...data
    };
    
    notifications.value.unshift(notification);
    
    // Auto-remove after 10 seconds for non-critical notifications
    if (type !== 'failed') {
      setTimeout(() => {
        removeNotification(notification.id);
      }, 10000);
    }
  };

  const connect = () => {
    if (!token.value) {
      connectionError.value = 'No authentication token provided';
      return;
    }

    socket.value = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Connection events
    socket.value.on('connect', () => {
      console.log('🔌 Connected to notification service');
      isConnected.value = true;
      connectionError.value = null;
      socket.value.emit('authenticate', { token: token.value });
    });

    socket.value.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      isConnected.value = false;
      isAuthenticated.value = false;
      
      if (reason === 'io server disconnect') {
        setTimeout(() => socket.value.connect(), 1000);
      }
    });

    socket.value.on('reconnect', (attemptNumber) => {
      console.log('🔌 Reconnected after', attemptNumber, 'attempts');
      socket.value.emit('authenticate', { token: token.value });
    });

    socket.value.on('reconnect_error', (error) => {
      console.error('🔌 Reconnection failed:', error);
      connectionError.value = 'Reconnection failed';
    });

    // Authentication events
    socket.value.on('authenticated', (data) => {
      console.log('✅ Authentication successful:', data.email);
      isAuthenticated.value = true;
      connectionError.value = null;
    });

    socket.value.on('auth_error', (error) => {
      console.error('❌ Authentication failed:', error.message);
      isAuthenticated.value = false;
      connectionError.value = `Authentication failed: ${error.message}`;
    });

    // Notification events
    socket.value.on('analysis-started', (data) => {
      addNotification('started', {
        title: 'Analysis Started',
        message: data.message || 'Your analysis has started processing...',
        jobId: data.jobId,
        metadata: data.metadata
      });
    });

    socket.value.on('analysis-complete', (data) => {
      addNotification('completed', {
        title: 'Analysis Complete',
        message: data.message || 'Your analysis is ready!',
        jobId: data.jobId,
        resultId: data.resultId,
        metadata: data.metadata
      });
    });

    socket.value.on('analysis-failed', (data) => {
      addNotification('failed', {
        title: 'Analysis Failed',
        message: data.message || 'Analysis failed. Please try again.',
        jobId: data.jobId,
        error: data.error,
        metadata: data.metadata
      });
    });

    socket.value.connect();
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }
    isConnected.value = false;
    isAuthenticated.value = false;
  };

  const reconnect = () => {
    disconnect();
    setTimeout(connect, 1000);
  };

  // Watch for token changes
  watch(token, (newToken, oldToken) => {
    if (newToken !== oldToken) {
      if (newToken) {
        connect();
      } else {
        disconnect();
      }
    }
  });

  onMounted(() => {
    if (token.value) {
      connect();
    }
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    isAuthenticated,
    notifications,
    connectionError,
    connectionStatus,
    unreadCount,
    clearNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    reconnect
  };
}

/**
 * Vue Component untuk menampilkan notifications
 */
export const NotificationList = {
  props: {
    notifications: {
      type: Array,
      required: true
    }
  },
  emits: ['remove', 'clear', 'markAsRead'],
  template: `
    <div class="notification-container">
      <div class="notification-header">
        <h3>Notifications ({{ notifications.length }})</h3>
        <button 
          v-if="notifications.length > 0"
          @click="$emit('clear')"
          class="clear-btn"
        >
          Clear All
        </button>
      </div>
      
      <div v-if="notifications.length === 0" class="no-notifications">
        No notifications
      </div>
      
      <div v-else class="notification-list">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          :class="['notification-item', notification.type, { unread: !notification.read }]"
          @click="$emit('markAsRead', notification.id)"
        >
          <div class="notification-content">
            <div class="notification-header-item">
              <span class="notification-icon">{{ getIcon(notification.type) }}</span>
              <strong>{{ notification.title }}</strong>
            </div>
            <p class="notification-message">{{ notification.message }}</p>
            <div v-if="notification.jobId" class="notification-meta">
              Job ID: {{ notification.jobId }}
            </div>
            <div v-if="notification.metadata?.assessmentName" class="notification-meta">
              Assessment: {{ notification.metadata.assessmentName }}
            </div>
            <small class="notification-time">
              {{ formatTime(notification.timestamp) }}
            </small>
          </div>
          <button 
            @click.stop="$emit('remove', notification.id)"
            class="remove-btn"
            title="Remove notification"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  `,
  methods: {
    getIcon(type) {
      switch (type) {
        case 'started': return '⏳';
        case 'completed': return '✅';
        case 'failed': return '❌';
        default: return 'ℹ️';
      }
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  }
};

/**
 * Vue Component untuk status koneksi
 */
export const ConnectionStatus = {
  props: {
    isConnected: Boolean,
    isAuthenticated: Boolean,
    connectionError: String
  },
  emits: ['reconnect'],
  computed: {
    statusColor() {
      if (this.connectionError) return '#f44336';
      if (this.isConnected && this.isAuthenticated) return '#4caf50';
      if (this.isConnected) return '#ff9800';
      return '#9e9e9e';
    },
    statusText() {
      if (this.connectionError) return `Error: ${this.connectionError}`;
      if (this.isConnected && this.isAuthenticated) return 'Connected & Authenticated';
      if (this.isConnected) return 'Connected (Authenticating...)';
      return 'Disconnected';
    },
    showReconnectButton() {
      return this.connectionError || !this.isConnected;
    }
  },
  template: `
    <div class="connection-status">
      <div class="status-info">
        <div 
          class="status-indicator"
          :style="{ backgroundColor: statusColor }"
        ></div>
        <span>{{ statusText }}</span>
      </div>
      <button 
        v-if="showReconnectButton"
        @click="$emit('reconnect')"
        class="reconnect-btn"
      >
        Reconnect
      </button>
    </div>
  `
};

// CSS Styles (dapat digunakan dalam <style> component atau file CSS terpisah)
export const notificationStyles = `
.notification-container {
  max-height: 400px;
  overflow-y: auto;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.notification-header h3 {
  margin: 0;
}

.clear-btn {
  padding: 4px 8px;
  font-size: 12px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.no-notifications {
  padding: 20px;
  text-align: center;
  color: #666;
}

.notification-item {
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 8px;
  border: 1px solid;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: opacity 0.2s;
}

.notification-item.unread {
  font-weight: bold;
}

.notification-item.started {
  background-color: #e3f2fd;
  border-color: #2196f3;
  color: #1565c0;
}

.notification-item.completed {
  background-color: #e8f5e8;
  border-color: #4caf50;
  color: #2e7d32;
}

.notification-item.failed {
  background-color: #ffebee;
  border-color: #f44336;
  color: #c62828;
}

.notification-content {
  flex: 1;
}

.notification-header-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.notification-icon {
  margin-right: 8px;
  font-size: 16px;
}

.notification-message {
  margin: 4px 0;
  font-size: 14px;
}

.notification-meta {
  font-size: 12px;
  opacity: 0.7;
}

.notification-time {
  opacity: 0.7;
  display: block;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.5;
  margin-left: 8px;
}

.remove-btn:hover {
  opacity: 1;
}

.connection-status {
  padding: 8px 12px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.status-info {
  display: flex;
  align-items: center;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.reconnect-btn {
  padding: 4px 8px;
  font-size: 12px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
`;
