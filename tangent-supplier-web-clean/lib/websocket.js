const { Server } = require('socket.io');
const { config } = require('./config');
const logger = require('./logger');
const { tokenUtils } = require('./security');

class WebSocketService {
  constructor() {
    this.io = null;
    this.authenticatedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.roomSubscriptions = new Map(); // roomName -> Set of socketIds
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.server.corsOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized successfully');
    return this.io;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('New WebSocket connection', { socketId: socket.id });

      // Authentication handler
      socket.on('authenticate', async (data) => {
        try {
          const { token } = data;
          if (!token) {
            socket.emit('auth_error', { message: 'No token provided' });
            return;
          }

          const decoded = tokenUtils.verifyToken(token);
          
          // Store user mapping
          this.authenticatedUsers.set(decoded.id, socket.id);
          this.userSockets.set(socket.id, decoded.id);
          
          socket.userId = decoded.id;
          socket.userEmail = decoded.email;
          socket.userRole = decoded.role;

          socket.emit('authenticated', { 
            message: 'Authentication successful',
            userId: decoded.id 
          });

          logger.info('WebSocket user authenticated', { 
            userId: decoded.id, 
            socketId: socket.id 
          });

        } catch (error) {
          socket.emit('auth_error', { message: 'Invalid token' });
          logger.warn('WebSocket authentication failed', { 
            socketId: socket.id, 
            error: error.message 
          });
        }
      });

      // Room subscription handlers
      socket.on('join_room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      socket.on('leave_room', (data) => {
        this.handleLeaveRoom(socket, data);
      });

      // Trade-specific handlers
      socket.on('subscribe_trades', () => {
        this.handleSubscribeTrades(socket);
      });

      socket.on('subscribe_user_trades', () => {
        this.handleSubscribeUserTrades(socket);
      });

      socket.on('subscribe_trade', (data) => {
        this.handleSubscribeTrade(socket, data);
      });

      // KYC status updates
      socket.on('subscribe_kyc_updates', () => {
        this.handleSubscribeKYC(socket);
      });

      // Real-time chat (future feature)
      socket.on('send_message', (data) => {
        this.handleSendMessage(socket, data);
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Error handler
      socket.on('error', (error) => {
        logger.error('WebSocket error', { 
          socketId: socket.id, 
          userId: socket.userId,
          error: error.message 
        });
      });
    });
  }

  handleJoinRoom(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const { room } = data;
    if (!room) {
      socket.emit('error', { message: 'Room name required' });
      return;
    }

    socket.join(room);
    
    // Track room subscriptions
    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room).add(socket.id);

    socket.emit('joined_room', { room });
    logger.info('User joined room', { 
      userId: socket.userId, 
      room, 
      socketId: socket.id 
    });
  }

  handleLeaveRoom(socket, data) {
    const { room } = data;
    if (!room) return;

    socket.leave(room);
    
    // Update room subscriptions
    if (this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.get(room).delete(socket.id);
      if (this.roomSubscriptions.get(room).size === 0) {
        this.roomSubscriptions.delete(room);
      }
    }

    socket.emit('left_room', { room });
    logger.info('User left room', { 
      userId: socket.userId, 
      room, 
      socketId: socket.id 
    });
  }

  handleSubscribeTrades(socket) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    socket.join('trades_global');
    socket.emit('subscribed', { channel: 'trades_global' });
    
    logger.info('User subscribed to global trades', { 
      userId: socket.userId, 
      socketId: socket.id 
    });
  }

  handleSubscribeUserTrades(socket) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userRoom = `user_trades_${socket.userId}`;
    socket.join(userRoom);
    socket.emit('subscribed', { channel: 'user_trades' });
    
    logger.info('User subscribed to personal trades', { 
      userId: socket.userId, 
      socketId: socket.id 
    });
  }

  handleSubscribeTrade(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const { tradeId } = data;
    if (!tradeId) {
      socket.emit('error', { message: 'Trade ID required' });
      return;
    }

    const tradeRoom = `trade_${tradeId}`;
    socket.join(tradeRoom);
    socket.emit('subscribed', { channel: 'trade_specific', tradeId });
    
    logger.info('User subscribed to specific trade', { 
      userId: socket.userId, 
      tradeId, 
      socketId: socket.id 
    });
  }

  handleSubscribeKYC(socket) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const kycRoom = `kyc_updates_${socket.userId}`;
    socket.join(kycRoom);
    socket.emit('subscribed', { channel: 'kyc_updates' });
    
    logger.info('User subscribed to KYC updates', { 
      userId: socket.userId, 
      socketId: socket.id 
    });
  }

  handleSendMessage(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const { room, message, tradeId } = data;
    if (!room || !message) {
      socket.emit('error', { message: 'Room and message required' });
      return;
    }

    // TODO: Validate user has access to the room/trade
    // TODO: Store message in database
    // TODO: Apply content moderation

    const messageData = {
      id: Date.now().toString(),
      userId: socket.userId,
      userEmail: socket.userEmail,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      tradeId: tradeId || null
    };

    // Broadcast to room
    this.io.to(room).emit('new_message', messageData);
    
    logger.info('Message sent', { 
      userId: socket.userId, 
      room, 
      messageLength: message.length 
    });
  }

  handleDisconnect(socket) {
    const userId = socket.userId;
    
    // Clean up user mappings
    if (userId) {
      this.authenticatedUsers.delete(userId);
    }
    this.userSockets.delete(socket.id);

    // Clean up room subscriptions
    for (const [room, socketIds] of this.roomSubscriptions) {
      socketIds.delete(socket.id);
      if (socketIds.size === 0) {
        this.roomSubscriptions.delete(room);
      }
    }

    logger.info('WebSocket disconnected', { 
      socketId: socket.id, 
      userId: userId || 'unauthenticated' 
    });
  }

  // Public methods for broadcasting events

  // Broadcast new trade to all subscribers
  broadcastNewTrade(tradeData) {
    if (!this.io) return;

    this.io.to('trades_global').emit('new_trade', {
      type: 'new_trade',
      data: tradeData,
      timestamp: new Date().toISOString()
    });

    logger.info('Broadcasted new trade', { tradeId: tradeData.id });
  }

  // Broadcast trade update to subscribers
  broadcastTradeUpdate(tradeId, updateData) {
    if (!this.io) return;

    const tradeRoom = `trade_${tradeId}`;
    this.io.to(tradeRoom).emit('trade_update', {
      type: 'trade_update',
      tradeId,
      data: updateData,
      timestamp: new Date().toISOString()
    });

    // Also broadcast to global trades room
    this.io.to('trades_global').emit('trade_update', {
      type: 'trade_update',
      tradeId,
      data: updateData,
      timestamp: new Date().toISOString()
    });

    logger.info('Broadcasted trade update', { tradeId, updateType: updateData.type });
  }

  // Notify specific user about their trade
  notifyUser(userId, eventType, data) {
    if (!this.io) return;

    const socketId = this.authenticatedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('user_notification', {
        type: eventType,
        data,
        timestamp: new Date().toISOString()
      });

      logger.info('Sent user notification', { userId, eventType });
    }

    // Also send to user-specific room
    const userRoom = `user_trades_${userId}`;
    this.io.to(userRoom).emit('user_notification', {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast KYC status update to user
  notifyKYCUpdate(userId, status, message = '') {
    if (!this.io) return;

    const kycRoom = `kyc_updates_${userId}`;
    this.io.to(kycRoom).emit('kyc_status_update', {
      type: 'kyc_status_update',
      status,
      message,
      timestamp: new Date().toISOString()
    });

    // Also send direct notification
    this.notifyUser(userId, 'kyc_update', { status, message });

    logger.info('Sent KYC update notification', { userId, status });
  }

  // Broadcast system-wide announcement
  broadcastSystemMessage(message, type = 'info') {
    if (!this.io) return;

    this.io.emit('system_message', {
      type: 'system_message',
      level: type,
      message,
      timestamp: new Date().toISOString()
    });

    logger.info('Broadcasted system message', { type, message });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.authenticatedUsers.size;
  }

  // Get room subscriber count
  getRoomSubscribers(room) {
    return this.roomSubscriptions.get(room)?.size || 0;
  }

  // Get all active rooms
  getActiveRooms() {
    return Array.from(this.roomSubscriptions.keys());
  }

  // Admin: Get connection stats
  getConnectionStats() {
    return {
      totalConnections: this.userSockets.size,
      authenticatedUsers: this.authenticatedUsers.size,
      activeRooms: this.roomSubscriptions.size,
      roomDetails: Object.fromEntries(
        Array.from(this.roomSubscriptions.entries()).map(([room, sockets]) => [
          room,
          sockets.size
        ])
      )
    };
  }
}

// Export singleton instance
module.exports = new WebSocketService();



