import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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
// import userProfileRoutes from './routes/user-profile.routes'; // Archived - conflicts with user-settings.routes.ts
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
import pointRoutes from './routes/point.routes';
import pointBalanceRoutes from './routes/point-balance.routes';
import pointProcessingRoutes from './routes/point-processing.routes';
import paymentSecurityRoutes from './routes/payment-security.routes';
import influencerBonusRoutes from './routes/influencer-bonus.routes';
import adminAdjustmentRoutes from './routes/admin-adjustment.routes';
import adminPaymentRoutes from './routes/admin-payment.routes';
import adminAnalyticsRoutes from './routes/admin-analytics.routes';
import ipBlockingRoutes from './routes/admin/ip-blocking.routes';
import securityRoutes from './routes/security.routes';
import notificationRoutes from './routes/notification.routes';
import websocketRoutes from './routes/websocket.routes';
import testErrorRoutes from './routes/test-error.routes';
import healthRoutes from './routes/health.routes';
// import adminAuthRoutes from './routes/admin-auth.routes'; // Archived - conflicts with auth.routes.ts
import adminUserManagementRoutes from './routes/admin-user-management.routes';
import cacheRoutes from './routes/cache.routes';
import monitoringRoutes from './routes/monitoring.routes';
import monitoringDashboardRoutes from './routes/monitoring-dashboard.routes';
import shutdownRoutes from './routes/shutdown.routes';
import userSessionsRoutes from './routes/user-sessions.routes';
import adminSecurityRoutes from './routes/admin-security.routes';
import adminSecurityEnhancedRoutes from './routes/admin-security-enhanced.routes';
import adminSecurityEventsRoutes from './routes/admin-security-events.routes';
import authAnalyticsRoutes from './routes/auth-analytics.routes';
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
import csrfRoutes from './routes/csrf.routes';
import adminFinancialRoutes from './routes/admin-financial.routes';

// Import barrel exports (will be populated as we build the application)
import {} from '@/controllers';
import {} from '@/services';
import {} from '@/repositories';
import {} from '@/middleware';
import {} from '@/routes';
import {} from '@/types';
import {} from '@/utils';
import {} from '@/config';
import {} from '@/validators';
import {} from '@/constants';
import { initializeWebSocketService } from './services/websocket.service';
import { influencerSchedulerService } from './services/influencer-scheduler.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware setup
app.use(correlationIdMiddleware);
app.use(performanceLoggingMiddleware);
app.use(requestLoggingMiddleware);
app.use(morganFormat);

// Comprehensive security middleware setup
import { securityHeaders } from './middleware/security.middleware';
import { securityEventDetection, securityEventResponseHandler } from './middleware/security-event-detection.middleware';
import { sqlInjectionPrevention } from './middleware/sql-injection-prevention.middleware';
import { rpcSecurityMiddleware } from './middleware/rpc-security.middleware';
import { xssProtection, csrfProtection } from './middleware/xss-csrf-protection.middleware';
import { securityEventLoggingMiddleware } from './middleware/security-event-logging.middleware';
import { applyResponseStandardization } from './middleware/response-standardization.middleware';
app.use(securityHeaders());
app.use(securityEventDetection());
app.use(securityEventResponseHandler());
app.use(sqlInjectionPrevention());
app.use(rpcSecurityMiddleware());
app.use(xssProtection());
app.use(csrfProtection());
app.use(securityEventLoggingMiddleware());
// Apply response standardization middleware
app.use(applyResponseStandardization());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Swagger UI setup - Multiple documentation endpoints
// Main API documentation (backward compatibility)
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/registration', registrationRoutes);
// app.use('/api/users', userProfileRoutes); // Archived - conflicts with user-settings.routes.ts
app.use('/api/admin', userStatusRoutes);
app.use('/api/admin/shops', adminShopRoutes);
app.use('/api/admin/shops/approval', adminShopApprovalRoutes);
app.use('/api/admin/reservations', adminReservationRoutes);
// app.use('/api/admin/auth', adminAuthRoutes); // Archived - conflicts with auth.routes.ts
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/shops/categories', shopCategoriesRoutes);
app.use('/api/service-catalog', serviceCatalogRoutes);
app.use('/api/shops/search', shopSearchRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/shops/images', shopImageRoutes);
app.use('/api/shop/register', shopRegistrationRoutes);
app.use('/api/shop/profile', shopProfileRoutes);
app.use('/api/shop/services', shopServiceRoutes);
app.use('/api/shop/operating-hours', shopOperatingHoursRoutes);
app.use('/api/shop/dashboard', shopDashboardRoutes);
app.use('/api/shop/images', imageMetadataRoutes);
app.use('/api/cdn', cdnRoutes);
app.use('/api', favoritesRoutes);
app.use('/api/shop', shopContactMethodsRoutes);
app.use('/api/shops', shopReportingRoutes);
app.use('/api/admin', adminModerationRoutes);
app.use('/api', reservationRoutes);
app.use('/api/admin/no-show', noShowDetectionRoutes);
app.use('/api', reservationReschedulingRoutes);
app.use('/api', conflictResolutionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', paymentRoutes);
app.use('/api/split-payments', splitPaymentRoutes);
app.use('/api/points', pointRoutes);
app.use('/api', pointBalanceRoutes);
app.use('/api/admin/point-processing', pointProcessingRoutes);
app.use('/api/payment-security', paymentSecurityRoutes);
app.use('/api', influencerBonusRoutes);
app.use('/api', adminAdjustmentRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/financial', adminFinancialRoutes);
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
app.use('/api/admin/security-events', adminSecurityEventsRoutes);
app.use('/api/analytics/auth', authAnalyticsRoutes);
app.use('/api/referral-codes', referralCodeRoutes);
app.use('/api/referral-relationships', referralRelationshipRoutes);
app.use('/api/influencer-qualification', influencerQualificationRoutes);
app.use('/api/referral-earnings', referralEarningsRoutes);
app.use('/api/referral-analytics', referralAnalyticsRoutes);
app.use('/api/users', userSettingsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/csrf', csrfRoutes);

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

// Start server
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 에뷰리띵 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`📚 API Documentation:`);
    console.log(`   📖 Complete API: http://localhost:${PORT}/api-docs`);
    console.log(`   🔒 Admin API: http://localhost:${PORT}/admin-docs`);
    console.log(`   🛍️ Service API: http://localhost:${PORT}/service-docs`);
    
    // Initialize WebSocket service
    initializeWebSocketService(server);
    console.log(`🔌 WebSocket 서비스가 초기화되었습니다.`);
    
    // Start influencer qualification scheduler
    influencerSchedulerService.startScheduler();
    console.log(`⭐ 인플루언서 자격 관리 스케줄러가 시작되었습니다.`);
  });
}

export default app; 