const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Comprehensive Swagger configuration with all endpoints
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '에뷰리띵 Beauty Platform API',
      version: '1.0.0',
      description: `
# Beauty Service Platform API

A comprehensive REST API for the beauty service booking platform connecting customers with beauty professionals.

## Features

- **User Management**: Registration, authentication, profile management
- **Shop Management**: Beauty shop listings, services, and bookings  
- **Booking System**: Reservation management with real-time availability
- **Payment Processing**: Secure payments via Toss Payments integration
- **Location Services**: PostGIS-powered location search and mapping
- **Notifications**: Push notifications via FCM
- **Reviews & Ratings**: Customer feedback and rating system
- **Admin Panel**: Complete administrative controls

## Authentication

This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

API endpoints are rate limited based on user roles:
- Guest users: 50 requests per 15 minutes
- Authenticated users: 200 requests per 15 minutes  
- Shop owners: 500 requests per 15 minutes
- Admins: 1000 requests per 15 minutes

## Error Handling

All API responses follow a consistent error format with appropriate HTTP status codes.

## Data Formats

- All timestamps are in ISO 8601 format
- Coordinates use WGS84 decimal degrees
- Currency amounts are in Korean Won (KRW)
      `,
      contact: {
        name: 'Beauty Platform API Support',
        email: 'api-support@beauty-platform.com',
        url: 'https://beauty-platform.com/support'
      },
      license: {
        name: 'Proprietary',
        url: 'https://beauty-platform.com/license'
      }
    },
    servers: [
      {
        url: 'https://api.beauty-platform.com',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.beauty-platform.com',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization endpoints' },
      { name: 'User Management', description: 'User profile and account management' },
      { name: 'Shop Management', description: 'Beauty shop listings and management' },
      { name: 'Reservations', description: 'Booking and reservation management' },
      { name: 'Payments', description: 'Payment processing and management' },
      { name: 'Points System', description: 'Point balance and transaction management' },
      { name: 'Notifications', description: 'Push notification management' },
      { name: 'Storage', description: 'File upload and storage management' },
      { name: 'WebSocket', description: 'Real-time communication endpoints' },
      { name: 'Analytics', description: 'Data analytics and reporting' },
      { name: 'Admin', description: 'Administrative controls and management' },
      { name: 'Influencer', description: 'Influencer bonus and referral system' },
      { name: 'Security', description: 'Payment security and fraud detection' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'shop_owner', 'admin', 'influencer'] },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Shop: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            coordinates: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          }
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            shop_id: { type: 'string', format: 'uuid' },
            service_id: { type: 'string', format: 'uuid' },
            scheduled_time: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled'] }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reservation_id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'KRW' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
            payment_method: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./test-server-full.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

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
    documentation: '/api-docs',
    health: '/health'
  });
});

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '에뷰리띵 API Documentation'
}));

// OpenAPI spec endpoint
app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// =============================================
// AUTHENTICATION ENDPOINTS (15 endpoints)
// =============================================

/**
 * @swagger
 * /api/auth/social-login:
 *   post:
 *     tags: [Authentication]
 *     summary: Social authentication (Kakao, Apple, Google)
 */
app.post('/api/auth/social-login', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Social login successful',
    data: { token: 'mock-jwt-token', user: { id: 'user-1', role: 'user' } }
  });
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: User registration
 */
app.post('/api/auth/register', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { userId: 'mock-user-id' }
  });
});

/**
 * @swagger
 * /api/auth/send-verification-code:
 *   post:
 *     tags: [Authentication]
 *     summary: Send phone verification code
 */
app.post('/api/auth/send-verification-code', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Verification code sent'
  });
});

/**
 * @swagger
 * /api/auth/verify-phone:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify phone number
 */
app.post('/api/auth/verify-phone', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Phone verified successfully'
  });
});

/**
 * @swagger
 * /api/auth/pass/callback:
 *   post:
 *     tags: [Authentication]
 *     summary: PASS verification callback
 */
app.post('/api/auth/pass/callback', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PASS verification completed'
  });
});

/**
 * @swagger
 * /api/auth/providers:
 *   get:
 *     tags: [Authentication]
 *     summary: Get provider configuration
 */
app.get('/api/auth/providers', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      kakao: { enabled: true },
      apple: { enabled: true },
      google: { enabled: true }
    }
  });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 */
app.post('/api/auth/refresh', (req, res) => {
  res.status(200).json({
    success: true,
    data: { token: 'new-mock-jwt-token' }
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from current device
 */
app.post('/api/auth/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from all devices
 */
app.post('/api/auth/logout-all', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out from all devices'
  });
});

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     tags: [Authentication]
 *     summary: Get user sessions
 */
app.get('/api/auth/sessions', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      sessions: [
        { id: 'session-1', device: 'iPhone', lastActive: '2024-01-15T10:00:00Z' }
      ]
    }
  });
});

// Admin Auth Endpoints
app.post('/api/admin/auth/login', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin login successful',
    data: { token: 'admin-jwt-token' }
  });
});

app.post('/api/admin/auth/refresh', (req, res) => {
  res.status(200).json({
    success: true,
    data: { token: 'new-admin-jwt-token' }
  });
});

app.post('/api/admin/auth/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin logout successful'
  });
});

app.get('/api/admin/auth/validate', (req, res) => {
  res.status(200).json({
    success: true,
    data: { valid: true }
  });
});

app.get('/api/admin/auth/profile', (req, res) => {
  res.status(200).json({
    success: true,
    data: { role: 'admin', permissions: ['all'] }
  });
});

app.post('/api/admin/auth/change-password', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// =============================================
// MISSING ADMIN ENDPOINTS (20+ endpoints)
// =============================================

// Admin User Management
app.get('/api/admin/users', (req, res) => {
  res.status(200).json({
    success: true,
    data: { users: [] }
  });
});

app.get('/api/admin/users/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: {} }
  });
});

app.put('/api/admin/users/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User updated by admin'
  });
});

app.delete('/api/admin/users/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User deleted by admin'
  });
});

app.get('/api/admin/users/search', (req, res) => {
  res.status(200).json({
    success: true,
    data: { users: [] }
  });
});

app.post('/api/admin/users/bulk-action', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk action completed'
  });
});

// Admin Shop Management (Additional)
app.get('/api/admin/shops/search', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shops: [] }
  });
});

app.post('/api/admin/shops/bulk-action', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk shop action completed'
  });
});

app.get('/api/admin/shops/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { statistics: {} }
  });
});

// Admin Reservation Management (Additional)
app.get('/api/admin/reservations/search', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reservations: [] }
  });
});

app.post('/api/admin/reservations/bulk-action', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk reservation action completed'
  });
});

app.get('/api/admin/reservations/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { statistics: {} }
  });
});

// Admin Payment Management (Additional)
app.get('/api/admin/payments/search', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payments: [] }
  });
});

app.post('/api/admin/payments/bulk-action', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk payment action completed'
  });
});

app.get('/api/admin/payments/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { statistics: {} }
  });
});

// Admin Analytics (Additional)
app.get('/api/admin/analytics/users', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/reservations', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/revenue', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/performance', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/export', (req, res) => {
  res.status(200).json({
    success: true,
    data: { export: {} }
  });
});

app.get('/api/admin/analytics/reports', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reports: [] }
  });
});

app.get('/api/admin/analytics/trends', (req, res) => {
  res.status(200).json({
    success: true,
    data: { trends: {} }
  });
});

app.get('/api/admin/analytics/insights', (req, res) => {
  res.status(200).json({
    success: true,
    data: { insights: [] }
  });
});

// =============================================
// MISSING SHOP OWNER ENDPOINTS (5+ endpoints)
// =============================================

app.get('/api/shop-owner/dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/shop-owner/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shops: [] }
  });
});

app.post('/api/shop-owner/shops', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Shop created'
  });
});

app.put('/api/shop-owner/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop updated'
  });
});

app.delete('/api/shop-owner/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop deleted'
  });
});

app.get('/api/shop-owner/reservations', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reservations: [] }
  });
});

app.get('/api/shop-owner/payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payments: [] }
  });
});

app.get('/api/shop-owner/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

// =============================================
// MISSING ADVANCED FEATURES (15+ endpoints)
// =============================================

// Shop Images (Additional)
app.post('/api/shops/:shopId/images', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop image uploaded'
  });
});

app.get('/api/shops/:shopId/images', (req, res) => {
  res.status(200).json({
    success: true,
    data: { images: [] }
  });
});

app.delete('/api/shops/:shopId/images/:imageId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Image deleted'
  });
});

app.put('/api/shops/:shopId/images/:imageId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Image updated'
  });
});

app.post('/api/shops/:shopId/images/:imageId/set-primary', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Primary image set'
  });
});

// Conflict Resolution (Additional)
app.get('/api/shops/:shopId/conflicts/detect', (req, res) => {
  res.status(200).json({
    success: true,
    data: { conflicts: [] }
  });
});

app.post('/api/conflicts/:conflictId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Conflict resolved'
  });
});

app.post('/api/conflicts/priority-scores', (req, res) => {
  res.status(200).json({
    success: true,
    data: { scores: {} }
  });
});

app.get('/api/shops/:shopId/conflicts/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.get('/api/shops/:shopId/conflicts/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/shops/:shopId/conflicts/manual-interface', (req, res) => {
  res.status(200).json({
    success: true,
    data: { interface: {} }
  });
});

app.post('/api/shops/:shopId/conflicts/prevent', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Conflict prevention applied'
  });
});

// No-Show Detection (Additional)
app.post('/api/admin/no-show/override', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'No-show override applied'
  });
});

app.get('/api/admin/no-show/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/admin/no-show/config', (req, res) => {
  res.status(200).json({
    success: true,
    data: { config: {} }
  });
});

app.put('/api/admin/no-show/config', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Config updated'
  });
});

app.post('/api/admin/no-show/trigger', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'No-show detection triggered'
  });
});

app.get('/api/admin/no-show/reservation/:reservationId', (req, res) => {
  res.status(200).json({
    success: true,
    data: { details: {} }
  });
});

// Split Payments (Additional)
app.post('/api/split-payments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Split payment created'
  });
});

app.get('/api/split-payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { splitPayments: [] }
  });
});

app.get('/api/split-payments/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { splitPayment: {} }
  });
});

app.put('/api/split-payments/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Split payment updated'
  });
});

// Point Processing (Additional)
app.get('/api/admin/point-processing/queue', (req, res) => {
  res.status(200).json({
    success: true,
    data: { queue: [] }
  });
});

app.post('/api/admin/point-processing/process', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Points processed'
  });
});

// Referral System (Additional)
app.get('/api/referrals/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/referrals/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.put('/api/referrals/:referralId/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Referral status updated'
  });
});

app.post('/api/referrals/:referralId/payout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payout processed'
  });
});

app.get('/api/referrals/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

// Additional Payment Security
app.get('/api/payment-security/metrics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { metrics: {} }
  });
});

app.get('/api/payment-security/alerts', (req, res) => {
  res.status(200).json({
    success: true,
    data: { alerts: [] }
  });
});

app.put('/api/payment-security/alerts/:alertId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alert resolved'
  });
});

app.post('/api/payment-security/compliance-report', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Compliance report generated'
  });
});

app.post('/api/payment-security/error-handling', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Error handled'
  });
});

app.get('/api/payment-security/errors', (req, res) => {
  res.status(200).json({
    success: true,
    data: { errors: [] }
  });
});

app.put('/api/payment-security/errors/:errorId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Error resolved'
  });
});

app.get('/api/payment-security/risk-assessment', (req, res) => {
  res.status(200).json({
    success: true,
    data: { assessment: {} }
  });
});

app.get('/api/payment-security/security-dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: { dashboard: {} }
  });
});

// Webhooks
app.post('/api/webhooks/toss-payments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook processed'
  });
});

// Reservation Rescheduling (Additional)
app.post('/api/reservations/:id/reschedule', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation rescheduled'
  });
});

app.get('/api/reservations/:id/reschedule-options', (req, res) => {
  res.status(200).json({
    success: true,
    data: { options: [] }
  });
});

// Available Slots (Additional)
app.get('/api/shops/:shopId/available-slots', (req, res) => {
  res.status(200).json({
    success: true,
    data: { slots: [] }
  });
});

// Point Balance Management (Additional)
app.get('/api/points/balance/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.post('/api/points/balance/adjust', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Balance adjusted'
  });
});

// Admin Point Adjustments (Additional)
app.post('/api/admin/adjustments/points', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Point adjustment created'
  });
});

app.get('/api/admin/adjustments/points', (req, res) => {
  res.status(200).json({
    success: true,
    data: { adjustments: [] }
  });
});

app.get('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { adjustment: {} }
  });
});

app.put('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adjustment updated'
  });
});

app.delete('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adjustment deleted'
  });
});

app.get('/api/admin/adjustments/points/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/admin/adjustments/points/export', (req, res) => {
  res.status(200).json({
    success: true,
    data: { export: {} }
  });
});

app.get('/api/admin/adjustments/points/audit', (req, res) => {
  res.status(200).json({
    success: true,
    data: { audit: [] }
  });
});

app.get('/api/admin/adjustments/points/reports', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reports: [] }
  });
});

app.get('/api/admin/adjustments/points/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

// Missing Privacy Policy Endpoint
app.post('/api/users/privacy/accept', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Privacy policy accepted'
  });
});

// =============================================
// ERROR HANDLING TEST ENDPOINTS
// =============================================

// Test authentication error
app.get('/api/test-error/auth-error', (req, res) => {
  res.status(401).json({
    success: false,
    error: {
      code: 'AUTH_1001',
      message: '테스트 인증 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// Test validation error
app.get('/api/test-error/validation-error', (req, res) => {
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_2001',
      message: '테스트 유효성 검사 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// Test business logic error
app.get('/api/test-error/business-error', (req, res) => {
  res.status(400).json({
    success: false,
    error: {
      code: 'BUSINESS_3001',
      message: '테스트 비즈니스 로직 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// Test database error
app.get('/api/test-error/database-error', (req, res) => {
  res.status(500).json({
    success: false,
    error: {
      code: 'DATABASE_4001',
      message: '테스트 데이터베이스 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// Test external service error
app.get('/api/test-error/external-error', (req, res) => {
  res.status(502).json({
    success: false,
    error: {
      code: 'EXTERNAL_5001',
      message: '테스트 외부 서비스 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// Test rate limit error
app.get('/api/test-error/rate-limit-error', (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_6001',
      message: '테스트 속도 제한 오류',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
});

// =============================================
// HEALTH CHECK ENDPOINTS
// =============================================

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// Detailed health check
app.get('/health/detailed', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: 'development',
    checks: {
      database: {
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: 45,
        details: { data: 1 },
        lastChecked: new Date().toISOString()
      },
      externalApis: {
        tossPayments: {
          status: 'healthy',
          message: 'TossPayments API accessible',
          responseTime: 120,
          details: { statusCode: 200 },
          lastChecked: new Date().toISOString()
        },
        fcm: {
          status: 'healthy',
          message: 'FCM configured',
          responseTime: 15,
          details: { configured: true },
          lastChecked: new Date().toISOString()
        },
        supabase: {
          status: 'healthy',
          message: 'Supabase connection successful',
          responseTime: 85,
          details: { hasSession: false },
          lastChecked: new Date().toISOString()
        }
      },
      system: {
        memory: {
          status: 'healthy',
          message: 'Memory usage: 45.23%',
          responseTime: 5,
          details: { usagePercent: 45.23 },
          lastChecked: new Date().toISOString()
        },
        cpu: {
          status: 'healthy',
          message: 'CPU load average: 0.85',
          responseTime: 3,
          details: { loadAverage: [0.85, 0.92, 0.78] },
          lastChecked: new Date().toISOString()
        },
        disk: {
          status: 'healthy',
          message: 'Disk check passed',
          responseTime: 2,
          details: { platform: 'darwin' },
          lastChecked: new Date().toISOString()
        }
      },
      dependencies: {
        redis: {
          status: 'healthy',
          message: 'Redis check passed',
          responseTime: 8,
          details: { configured: true },
          lastChecked: new Date().toISOString()
        },
        websocket: {
          status: 'healthy',
          message: 'WebSocket service available',
          responseTime: 12,
          details: { service: 'Socket.io' },
          lastChecked: new Date().toISOString()
        }
      }
    },
    summary: {
      totalChecks: 9,
      healthyChecks: 9,
      degradedChecks: 0,
      unhealthyChecks: 0
    }
  };

  res.status(200).json({
    success: true,
    data: healthData,
    responseTime: 250,
    timestamp: new Date().toISOString()
  });
});

// Readiness probe
app.get('/health/ready', (req, res) => {
  res.status(200).json({
    success: true,
    ready: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Liveness probe
app.get('/health/live', (req, res) => {
  res.status(200).json({
    success: true,
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Clear health cache
app.post('/health/cache/clear', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Health check cache cleared',
    timestamp: new Date().toISOString()
  });
});

// =============================================
// CACHE ENDPOINTS
// =============================================

// Get cache statistics
app.get('/api/cache/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      hits: 45,
      misses: 12,
      keys: 8,
      memory: 1024000,
      hitRate: 78.95
    },
    timestamp: new Date().toISOString()
  });
});

// Set cache entry
app.post('/api/cache/set', (req, res) => {
  const { key, data, ttl = 3600, prefix, tags = [] } = req.body;
  
  if (!key || data === undefined) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CACHE_REQUEST',
        message: 'Key and data are required',
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Cache entry set successfully',
    timestamp: new Date().toISOString()
  });
});

// Get cache entry
app.get('/api/cache/get/:key', (req, res) => {
  const { key } = req.params;
  
  // Simulate cache hit/miss
  if (key === 'test:shops') {
    res.status(200).json({
      success: true,
      data: [
        { id: 1, name: 'Test Shop 1', rating: 4.5 },
        { id: 2, name: 'Test Shop 2', rating: 4.8 }
      ],
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      success: false,
      error: {
        code: 'CACHE_MISS',
        message: 'Cache entry not found',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Delete cache entry
app.delete('/api/cache/delete/:key', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cache entry deleted successfully',
    timestamp: new Date().toISOString()
  });
});

// Invalidate cache by tags
app.post('/api/cache/invalidate', (req, res) => {
  const { tags } = req.body;
  
  if (!tags || !Array.isArray(tags)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TAGS',
        message: 'Tags array is required',
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Cache invalidated successfully',
    timestamp: new Date().toISOString()
  });
});

// Clear all cache
app.post('/api/cache/clear', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

// Warm cache with test data
app.post('/api/cache/warm', (req, res) => {
  const testData = {
    shops: [
      { id: 1, name: 'Test Shop 1', rating: 4.5 },
      { id: 2, name: 'Test Shop 2', rating: 4.8 }
    ],
    users: [
      { id: 1, name: 'Test User 1', points: 1000 },
      { id: 2, name: 'Test User 2', points: 2500 }
    ]
  };

  res.status(200).json({
    success: true,
    message: 'Cache warmed successfully',
    data: testData,
    timestamp: new Date().toISOString()
  });
});

// =============================================
// USER MANAGEMENT ENDPOINTS (12 endpoints)
// =============================================

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     tags: [User Management]
 *     summary: Get user profile
 */
app.get('/api/users/profile', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: 'mock-user-id',
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user'
    }
  });
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     tags: [User Management]
 *     summary: Update user profile
 */
app.put('/api/users/profile', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully'
  });
});

/**
 * @swagger
 * /api/users/profile/completion:
 *   get:
 *     tags: [User Management]
 *     summary: Get profile completion status
 */
app.get('/api/users/profile/completion', (req, res) => {
  res.status(200).json({
    success: true,
    data: { completion: 85 }
  });
});

/**
 * @swagger
 * /api/users/profile/image:
 *   post:
 *     tags: [User Management]
 *     summary: Upload profile image
 */
app.post('/api/users/profile/image', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profile image uploaded'
  });
});

/**
 * @swagger
 * /api/users/settings:
 *   get:
 *     tags: [User Management]
 *     summary: Get user settings
 */
app.get('/api/users/settings', (req, res) => {
  res.status(200).json({
    success: true,
    data: { notifications: true, privacy: 'public' }
  });
});

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     tags: [User Management]
 *     summary: Update user settings
 */
app.put('/api/users/settings', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Settings updated'
  });
});

/**
 * @swagger
 * /api/users/terms/accept:
 *   post:
 *     tags: [User Management]
 *     summary: Accept terms and conditions
 */
app.post('/api/users/terms/accept', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Terms accepted'
  });
});

/**
 * @swagger
 * /api/users/privacy/accept:
 *   post:
 *     tags: [User Management]
 *     summary: Accept privacy policy
 */
app.post('/api/users/privacy/accept', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Privacy policy accepted'
  });
});

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     tags: [User Management]
 *     summary: Delete user account
 */
app.delete('/api/users/account', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Account deleted'
  });
});

// User Status Management (Admin)
app.put('/api/admin/users/:userId/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User status updated'
  });
});

app.get('/api/admin/users/:userId/status/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.get('/api/admin/users/:userId/violations', (req, res) => {
  res.status(200).json({
    success: true,
    data: { violations: [] }
  });
});

app.put('/api/admin/violations/:violationId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Violation resolved'
  });
});

app.get('/api/admin/users/status/:status', (req, res) => {
  res.status(200).json({
    success: true,
    data: { users: [] }
  });
});

app.post('/api/admin/users/bulk-status-change', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk status change completed'
  });
});

app.get('/api/admin/users/status-stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

// =============================================
// SHOP MANAGEMENT ENDPOINTS (25+ endpoints)
// =============================================

/**
 * @swagger
 * /api/shops:
 *   get:
 *     tags: [Shop Management]
 *     summary: Get all shops
 */
app.get('/api/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      shops: [
        {
          id: 'shop-1',
          name: 'Beauty Salon A',
          description: 'Professional beauty services',
          address: 'Seoul, Korea'
        }
      ],
      pagination: {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        total: 1
      }
    }
  });
});

/**
 * @swagger
 * /api/shops/{id}:
 *   get:
 *     tags: [Shop Management]
 *     summary: Get shop by ID
 */
app.get('/api/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      name: 'Beauty Salon A',
      description: 'Professional beauty services',
      address: 'Seoul, Korea'
    }
  });
});

/**
 * @swagger
 * /api/shops:
 *   post:
 *     tags: [Shop Management]
 *     summary: Create new shop
 */
app.post('/api/shops', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Shop created successfully',
    data: { id: 'shop-2' }
  });
});

/**
 * @swagger
 * /api/shops/{id}:
 *   put:
 *     tags: [Shop Management]
 *     summary: Update shop
 */
app.put('/api/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop updated successfully'
  });
});

/**
 * @swagger
 * /api/shops/{id}:
 *   delete:
 *     tags: [Shop Management]
 *     summary: Delete shop
 */
app.delete('/api/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop deleted successfully'
  });
});

// Shop Images
app.post('/api/shops/:shopId/images', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop image uploaded'
  });
});

app.get('/api/shops/:shopId/images', (req, res) => {
  res.status(200).json({
    success: true,
    data: { images: [] }
  });
});

app.delete('/api/shops/:shopId/images/:imageId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Image deleted'
  });
});

app.put('/api/shops/:shopId/images/:imageId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Image updated'
  });
});

app.post('/api/shops/:shopId/images/:imageId/set-primary', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Primary image set'
  });
});

// Shop Owner Routes
app.get('/api/shop-owner/dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/shop-owner/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shops: [] }
  });
});

app.post('/api/shop-owner/shops', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Shop created'
  });
});

app.put('/api/shop-owner/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop updated'
  });
});

app.delete('/api/shop-owner/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop deleted'
  });
});

// Admin Shop Management
app.get('/api/admin/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shops: [] }
  });
});

app.get('/api/admin/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shop: {} }
  });
});

app.put('/api/admin/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop updated by admin'
  });
});

app.delete('/api/admin/shops/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop deleted by admin'
  });
});

// Shop Approval
app.get('/api/admin/shops/approval', (req, res) => {
  res.status(200).json({
    success: true,
    data: { pendingShops: [] }
  });
});

app.get('/api/admin/shops/approval/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.put('/api/admin/shops/approval/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shop approval processed'
  });
});

app.get('/api/admin/shops/approval/:id/details', (req, res) => {
  res.status(200).json({
    success: true,
    data: { details: {} }
  });
});

app.post('/api/admin/shops/approval/bulk-approval', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk approval completed'
  });
});

// =============================================
// RESERVATION ENDPOINTS (15+ endpoints)
// =============================================

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     tags: [Reservations]
 *     summary: Create a new reservation
 */
app.post('/api/reservations', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Reservation created successfully',
    data: {
      id: 'reservation-1',
      shop_id: req.body.shop_id,
      service_id: req.body.service_id,
      scheduled_time: req.body.scheduled_time,
      status: 'pending'
    }
  });
});

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     tags: [Reservations]
 *     summary: Get user reservations
 */
app.get('/api/reservations', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      reservations: [
        {
          id: 'reservation-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          scheduled_time: '2024-01-15T10:00:00Z',
          status: 'confirmed'
        }
      ]
    }
  });
});

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     tags: [Reservations]
 *     summary: Get reservation by ID
 */
app.get('/api/reservations/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      shop_id: 'shop-1',
      service_id: 'service-1',
      scheduled_time: '2024-01-15T10:00:00Z',
      status: 'confirmed'
    }
  });
});

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   put:
 *     tags: [Reservations]
 *     summary: Cancel reservation
 */
app.put('/api/reservations/:id/cancel', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation cancelled'
  });
});

// Available Slots
app.get('/api/shops/:shopId/available-slots', (req, res) => {
  res.status(200).json({
    success: true,
    data: { slots: [] }
  });
});

// Reservation Rescheduling
app.post('/api/reservations/:id/reschedule', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation rescheduled'
  });
});

app.get('/api/reservations/:id/reschedule-options', (req, res) => {
  res.status(200).json({
    success: true,
    data: { options: [] }
  });
});

// Conflict Resolution
app.get('/api/shops/:shopId/conflicts/detect', (req, res) => {
  res.status(200).json({
    success: true,
    data: { conflicts: [] }
  });
});

app.post('/api/conflicts/:conflictId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Conflict resolved'
  });
});

app.post('/api/conflicts/priority-scores', (req, res) => {
  res.status(200).json({
    success: true,
    data: { scores: {} }
  });
});

app.get('/api/shops/:shopId/conflicts/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.get('/api/shops/:shopId/conflicts/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/shops/:shopId/conflicts/manual-interface', (req, res) => {
  res.status(200).json({
    success: true,
    data: { interface: {} }
  });
});

app.post('/api/shops/:shopId/conflicts/prevent', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Conflict prevention applied'
  });
});

// No-Show Detection
app.post('/api/admin/no-show/override', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'No-show override applied'
  });
});

app.get('/api/admin/no-show/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/admin/no-show/config', (req, res) => {
  res.status(200).json({
    success: true,
    data: { config: {} }
  });
});

app.put('/api/admin/no-show/config', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Config updated'
  });
});

app.post('/api/admin/no-show/trigger', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'No-show detection triggered'
  });
});

app.get('/api/admin/no-show/reservation/:reservationId', (req, res) => {
  res.status(200).json({
    success: true,
    data: { details: {} }
  });
});

// Admin Reservation Management
app.get('/api/admin/reservations', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reservations: [] }
  });
});

app.get('/api/admin/reservations/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reservation: {} }
  });
});

app.put('/api/admin/reservations/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation updated by admin'
  });
});

app.delete('/api/admin/reservations/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation deleted by admin'
  });
});

// =============================================
// PAYMENT ENDPOINTS (20+ endpoints)
// =============================================

/**
 * @swagger
 * /api/payments:
 *   post:
 *     tags: [Payments]
 *     summary: Process payment
 */
app.post('/api/payments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment processed successfully',
    data: {
      id: 'payment-1',
      reservation_id: req.body.reservation_id,
      amount: req.body.amount,
      payment_method: req.body.payment_method,
      status: 'completed'
    }
  });
});

/**
 * @swagger
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get user payments
 */
app.get('/api/payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payments: [] }
  });
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
 */
app.get('/api/payments/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payment: {} }
  });
});

// Split Payments
app.post('/api/split-payments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Split payment created'
  });
});

app.get('/api/split-payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { splitPayments: [] }
  });
});

app.get('/api/split-payments/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { splitPayment: {} }
  });
});

app.put('/api/split-payments/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Split payment updated'
  });
});

// Admin Payment Management
app.get('/api/admin/payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payments: [] }
  });
});

app.get('/api/admin/payments/summary', (req, res) => {
  res.status(200).json({
    success: true,
    data: { summary: {} }
  });
});

app.get('/api/admin/payments/settlements', (req, res) => {
  res.status(200).json({
    success: true,
    data: { settlements: [] }
  });
});

app.get('/api/admin/payments/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/payments/export', (req, res) => {
  res.status(200).json({
    success: true,
    data: { export: {} }
  });
});

app.get('/api/admin/payments/:paymentId', (req, res) => {
  res.status(200).json({
    success: true,
    data: { payment: {} }
  });
});

app.post('/api/admin/payments/:paymentId/refund', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Refund processed'
  });
});

// Payment Security
app.post('/api/payment-security/fraud-detection', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      risk_score: 0.1,
      is_suspicious: false,
      recommendations: []
    }
  });
});

app.get('/api/payment-security/metrics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { metrics: {} }
  });
});

app.get('/api/payment-security/alerts', (req, res) => {
  res.status(200).json({
    success: true,
    data: { alerts: [] }
  });
});

app.put('/api/payment-security/alerts/:alertId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alert resolved'
  });
});

app.post('/api/payment-security/compliance-report', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Compliance report generated'
  });
});

app.post('/api/payment-security/error-handling', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Error handled'
  });
});

app.get('/api/payment-security/errors', (req, res) => {
  res.status(200).json({
    success: true,
    data: { errors: [] }
  });
});

app.put('/api/payment-security/errors/:errorId/resolve', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Error resolved'
  });
});

app.get('/api/payment-security/risk-assessment', (req, res) => {
  res.status(200).json({
    success: true,
    data: { assessment: {} }
  });
});

app.get('/api/payment-security/security-dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: { dashboard: {} }
  });
});

// Webhooks
app.post('/api/webhooks/toss-payments', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook processed'
  });
});

// =============================================
// POINTS SYSTEM ENDPOINTS (10+ endpoints)
// =============================================

/**
 * @swagger
 * /api/points/balance:
 *   get:
 *     tags: [Points System]
 *     summary: Get user point balance
 */
app.get('/api/points/balance', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      balance: 1000,
      currency: 'KRW'
    }
  });
});

/**
 * @swagger
 * /api/points:
 *   get:
 *     tags: [Points System]
 *     summary: Get point transactions
 */
app.get('/api/points', (req, res) => {
  res.status(200).json({
    success: true,
    data: { transactions: [] }
  });
});

/**
 * @swagger
 * /api/points:
 *   post:
 *     tags: [Points System]
 *     summary: Add points
 */
app.post('/api/points', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Points added'
  });
});

// Point Balance Management
app.get('/api/points/balance/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.post('/api/points/balance/adjust', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Balance adjusted'
  });
});

// Point Processing (Admin)
app.get('/api/admin/point-processing/queue', (req, res) => {
  res.status(200).json({
    success: true,
    data: { queue: [] }
  });
});

app.post('/api/admin/point-processing/process', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Points processed'
  });
});

// Admin Point Adjustments
app.post('/api/admin/adjustments/points', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Point adjustment created'
  });
});

app.get('/api/admin/adjustments/points', (req, res) => {
  res.status(200).json({
    success: true,
    data: { adjustments: [] }
  });
});

app.get('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { adjustment: {} }
  });
});

app.put('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adjustment updated'
  });
});

app.delete('/api/admin/adjustments/points/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adjustment deleted'
  });
});

app.get('/api/admin/adjustments/points/statistics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/admin/adjustments/points/export', (req, res) => {
  res.status(200).json({
    success: true,
    data: { export: {} }
  });
});

app.get('/api/admin/adjustments/points/audit', (req, res) => {
  res.status(200).json({
    success: true,
    data: { audit: [] }
  });
});

app.get('/api/admin/adjustments/points/reports', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reports: [] }
  });
});

app.get('/api/admin/adjustments/points/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

// =============================================
// NOTIFICATION ENDPOINTS (10+ endpoints)
// =============================================

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 */
app.get('/api/notifications', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      notifications: [
        {
          id: 'notification-1',
          title: 'Reservation Confirmed',
          message: 'Your reservation has been confirmed',
          type: 'reservation',
          read: false
        }
      ]
    }
  });
});

/**
 * @swagger
 * /api/notifications/register:
 *   post:
 *     tags: [Notifications]
 *     summary: Register for push notifications
 */
app.post('/api/notifications/register', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notification registration successful'
  });
});

/**
 * @swagger
 * /api/notifications/unregister:
 *   post:
 *     tags: [Notifications]
 *     summary: Unregister from push notifications
 */
app.post('/api/notifications/unregister', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notification unregistration successful'
  });
});

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Send notification
 */
app.post('/api/notifications/send', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notification sent'
  });
});

/**
 * @swagger
 * /api/notifications/template:
 *   post:
 *     tags: [Notifications]
 *     summary: Create notification template
 */
app.post('/api/notifications/template', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Template created'
  });
});

/**
 * @swagger
 * /api/notifications/templates:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification templates
 */
app.get('/api/notifications/templates', (req, res) => {
  res.status(200).json({
    success: true,
    data: { templates: [] }
  });
});

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification settings
 */
app.get('/api/notifications/settings', (req, res) => {
  res.status(200).json({
    success: true,
    data: { settings: {} }
  });
});

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     tags: [Notifications]
 *     summary: Update notification settings
 */
app.put('/api/notifications/settings', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Settings updated'
  });
});

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification history
 */
app.get('/api/notifications/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

/**
 * @swagger
 * /api/notifications/tokens:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification tokens
 */
app.get('/api/notifications/tokens', (req, res) => {
  res.status(200).json({
    success: true,
    data: { tokens: [] }
  });
});

// =============================================
// STORAGE ENDPOINTS (10+ endpoints)
// =============================================

/**
 * @swagger
 * /api/storage/upload:
 *   post:
 *     tags: [Storage]
 *     summary: Upload file
 */
app.post('/api/storage/upload', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      url: 'https://storage.example.com/file.jpg',
      filename: 'file.jpg'
    }
  });
});

/**
 * @swagger
 * /api/storage/files/{id}:
 *   delete:
 *     tags: [Storage]
 *     summary: Delete file
 */
app.delete('/api/storage/files/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'File deleted'
  });
});

/**
 * @swagger
 * /api/storage/files/{id}:
 *   get:
 *     tags: [Storage]
 *     summary: Get file info
 */
app.get('/api/storage/files/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: { file: {} }
  });
});

/**
 * @swagger
 * /api/storage/files/{id}/download:
 *   post:
 *     tags: [Storage]
 *     summary: Download file
 */
app.post('/api/storage/files/:id/download', (req, res) => {
  res.status(200).json({
    success: true,
    data: { downloadUrl: 'https://storage.example.com/download' }
  });
});

/**
 * @swagger
 * /api/storage/files:
 *   get:
 *     tags: [Storage]
 *     summary: List files
 */
app.get('/api/storage/files', (req, res) => {
  res.status(200).json({
    success: true,
    data: { files: [] }
  });
});

/**
 * @swagger
 * /api/storage/files/{id}/share:
 *   post:
 *     tags: [Storage]
 *     summary: Share file
 */
app.post('/api/storage/files/:id/share', (req, res) => {
  res.status(200).json({
    success: true,
    data: { shareUrl: 'https://storage.example.com/share' }
  });
});

// =============================================
// WEBSOCKET ENDPOINTS (10+ endpoints)
// =============================================

/**
 * @swagger
 * /api/websocket/connect:
 *   get:
 *     tags: [WebSocket]
 *     summary: Connect to WebSocket
 */
app.get('/api/websocket/connect', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebSocket connection established'
  });
});

/**
 * @swagger
 * /api/websocket/stats:
 *   get:
 *     tags: [WebSocket]
 *     summary: Get WebSocket stats
 */
app.get('/api/websocket/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

/**
 * @swagger
 * /api/websocket/rooms:
 *   get:
 *     tags: [WebSocket]
 *     summary: Get WebSocket rooms
 */
app.get('/api/websocket/rooms', (req, res) => {
  res.status(200).json({
    success: true,
    data: { rooms: [] }
  });
});

/**
 * @swagger
 * /api/websocket/rooms/{roomId}:
 *   get:
 *     tags: [WebSocket]
 *     summary: Get WebSocket room details
 */
app.get('/api/websocket/rooms/:roomId', (req, res) => {
  res.status(200).json({
    success: true,
    data: { room: {} }
  });
});

/**
 * @swagger
 * /api/websocket/admin/notification:
 *   post:
 *     tags: [WebSocket]
 *     summary: Send admin notification
 */
app.post('/api/websocket/admin/notification', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin notification sent'
  });
});

/**
 * @swagger
 * /api/websocket/reservation/update:
 *   post:
 *     tags: [WebSocket]
 *     summary: Update reservation via WebSocket
 */
app.post('/api/websocket/reservation/update', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reservation updated'
  });
});

/**
 * @swagger
 * /api/websocket/user/message:
 *   post:
 *     tags: [WebSocket]
 *     summary: Send user message
 */
app.post('/api/websocket/user/message', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Message sent'
  });
});

/**
 * @swagger
 * /api/websocket/room/message:
 *   post:
 *     tags: [WebSocket]
 *     summary: Send room message
 */
app.post('/api/websocket/room/message', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Room message sent'
  });
});

/**
 * @swagger
 * /api/websocket/broadcast:
 *   post:
 *     tags: [WebSocket]
 *     summary: Broadcast message
 */
app.post('/api/websocket/broadcast', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Message broadcasted'
  });
});

/**
 * @swagger
 * /api/websocket/cleanup:
 *   post:
 *     tags: [WebSocket]
 *     summary: Cleanup WebSocket connections
 */
app.post('/api/websocket/cleanup', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cleanup completed'
  });
});

// =============================================
// ANALYTICS ENDPOINTS (10+ endpoints)
// =============================================

/**
 * @swagger
 * /api/admin/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics dashboard data
 */
app.get('/api/admin/analytics/dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      total_users: 1000,
      total_shops: 50,
      total_reservations: 500,
      revenue: 10000000
    }
  });
});

app.get('/api/admin/analytics/users', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/shops', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/reservations', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/payments', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/revenue', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/performance', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.get('/api/admin/analytics/export', (req, res) => {
  res.status(200).json({
    success: true,
    data: { export: {} }
  });
});

app.get('/api/admin/analytics/reports', (req, res) => {
  res.status(200).json({
    success: true,
    data: { reports: [] }
  });
});

app.get('/api/admin/analytics/trends', (req, res) => {
  res.status(200).json({
    success: true,
    data: { trends: {} }
  });
});

app.get('/api/admin/analytics/insights', (req, res) => {
  res.status(200).json({
    success: true,
    data: { insights: [] }
  });
});

// =============================================
// REFERRAL ENDPOINTS (5+ endpoints)
// =============================================

app.get('/api/referrals/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/referrals/history', (req, res) => {
  res.status(200).json({
    success: true,
    data: { history: [] }
  });
});

app.put('/api/referrals/:referralId/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Referral status updated'
  });
});

app.post('/api/referrals/:referralId/payout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payout processed'
  });
});

app.get('/api/referrals/analytics', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

// =============================================
// INFLUENCER ENDPOINTS (5+ endpoints)
// =============================================

app.get('/api/influencer/bonus', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      tier: 'gold',
      bonus_rate: 0.05,
      total_earnings: 50000
    }
  });
});

app.get('/api/admin/influencer-bonus/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: { stats: {} }
  });
});

app.get('/api/admin/influencer-bonus/analytics/:influencerId', (req, res) => {
  res.status(200).json({
    success: true,
    data: { analytics: {} }
  });
});

app.post('/api/admin/influencer-bonus/validate/:transactionId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Transaction validated'
  });
});

app.post('/api/admin/influencer-bonus/check-qualification', (req, res) => {
  res.status(200).json({
    success: true,
    data: { qualified: true }
  });
});

// =============================================
// WEBSOCKET ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/websocket/connect:
 *   get:
 *     tags: [WebSocket]
 *     summary: Connect to WebSocket
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WebSocket connection established
 */
app.get('/api/websocket/connect', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebSocket connection established'
  });
});

// =============================================
// ANALYTICS ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/admin/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics dashboard data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 */
app.get('/api/admin/analytics/dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      total_users: 1000,
      total_shops: 50,
      total_reservations: 500,
      revenue: 10000000
    }
  });
});

// =============================================
// ADMIN ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
app.get('/api/admin/users', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      users: [
        {
          id: 'user-1',
          email: 'user@example.com',
          role: 'user',
          status: 'active'
        }
      ]
    }
  });
});

// =============================================
// INFLUENCER ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/influencer/bonus:
 *   get:
 *     tags: [Influencer]
 *     summary: Get influencer bonus information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bonus information retrieved successfully
 */
app.get('/api/influencer/bonus', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      tier: 'gold',
      bonus_rate: 0.05,
      total_earnings: 50000
    }
  });
});

// =============================================
// SECURITY ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/payment-security/fraud-detection:
 *   post:
 *     tags: [Security]
 *     summary: Perform fraud detection
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payment_id:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Fraud detection completed
 */
app.post('/api/payment-security/fraud-detection', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      risk_score: 0.1,
      is_suspicious: false,
      recommendations: []
    }
  });
});

// =============================================
// MONITORING ENDPOINTS
// =============================================

// Get all metrics
app.get('/api/monitoring/metrics', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      {
        name: 'system_cpu_usage',
        type: 'gauge',
        description: 'CPU usage percentage',
        values: [
          { value: 45.2, timestamp: Date.now() - 30000 },
          { value: 47.8, timestamp: Date.now() - 20000 },
          { value: 43.1, timestamp: Date.now() - 10000 },
          { value: 46.5, timestamp: Date.now() }
        ]
      },
      {
        name: 'app_requests_total',
        type: 'counter',
        description: 'Total number of requests',
        values: [
          { value: 1250, timestamp: Date.now() - 30000 },
          { value: 1280, timestamp: Date.now() - 20000 },
          { value: 1310, timestamp: Date.now() - 10000 },
          { value: 1340, timestamp: Date.now() }
        ]
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Get specific metric
app.get('/api/monitoring/metrics/:name', (req, res) => {
  const { name } = req.params;
  
  res.status(200).json({
    success: true,
    data: {
      name,
      values: [
        { value: 45.2, timestamp: Date.now() - 30000 },
        { value: 47.8, timestamp: Date.now() - 20000 },
        { value: 43.1, timestamp: Date.now() - 10000 },
        { value: 46.5, timestamp: Date.now() }
      ],
      count: 4
    },
    timestamp: new Date().toISOString()
  });
});

// Record metric
app.post('/api/monitoring/metrics', (req, res) => {
  const { name, value, labels } = req.body;
  
  if (!name || value === undefined) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_METRIC_REQUEST',
        message: 'Name and value are required',
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Metric recorded successfully',
    timestamp: new Date().toISOString()
  });
});

// Get alerts
app.get('/api/monitoring/alerts', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      {
        id: 'alert_1',
        ruleId: 'high_cpu_usage',
        severity: 'high',
        message: 'CPU usage is above 80%',
        timestamp: Date.now() - 60000,
        resolved: false
      },
      {
        id: 'alert_2',
        ruleId: 'high_error_rate',
        severity: 'critical',
        message: 'Error rate is above 5%',
        timestamp: Date.now() - 30000,
        resolved: false
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Get alert rules
app.get('/api/monitoring/alerts/rules', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'CPU usage is above 80%',
        condition: 'system_cpu_usage > 80',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldown: 300
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate is above 5%',
        condition: 'app_errors_total / app_requests_total > 0.05',
        threshold: 0.05,
        severity: 'critical',
        enabled: true,
        cooldown: 60
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Create alert rule
app.post('/api/monitoring/alerts/rules', (req, res) => {
  const rule = req.body;
  
  if (!rule.name || !rule.condition || !rule.threshold) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ALERT_RULE',
        message: 'Name, condition, and threshold are required',
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Alert rule created successfully',
    data: rule,
    timestamp: new Date().toISOString()
  });
});

// Update alert rule
app.put('/api/monitoring/alerts/rules/:id', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    success: true,
    message: 'Alert rule updated successfully',
    timestamp: new Date().toISOString()
  });
});

// Delete alert rule
app.delete('/api/monitoring/alerts/rules/:id', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    success: true,
    message: 'Alert rule deleted successfully',
    timestamp: new Date().toISOString()
  });
});

// Resolve alert
app.post('/api/monitoring/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    success: true,
    message: 'Alert resolved successfully',
    timestamp: new Date().toISOString()
  });
});

// Get dashboard
app.get('/api/monitoring/dashboard', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      system: {
        cpu: {
          usage: 45.2,
          loadAverage: [0.85, 0.92, 0.78],
          cores: 8
        },
        memory: {
          total: 17179869184,
          used: 8589934592,
          free: 8589934592,
          usagePercent: 50
        },
        disk: {
          total: 1000000000000,
          used: 450000000000,
          free: 550000000000,
          usagePercent: 45
        },
        network: {
          bytesIn: 1000000,
          bytesOut: 500000,
          connections: 150
        }
      },
      application: {
        requests: {
          total: 1340,
          success: 1280,
          error: 60,
          rate: 15.5
        },
        responseTime: {
          average: 150,
          p95: 225,
          p99: 300,
          max: 450
        },
        errors: {
          total: 60,
          byType: {
            'validation_error': 25,
            'database_error': 15,
            'external_api_error': 20
          },
          rate: 0.5
        },
        business: {
          reservations: {
            total: 1250,
            pending: 45,
            completed: 1150,
            cancelled: 55
          },
          payments: {
            total: 1200,
            success: 1140,
            failed: 60,
            successRate: 95
          },
          users: {
            total: 5000,
            active: 3200,
            new: 150
          }
        }
      },
      alerts: {
        total: 2,
        active: 2,
        bySeverity: {
          high: 1,
          critical: 1
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Get system metrics
app.get('/api/monitoring/system', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      cpu: {
        usage: 45.2,
        loadAverage: [0.85, 0.92, 0.78],
        cores: 8
      },
      memory: {
        total: 17179869184,
        used: 8589934592,
        free: 8589934592,
        usagePercent: 50
      },
      disk: {
        total: 1000000000000,
        used: 450000000000,
        free: 550000000000,
        usagePercent: 45
      },
      network: {
        bytesIn: 1000000,
        bytesOut: 500000,
        connections: 150
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Get application metrics
app.get('/api/monitoring/application', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      requests: {
        total: 1340,
        success: 1280,
        error: 60,
        rate: 15.5
      },
      responseTime: {
        average: 150,
        p95: 225,
        p99: 300,
        max: 450
      },
      errors: {
        total: 60,
        byType: {
          'validation_error': 25,
          'database_error': 15,
          'external_api_error': 20
        },
        rate: 0.5
      },
      business: {
        reservations: {
          total: 1250,
          pending: 45,
          completed: 1150,
          cancelled: 55
        },
        payments: {
          total: 1200,
          success: 1140,
          failed: 60,
          successRate: 95
        },
        users: {
          total: 5000,
          active: 3200,
          new: 150
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// =============================================
// SHUTDOWN ENDPOINTS
// =============================================

// Get shutdown status
app.get('/api/shutdown/status', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      isShuttingDown: false,
      startTime: null,
      completedSteps: [],
      remainingSteps: [
        'Stop accepting new connections',
        'Complete in-flight requests',
        'Close WebSocket connections',
        'Close database connections',
        'Close Redis connections',
        'Close monitoring connections',
        'Stop health checks',
        'Exit process'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Test shutdown process
app.post('/api/shutdown/test', (req, res) => {
  const testSteps = [
    'Stop accepting new connections',
    'Complete in-flight requests',
    'Close WebSocket connections',
    'Close database connections',
    'Close Redis connections',
    'Close monitoring connections',
    'Stop health checks'
  ];

  const results = testSteps.map(step => ({
    step,
    status: 'completed',
    duration: 500
  }));

  res.status(200).json({
    success: true,
    message: 'Shutdown test completed successfully',
    data: {
      steps: results,
      totalDuration: results.length * 500
    },
    timestamp: new Date().toISOString()
  });
});

// Shutdown health check
app.get('/api/shutdown/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'System is healthy and ready',
    timestamp: new Date().toISOString()
  });
});

// Error handler - improved to handle malformed JSON
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle malformed JSON specifically
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON format',
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    }
  });
});

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

// Export the app for testing
module.exports = app;

// Only start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 에뷰리띵 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📍 Health Check: http://localhost:${PORT}/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`📋 OpenAPI Spec: http://localhost:${PORT}/api/openapi.json`);
  });
} 