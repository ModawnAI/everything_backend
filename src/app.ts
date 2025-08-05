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
import pointRoutes from './routes/point.routes';
import pointBalanceRoutes from './routes/point-balance.routes';
import pointProcessingRoutes from './routes/point-processing.routes';
import paymentSecurityRoutes from './routes/payment-security.routes';
import influencerBonusRoutes from './routes/influencer-bonus.routes';
import adminAdjustmentRoutes from './routes/admin-adjustment.routes';
import adminPaymentRoutes from './routes/admin-payment.routes';
import adminAnalyticsRoutes from './routes/admin-analytics.routes';
import notificationRoutes from './routes/notification.routes';
import websocketRoutes from './routes/websocket.routes';
import testErrorRoutes from './routes/test-error.routes';
import healthRoutes from './routes/health.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import adminUserManagementRoutes from './routes/admin-user-management.routes';
import cacheRoutes from './routes/cache.routes';
import monitoringRoutes from './routes/monitoring.routes';
import shutdownRoutes from './routes/shutdown.routes';

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

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging middleware setup
app.use(correlationIdMiddleware);
app.use(performanceLoggingMiddleware);
app.use(requestLoggingMiddleware);
app.use(morganFormat);

// Basic middleware setup
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import comprehensive OpenAPI configuration - TEMPORARILY DISABLED DUE TO TYPE ERRORS
// import { API_INFO, API_SERVERS, API_TAGS, SECURITY_SCHEMES, COMMON_RESPONSES, COMMON_PARAMETERS, DATABASE_SCHEMAS } from './config/openapi.config';

// Swagger configuration using comprehensive OpenAPI config - TEMPORARILY DISABLED
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '에뷰리띵 백엔드 API',
      version: '1.0.0',
      description: 'Everything Backend API for Review Thing App',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://api.reviewthing.com' : `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['male', 'female', 'other'] },
            nickname: { type: 'string' },
            profileImage: { type: 'string' },
            referralCode: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' }
          }
        },
        Shop: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            phoneNumber: { type: 'string' },
            email: { type: 'string', format: 'email' },
            address: { type: 'string' },
            detailedAddress: { type: 'string' },
            postalCode: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            mainCategory: { type: 'string' },
            subCategories: { type: 'array', items: { type: 'string' } },
            operatingHours: { type: 'object' },
            paymentMethods: { type: 'array', items: { type: 'string' } },
            kakaoChannelUrl: { type: 'string' },
            businessLicenseNumber: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'suspended'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            shopId: { type: 'string', format: 'uuid' },
            services: { type: 'array', items: { $ref: '#/components/schemas/ReservationService' } },
            reservationDate: { type: 'string', format: 'date' },
            reservationTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] },
            totalAmount: { type: 'number' },
            pointsUsed: { type: 'number' },
            specialRequests: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        ReservationService: {
          type: 'object',
          properties: {
            serviceId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
            price: { type: 'number' }
          }
        },
        TimeSlot: {
          type: 'object',
          properties: {
            startTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' },
            endTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' },
            available: { type: 'boolean' },
            capacity: { type: 'integer' },
            booked: { type: 'integer' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Too Many Requests',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { $ref: '#/components/schemas/Error' }
                }
              }
            }
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
  apis: ['./src/routes/*.ts', './src/app.ts']
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/admin', userStatusRoutes);
app.use('/api/admin/shops', adminShopRoutes);
app.use('/api/admin/shops/approval', adminShopApprovalRoutes);
app.use('/api/admin/reservations', adminReservationRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/shops', shopImageRoutes);
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api/test-error', testErrorRoutes);
app.use('/health', healthRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/shutdown', shutdownRoutes);

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
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    
    // Initialize WebSocket service
    initializeWebSocketService(server);
    console.log(`🔌 WebSocket 서비스가 초기화되었습니다.`);
  });
}

export default app; 