import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { notificationService } from './notification.service';

// WebSocket event types
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
  userId?: string;
  roomId?: string;
}

export interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: string;
  userId?: string;
  roomId?: string;
}

export interface WebSocketRoom {
  id: string;
  name: string;
  type: 'admin' | 'user' | 'shop' | 'reservation';
  participants: string[];
  createdAt: string;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  userRole: string;
  rooms: string[];
  connectedAt: string;
  lastActivity: string;
}

export interface AdminNotification {
  id: string;
  type: 'reservation_update' | 'payment_update' | 'shop_approval' | 'system_alert';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
}

export interface ReservationUpdate {
  reservationId: string;
  status: string;
  shopId: string;
  userId: string;
  updateType: 'created' | 'confirmed' | 'cancelled' | 'modified';
  timestamp: string;
  data?: Record<string, any>;
}

export interface SettingsUpdate {
  userId: string;
  updateType: 'single' | 'bulk' | 'reset';
  changedFields: string[];
  newValues: Record<string, any>;
  timestamp: string;
  source?: 'web' | 'mobile' | 'api';
}

export interface UserActivityEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  activityType: 'login' | 'logout' | 'status_change' | 'role_change' | 'profile_update' | 'admin_action' | 'reservation_update' | 'payment_update';
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AdminActivityFilter {
  userId?: string;
  activityTypes?: string[];
  severity?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class WebSocketService {
  private io: SocketIOServer;
  private supabase = getSupabaseClient();
  private connections = new Map<string, WebSocketConnection>();
  private rooms = new Map<string, WebSocketRoom>();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.setupAdminRooms();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Handle authentication
      socket.on('authenticate', async (data: { token: string }) => {
        await this.handleAuthentication(socket, data.token);
      });

      // Handle room joining
      socket.on('join_room', async (data: { roomId: string; userId: string }) => {
        await this.handleJoinRoom(socket, data.roomId, data.userId);
      });

      // Handle room leaving
      socket.on('leave_room', (data: { roomId: string; userId: string }) => {
        this.handleLeaveRoom(socket, data.roomId, data.userId);
      });

      // Handle admin notifications
      socket.on('admin_notification', (data: AdminNotification) => {
        this.handleAdminNotification(socket, data);
      });

      // Handle reservation updates
      socket.on('reservation_update', (data: ReservationUpdate) => {
        this.handleReservationUpdate(socket, data);
      });

      // Handle settings updates
      socket.on('settings_update', (data: SettingsUpdate) => {
        this.handleSettingsUpdate(socket, data);
      });

      // Handle user typing
      socket.on('typing', (data: { roomId: string; userId: string; isTyping: boolean }) => {
        this.handleTyping(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Setup admin rooms for different notification types
   */
  private setupAdminRooms(): void {
    const adminRooms = [
      { id: 'admin-general', name: 'General Admin', type: 'admin' as const },
      { id: 'admin-reservations', name: 'Reservation Updates', type: 'admin' as const },
      { id: 'admin-payments', name: 'Payment Updates', type: 'admin' as const },
      { id: 'admin-shops', name: 'Shop Approvals', type: 'admin' as const },
      { id: 'admin-system', name: 'System Alerts', type: 'admin' as const },
      { id: 'admin-activity', name: 'User Activity Monitoring', type: 'admin' as const }
    ];

    adminRooms.forEach(room => {
      this.rooms.set(room.id, {
        ...room,
        participants: [],
        createdAt: new Date().toISOString()
      });
    });
  }

  /**
   * Handle user authentication
   */
  private async handleAuthentication(socket: Socket, token: string): Promise<void> {
    try {
      // Verify JWT token with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        socket.emit('auth_error', {
          message: '인증에 실패했습니다.',
          code: 'AUTH_FAILED'
        });
        return;
      }

      // Store connection information
      const connection: WebSocketConnection = {
        id: socket.id,
        userId: user.id,
        userRole: user.user_metadata?.role || 'user',
        rooms: [],
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      this.connections.set(socket.id, connection);

      // Join user-specific room
      const userRoom = `user-${user.id}`;
      socket.join(userRoom);
      connection.rooms.push(userRoom);

      // Join role-specific room
      const roleRoom = `role-${connection.userRole}`;
      socket.join(roleRoom);
      connection.rooms.push(roleRoom);

      // Join admin rooms if user is admin
      if (connection.userRole === 'admin') {
        const adminRooms = ['admin-general', 'admin-reservations', 'admin-payments', 'admin-shops', 'admin-system', 'admin-activity'];
        adminRooms.forEach(roomId => {
          socket.join(roomId);
          connection.rooms.push(roomId);
        });
      }

      socket.emit('authenticated', {
        userId: user.id,
        userRole: connection.userRole,
        rooms: connection.rooms
      });

      logger.info('WebSocket user authenticated', {
        socketId: socket.id,
        userId: user.id,
        userRole: connection.userRole
      });

    } catch (error) {
      logger.error('WebSocket authentication failed', { error, socketId: socket.id });
      socket.emit('auth_error', {
        message: '인증 중 오류가 발생했습니다.',
        code: 'AUTH_ERROR'
      });
    }
  }

  /**
   * Handle room joining
   */
  private async handleJoinRoom(socket: Socket, roomId: string, userId: string): Promise<void> {
    try {
      const connection = this.connections.get(socket.id);
      if (!connection) {
        socket.emit('error', { message: '연결이 인증되지 않았습니다.' });
        return;
      }

      // Check if user has permission to join the room
      if (!this.canJoinRoom(connection, roomId)) {
        socket.emit('error', { message: '이 방에 참여할 권한이 없습니다.' });
        return;
      }

      socket.join(roomId);
      connection.rooms.push(roomId);
      connection.lastActivity = new Date().toISOString();

      // Update room participants
      const room = this.rooms.get(roomId);
      if (room && !room.participants.includes(userId)) {
        room.participants.push(userId);
      }

      socket.emit('room_joined', {
        roomId,
        participants: room?.participants || []
      });

      // Notify other room members
      socket.to(roomId).emit('user_joined', {
        userId,
        roomId,
        timestamp: new Date().toISOString()
      });

      logger.info('User joined room', { socketId: socket.id, userId, roomId });

    } catch (error) {
      logger.error('Failed to join room', { error, socketId: socket.id, roomId });
      socket.emit('error', { message: '방 참여 중 오류가 발생했습니다.' });
    }
  }

  /**
   * Handle room leaving
   */
  private handleLeaveRoom(socket: Socket, roomId: string, userId: string): void {
    try {
      const connection = this.connections.get(socket.id);
      if (!connection) return;

      socket.leave(roomId);
      connection.rooms = connection.rooms.filter(r => r !== roomId);
      connection.lastActivity = new Date().toISOString();

      // Update room participants
      const room = this.rooms.get(roomId);
      if (room) {
        room.participants = room.participants.filter(p => p !== userId);
      }

      // Notify other room members
      socket.to(roomId).emit('user_left', {
        userId,
        roomId,
        timestamp: new Date().toISOString()
      });

      logger.info('User left room', { socketId: socket.id, userId, roomId });

    } catch (error) {
      logger.error('Failed to leave room', { error, socketId: socket.id, roomId });
    }
  }

  /**
   * Handle admin notifications
   */
  private handleAdminNotification(socket: Socket, notification: AdminNotification): void {
    try {
      const connection = this.connections.get(socket.id);
      if (!connection || connection.userRole !== 'admin') {
        socket.emit('error', { message: '관리자 권한이 필요합니다.' });
        return;
      }

      // Broadcast to appropriate admin room
      const roomId = `admin-${notification.type.split('_')[1]}`;
      this.io.to(roomId).emit('admin_notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });

      // Also send push notification to admin users
      this.broadcastAdminNotification(notification);

      logger.info('Admin notification sent', {
        socketId: socket.id,
        notificationId: notification.id,
        roomId
      });

    } catch (error) {
      logger.error('Failed to handle admin notification', { error, socketId: socket.id });
      socket.emit('error', { message: '관리자 알림 처리 중 오류가 발생했습니다.' });
    }
  }

  /**
   * Handle reservation updates
   */
  private handleReservationUpdate(socket: Socket, update: ReservationUpdate): void {
    try {
      const connection = this.connections.get(socket.id);
      if (!connection) return;

      // Broadcast to admin reservations room
      this.io.to('admin-reservations').emit('reservation_update', {
        ...update,
        timestamp: new Date().toISOString()
      });

      // Send to specific user
      this.io.to(`user-${update.userId}`).emit('reservation_update', {
        ...update,
        timestamp: new Date().toISOString()
      });

      // Send to shop owner if applicable
      this.io.to(`shop-${update.shopId}`).emit('reservation_update', {
        ...update,
        timestamp: new Date().toISOString()
      });

      logger.info('Reservation update sent', {
        socketId: socket.id,
        reservationId: update.reservationId,
        updateType: update.updateType
      });

    } catch (error) {
      logger.error('Failed to handle reservation update', { error, socketId: socket.id });
    }
  }

  /**
   * Handle settings updates
   */
  private handleSettingsUpdate(socket: Socket, update: SettingsUpdate): void {
    try {
      const connection = this.connections.get(socket.id);
      if (!connection) {
        socket.emit('error', { message: '연결이 인증되지 않았습니다.' });
        return;
      }

      // Verify that the user can only update their own settings
      if (connection.userId !== update.userId) {
        socket.emit('error', { message: '다른 사용자의 설정을 변경할 권한이 없습니다.' });
        return;
      }

      // Broadcast settings update to all user's connected devices
      this.io.to(`user-${update.userId}`).emit('settings_update', {
        ...update,
        timestamp: new Date().toISOString()
      });

      logger.info('Settings update broadcasted', {
        userId: update.userId,
        updateType: update.updateType,
        changedFields: update.changedFields,
        source: update.source
      });

    } catch (error) {
      logger.error('Error handling settings update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        update
      });
      socket.emit('error', { message: '설정 업데이트 처리 중 오류가 발생했습니다.' });
    }
  }

  /**
   * Handle typing indicators
   */
  private handleTyping(socket: Socket, data: { roomId: string; userId: string; isTyping: boolean }): void {
    try {
      socket.to(data.roomId).emit('typing', {
        userId: data.userId,
        roomId: data.roomId,
        isTyping: data.isTyping,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to handle typing indicator', { error, socketId: socket.id });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    try {
      const connection = this.connections.get(socket.id);
      if (connection) {
        // Remove from all rooms
        connection.rooms.forEach(roomId => {
          const room = this.rooms.get(roomId);
          if (room) {
            room.participants = room.participants.filter(p => p !== connection.userId);
          }
        });

        this.connections.delete(socket.id);
      }

      logger.info('WebSocket client disconnected', { socketId: socket.id });

    } catch (error) {
      logger.error('Failed to handle disconnect', { error, socketId: socket.id });
    }
  }

  /**
   * Check if user can join a room
   */
  private canJoinRoom(connection: WebSocketConnection, roomId: string): boolean {
    // Admin can join any room
    if (connection.userRole === 'admin') return true;

    // Users can join their own room
    if (roomId === `user-${connection.userId}`) return true;

    // Users can join role-based rooms
    if (roomId === `role-${connection.userRole}`) return true;

    // Shop owners can join their shop room
    if (roomId.startsWith('shop-') && connection.userRole === 'shop_owner') {
      const shopId = roomId.replace('shop-', '');
      // Here you would check if the user owns this shop
      return true;
    }

    return false;
  }

  /**
   * Broadcast admin notification to all admin users
   */
  private async broadcastAdminNotification(notification: AdminNotification): Promise<void> {
    try {
      // Get all admin users
      const { data: adminUsers, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (error || !adminUsers) {
        logger.error('Failed to get admin users for notification', { error });
        return;
      }

      // Send push notification to all admin users
      const userIds = adminUsers.map(user => user.id);
      await notificationService.sendNotificationToUsers(userIds, {
        title: notification.title,
        body: notification.message,
        data: {
          type: 'admin_notification',
          notificationId: notification.id,
          priority: notification.priority,
          ...notification.data
        }
      });

      logger.info('Admin notification broadcasted', {
        notificationId: notification.id,
        adminCount: userIds.length
      });

    } catch (error) {
      logger.error('Failed to broadcast admin notification', { error });
    }
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, event: string, data: any): void {
    this.io.to(`user-${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to all users in a room
   */
  public sendToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to all admin users
   */
  public sendToAdmins(event: string, data: any): void {
    this.io.to('admin-general').emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(event: string, data: any): void {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast settings update to all user's connected devices
   */
  public broadcastSettingsUpdate(userId: string, changedFields: string[], newValues: Record<string, any>, source?: string): void {
    const settingsUpdate: SettingsUpdate = {
      userId,
      updateType: changedFields.length === 1 ? 'single' : 'bulk',
      changedFields,
      newValues,
      timestamp: new Date().toISOString(),
      source: (source || 'api') as 'mobile' | 'web' | 'api'
    };

    this.io.to(`user-${userId}`).emit('settings_update', settingsUpdate);

    logger.info('Settings update broadcasted to user', {
      userId,
      changedFields,
      source,
      updateType: settingsUpdate.updateType
    });
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    activeRooms: number;
    connectionsByRole: Record<string, number>;
  } {
    const connectionsByRole: Record<string, number> = {};
    
    this.connections.forEach(connection => {
      connectionsByRole[connection.userRole] = (connectionsByRole[connection.userRole] || 0) + 1;
    });

    return {
      totalConnections: this.connections.size,
      activeRooms: this.rooms.size,
      connectionsByRole
    };
  }

  /**
   * Get room information
   */
  public getRoomInfo(roomId: string): WebSocketRoom | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all active rooms
   */
  public getAllRooms(): WebSocketRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(socketId: string): WebSocketConnection | null {
    return this.connections.get(socketId) || null;
  }

  /**
   * Clean up inactive connections
   */
  public cleanupInactiveConnections(): void {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    this.connections.forEach((connection, socketId) => {
      const lastActivity = new Date(connection.lastActivity);
      if (now.getTime() - lastActivity.getTime() > inactiveThreshold) {
        this.connections.delete(socketId);
        logger.info('Cleaned up inactive connection', { socketId, userId: connection.userId });
      }
    });
  }

  /**
   * Broadcast user activity event to admin monitoring room
   */
  public broadcastUserActivity(activity: UserActivityEvent): void {
    try {
      this.io.to('admin-activity').emit('user_activity', {
        ...activity,
        timestamp: new Date().toISOString()
      });

      logger.info('User activity broadcasted to admins', {
        activityId: activity.id,
        userId: activity.userId,
        activityType: activity.activityType,
        severity: activity.severity
      });
    } catch (error) {
      logger.error('Failed to broadcast user activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        activity
      });
    }
  }

  /**
   * Create and broadcast user login activity
   */
  public broadcastUserLogin(userId: string, userName: string, userEmail?: string, ipAddress?: string, userAgent?: string): void {
    const activity: UserActivityEvent = {
      id: `login_${userId}_${Date.now()}`,
      userId,
      userName,
      userEmail,
      activityType: 'login',
      description: `${userName} logged in`,
      metadata: {
        loginMethod: 'social_auth',
        deviceInfo: userAgent ? this.parseUserAgent(userAgent) : undefined
      },
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      severity: 'low'
    };

    this.broadcastUserActivity(activity);
  }

  /**
   * Create and broadcast user logout activity
   */
  public broadcastUserLogout(userId: string, userName: string, userEmail?: string): void {
    const activity: UserActivityEvent = {
      id: `logout_${userId}_${Date.now()}`,
      userId,
      userName,
      userEmail,
      activityType: 'logout',
      description: `${userName} logged out`,
      timestamp: new Date().toISOString(),
      severity: 'low'
    };

    this.broadcastUserActivity(activity);
  }

  /**
   * Create and broadcast user status change activity
   */
  public broadcastUserStatusChange(
    userId: string, 
    userName: string, 
    previousStatus: string, 
    newStatus: string, 
    reason?: string,
    adminId?: string,
    adminName?: string
  ): void {
    const activity: UserActivityEvent = {
      id: `status_${userId}_${Date.now()}`,
      userId,
      userName,
      activityType: 'status_change',
      description: `${userName}'s status changed from ${previousStatus} to ${newStatus}`,
      metadata: {
        previousStatus,
        newStatus,
        reason,
        changedBy: adminId ? 'admin' : 'system',
        adminId,
        adminName
      },
      timestamp: new Date().toISOString(),
      severity: newStatus === 'suspended' || newStatus === 'deleted' ? 'high' : 'medium'
    };

    this.broadcastUserActivity(activity);
  }

  /**
   * Create and broadcast user role change activity
   */
  public broadcastUserRoleChange(
    userId: string, 
    userName: string, 
    previousRole: string, 
    newRole: string, 
    reason?: string,
    adminId?: string,
    adminName?: string
  ): void {
    const activity: UserActivityEvent = {
      id: `role_${userId}_${Date.now()}`,
      userId,
      userName,
      activityType: 'role_change',
      description: `${userName}'s role changed from ${previousRole} to ${newRole}`,
      metadata: {
        previousRole,
        newRole,
        reason,
        adminId,
        adminName
      },
      timestamp: new Date().toISOString(),
      severity: newRole === 'admin' ? 'critical' : 'medium'
    };

    this.broadcastUserActivity(activity);
  }

  /**
   * Create and broadcast admin action activity
   */
  public broadcastAdminAction(
    adminId: string,
    adminName: string,
    actionType: string,
    targetUserId?: string,
    targetUserName?: string,
    description?: string,
    metadata?: Record<string, any>
  ): void {
    const activity: UserActivityEvent = {
      id: `admin_${adminId}_${Date.now()}`,
      userId: adminId,
      userName: adminName,
      activityType: 'admin_action',
      description: description || `Admin ${adminName} performed ${actionType}`,
      metadata: {
        actionType,
        targetUserId,
        targetUserName,
        ...metadata
      },
      timestamp: new Date().toISOString(),
      severity: 'medium'
    };

    this.broadcastUserActivity(activity);
  }

  /**
   * Broadcast reservation update to shop owner, user, and admin rooms
   */
  public broadcastReservationUpdate(update: ReservationUpdate): void {
    try {
      const timestamp = new Date().toISOString();

      // Broadcast to admin reservations room
      this.io.to('admin-reservations').emit('reservation_update', {
        ...update,
        timestamp
      });

      // Send to specific user
      this.io.to(`user-${update.userId}`).emit('reservation_update', {
        ...update,
        timestamp
      });

      // Send to shop owner - this is the key notification for shop owners
      this.io.to(`shop-${update.shopId}`).emit('reservation_update', {
        ...update,
        timestamp
      });

      logger.info('Reservation update broadcasted via WebSocket', {
        reservationId: update.reservationId,
        shopId: update.shopId,
        userId: update.userId,
        updateType: update.updateType
      });

    } catch (error) {
      logger.error('Failed to broadcast reservation update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: update.reservationId
      });
    }
  }

  /**
   * Parse user agent string for device information
   */
  private parseUserAgent(userAgent: string): Record<string, any> {
    // Simple user agent parsing - in production, consider using a library like ua-parser-js
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const isTablet = /iPad|Tablet/.test(userAgent);
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1] || 'Unknown';
    const os = userAgent.match(/(Windows|Mac OS|Linux|Android|iOS)/)?.[1] || 'Unknown';

    return {
      isMobile,
      isTablet,
      browser,
      os,
      deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'
    };
  }
}

// Export singleton instance (will be initialized in app.ts)
export let websocketService: WebSocketService;

export function initializeWebSocketService(server: HTTPServer): void {
  websocketService = new WebSocketService(server);
} 