/**
 * Monitoring WebSocket Service
 * 
 * Real-time WebSocket service for monitoring dashboard:
 * - Live metrics streaming
 * - Real-time alert notifications
 * - Dashboard widget updates
 * - System status broadcasts
 * - Performance monitoring events
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { monitoringDashboardService, RealTimeMetrics, Alert } from './monitoring-dashboard.service';
import { logger } from '../utils/logger';
// Authentication will be handled in the middleware setup

// WebSocket event types
export enum MonitoringEvents {
  // Client events
  SUBSCRIBE_METRICS = 'subscribe_metrics',
  UNSUBSCRIBE_METRICS = 'unsubscribe_metrics',
  SUBSCRIBE_ALERTS = 'subscribe_alerts',
  UNSUBSCRIBE_ALERTS = 'unsubscribe_alerts',
  ACKNOWLEDGE_ALERT = 'acknowledge_alert',
  RESOLVE_ALERT = 'resolve_alert',
  
  // Server events
  METRICS_UPDATE = 'metrics_update',
  ALERT_CREATED = 'alert_created',
  ALERT_UPDATED = 'alert_updated',
  ALERT_RESOLVED = 'alert_resolved',
  SYSTEM_STATUS_CHANGE = 'system_status_change',
  DASHBOARD_REFRESH = 'dashboard_refresh'
}

// WebSocket message interfaces
export interface MetricsSubscription {
  userId: string;
  socketId: string;
  metrics: string[]; // Specific metrics to subscribe to
  interval: number; // Update interval in milliseconds
}

export interface AlertSubscription {
  userId: string;
  socketId: string;
  severityFilter: string[]; // Alert severities to receive
  typeFilter: string[]; // Alert types to receive
}

export interface WebSocketMessage {
  event: MonitoringEvents;
  data: any;
  timestamp: string;
  userId?: string;
}

export class MonitoringWebSocketService {
  private io: SocketIOServer;
  private metricsSubscriptions: Map<string, MetricsSubscription> = new Map();
  private alertSubscriptions: Map<string, AlertSubscription> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private lastMetrics: RealTimeMetrics | null = null;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/monitoring'
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startMetricsStreaming();
  }

  /**
   * Setup authentication middleware for WebSocket connections
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify token (simplified - in production, use proper JWT verification)
        // const user = await verifyJWTToken(token);
        // socket.data.user = user;
        
        // For now, just log the connection
        logger.info('WebSocket authentication successful', {
          socketId: socket.id,
          token: token.substring(0, 10) + '...'
        });

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Monitoring WebSocket client connected', {
        socketId: socket.id,
        userId: socket.data.user?.id
      });

      // Handle metrics subscription
      socket.on(MonitoringEvents.SUBSCRIBE_METRICS, (data) => {
        this.handleMetricsSubscription(socket, data);
      });

      // Handle metrics unsubscription
      socket.on(MonitoringEvents.UNSUBSCRIBE_METRICS, () => {
        this.handleMetricsUnsubscription(socket);
      });

      // Handle alerts subscription
      socket.on(MonitoringEvents.SUBSCRIBE_ALERTS, (data) => {
        this.handleAlertsSubscription(socket, data);
      });

      // Handle alerts unsubscription
      socket.on(MonitoringEvents.UNSUBSCRIBE_ALERTS, () => {
        this.handleAlertsUnsubscription(socket);
      });

      // Handle alert acknowledgment
      socket.on(MonitoringEvents.ACKNOWLEDGE_ALERT, async (data) => {
        await this.handleAlertAcknowledgment(socket, data);
      });

      // Handle alert resolution
      socket.on(MonitoringEvents.RESOLVE_ALERT, async (data) => {
        await this.handleAlertResolution(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('Monitoring WebSocket client disconnected', {
          socketId: socket.id,
          userId: socket.data.user?.id,
          reason
        });
        
        this.cleanupSubscriptions(socket.id);
      });

      // Send initial dashboard data
      this.sendInitialDashboardData(socket);
    });
  }

  /**
   * Handle metrics subscription
   */
  private handleMetricsSubscription(socket: Socket, data: any): void {
    const subscription: MetricsSubscription = {
      userId: socket.data.user?.id || 'anonymous',
      socketId: socket.id,
      metrics: data.metrics || ['all'],
      interval: Math.max(data.interval || 30000, 5000) // Minimum 5 seconds
    };

    this.metricsSubscriptions.set(socket.id, subscription);

    logger.info('Client subscribed to metrics', {
      socketId: socket.id,
      userId: subscription.userId,
      metrics: subscription.metrics,
      interval: subscription.interval
    });

    // Send current metrics immediately
    if (this.lastMetrics) {
      this.sendMetricsToSocket(socket, this.lastMetrics, subscription);
    }
  }

  /**
   * Handle metrics unsubscription
   */
  private handleMetricsUnsubscription(socket: Socket): void {
    this.metricsSubscriptions.delete(socket.id);
    
    logger.info('Client unsubscribed from metrics', {
      socketId: socket.id,
      userId: socket.data.user?.id
    });
  }

  /**
   * Handle alerts subscription
   */
  private handleAlertsSubscription(socket: Socket, data: any): void {
    const subscription: AlertSubscription = {
      userId: socket.data.user?.id || 'anonymous',
      socketId: socket.id,
      severityFilter: data.severityFilter || ['critical', 'high', 'medium', 'low'],
      typeFilter: data.typeFilter || ['payment', 'system', 'security', 'business']
    };

    this.alertSubscriptions.set(socket.id, subscription);

    logger.info('Client subscribed to alerts', {
      socketId: socket.id,
      userId: subscription.userId,
      severityFilter: subscription.severityFilter,
      typeFilter: subscription.typeFilter
    });

    // Send current active alerts
    const activeAlerts = monitoringDashboardService.getActiveAlerts()
      .filter(alert => 
        subscription.severityFilter.includes(alert.severity) &&
        subscription.typeFilter.includes(alert.type)
      );

    socket.emit(MonitoringEvents.ALERT_CREATED, {
      alerts: activeAlerts,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle alerts unsubscription
   */
  private handleAlertsUnsubscription(socket: Socket): void {
    this.alertSubscriptions.delete(socket.id);
    
    logger.info('Client unsubscribed from alerts', {
      socketId: socket.id,
      userId: socket.data.user?.id
    });
  }

  /**
   * Handle alert acknowledgment
   */
  private async handleAlertAcknowledgment(socket: Socket, data: any): Promise<void> {
    try {
      const { alertId, assignee } = data;
      const userId = socket.data.user?.id || assignee;

      await monitoringDashboardService.acknowledgeAlert(alertId, userId);

      // Broadcast alert update to all subscribed clients
      this.broadcastAlertUpdate({
        id: alertId,
        status: 'acknowledged',
        assignee: userId,
        acknowledgedAt: new Date().toISOString()
      } as any);

      logger.info('Alert acknowledged via WebSocket', {
        alertId,
        userId,
        socketId: socket.id
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert via WebSocket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });

      socket.emit('error', {
        message: 'Failed to acknowledge alert',
        code: 'ALERT_ACKNOWLEDGE_ERROR'
      });
    }
  }

  /**
   * Handle alert resolution
   */
  private async handleAlertResolution(socket: Socket, data: any): Promise<void> {
    try {
      const { alertId, resolution } = data;

      await monitoringDashboardService.resolveAlert(alertId, resolution);

      // Broadcast alert resolution to all subscribed clients
      this.broadcastAlertUpdate({
        id: alertId,
        status: 'resolved',
        resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: socket.data.user?.id
      } as any);

      logger.info('Alert resolved via WebSocket', {
        alertId,
        resolution,
        userId: socket.data.user?.id,
        socketId: socket.id
      });
    } catch (error) {
      logger.error('Failed to resolve alert via WebSocket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        data
      });

      socket.emit('error', {
        message: 'Failed to resolve alert',
        code: 'ALERT_RESOLVE_ERROR'
      });
    }
  }

  /**
   * Send initial dashboard data to newly connected client
   */
  private async sendInitialDashboardData(socket: Socket): Promise<void> {
    try {
      const [metrics, widgets, alerts] = await Promise.all([
        monitoringDashboardService.getRealTimeMetrics(),
        monitoringDashboardService.getDashboardWidgets(),
        monitoringDashboardService.getActiveAlerts()
      ]);

      socket.emit('initial_dashboard_data', {
        metrics,
        widgets,
        alerts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send initial dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id
      });
    }
  }

  /**
   * Start metrics streaming to subscribed clients
   */
  private startMetricsStreaming(): void {
    // Stream metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await monitoringDashboardService.getRealTimeMetrics();
        this.lastMetrics = metrics;

        // Send metrics to all subscribed clients
        for (const [socketId, subscription] of this.metricsSubscriptions) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            this.sendMetricsToSocket(socket, metrics, subscription);
          } else {
            // Clean up stale subscription
            this.metricsSubscriptions.delete(socketId);
          }
        }
      } catch (error) {
        logger.error('Failed to stream metrics', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 30000);
  }

  /**
   * Send metrics to specific socket based on subscription
   */
  private sendMetricsToSocket(socket: Socket, metrics: RealTimeMetrics, subscription: MetricsSubscription): void {
    let filteredMetrics = metrics;

    // Filter metrics based on subscription
    if (subscription.metrics.length > 0 && !subscription.metrics.includes('all')) {
      filteredMetrics = this.filterMetrics(metrics, subscription.metrics);
    }

    socket.emit(MonitoringEvents.METRICS_UPDATE, {
      metrics: filteredMetrics,
      timestamp: metrics.timestamp,
      subscription: {
        metrics: subscription.metrics,
        interval: subscription.interval
      }
    });
  }

  /**
   * Filter metrics based on subscription preferences
   */
  private filterMetrics(metrics: RealTimeMetrics, requestedMetrics: string[]): RealTimeMetrics {
    const filtered: any = {
      timestamp: metrics.timestamp
    };

    for (const metric of requestedMetrics) {
      const [category, field] = metric.split('.');
      
      if (category && field) {
        if (!filtered[category]) {
          filtered[category] = {};
        }
        if (metrics[category as keyof RealTimeMetrics] && (metrics[category as keyof RealTimeMetrics] as any)[field]) {
          filtered[category][field] = (metrics[category as keyof RealTimeMetrics] as any)[field];
        }
      } else if (category && metrics[category as keyof RealTimeMetrics]) {
        filtered[category] = metrics[category as keyof RealTimeMetrics];
      }
    }

    return filtered as RealTimeMetrics;
  }

  /**
   * Broadcast new alert to subscribed clients
   */
  public broadcastNewAlert(alert: Alert): void {
    for (const [socketId, subscription] of this.alertSubscriptions) {
      // Check if alert matches subscription filters
      if (
        subscription.severityFilter.includes(alert.severity) &&
        subscription.typeFilter.includes(alert.type)
      ) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(MonitoringEvents.ALERT_CREATED, {
            alert,
            timestamp: new Date().toISOString()
          });
        } else {
          // Clean up stale subscription
          this.alertSubscriptions.delete(socketId);
        }
      }
    }
  }

  /**
   * Broadcast alert update to subscribed clients
   */
  public broadcastAlertUpdate(alert: Partial<Alert>): void {
    for (const [socketId] of this.alertSubscriptions) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(MonitoringEvents.ALERT_UPDATED, {
          alert,
          timestamp: new Date().toISOString()
        });
      } else {
        // Clean up stale subscription
        this.alertSubscriptions.delete(socketId);
      }
    }
  }

  /**
   * Broadcast system status change
   */
  public broadcastSystemStatusChange(status: any): void {
    this.io.emit(MonitoringEvents.SYSTEM_STATUS_CHANGE, {
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger dashboard refresh for all clients
   */
  public triggerDashboardRefresh(): void {
    this.io.emit(MonitoringEvents.DASHBOARD_REFRESH, {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up subscriptions for disconnected socket
   */
  private cleanupSubscriptions(socketId: string): void {
    this.metricsSubscriptions.delete(socketId);
    this.alertSubscriptions.delete(socketId);
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): any {
    return {
      totalConnections: this.io.sockets.sockets.size,
      metricsSubscriptions: this.metricsSubscriptions.size,
      alertSubscriptions: this.alertSubscriptions.size,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown WebSocket service
   */
  public shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.io.close();
    logger.info('Monitoring WebSocket service shut down');
  }
}

export let monitoringWebSocketService: MonitoringWebSocketService;
