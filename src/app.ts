// Load environment configuration first
import { config } from './config/environment';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './utils/logger';
import { 
  correlationIdMiddleware, 
  morganFormat, 
  requestLoggingMiddleware, 
  errorLoggingMiddleware, 
  performanceLoggingMiddleware 
} from './middleware/logging.middleware';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Initialize database first before importing any services
import { initializeDatabase } from './config/database';
initializeDatabase();

// Import routes
import authRoutes from './routes/auth.routes';
import registrationRoutes from './routes/registration.routes';
import userProfileRoutes from './routes/user-profile.routes';
import userStatusRoutes from './routes/user-status.routes';
import shopRoutes from './routes/shop.routes';
import shopImageRoutes from './routes/shop-image.routes';
import { adminShopRoutes } from './routes/admin-shop.routes';
import adminShopApprovalRoutes from './routes/admin-shop-approval.routes';
import adminReservationRoutes from './routes/admin-reservation.routes';
import shopOwnerRoutes from './routes/shop-owner.routes';
import { storageRoutes } from './routes/storage.routes';
import reservationRoutes from './routes/reservation.routes';
import noShowDetectionRoutes from './routes/no-show-detection.routes';
import reservationReschedulingRoutes from './routes/reservation-rescheduling.routes';
import conflictResolutionRoutes from './routes/conflict-resolution.routes';
import paymentRoutes from './routes/payment.routes';
import splitPaymentRoutes from './routes/split-payment.routes';
import identityVerificationRoutes from './routes/identity-verification.routes';
import pointRoutes from './routes/point.routes';
import pointBalanceRoutes from './routes/point-balance.routes';
import pointProcessingRoutes from './routes/point-processing.routes';
import paymentSecurityRoutes from './routes/payment-security.routes';
import influencerBonusRoutes from './routes/influencer-bonus.routes';
import adminAdjustmentRoutes from './routes/admin-adjustment.routes';
import adminPaymentRoutes from './routes/admin-payment.routes';
import adminPaymentManagementRoutes from './routes/admin-payment-management.routes';
import adminAnalyticsRoutes from './routes/admin-analytics.routes';
import ipBlockingRoutes from './routes/admin/ip-blocking.routes';
import securityRoutes from './routes/security.routes';
import notificationRoutes from './routes/notification.routes';
import websocketRoutes from './routes/websocket.routes';
import testErrorRoutes from './routes/test-error.routes';
import healthRoutes from './routes/health.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import shopOwnerAuthRoutes from './routes/shop-owner-auth.routes';
import adminUserManagementRoutes from './routes/admin-user-management.routes';
import cacheRoutes from './routes/cache.routes';
import monitoringRoutes from './routes/monitoring.routes';
import monitoringDashboardRoutes from './routes/monitoring-dashboard.routes';
import shutdownRoutes from './routes/shutdown.routes';
import userSessionsRoutes from './routes/user-sessions.routes';
import adminSecurityRoutes from './routes/admin-security.routes';
import adminServiceDetailsRoutes from './routes/admin-service-details.routes';
import adminSecurityEnhancedRoutes from './routes/admin-security-enhanced.routes';
import adminSecurityEventsRoutes from './routes/admin-security-events.routes';
import authAnalyticsRoutes from './routes/auth-analytics.routes';
import referralRoutes from './routes/referral.routes';
import auditTrailRoutes from './routes/audit-trail.routes';
import automaticStateProgressionRoutes from './routes/automatic-state-progression.routes';
import referralCodeRoutes from './routes/referral-code.routes';
import referralRelationshipRoutes from './routes/referral-relationship.routes';
import influencerQualificationRoutes from './routes/influencer-qualification.routes';
import referralEarningsRoutes from './routes/referral-earnings.routes';
import referralAnalyticsRoutes from './routes/referral-analytics.routes';
import { userSettingsRoutes } from './routes/user-settings.routes';
import shopRegistrationRoutes from './routes/shop-registration.routes';
import shopSearchRoutes from './routes/shop-search.routes';
import shopProfileRoutes from './routes/shop-profile.routes';
import shopServiceRoutes from './routes/shop-service.routes';
import shopOperatingHoursRoutes from './routes/shop-operating-hours.routes';
import shopDashboardRoutes from './routes/shop-dashboard.routes';
import imageMetadataRoutes from './routes/image-metadata.routes';
import cdnRoutes from './routes/cdn.routes';
import favoritesRoutes from './routes/favorites.routes';
import shopContactMethodsRoutes from './routes/shop-contact-methods.routes';
import shopReportingRoutes from './routes/shop-reporting.routes';
import adminModerationRoutes from './routes/admin-moderation.routes';
import shopCategoriesRoutes from './routes/shop-categories.routes';
import serviceCatalogRoutes from './routes/service-catalog.routes';
import feedRoutes from './routes/feed.routes';
import userFeedRoutes from './routes/user-feed.routes';
import csrfRoutes from './routes/csrf.routes';
import adminFinancialRoutes from './routes/admin-financial.routes';
import adminProductRoutes from './routes/admin-product.routes';
import adminTicketRoutes from './routes/admin-ticket.routes';
import adminPointPolicyRoutes from './routes/admin-point-policy.routes';
import adminAnnouncementRoutes from './routes/admin-announcement.routes';
import adminPushNotificationRoutes from './routes/admin-push-notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { testDashboardRoutes } from './routes/test-dashboard.routes';
import shopReservationsRoutes from './routes/shop-reservations.routes';
import shopUsersRoutes from './routes/shop-users.routes';
import shopPaymentsRoutes from './routes/shop-payments.routes';
import shopAnalyticsRoutes from './routes/shop-analytics.routes';
import unifiedAuthRoutes from './routes/unified-auth.routes';

// Import services
import { initializeWebSocketService } from './services/websocket.service';
import { influencerSchedulerService } from './services/influencer-scheduler.service';

const app = express();
const PORT = config.server.port;

// CORS Configuration - Must be before other middleware
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', {
        origin,
        allowedOrigins: corsOrigins,
        timestamp: new Date().toISOString()
      });
      callback(null, true); // Allow anyway but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-CSRF-Secret', 'X-Request-ID', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400 // 24 hours
}));

// Log all incoming requests including OPTIONS (preflight), except health checks
app.use((req, res, next) => {
  // Skip logging for health check endpoint
  if (req.path !== '/health') {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      origin: req.get('origin') || 'no-origin',
      userAgent: req.get('user-agent'),
      ip: req.ip,
      headers: {
        authorization: req.get('authorization') ? 'present' : 'missing',
        contentType: req.get('content-type') || 'none'
      }
    });
  }
  next();
});

// Enhanced logging middleware setup
app.use(correlationIdMiddleware);
app.use(performanceLoggingMiddleware);
app.use(requestLoggingMiddleware);
app.use(morganFormat);

// Body parsers MUST come first, before any middleware that reads req.body
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Case transformation middleware - MUST be after body parsers
// Automatically transforms ALL JSON responses from snake_case to camelCase
import { transformResponseMiddleware } from './utils/case-transformer';
app.use(transformResponseMiddleware);

// Comprehensive security middleware setup
import { securityHeaders } from './middleware/security.middleware';
import { securityEventDetection, securityEventResponseHandler } from './middleware/security-event-detection.middleware';
import { sqlInjectionPrevention } from './middleware/sql-injection-prevention.middleware';
import { rpcSecurityMiddleware } from './middleware/rpc-security.middleware';
import { xssProtection, csrfProtection } from './middleware/xss-csrf-protection.middleware';
import { securityEventLoggingMiddleware } from './middleware/security-event-logging.middleware';
import { applyResponseStandardization } from './middleware/response-standardization.middleware';
import { authenticateJWT } from './middleware/auth.middleware';
import { requireAdmin } from './middleware/rbac.middleware';
import { adminNoCacheMiddleware } from './middleware/no-cache.middleware';
app.use(securityHeaders());
app.use(securityEventDetection());
app.use(securityEventResponseHandler());
app.use(sqlInjectionPrevention());
app.use(rpcSecurityMiddleware());
app.use(xssProtection());
app.use(csrfProtection());
app.use(securityEventLoggingMiddleware());

// Import comprehensive OpenAPI configurations
import { OPENAPI_GENERATION_CONFIG } from './config/openapi.config';
import { 
  ADMIN_OPENAPI_GENERATION_CONFIG, 
  ADMIN_OPENAPI_UI_CONFIG 
} from './config/openapi-admin.config';
import { 
  SERVICE_OPENAPI_GENERATION_CONFIG, 
  SERVICE_OPENAPI_UI_CONFIG 
} from './config/openapi-service.config';

// Swagger configurations
const swaggerOptions = OPENAPI_GENERATION_CONFIG; // Keep original for backward compatibility
const adminSwaggerOptions = ADMIN_OPENAPI_GENERATION_CONFIG;
const serviceSwaggerOptions = SERVICE_OPENAPI_GENERATION_CONFIG;

// Initialize Swagger specs with error handling to ignore YAML syntax errors
let swaggerSpec, adminSwaggerSpec, serviceSwaggerSpec;

// Temporarily disable console warnings for YAML parsing
const originalWarn = console.warn;
const originalError = console.error;
console.warn = () => {};
console.error = () => {};

try {
  swaggerSpec = swaggerJsdoc(swaggerOptions);
} catch (error) {
  swaggerSpec = { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' }, paths: {} };
}

try {
  adminSwaggerSpec = swaggerJsdoc(adminSwaggerOptions);
} catch (error) {
  adminSwaggerSpec = { openapi: '3.0.0', info: { title: 'Admin API', version: '1.0.0' }, paths: {} };
}

try {
  serviceSwaggerSpec = swaggerJsdoc(serviceSwaggerOptions);
} catch (error) {
  serviceSwaggerSpec = { openapi: '3.0.0', info: { title: 'Service API', version: '1.0.0' }, paths: {} };
}

// Restore console functions
console.warn = originalWarn;
console.error = originalError;

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '에뷰리띵 백엔드 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Default route
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Welcome to 에뷰리띵 Backend API',
    documentation: {
      complete: '/api-docs',
      admin: '/admin-docs',
      service: '/service-docs'
    },
    openapi_specs: {
      complete: '/api/openapi.json',
      admin: '/api/admin/openapi.json',
      service: '/api/service/openapi.json'
    },
    health: '/health'
  });
});

// Handle service worker requests (prevent 404 errors)
app.get('/sw.js', (_req, res) => {
  res.status(204).end(); // No Content - service worker not implemented
});

// Handle manifest.json requests
app.get('/manifest.json', (_req, res) => {
  res.status(204).end(); // No Content - manifest not implemented
});

// Swagger UI setup - Each endpoint needs both app.use() for static files and app.get() for setup
// Main API documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: '📚 API Documentation (Complete)',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha'
  }
}));

// Admin API documentation
app.use('/admin-docs', swaggerUi.serve);
app.get('/admin-docs', swaggerUi.setup(adminSwaggerSpec, ADMIN_OPENAPI_UI_CONFIG));

// Service API documentation
app.use('/service-docs', swaggerUi.serve);
app.get('/service-docs', swaggerUi.setup(serviceSwaggerSpec, SERVICE_OPENAPI_UI_CONFIG));

// OpenAPI spec endpoints - provides JSON version of the API documentation
// IMPORTANT: These must be registered BEFORE response standardization middleware
// Main API spec (backward compatibility)
app.get('/api/openapi.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Alternative Swagger JSON endpoint (backward compatibility)
app.get('/swagger.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Admin API spec
app.get('/api/admin/openapi.json', (_req, res) => {
  res.json(adminSwaggerSpec);
});

app.get('/admin-swagger.json', (_req, res) => {
  res.json(adminSwaggerSpec);
});

// Service API spec
app.get('/api/service/openapi.json', (_req, res) => {
  res.json(serviceSwaggerSpec);
});

app.get('/service-swagger.json', (_req, res) => {
  res.json(serviceSwaggerSpec);
});

// Apply response standardization middleware AFTER OpenAPI endpoints
app.use(applyResponseStandardization());

// Test Routes (no authentication required)
app.use('/api/test/dashboard', testDashboardRoutes);

// API Routes
// Unified authentication (new)
app.use('/api/v2/auth', unifiedAuthRoutes);

// Legacy authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/users', userProfileRoutes);

// IMPORTANT: More specific routes MUST come BEFORE general routes
// Place /api/admin/* specific routes before /api/admin

// Admin authentication - Auth routes don't need authentication middleware
app.use('/api/admin/auth', adminAuthRoutes);

// Shop owner authentication - Auth routes don't need authentication middleware
app.use('/api/shop-owner/auth', shopOwnerAuthRoutes);

// Apply authentication to all other admin routes (supports both Supabase and JWT tokens)
app.use('/api/admin/*', authenticateJWT(), requireAdmin());

// Disable caching for all admin endpoints to ensure fresh data
app.use('/api/admin/*', adminNoCacheMiddleware);

app.use('/api/admin/shops/approval', adminShopApprovalRoutes);
app.use('/api/admin/shops', adminShopRoutes); // Includes /:shopId/services sub-router
// Alias for backwards compatibility: /api/admin/shop -> /api/admin/shops
app.use('/api/admin/shop', adminShopRoutes);
app.use('/api/admin/reservations', adminReservationRoutes);
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/admin/services', adminServiceDetailsRoutes);
app.use('/api/admin', userStatusRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/shops/categories', shopCategoriesRoutes);
app.use('/api/service-catalog', serviceCatalogRoutes);
app.use('/api/shops/search', shopSearchRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/shops/images', shopImageRoutes);
app.use('/api/shop/register', shopRegistrationRoutes);
app.use('/api/shop/profile', shopProfileRoutes);
app.use('/api/shop/info', shopProfileRoutes); // Alias for /api/shop/profile
app.use('/api/shop/services', shopServiceRoutes);
app.use('/api/shop/operating-hours', shopOperatingHoursRoutes);
app.use('/api/shop/dashboard', shopDashboardRoutes);
app.use('/api/shop/images', imageMetadataRoutes);
app.use('/api/cdn', cdnRoutes);

// Shop-scoped routes (requires authentication + shop access validation)
// Platform admins can access any shop, shop users only their own
app.use('/api/shops/:shopId/reservations', shopReservationsRoutes);
app.use('/api/shops/:shopId/payments', shopPaymentsRoutes);
app.use('/api/shops/:shopId/analytics', shopAnalyticsRoutes);
app.use('/api/shops/:shopId/users', shopUsersRoutes);

// IMPORTANT: Routes ordered from MOST SPECIFIC to MOST GENERAL
// This prevents route conflicts when multiple routers share base paths

// Payment routes
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', paymentRoutes);
app.use('/api/split-payments', splitPaymentRoutes);

// Identity Verification routes (PortOne V2)
app.use('/api/identity-verification', identityVerificationRoutes);
app.use('/api/payment-security', paymentSecurityRoutes);
app.use('/api/points', pointRoutes);

// Admin routes (specific paths first)
app.use('/api/admin/no-show', noShowDetectionRoutes);
app.use('/api/admin/point-processing', pointProcessingRoutes);
app.use('/api/admin/adjustments', adminAdjustmentRoutes);
app.use('/api/admin/influencer-bonus', influencerBonusRoutes);
app.use('/api/admin', adminModerationRoutes);
app.use('/api/admin/points', adminPointPolicyRoutes);
app.use('/api/admin/announcements', adminAnnouncementRoutes);
app.use('/api/admin/push', adminPushNotificationRoutes);

// General /api routes (order matters less since paths are unique)
app.use('/api', favoritesRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api', reservationReschedulingRoutes);
app.use('/api', conflictResolutionRoutes);
app.use('/api', pointBalanceRoutes);
// MOVED UP: More specific /api/shop routes MUST come before catch-all /api/shop
// app.use('/api/shop', shopContactMethodsRoutes); // MOVED TO AFTER SPECIFIC ROUTES
app.use('/api/shops', shopReportingRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/payments/management', adminPaymentManagementRoutes);
// Admin analytics routes (comprehensive dashboard, realtime, export, etc.)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/financial', adminFinancialRoutes);
app.use('/api/admin/tickets', adminTicketRoutes);
app.use('/api/admin', ipBlockingRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api/test-error', testErrorRoutes);
app.use('/health', healthRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/monitoring', monitoringDashboardRoutes);
app.use('/api/shutdown', shutdownRoutes);
app.use('/api/user/sessions', userSessionsRoutes);
app.use('/api/admin/security', adminSecurityRoutes);
app.use('/api/admin/security-enhanced', adminSecurityEnhancedRoutes);
app.use('/api/admin/security/events', adminSecurityEventsRoutes);
app.use('/api/analytics/auth', authAnalyticsRoutes);
app.use('/api/referral-codes', referralCodeRoutes);
app.use('/api/referral-relationships', referralRelationshipRoutes);
app.use('/api/influencer-qualification', influencerQualificationRoutes);
app.use('/api/referral-earnings', referralEarningsRoutes);
app.use('/api/referral-analytics', referralAnalyticsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin/audit', auditTrailRoutes);
app.use('/api/admin/automation', automaticStateProgressionRoutes);
app.use('/api/users', userSettingsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/user/feed', userFeedRoutes);
app.use('/api/csrf', csrfRoutes);
// Catch-all /api/shop routes LAST (after all specific /api/shop/* routes above)
app.use('/api/shop', shopContactMethodsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: '요청한 경로를 찾을 수 없습니다.',
      path: req.originalUrl
    }
  });
});

// Import comprehensive error handling middleware
import { errorHandler } from './middleware/error-handling.middleware';

// Enhanced error logging middleware
app.use(errorLoggingMiddleware);

// Comprehensive error handling middleware
app.use(errorHandler);

// Start server with improved error handling
if (require.main === module) {
  let server: any = null;
  let isShuttingDown = false;

  const startServer = () => {
    // Check if already shutting down
    if (isShuttingDown) {
      console.log('⏳ Server is shutting down, skipping restart...');
      return;
    }

    try {
      server = app.listen(PORT, () => {
        // console.log(`🚀 에뷰리띵 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
        // console.log(`📍 Health Check: http://localhost:${PORT}/health`);
        // console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
        // console.log(`📚 API Documentation:`);
        // console.log(`   📖 Complete API: http://localhost:${PORT}/api-docs`);
        // console.log(`   🔒 Admin API: http://localhost:${PORT}/admin-docs`);
        // console.log(`   🛍️ Service API: http://localhost:${PORT}/service-docs`);

        // Initialize WebSocket service
        initializeWebSocketService(server);
        // console.log(`🔌 WebSocket 서비스가 초기화되었습니다.`);

        // Start influencer qualification scheduler
        influencerSchedulerService.startScheduler();
        // console.log(`⭐ 인플루언서 자격 관리 스케줄러가 시작되었습니다.`);
      });

      // Handle server errors
      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use. Please check for running processes.`);
          console.log('💡 Try: netstat -ano | findstr :3001');
          process.exit(1);
        } else {
          console.error('❌ Server error:', error);
          process.exit(1);
        }
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  };

  // Graceful shutdown handler
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) {
      console.log('⏳ Shutdown already in progress...');
      return;
    }

    console.log(`\n📡 ${signal} received. Starting graceful shutdown...`);
    isShuttingDown = true;

    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('✅ Server closed successfully');

        // Stop scheduler
        influencerSchedulerService.stopScheduler();
        console.log('✅ Scheduler stopped');

        // Exit process
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  // Handle nodemon restart
  process.once('SIGUSR2', () => {
    gracefulShutdown('SIGUSR2');
  });

  // Handle uncaught exceptions and unhandled promise rejections
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Don't exit the process in development, just log
    if (config.server.isProduction) {
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    }
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('❌ UNHANDLED PROMISE REJECTION:', reason);
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Don't exit the process in development, just log
    if (config.server.isProduction) {
      gracefulShutdown('UNHANDLED_REJECTION');
    }
  });

  // Start the server
  startServer();
}

export default app; 
