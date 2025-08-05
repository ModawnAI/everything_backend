const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '에뷰리띵 Beauty Platform API',
      version: '1.0.0',
      description: 'Comprehensive REST API for the beauty service booking platform',
      contact: {
        name: 'API Support',
        email: 'support@ebeautything.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./test-server.js'] // Only include the current file
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '에뷰리띵 백엔드 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Default route
app.get('/', (req, res) => {
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

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 */
app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    token: 'mock-jwt-token',
    user: {
      id: 'user-123',
      email: req.body.email,
      name: 'Test User'
    }
  });
});

/**
 * @swagger
 * /api/shops:
 *   get:
 *     summary: Get all shops
 *     tags: [Shops]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of shops
 */
app.get('/api/shops', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'shop-1',
        name: 'Beauty Salon A',
        address: 'Seoul, Gangnam-gu',
        rating: 4.5
      },
      {
        id: 'shop-2',
        name: 'Hair Studio B',
        address: 'Seoul, Hongdae',
        rating: 4.8
      }
    ]
  });
});

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopId:
 *                 type: string
 *               serviceId:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Reservation created successfully
 */
app.post('/api/reservations', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: 'reservation-123',
      shopId: req.body.shopId,
      serviceId: req.body.serviceId,
      scheduledAt: req.body.scheduledAt,
      status: 'pending'
    }
  });
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Process payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reservationId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed successfully
 */
app.post('/api/payments', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'payment-123',
      reservationId: req.body.reservationId,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      status: 'completed'
    }
  });
});

// OpenAPI spec endpoint - moved before 404 handler
app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerSpec);
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
      message: '서버 내부 오류가 발생했습니다.'
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
  });
} 