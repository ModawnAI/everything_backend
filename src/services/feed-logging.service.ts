/**
 * Feed Logging Service
 * 
 * Extends Winston logger with feed-specific logging categories and utilities
 * for comprehensive monitoring of social feed operations
 */

import { Request } from 'express';
import { logger, addRequestId } from '../utils/logger';
import { logBusinessEvent, logSecurityEvent, logAuditEvent } from '../middleware/logging.middleware';

// ========================================
// FEED LOGGING INTERFACES
// ========================================

export interface FeedOperationContext {
  userId?: string;
  postId?: string;
  commentId?: string;
  correlationId?: string;
  operation: string;
  metadata?: Record<string, any>;
}

export interface FeedPerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface FeedModerationContext {
  contentId: string;
  contentType: 'post' | 'comment';
  moderationAction: 'approve' | 'reject' | 'hide' | 'flag' | 'review';
  reason?: string;
  confidence?: number;
  automated: boolean;
  moderatorId?: string;
}

export interface FeedEngagementContext {
  userId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  action: 'like' | 'unlike' | 'comment' | 'view' | 'share';
  metadata?: Record<string, any>;
}

export interface FeedSecurityContext {
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
}

// ========================================
// FEED LOGGING SERVICE
// ========================================

export class FeedLoggingService {
  
  // ========================================
  // FEED OPERATION LOGGING
  // ========================================

  /**
   * Log feed operations (post creation, updates, deletions)
   */
  logFeedOperation(context: FeedOperationContext, req?: Request): void {
    const feedLogger = this.createFeedLogger(context, req);
    
    feedLogger.info(`Feed operation: ${context.operation}`, {
      eventType: 'feed_operation',
      operation: context.operation,
      userId: context.userId,
      postId: context.postId,
      commentId: context.commentId,
      metadata: context.metadata,
      timestamp: new Date().toISOString()
    });

    // Also log as business event
    logBusinessEvent(`feed_${context.operation}`, {
      userId: context.userId,
      postId: context.postId,
      commentId: context.commentId,
      operation: context.operation,
      metadata: context.metadata
    }, req);
  }

  /**
   * Log post creation
   */
  logPostCreation(postId: string, userId: string, metadata: Record<string, any> = {}, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      operation: 'post_created',
      metadata: {
        ...metadata,
        category: metadata.category || 'unknown',
        hasImages: metadata.hasImages || false,
        contentLength: metadata.contentLength || 0,
        hashtags: metadata.hashtags || []
      }
    }, req);
  }

  /**
   * Log post update
   */
  logPostUpdate(postId: string, userId: string, metadata: Record<string, any> = {}, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      operation: 'post_updated',
      metadata
    }, req);
  }

  /**
   * Log post deletion
   */
  logPostDeletion(postId: string, userId: string, reason: string, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      operation: 'post_deleted',
      metadata: { reason }
    }, req);
  }

  /**
   * Log comment creation
   */
  logCommentCreation(commentId: string, postId: string, userId: string, metadata: Record<string, any> = {}, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      commentId,
      operation: 'comment_created',
      metadata
    }, req);
  }

  /**
   * Log comment update
   */
  logCommentUpdate(commentId: string, postId: string, userId: string, metadata: Record<string, any> = {}, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      commentId,
      operation: 'comment_updated',
      metadata
    }, req);
  }

  /**
   * Log comment deletion
   */
  logCommentDeletion(commentId: string, postId: string, userId: string, reason: string, req?: Request): void {
    this.logFeedOperation({
      userId,
      postId,
      commentId,
      operation: 'comment_deleted',
      metadata: { reason }
    }, req);
  }

  // ========================================
  // CONTENT MODERATION LOGGING
  // ========================================

  /**
   * Log content moderation actions
   */
  logModerationAction(context: FeedModerationContext, req?: Request): void {
    const moderationLogger = this.createFeedLogger({
      userId: context.moderatorId,
      postId: context.contentType === 'post' ? context.contentId : undefined,
      commentId: context.contentType === 'comment' ? context.contentId : undefined,
      operation: 'moderation_action',
      metadata: {
        moderationAction: context.moderationAction,
        reason: context.reason,
        confidence: context.confidence,
        automated: context.automated
      }
    }, req);

    const logLevel = context.moderationAction === 'reject' || context.moderationAction === 'hide' ? 'warn' : 'info';
    
    moderationLogger[logLevel](`Moderation action: ${context.moderationAction}`, {
      eventType: 'content_moderation',
      contentType: context.contentType,
      contentId: context.contentId,
      action: context.moderationAction,
      reason: context.reason,
      confidence: context.confidence,
      automated: context.automated,
      moderatorId: context.moderatorId,
      timestamp: new Date().toISOString()
    });

    // Log as audit event for compliance
    logAuditEvent(`moderation_${context.moderationAction}`, `${context.contentType}_${context.contentId}`, {
      contentType: context.contentType,
      contentId: context.contentId,
      action: context.moderationAction,
      reason: context.reason,
      automated: context.automated,
      moderatorId: context.moderatorId
    }, req);
  }

  /**
   * Log content flagging
   */
  logContentFlag(contentId: string, contentType: 'post' | 'comment', userId: string, reason: string, req?: Request): void {
    this.logModerationAction({
      contentId,
      contentType,
      moderationAction: 'flag',
      reason,
      automated: false,
      moderatorId: userId
    }, req);
  }

  /**
   * Log automated moderation decision
   */
  logAutomatedModeration(contentId: string, contentType: 'post' | 'comment', action: 'approve' | 'reject', confidence: number, req?: Request): void {
    this.logModerationAction({
      contentId,
      contentType,
      moderationAction: action,
      reason: `Automated ${action} with ${confidence}% confidence`,
      confidence,
      automated: true
    }, req);
  }

  // ========================================
  // USER ENGAGEMENT LOGGING
  // ========================================

  /**
   * Log user engagement actions
   */
  logEngagement(context: FeedEngagementContext, req?: Request): void {
    const engagementLogger = this.createFeedLogger({
      userId: context.userId,
      postId: context.targetType === 'post' ? context.targetId : undefined,
      commentId: context.targetType === 'comment' ? context.targetId : undefined,
      operation: `engagement_${context.action}`,
      metadata: context.metadata
    }, req);

    engagementLogger.info(`User engagement: ${context.action}`, {
      eventType: 'user_engagement',
      userId: context.userId,
      targetType: context.targetType,
      targetId: context.targetId,
      action: context.action,
      metadata: context.metadata,
      timestamp: new Date().toISOString()
    });

    // Log as business event for analytics
    logBusinessEvent(`engagement_${context.action}`, {
      userId: context.userId,
      targetType: context.targetType,
      targetId: context.targetId,
      action: context.action,
      metadata: context.metadata
    }, req);
  }

  /**
   * Log like action
   */
  logLike(postId: string, userId: string, req?: Request): void {
    this.logEngagement({
      userId,
      targetType: 'post',
      targetId: postId,
      action: 'like'
    }, req);
  }

  /**
   * Log unlike action
   */
  logUnlike(postId: string, userId: string, req?: Request): void {
    this.logEngagement({
      userId,
      targetType: 'post',
      targetId: postId,
      action: 'unlike'
    }, req);
  }

  /**
   * Log comment action
   */
  logComment(postId: string, commentId: string, userId: string, req?: Request): void {
    this.logEngagement({
      userId,
      targetType: 'post',
      targetId: postId,
      action: 'comment',
      metadata: { commentId }
    }, req);
  }

  /**
   * Log view action
   */
  logView(postId: string, userId: string, req?: Request): void {
    this.logEngagement({
      userId,
      targetType: 'post',
      targetId: postId,
      action: 'view'
    }, req);
  }

  /**
   * Log share action
   */
  logShare(postId: string, userId: string, platform: string, req?: Request): void {
    this.logEngagement({
      userId,
      targetType: 'post',
      targetId: postId,
      action: 'share',
      metadata: { platform }
    }, req);
  }

  // ========================================
  // PERFORMANCE LOGGING
  // ========================================

  /**
   * Log feed performance metrics
   */
  logPerformanceMetrics(metrics: FeedPerformanceMetrics, req?: Request): void {
    const perfLogger = this.createFeedLogger({
      operation: `performance_${metrics.operation}`,
      metadata: metrics.metadata
    }, req);

    const logLevel = metrics.success ? 'info' : 'error';
    const durationThreshold = 2000; // 2 seconds

    if (metrics.duration > durationThreshold) {
      perfLogger.warn(`Slow feed operation: ${metrics.operation}`, {
        eventType: 'feed_performance',
        operation: metrics.operation,
        duration: metrics.duration,
        success: metrics.success,
        slowOperation: true,
        metadata: metrics.metadata,
        timestamp: new Date().toISOString()
      });
    } else {
      perfLogger[logLevel](`Feed operation: ${metrics.operation}`, {
        eventType: 'feed_performance',
        operation: metrics.operation,
        duration: metrics.duration,
        success: metrics.success,
        metadata: metrics.metadata,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log feed load performance
   */
  logFeedLoad(duration: number, userId: string, postCount: number, cacheHit: boolean, req?: Request): void {
    this.logPerformanceMetrics({
      operation: 'feed_load',
      duration,
      success: true,
      metadata: {
        userId,
        postCount,
        cacheHit,
        postsPerSecond: postCount / (duration / 1000)
      }
    }, req);
  }

  /**
   * Log post creation performance
   */
  logPostCreationPerformance(duration: number, postId: string, userId: string, success: boolean, req?: Request): void {
    this.logPerformanceMetrics({
      operation: 'post_creation',
      duration,
      success,
      metadata: {
        postId,
        userId
      }
    }, req);
  }

  /**
   * Log comment creation performance
   */
  logCommentCreationPerformance(duration: number, commentId: string, postId: string, userId: string, success: boolean, req?: Request): void {
    this.logPerformanceMetrics({
      operation: 'comment_creation',
      duration,
      success,
      metadata: {
        commentId,
        postId,
        userId
      }
    }, req);
  }

  // ========================================
  // SECURITY LOGGING
  // ========================================

  /**
   * Log feed security events
   */
  logSecurityEvent(context: FeedSecurityContext, req?: Request): void {
    const securityLogger = this.createFeedLogger({
      operation: `security_${context.event}`,
      userId: context.userId,
      metadata: context.details
    }, req);

    securityLogger[context.severity](`Feed security event: ${context.event}`, {
      eventType: 'feed_security',
      event: context.event,
      severity: context.severity,
      userId: context.userId,
      ip: context.ip,
      userAgent: context.userAgent,
      details: context.details,
      timestamp: new Date().toISOString()
    });

    // Log as security event for monitoring
    logSecurityEvent(`feed_${context.event}`, {
      severity: context.severity,
      userId: context.userId,
      ip: context.ip,
      userAgent: context.userAgent,
      details: context.details
    }, req);
  }

  /**
   * Log spam detection
   */
  logSpamDetection(userId: string, contentId: string, contentType: 'post' | 'comment', confidence: number, req?: Request): void {
    this.logSecurityEvent({
      event: 'spam_detection',
      severity: confidence > 0.8 ? 'high' : 'medium',
      userId,
      details: {
        contentId,
        contentType,
        confidence,
        action: 'flagged_for_review'
      }
    }, req);
  }

  /**
   * Log rate limiting trigger
   */
  logRateLimitTrigger(userId: string, endpoint: string, limit: number, window: string, req?: Request): void {
    this.logSecurityEvent({
      event: 'rate_limit_trigger',
      severity: 'medium',
      userId,
      details: {
        endpoint,
        limit,
        window,
        action: 'request_blocked'
      }
    }, req);
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(userId: string, activity: string, details: Record<string, any>, req?: Request): void {
    this.logSecurityEvent({
      event: 'suspicious_activity',
      severity: 'high',
      userId,
      details: {
        activity,
        ...details
      }
    }, req);
  }

  // ========================================
  // ERROR LOGGING
  // ========================================

  /**
   * Log feed errors
   */
  logFeedError(error: Error, context: FeedOperationContext, req?: Request): void {
    const errorLogger = this.createFeedLogger(context, req);
    
    errorLogger.error(`Feed error: ${error.message}`, {
      eventType: 'feed_error',
      error: error.message,
      stack: error.stack,
      operation: context.operation,
      userId: context.userId,
      postId: context.postId,
      commentId: context.commentId,
      metadata: context.metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log moderation errors
   */
  logModerationError(error: Error, contentId: string, contentType: 'post' | 'comment', req?: Request): void {
    this.logFeedError(error, {
      operation: 'moderation_error',
      metadata: {
        contentId,
        contentType,
        errorType: error.constructor.name
      }
    }, req);
  }

  /**
   * Log image processing errors
   */
  logImageProcessingError(error: Error, postId: string, imageUrl: string, req?: Request): void {
    this.logFeedError(error, {
      operation: 'image_processing_error',
      postId,
      metadata: {
        imageUrl,
        errorType: error.constructor.name
      }
    }, req);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Create feed logger with context
   */
  private createFeedLogger(context: FeedOperationContext, req?: Request) {
    const correlationId = context.correlationId || (req as any)?.correlationId || this.generateCorrelationId();
    
    return logger.child({
      service: 'feed-system',
      correlationId,
      userId: context.userId,
      postId: context.postId,
      commentId: context.commentId,
      operation: context.operation
    });
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create request logger for feed operations
   */
  createRequestLogger(correlationId: string) {
    return addRequestId(correlationId).child({ service: 'feed-system' });
  }
}

// Export singleton instance
export const feedLoggingService = new FeedLoggingService();

