import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { websocketService, AdminNotification, ReservationUpdate } from '../services/websocket.service';
import { logger } from '../utils/logger';

export default class WebSocketController {
  /**
   * Validate reservation notification authorization
   */
  private async validateReservationNotificationAuth(
    userId: string,
    reservationId: string,
    shopId?: string
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      // Get user role and reservation details
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user) {
        return { authorized: false, reason: 'User not found' };
      }

      // Admins can send notifications for any reservation
      if (user.role === 'admin') {
        return { authorized: true };
      }

      // Get reservation details for authorization check
      const { data: reservation } = await supabase
        .from('reservations')
        .select(`
          user_id,
          shop_id,
          shops!inner(owner_id)
        `)
        .eq('id', reservationId)
        .single();

      if (!reservation) {
        return { authorized: false, reason: 'Reservation not found' };
      }

      // Check authorization based on user role
      if (user.role === 'shop_owner') {
        // Shop owners can only send notifications for their own shop's reservations
        if (reservation.shop_id !== shopId) {
          return { authorized: false, reason: 'Shop owner can only manage their own shop reservations' };
        }
        if ((reservation.shops as any)?.owner_id !== userId) {
          return { authorized: false, reason: 'Not authorized to manage this shop' };
        }
        return { authorized: true };
      }

      if (user.role === 'user') {
        // Users can only send notifications for their own reservations
        if (reservation.user_id !== userId) {
          return { authorized: false, reason: 'Users can only manage their own reservations' };
        }
        return { authorized: true };
      }

      return { authorized: false, reason: 'Invalid user role' };

    } catch (error) {
      logger.error('Failed to validate reservation notification authorization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        reservationId
      });
      return { authorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Get WebSocket connection statistics
   */
  async getConnectionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const stats = websocketService.getConnectionStats();

      res.status(200).json({
        success: true,
        message: 'WebSocket 연결 통계를 조회했습니다.',
        data: {
          stats,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get WebSocket connection stats', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'WebSocket 연결 통계 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get all active rooms
   */
  async getAllRooms(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const rooms = websocketService.getAllRooms();

      // Filter rooms based on user role
      const accessibleRooms = rooms.filter(room => {
        if (userRole === 'admin') return true;
        if (room.type === 'user' && room.id === `user-${userId}`) return true;
        if (room.type === 'admin') return false;
        return true;
      });

      res.status(200).json({
        success: true,
        message: '활성 방 목록을 조회했습니다.',
        data: {
          rooms: accessibleRooms,
          totalCount: accessibleRooms.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get all rooms', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '방 목록 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get room information
   */
  async getRoomInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!roomId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '방 ID가 필요합니다.'
          }
        });
        return;
      }

      const room = websocketService.getRoomInfo(roomId);

      if (!room) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ROOM_NOT_FOUND',
            message: '방을 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Check if user has access to this room
      if (room.type === 'admin' && userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '이 방에 접근할 권한이 없습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '방 정보를 조회했습니다.',
        data: {
          room
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get room info', { error, userId: req.user?.id, roomId: req.params.roomId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '방 정보 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send admin notification
   */
  async sendAdminNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { type, title, message, data, priority } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '관리자 권한이 필요합니다.'
          }
        });
        return;
      }

      if (!type || !title || !message) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '알림 유형, 제목, 메시지가 필요합니다.'
          }
        });
        return;
      }

      const notification: AdminNotification = {
        id: `notification-${Date.now()}`,
        type,
        title,
        message,
        data,
        priority: priority || 'medium',
        createdAt: new Date().toISOString()
      };

      // Send to admin rooms via WebSocket
      websocketService.sendToAdmins('admin_notification', notification);

      res.status(200).json({
        success: true,
        message: '관리자 알림이 전송되었습니다.',
        data: {
          notificationId: notification.id,
          type: notification.type,
          priority: notification.priority
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send admin notification', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '관리자 알림 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send reservation status notification with push and WebSocket integration
   */
  async sendReservationStatusNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { 
        reservationId, 
        status, 
        shopId, 
        customerId,
        updateType, 
        notificationType,
        recipient = 'both', // 'user', 'shop', 'both'
        pushNotification = true,
        websocketNotification = true,
        data 
      } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!reservationId || !status || !updateType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '예약 ID, 상태, 업데이트 유형이 필요합니다.'
          }
        });
        return;
      }

      // Validate notification type
      const validNotificationTypes = [
        'reservation_requested',
        'reservation_confirmed', 
        'reservation_rejected',
        'reservation_completed',
        'reservation_cancelled',
        'reservation_no_show',
        'reservation_reminder'
      ];

      if (notificationType && !validNotificationTypes.includes(notificationType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NOTIFICATION_TYPE',
            message: `유효하지 않은 알림 유형입니다. 허용된 유형: ${validNotificationTypes.join(', ')}`
          }
        });
        return;
      }

      // Validate authorization for reservation notification
      const authCheck = await this.validateReservationNotificationAuth(userId, reservationId, shopId);
      if (!authCheck.authorized) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '예약 알림을 전송할 권한이 없습니다.',
            details: authCheck.reason
          }
        });
        return;
      }

      const results = {
        websocket: { success: false, error: null },
        push: { success: false, error: null }
      };

      // Send WebSocket notification
      if (websocketNotification) {
        try {
          const wsUpdate: ReservationUpdate = {
            reservationId,
            status,
            shopId: shopId || '',
            userId: customerId || userId,
            updateType: updateType as any,
            timestamp: new Date().toISOString(),
            data: {
              ...data,
              notificationType,
              sentBy: userId
            }
          };

          // Send to appropriate recipients
          if (recipient === 'user' || recipient === 'both') {
            if (customerId) {
              websocketService.sendToUser(customerId, 'reservation_status_update', wsUpdate);
            }
          }

          if (recipient === 'shop' || recipient === 'both') {
            if (shopId) {
              websocketService.sendToRoom(`shop-${shopId}`, 'reservation_status_update', wsUpdate);
            }
          }

          // Always send to admin room for monitoring
          websocketService.sendToRoom('admin-reservations', 'reservation_status_update', wsUpdate);

          results.websocket.success = true;

        } catch (wsError) {
          results.websocket.error = wsError instanceof Error ? wsError.message : 'Unknown WebSocket error';
          logger.error('WebSocket notification failed', { 
            error: wsError, 
            reservationId, 
            userId 
          });
        }
      }

      // Send push notification
      if (pushNotification) {
        try {
          const { notificationService } = await import('../services/notification.service');
          
          // Determine notification recipients
          const recipients = [];
          if (recipient === 'user' || recipient === 'both') {
            if (customerId) {
              recipients.push({ userId: customerId, role: 'user' });
            }
          }
          if (recipient === 'shop' || recipient === 'both') {
            if (shopId) {
              // Get shop owner ID
              const { getSupabaseClient } = await import('../config/database');
              const supabase = getSupabaseClient();
              const { data: shop } = await supabase
                .from('shops')
                .select('owner_id')
                .eq('id', shopId)
                .single();
              
              if (shop?.owner_id) {
                recipients.push({ userId: shop.owner_id, role: 'shop' });
              }
            }
          }

          // Send push notifications
          for (const recipientInfo of recipients) {
            if (notificationType) {
              await notificationService.sendReservationNotification(
                recipientInfo.userId,
                notificationType,
                recipientInfo.role as 'user' | 'shop',
                {
                  reservationId,
                  shopId,
                  ...data
                }
              );
            }
          }

          results.push.success = true;

        } catch (pushError) {
          results.push.error = pushError instanceof Error ? pushError.message : 'Unknown push notification error';
          logger.error('Push notification failed', { 
            error: pushError, 
            reservationId, 
            userId 
          });
        }
      }

      // Determine overall success
      const overallSuccess = results.websocket.success || results.push.success;

      res.status(overallSuccess ? 200 : 500).json({
        success: overallSuccess,
        message: overallSuccess ? '예약 상태 알림이 전송되었습니다.' : '알림 전송 중 일부 오류가 발생했습니다.',
        data: {
          reservationId,
          status,
          updateType,
          notificationType,
          recipient,
          results,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to send reservation status notification', { 
        error, 
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '예약 상태 알림 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send reservation update
   */
  async sendReservationUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { reservationId, status, shopId, updateType, data } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!reservationId || !status || !shopId || !updateType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '예약 ID, 상태, 매장 ID, 업데이트 유형이 필요합니다.'
          }
        });
        return;
      }

      const update: ReservationUpdate = {
        reservationId,
        status,
        shopId,
        userId,
        updateType,
        timestamp: new Date().toISOString(),
        data
      };

      // Send reservation update via WebSocket
      websocketService.sendToRoom('admin-reservations', 'reservation_update', update);

      // Also send enhanced reservation status notification
      try {
        // Determine notification type based on update type
        let notificationType = null;
        switch (updateType) {
          case 'confirmed':
            notificationType = 'reservation_confirmed';
            break;
          case 'cancelled':
            notificationType = 'reservation_cancelled';
            break;
          case 'created':
            notificationType = 'reservation_requested';
            break;
          default:
            notificationType = null;
        }

        if (notificationType) {
          // Send to customer if we have user ID
          if (update.userId) {
            websocketService.sendToUser(update.userId, 'reservation_status_update', {
              ...update,
              notificationType
            });
          }

          // Send to shop if we have shop ID
          if (update.shopId) {
            websocketService.sendToRoom(`shop-${update.shopId}`, 'reservation_status_update', {
              ...update,
              notificationType
            });
          }
        }

      } catch (notificationError) {
        logger.warn('Failed to send enhanced reservation notification', {
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          reservationId: update.reservationId
        });
        // Don't fail the main request if notification enhancement fails
      }

      res.status(200).json({
        success: true,
        message: '예약 업데이트가 전송되었습니다.',
        data: {
          reservationId: update.reservationId,
          updateType: update.updateType,
          status: update.status
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send reservation update', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '예약 업데이트 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send message to specific user
   */
  async sendToUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { targetUserId, event, data } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!targetUserId || !event) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '대상 사용자 ID와 이벤트가 필요합니다.'
          }
        });
        return;
      }

      // Only admins can send messages to other users
      if (userRole !== 'admin' && userId !== targetUserId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '다른 사용자에게 메시지를 보낼 권한이 없습니다.'
          }
        });
        return;
      }

      websocketService.sendToUser(targetUserId, event, data);

      res.status(200).json({
        success: true,
        message: '사용자에게 메시지가 전송되었습니다.',
        data: {
          targetUserId,
          event,
          sentAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send message to user', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '사용자 메시지 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send message to room
   */
  async sendToRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { roomId, event, data } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!roomId || !event) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '방 ID와 이벤트가 필요합니다.'
          }
        });
        return;
      }

      // Check if user has access to this room
      const room = websocketService.getRoomInfo(roomId);
      if (!room) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ROOM_NOT_FOUND',
            message: '방을 찾을 수 없습니다.'
          }
        });
        return;
      }

      if (room.type === 'admin' && userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '이 방에 메시지를 보낼 권한이 없습니다.'
          }
        });
        return;
      }

      websocketService.sendToRoom(roomId, event, data);

      res.status(200).json({
        success: true,
        message: '방에 메시지가 전송되었습니다.',
        data: {
          roomId,
          event,
          sentAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send message to room', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '방 메시지 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  async broadcastMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { event, data } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!event) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '이벤트가 필요합니다.'
          }
        });
        return;
      }

      // Only admins can broadcast messages
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '브로드캐스트 권한이 없습니다.'
          }
        });
        return;
      }

      websocketService.broadcast(event, data);

      res.status(200).json({
        success: true,
        message: '모든 연결된 클라이언트에게 메시지가 브로드캐스트되었습니다.',
        data: {
          event,
          broadcastAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to broadcast message', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '브로드캐스트 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Clean up inactive connections
   */
  async cleanupInactiveConnections(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      // Only admins can cleanup connections
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '연결 정리 권한이 없습니다.'
          }
        });
        return;
      }

      websocketService.cleanupInactiveConnections();

      res.status(200).json({
        success: true,
        message: '비활성 연결이 정리되었습니다.',
        data: {
          cleanedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to cleanup inactive connections', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '연결 정리 중 오류가 발생했습니다.'
        }
      });
    }
  }
} 