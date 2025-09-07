// Tangent Platform WebSocket Client
// Include this in your HTML pages to enable real-time features

class TangentWebSocket {
  constructor(url, authToken) {
    this.url = url || `ws://${window.location.host}`;
    this.authToken = authToken;
    this.socket = null;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = {};
  }

  connect() {
    try {
      this.socket = io(this.url, {
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();
      this.authenticate();
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.scheduleReconnect();
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to Tangent Platform WebSocket');
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket:', reason);
      this.isAuthenticated = false;
      this.emit('disconnected', reason);
      
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('authenticated', (data) => {
      console.log('WebSocket authenticated:', data);
      this.isAuthenticated = true;
      this.emit('authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('WebSocket authentication failed:', error);
      this.emit('auth_error', error);
    });

    // Trade events
    this.socket.on('new_trade', (data) => {
      console.log('New trade received:', data);
      this.emit('new_trade', data);
    });

    this.socket.on('trade_update', (data) => {
      console.log('Trade update received:', data);
      this.emit('trade_update', data);
    });

    // User notifications
    this.socket.on('user_notification', (data) => {
      console.log('User notification:', data);
      this.emit('user_notification', data);
      this.showNotification(data);
    });

    // KYC updates
    this.socket.on('kyc_status_update', (data) => {
      console.log('KYC status update:', data);
      this.emit('kyc_status_update', data);
      this.showKYCNotification(data);
    });

    // System messages
    this.socket.on('system_message', (data) => {
      console.log('System message:', data);
      this.emit('system_message', data);
      this.showSystemMessage(data);
    });

    // Room events
    this.socket.on('joined_room', (data) => {
      console.log('Joined room:', data.room);
      this.emit('joined_room', data);
    });

    this.socket.on('left_room', (data) => {
      console.log('Left room:', data.room);
      this.emit('left_room', data);
    });

    this.socket.on('subscribed', (data) => {
      console.log('Subscribed to channel:', data.channel);
      this.emit('subscribed', data);
    });

    // Chat messages (future feature)
    this.socket.on('new_message', (data) => {
      console.log('New message:', data);
      this.emit('new_message', data);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  authenticate() {
    if (this.authToken && this.socket) {
      this.socket.emit('authenticate', { token: this.authToken });
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
    }
  }

  // Subscription methods
  subscribeToTrades() {
    if (this.isAuthenticated) {
      this.socket.emit('subscribe_trades');
    }
  }

  subscribeToUserTrades() {
    if (this.isAuthenticated) {
      this.socket.emit('subscribe_user_trades');
    }
  }

  subscribeToTrade(tradeId) {
    if (this.isAuthenticated) {
      this.socket.emit('subscribe_trade', { tradeId });
    }
  }

  subscribeToKYCUpdates() {
    if (this.isAuthenticated) {
      this.socket.emit('subscribe_kyc_updates');
    }
  }

  joinRoom(room) {
    if (this.isAuthenticated) {
      this.socket.emit('join_room', { room });
    }
  }

  leaveRoom(room) {
    if (this.isAuthenticated) {
      this.socket.emit('leave_room', { room });
    }
  }

  // Chat functionality (future feature)
  sendMessage(room, message, tradeId = null) {
    if (this.isAuthenticated) {
      this.socket.emit('send_message', { room, message, tradeId });
    }
  }

  // Event handling
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  // UI notification methods
  showNotification(data) {
    // Create a simple browser notification
    if (Notification.permission === 'granted') {
      const notification = new Notification('Tangent Platform', {
        body: this.getNotificationMessage(data),
        icon: '/favicon.ico'
      });

      setTimeout(() => notification.close(), 5000);
    }

    // Also show in-app notification
    this.showInAppNotification(data);
  }

  showKYCNotification(data) {
    const messages = {
      approved: '✅ Your KYC verification has been approved!',
      rejected: '❌ Your KYC verification was rejected.',
      under_review: '🔍 Your KYC documents are under review.'
    };

    const message = messages[data.status] || 'KYC status updated';
    this.showToast(message, data.status === 'approved' ? 'success' : 'info');
  }

  showSystemMessage(data) {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    const message = `${icons[data.level] || 'ℹ️'} ${data.message}`;
    this.showToast(message, data.level);
  }

  getNotificationMessage(data) {
    switch (data.type) {
      case 'new_trade_as_supplier':
        return `New trade opportunity: ${data.data.commodity}`;
      case 'new_trade_as_buyer':
        return `Trade created for you: ${data.data.commodity}`;
      case 'trade_update':
        return `Trade updated: ${data.data.type}`;
      case 'kyc_update':
        return `KYC status: ${data.data.status}`;
      default:
        return 'New notification from Tangent Platform';
    }
  }

  showInAppNotification(data) {
    // Simple in-app notification div
    const notification = document.createElement('div');
    notification.className = 'tangent-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <strong>Notification</strong>
        <p>${this.getNotificationMessage(data)}</p>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('tangent-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'tangent-notification-styles';
      styles.textContent = `
        .tangent-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #667eea;
          color: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          max-width: 300px;
          animation: slideIn 0.3s ease-out;
        }
        .notification-content {
          position: relative;
        }
        .notification-content button {
          position: absolute;
          top: -5px;
          right: -5px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `tangent-toast tangent-toast-${type}`;
    toast.textContent = message;

    // Add toast styles if not present
    if (!document.getElementById('tangent-toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'tangent-toast-styles';
      styles.textContent = `
        .tangent-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 24px;
          border-radius: 6px;
          color: white;
          font-weight: 500;
          z-index: 10001;
          animation: slideUp 0.3s ease-out;
        }
        .tangent-toast-info { background: #3b82f6; }
        .tangent-toast-success { background: #10b981; }
        .tangent-toast-warning { background: #f59e0b; }
        .tangent-toast-error { background: #ef4444; }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 3000);
  }

  // Request notification permission
  static requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Global instance management
window.TangentWebSocket = TangentWebSocket;

// Auto-initialize if auth token is available
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Request notification permission
    TangentWebSocket.requestNotificationPermission();
    
    // Auto-connect if auth token is available
    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (authToken) {
      window.tangentWS = new TangentWebSocket(undefined, authToken);
      window.tangentWS.connect();
      
      // Auto-subscribe to common channels
      window.tangentWS.on('authenticated', () => {
        window.tangentWS.subscribeToTrades();
        window.tangentWS.subscribeToUserTrades();
        window.tangentWS.subscribeToKYCUpdates();
      });
    }
  });
}


