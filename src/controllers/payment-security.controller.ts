/**
 * Payment Security Controller
 * 
 * Comprehensive payment security controller integrating:
 * - Fraud detection and risk assessment
 * - Security monitoring and alert management
 * - Error handling and recovery
 * - Compliance reporting and analytics
 * - Security dashboard and admin controls
 */

import { Request, Response } from 'express';
import { fraudDetectionService } from '../services/fraud-detection.service';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { paymentErrorHandlingService } from '../services/payment-error-handling.service';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  FraudDetectionRequest,
  SecurityMetrics,
  ComplianceReport,
  SecurityAlert,
  PaymentError,
  FraudRiskLevel,
  SecurityAlertSeverity
} from '../types/payment-security.types';

export class PaymentSecurityController {
  private supabase = getSupabaseClient();

  /**
   * POST /api/payment-security/fraud-detection
   * Perform fraud detection on payment request
   */
  async detectFraud(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        paymentId,
        amount,
        currency = 'KRW',
        paymentMethod,
        ipAddress,
        userAgent,
        geolocation,
        deviceFingerprint,
        metadata
      } = req.body;

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!paymentId || !amount || !ipAddress) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'paymentId, amount, ipAddress는 필수입니다.'
          }
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: '유효하지 않은 금액입니다.',
            details: '금액은 0보다 커야 합니다.'
          }
        });
        return;
      }

      const fraudRequest: FraudDetectionRequest = {
        paymentId,
        userId,
        amount,
        currency,
        paymentMethod: paymentMethod || 'unknown',
        ipAddress,
        userAgent: userAgent || '',
        geolocation,
        deviceFingerprint,
        metadata
      };

      const fraudResult = await fraudDetectionService.detectFraud(fraudRequest);

      res.status(200).json({
        success: true,
        data: {
          isAllowed: fraudResult.isAllowed,
          riskScore: fraudResult.riskScore,
          riskLevel: fraudResult.riskLevel,
          action: fraudResult.action,
          detectedRules: fraudResult.detectedRules,
          securityAlerts: fraudResult.securityAlerts,
          recommendations: fraudResult.recommendations,
          metadata: fraudResult.metadata
        }
      });

    } catch (error) {
      logger.error('Error in fraud detection endpoint', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'FRAUD_DETECTION_ERROR',
          message: '사기 탐지 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/payment-security/metrics
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { start, end } = req.query;

      // Validate time range
      if (!start || !end) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TIME_RANGE',
            message: '시간 범위가 필요합니다.',
            details: 'start와 end 파라미터가 필요합니다.'
          }
        });
        return;
      }

      const timeRange = {
        start: start as string,
        end: end as string
      };

      // Validate date format
      if (isNaN(Date.parse(timeRange.start)) || isNaN(Date.parse(timeRange.end))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: '잘못된 날짜 형식입니다.',
            details: 'ISO 8601 형식의 날짜를 사용해주세요.'
          }
        });
        return;
      }

      const metrics = await securityMonitoringService.getSecurityMetrics();

      res.status(200).json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Error getting security metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: '보안 지표 조회 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/payment-security/alerts
   * Get unresolved security alerts
   */
  async getUnresolvedAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { limit = '50' } = req.query;
      const limitNumber = parseInt(limit as string, 10);

      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: '잘못된 제한값입니다.',
            details: 'limit은 1-100 사이의 숫자여야 합니다.'
          }
        });
        return;
      }

      const allAlerts = await securityMonitoringService.getUnresolvedAlerts();
      const alerts = allAlerts.slice(0, limitNumber);

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          limit: limitNumber
        }
      });

    } catch (error) {
      logger.error('Error getting unresolved alerts', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ALERTS_ERROR',
          message: '보안 알림 조회 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/payment-security/alerts/:alertId/resolve
   * Resolve security alert
   */
  async resolveSecurityAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { resolutionNotes } = req.body;

      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate alert ID
      if (!alertId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ALERT_ID',
            message: '알림 ID가 필요합니다.',
            details: 'alertId 파라미터가 필요합니다.'
          }
        });
        return;
      }

      await securityMonitoringService.resolveSecurityAlert(alertId, adminId, resolutionNotes);

      res.status(200).json({
        success: true,
        message: '보안 알림이 해결되었습니다.',
        data: {
          alertId,
          resolvedBy: adminId,
          resolvedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error resolving security alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: req.params.alertId,
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'RESOLVE_ALERT_ERROR',
          message: '보안 알림 해결 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/payment-security/compliance-report
   * Generate compliance report
   */
  async generateComplianceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        reportType,
        timeRange
      } = req.body;

      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!reportType || !timeRange || !timeRange.start || !timeRange.end) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'reportType과 timeRange (start, end)는 필수입니다.'
          }
        });
        return;
      }

      // Validate report type
      const validReportTypes = ['fraud_summary', 'security_audit', 'compliance_check', 'risk_assessment'];
      if (!validReportTypes.includes(reportType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REPORT_TYPE',
            message: '잘못된 보고서 유형입니다.',
            details: `유효한 보고서 유형: ${validReportTypes.join(', ')}`
          }
        });
        return;
      }

      // Validate date format
      if (isNaN(Date.parse(timeRange.start)) || isNaN(Date.parse(timeRange.end))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: '잘못된 날짜 형식입니다.',
            details: 'ISO 8601 형식의 날짜를 사용해주세요.'
          }
        });
        return;
      }

      const report = await securityMonitoringService.generateComplianceReport();

      res.status(200).json({
        success: true,
        message: '준수 보고서가 생성되었습니다.',
        data: report
      });

    } catch (error) {
      logger.error('Error generating compliance report', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'COMPLIANCE_REPORT_ERROR',
          message: '준수 보고서 생성 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/payment-security/error-handling
   * Handle payment error with comprehensive error management
   */
  async handlePaymentError(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        error,
        errorType,
        context
      } = req.body;

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate required fields
      if (!error || !errorType || !context) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '필수 필드가 누락되었습니다.',
            details: 'error, errorType, context는 필수입니다.'
          }
        });
        return;
      }

      // Validate error type
      const validErrorTypes = [
        'network_error', 'api_error', 'validation_error', 'authentication_error',
        'authorization_error', 'rate_limit_error', 'fraud_detection_error',
        'system_error', 'timeout_error', 'webhook_error'
      ];
      if (!validErrorTypes.includes(errorType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ERROR_TYPE',
            message: '잘못된 오류 유형입니다.',
            details: `유효한 오류 유형: ${validErrorTypes.join(', ')}`
          }
        });
        return;
      }

      // Create Error object from error data
      const errorObj = new Error(error.message || 'Unknown error');
      errorObj.stack = error.stack;

      const paymentError = await paymentErrorHandlingService.handlePaymentError(
        errorObj,
        errorType,
        {
          ...context,
          userId: context.userId || userId
        }
      );

      res.status(200).json({
        success: true,
        message: '결제 오류가 처리되었습니다.',
        data: {
          errorId: paymentError.id,
          errorType: paymentError.errorType,
          isResolved: paymentError.isResolved,
          createdAt: paymentError.createdAt
        }
      });

    } catch (error) {
      logger.error('Error in payment error handling endpoint', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ERROR_HANDLING_ERROR',
          message: '오류 처리 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/payment-security/errors
   * Get payment errors with filtering and pagination
   */
  async getPaymentErrors(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        errorType,
        isResolved,
        startDate,
        endDate
      } = req.query;

      const pageNumber = parseInt(page as string, 10);
      const limitNumber = parseInt(limit as string, 10);

      // Validate pagination parameters
      if (isNaN(pageNumber) || pageNumber < 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAGE',
            message: '잘못된 페이지 번호입니다.',
            details: 'page는 1 이상의 숫자여야 합니다.'
          }
        });
        return;
      }

      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: '잘못된 제한값입니다.',
            details: 'limit은 1-100 사이의 숫자여야 합니다.'
          }
        });
        return;
      }

      const offset = (pageNumber - 1) * limitNumber;

      // Build query
      let query = this.supabase
        .from('payment_errors')
        .select('*', { count: 'exact' });

      // Apply filters
      if (errorType) {
        query = query.eq('error_type', errorType);
      }

      if (isResolved !== undefined) {
        query = query.eq('is_resolved', isResolved === 'true');
      }

      if (startDate) {
        query = query.gte('created_at', startDate as string);
      }

      if (endDate) {
        query = query.lte('created_at', endDate as string);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNumber - 1);

      const { data: errors, error, count } = await query;

      if (error) {
        logger.error('Error fetching payment errors', { error });
        throw new Error('Database error');
      }

      res.status(200).json({
        success: true,
        data: {
          errors: errors || [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNumber)
          }
        }
      });

    } catch (error) {
      logger.error('Error getting payment errors', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ERRORS_ERROR',
          message: '결제 오류 조회 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/payment-security/errors/:errorId/resolve
   * Manually resolve payment error
   */
  async resolvePaymentError(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { errorId } = req.params;
      const { resolutionNotes } = req.body;

      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Validate error ID
      if (!errorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ERROR_ID',
            message: '오류 ID가 필요합니다.',
            details: 'errorId 파라미터가 필요합니다.'
          }
        });
        return;
      }

      const now = new Date().toISOString();

      const { error } = await this.supabase
        .from('payment_errors')
        .update({
          is_resolved: true,
          resolved_at: now,
          resolved_by: adminId,
          resolution_notes: resolutionNotes,
          updated_at: now
        })
        .eq('id', errorId);

      if (error) {
        logger.error('Error resolving payment error', { error, errorId });
        throw new Error('Database error');
      }

      res.status(200).json({
        success: true,
        message: '결제 오류가 해결되었습니다.',
        data: {
          errorId,
          resolvedBy: adminId,
          resolvedAt: now
        }
      });

    } catch (error) {
      logger.error('Error resolving payment error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorId: req.params.errorId,
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'RESOLVE_ERROR_ERROR',
          message: '결제 오류 해결 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/payment-security/dashboard
   * Get comprehensive security dashboard data
   */
  async getSecurityDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;

      // Calculate time range based on parameter
      const now = new Date();
      let start: Date;
      
      switch (timeRange) {
        case '1h':
          start = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
      }

      const timeRangeObj = {
        start: start.toISOString(),
        end: now.toISOString()
      };

      // Get security metrics
      const metrics = await securityMonitoringService.getSecurityMetrics();

      // Get recent alerts
      const allRecentAlerts = await securityMonitoringService.getUnresolvedAlerts();
      const recentAlerts = allRecentAlerts.slice(0, 10);

      // Get recent errors
      const { data: recentErrors } = await this.supabase
        .from('payment_errors')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      res.status(200).json({
        success: true,
        data: {
          metrics,
          recentAlerts,
          recentErrors: recentErrors || [],
          timeRange: timeRangeObj,
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting security dashboard', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id 
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: '보안 대시보드 조회 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const paymentSecurityController = new PaymentSecurityController(); 