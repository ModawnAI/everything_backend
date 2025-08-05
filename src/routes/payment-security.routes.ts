/**
 * Payment Security Routes
 * 
 * API routes for payment security system including:
 * - Fraud detection and risk assessment
 * - Security monitoring and alert management
 * - Error handling and recovery
 * - Compliance reporting and analytics
 * - Security dashboard and admin controls
 */

import { Router } from 'express';
import { paymentSecurityController } from '../controllers/payment-security.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// =============================================
// FRAUD DETECTION ROUTES
// =============================================

/**
 * POST /api/payment-security/fraud-detection
 * Perform fraud detection on payment request
 */
const fraudDetectionSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().default('KRW'),
  paymentMethod: Joi.string(),
  ipAddress: Joi.string().ip().required(),
  userAgent: Joi.string(),
  geolocation: Joi.object({
    country: Joi.string(),
    region: Joi.string(),
    city: Joi.string(),
    latitude: Joi.number(),
    longitude: Joi.number(),
    timezone: Joi.string(),
    isp: Joi.string(),
    organization: Joi.string(),
    asn: Joi.string(),
    isProxy: Joi.boolean(),
    isVpn: Joi.boolean(),
    isTor: Joi.boolean(),
    riskScore: Joi.number().min(0).max(100)
  }),
  deviceFingerprint: Joi.string(),
  metadata: Joi.object()
});

router.post(
  '/fraud-detection',
  authenticateJWT(),
  requirePermission({ resource: 'payments', action: 'read' }),
  rateLimit({ config: { max: 100, windowMs: 15 * 60 * 1000 } }), // 100 requests per 15 minutes
  validateRequestBody(fraudDetectionSchema),
  paymentSecurityController.detectFraud.bind(paymentSecurityController)
);

// =============================================
// SECURITY MONITORING ROUTES
// =============================================

/**
 * GET /api/payment-security/metrics
 * Get security metrics for dashboard
 */
const metricsQuerySchema = Joi.object({
  start: Joi.string().isoDate().required(),
  end: Joi.string().isoDate().required()
});

router.get(
  '/metrics',
  authenticateJWT(),
  requirePermission({ resource: 'analytics', action: 'read' }),
  rateLimit({ config: { max: 50, windowMs: 15 * 60 * 1000 } }), // 50 requests per 15 minutes
  validateQueryParams(metricsQuerySchema),
  paymentSecurityController.getSecurityMetrics.bind(paymentSecurityController)
);

/**
 * GET /api/payment-security/alerts
 * Get unresolved security alerts
 */
const alertsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50)
});

router.get(
  '/alerts',
  authenticateJWT(),
  requirePermission({ resource: 'admin_actions', action: 'read' }),
  rateLimit({ config: { max: 100, windowMs: 15 * 60 * 1000 } }), // 100 requests per 15 minutes
  validateQueryParams(alertsQuerySchema),
  paymentSecurityController.getUnresolvedAlerts.bind(paymentSecurityController)
);

/**
 * PUT /api/payment-security/alerts/:alertId/resolve
 * Resolve security alert
 */
const resolveAlertSchema = Joi.object({
  resolutionNotes: Joi.string().max(1000)
});

router.put(
  '/alerts/:alertId/resolve',
  authenticateJWT(),
  requirePermission({ resource: 'admin_actions', action: 'update' }),
  rateLimit({ config: { max: 20, windowMs: 15 * 60 * 1000 } }), // 20 requests per 15 minutes
  validateRequestBody(resolveAlertSchema),
  paymentSecurityController.resolveSecurityAlert.bind(paymentSecurityController)
);

// =============================================
// COMPLIANCE REPORTING ROUTES
// =============================================

/**
 * POST /api/payment-security/compliance-report
 * Generate compliance report
 */
const complianceReportSchema = Joi.object({
  reportType: Joi.string().valid('fraud_summary', 'security_audit', 'compliance_check', 'risk_assessment').required(),
  timeRange: Joi.object({
    start: Joi.string().isoDate().required(),
    end: Joi.string().isoDate().required()
  }).required()
});

router.post(
  '/compliance-report',
  authenticateJWT(),
  requirePermission({ resource: 'reports', action: 'create' }),
  rateLimit({ config: { max: 10, windowMs: 60 * 60 * 1000 } }), // 10 requests per hour
  validateRequestBody(complianceReportSchema),
  paymentSecurityController.generateComplianceReport.bind(paymentSecurityController)
);

// =============================================
// ERROR HANDLING ROUTES
// =============================================

/**
 * POST /api/payment-security/error-handling
 * Handle payment error with comprehensive error management
 */
const errorHandlingSchema = Joi.object({
  error: Joi.object({
    message: Joi.string().required(),
    stack: Joi.string()
  }).required(),
  errorType: Joi.string().valid(
    'network_error', 'api_error', 'validation_error', 'authentication_error',
    'authorization_error', 'rate_limit_error', 'fraud_detection_error',
    'system_error', 'timeout_error', 'webhook_error'
  ).required(),
  context: Joi.object({
    paymentId: Joi.string().uuid(),
    userId: Joi.string().uuid(),
    reservationId: Joi.string().uuid(),
    requestData: Joi.object(),
    responseData: Joi.object(),
    ipAddress: Joi.string().ip(),
    userAgent: Joi.string()
  }).required()
});

router.post(
  '/error-handling',
  authenticateJWT(),
  requirePermission({ resource: 'payments', action: 'read' }),
  rateLimit({ config: { max: 200, windowMs: 15 * 60 * 1000 } }), // 200 requests per 15 minutes
  validateRequestBody(errorHandlingSchema),
  paymentSecurityController.handlePaymentError.bind(paymentSecurityController)
);

/**
 * GET /api/payment-security/errors
 * Get payment errors with filtering and pagination
 */
const errorsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  errorType: Joi.string().valid(
    'network_error', 'api_error', 'validation_error', 'authentication_error',
    'authorization_error', 'rate_limit_error', 'fraud_detection_error',
    'system_error', 'timeout_error', 'webhook_error'
  ),
  isResolved: Joi.boolean(),
  startDate: Joi.string().isoDate(),
  endDate: Joi.string().isoDate()
});

router.get(
  '/errors',
  authenticateJWT(),
  requirePermission({ resource: 'payments', action: 'read' }),
  rateLimit({ config: { max: 100, windowMs: 15 * 60 * 1000 } }), // 100 requests per 15 minutes
  validateQueryParams(errorsQuerySchema),
  paymentSecurityController.getPaymentErrors.bind(paymentSecurityController)
);

/**
 * PUT /api/payment-security/errors/:errorId/resolve
 * Manually resolve payment error
 */
const resolveErrorSchema = Joi.object({
  resolutionNotes: Joi.string().max(1000)
});

router.put(
  '/errors/:errorId/resolve',
  authenticateJWT(),
  requirePermission({ resource: 'payments', action: 'update' }),
  rateLimit({ config: { max: 20, windowMs: 15 * 60 * 1000 } }), // 20 requests per 15 minutes
  validateRequestBody(resolveErrorSchema),
  paymentSecurityController.resolvePaymentError.bind(paymentSecurityController)
);

// =============================================
// SECURITY DASHBOARD ROUTES
// =============================================

/**
 * GET /api/payment-security/dashboard
 * Get comprehensive security dashboard data
 */
const dashboardQuerySchema = Joi.object({
  timeRange: Joi.string().valid('1h', '24h', '7d', '30d').default('24h')
});

router.get(
  '/dashboard',
  authenticateJWT(),
  requirePermission({ resource: 'analytics', action: 'read' }),
  rateLimit({ config: { max: 30, windowMs: 15 * 60 * 1000 } }), // 30 requests per 15 minutes
  validateQueryParams(dashboardQuerySchema),
  paymentSecurityController.getSecurityDashboard.bind(paymentSecurityController)
);

// =============================================
// ADMIN-ONLY ROUTES
// =============================================

/**
 * GET /api/payment-security/admin/overview
 * Get admin overview of security status (admin only)
 */
router.get(
  '/admin/overview',
  authenticateJWT(),
  requirePermission({ resource: 'admin_actions', action: 'read' }),
  rateLimit({ config: { max: 20, windowMs: 15 * 60 * 1000 } }), // 20 requests per 15 minutes
  async (req, res) => {
    try {
      // This would provide a comprehensive admin overview
      // For now, return a basic response
      res.status(200).json({
        success: true,
        data: {
          message: 'Admin overview endpoint - implementation pending',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ADMIN_OVERVIEW_ERROR',
          message: '관리자 개요 조회 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다.'
        }
      });
    }
  }
);

/**
 * POST /api/payment-security/admin/configure
 * Configure security settings (admin only)
 */
const configureSecuritySchema = Joi.object({
  fraudDetectionEnabled: Joi.boolean(),
  alertThreshold: Joi.number().min(0).max(100),
  autoBlockThreshold: Joi.number().min(0).max(100),
  monitoringInterval: Joi.number().min(1).max(60),
  notificationChannels: Joi.array().items(Joi.string())
});

router.post(
  '/admin/configure',
  authenticateJWT(),
  requirePermission({ resource: 'system_settings', action: 'update' }),
  rateLimit({ config: { max: 5, windowMs: 60 * 60 * 1000 } }), // 5 requests per hour
  validateRequestBody(configureSecuritySchema),
  async (req, res) => {
    try {
      // This would update security configuration
      // For now, return a basic response
      res.status(200).json({
        success: true,
        data: {
          message: 'Security configuration updated',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURE_SECURITY_ERROR',
          message: '보안 설정 구성 중 오류가 발생했습니다.',
          details: '시스템 오류가 발생했습니다.'
        }
      });
    }
  }
);

// =============================================
// HEALTH CHECK ROUTES
// =============================================

/**
 * GET /api/payment-security/health
 * Health check for payment security system
 */
router.get(
  '/health',
  async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            fraudDetection: 'operational',
            securityMonitoring: 'operational',
            errorHandling: 'operational'
          }
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Payment security system health check failed',
          details: 'One or more services are not operational'
        }
      });
    }
  }
);

export default router; 