/**
 * Shop Operating Hours Routes
 * 
 * API endpoints for shop operating hours management including:
 * - Retrieving current operating hours schedule
 * - Updating weekly operating hours with validation
 * - Managing break times and special hours
 * - Real-time shop status (open/closed) calculation
 */

import { Router } from 'express';
import { shopOperatingHoursController } from '../controllers/shop-operating-hours.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateOperatingHoursComprehensive } from '../validators/shop-operating-hours.validators';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Shop Operating Hours
 *     description: Shop operating hours management operations for shop owners
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DayOperatingHours:
 *       type: object
 *       description: Operating hours configuration for a single day
 *       properties:
 *         open:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Opening time in HH:MM format (24-hour)
 *           example: "09:00"
 *         close:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Closing time in HH:MM format (24-hour)
 *           example: "18:00"
 *         closed:
 *           type: boolean
 *           description: Whether the shop is closed on this day
 *           default: false
 *           example: false
 *         break_start:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Break start time in HH:MM format (optional)
 *           example: "12:30"
 *         break_end:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Break end time in HH:MM format (optional)
 *           example: "13:30"
 *       required:
 *         - open
 *         - close
 *       additionalProperties: false
 *     
 *     WeeklyOperatingHours:
 *       type: object
 *       description: Complete weekly operating hours schedule
 *       properties:
 *         monday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         tuesday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         wednesday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         thursday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         friday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         saturday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *         sunday:
 *           $ref: '#/components/schemas/DayOperatingHours'
 *       additionalProperties: false
 *     
 *     ShopCurrentStatus:
 *       type: object
 *       description: Current shop status based on operating hours
 *       properties:
 *         is_open:
 *           type: boolean
 *           description: Whether the shop is currently open
 *           example: true
 *         current_day:
 *           type: string
 *           description: Current day of the week
 *           example: "monday"
 *         current_time:
 *           type: string
 *           description: Current time in HH:MM format
 *           example: "14:30"
 *         next_opening:
 *           type: string
 *           description: Next opening time if currently closed
 *           example: "Tomorrow at 10:00"
 *           nullable: true
 *       required:
 *         - is_open
 *         - current_day
 *         - current_time
 *       additionalProperties: false
 */

// Rate limiting for operating hours operations
const operatingHoursRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    strategy: 'fixed_window'
  }
});

const operatingHoursUpdateRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 update requests per 5 minutes
    strategy: 'fixed_window'
  }
});

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @swagger
 * /api/shop/operating-hours:
 *   get:
 *     summary: Get shop operating hours
 *     description: |
 *       Retrieve the current operating hours schedule for the authenticated shop owner's shop.
 *       
 *       **Features:**
 *       - Complete weekly schedule with day-by-day configuration
 *       - Break time information if configured
 *       - Current shop status (open/closed) based on real-time calculation
 *       - Next opening time if currently closed
 *       - Default template if no hours are configured
 *       
 *       **Business Logic:**
 *       - Supports overnight hours (e.g., 22:00 - 02:00)
 *       - Handles break times within operating hours
 *       - Real-time status calculation based on current time and day
 *       - Provides helpful next opening information
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can access their operating hours.
 *     tags: [Shop Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operating hours retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     operating_hours:
 *                       $ref: '#/components/schemas/WeeklyOperatingHours'
 *                     current_status:
 *                       $ref: '#/components/schemas/ShopCurrentStatus'
 *                 message:
 *                   type: string
 *                   example: "영업시간을 성공적으로 조회했습니다."
 *             examples:
 *               standard_hours:
 *                 summary: Standard business hours
 *                 value:
 *                   success: true
 *                   data:
 *                     operating_hours:
 *                       monday:
 *                         open: "09:00"
 *                         close: "18:00"
 *                         closed: false
 *                       tuesday:
 *                         open: "09:00"
 *                         close: "18:00"
 *                         closed: false
 *                       wednesday:
 *                         open: "09:00"
 *                         close: "18:00"
 *                         closed: false
 *                       thursday:
 *                         open: "09:00"
 *                         close: "18:00"
 *                         closed: false
 *                       friday:
 *                         open: "09:00"
 *                         close: "20:00"
 *                         closed: false
 *                       saturday:
 *                         open: "10:00"
 *                         close: "17:00"
 *                         closed: false
 *                       sunday:
 *                         closed: true
 *                     current_status:
 *                       is_open: true
 *                       current_day: "monday"
 *                       current_time: "14:30"
 *                   message: "영업시간을 성공적으로 조회했습니다."
 *               with_breaks:
 *                 summary: Hours with lunch breaks
 *                 value:
 *                   success: true
 *                   data:
 *                     operating_hours:
 *                       monday:
 *                         open: "10:00"
 *                         close: "19:00"
 *                         break_start: "12:30"
 *                         break_end: "13:30"
 *                         closed: false
 *                     current_status:
 *                       is_open: false
 *                       current_day: "monday"
 *                       current_time: "13:00"
 *                       next_opening: "Today at 13:30"
 *                   message: "영업시간을 성공적으로 조회했습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Shop not found - User has no registered shop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "SHOP_NOT_FOUND"
 *                 message: "등록된 샵이 없습니다."
 *                 details: "샵 등록을 먼저 완료해주세요."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: GET /
 *     description: GET endpoint for /
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/',
  ...requireShopOwnerWithShop(),
  operatingHoursRateLimit,
  async (req, res) => {
    try {
      await shopOperatingHoursController.getOperatingHours(req, res);
    } catch (error) {
      logger.error('Error in shop operating hours GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/operating-hours:
 *   put:
 *     summary: Update shop operating hours
 *     description: |
 *       Update the operating hours schedule for the authenticated shop owner's shop.
 *       
 *       **Key Features:**
 *       - Flexible weekly schedule configuration
 *       - Support for break times during operating hours
 *       - Partial updates (only specify days you want to change)
 *       - Comprehensive validation with business rules
 *       - Support for overnight hours (e.g., 22:00 - 02:00)
 *       - Real-time status calculation after update
 *       
 *       **Business Rules:**
 *       - Time format must be HH:MM (24-hour format)
 *       - Open time must be before close time (except overnight hours)
 *       - Break times must be within operating hours
 *       - Break start must be before break end
 *       - At least one day must be open
 *       - Maximum 18 hours of operation per day
 *       - Minimum 30 minutes of operation per day
 *       - Break duration: 15 minutes to 3 hours
 *       
 *       **Validation Features:**
 *       - Format validation (HH:MM pattern)
 *       - Time logic validation (start < end)
 *       - Business rule enforcement
 *       - Comprehensive error messages in Korean
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can update their operating hours.
 *     tags: [Shop Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operating_hours
 *             properties:
 *               operating_hours:
 *                 $ref: '#/components/schemas/WeeklyOperatingHours'
 *           examples:
 *             standard_hours:
 *               summary: Standard business hours (Mon-Sat)
 *               value:
 *                 operating_hours:
 *                   monday:
 *                     open: "09:00"
 *                     close: "18:00"
 *                     closed: false
 *                   tuesday:
 *                     open: "09:00"
 *                     close: "18:00"
 *                     closed: false
 *                   wednesday:
 *                     open: "09:00"
 *                     close: "18:00"
 *                     closed: false
 *                   thursday:
 *                     open: "09:00"
 *                     close: "18:00"
 *                     closed: false
 *                   friday:
 *                     open: "09:00"
 *                     close: "20:00"
 *                     closed: false
 *                   saturday:
 *                     open: "10:00"
 *                     close: "17:00"
 *                     closed: false
 *                   sunday:
 *                     closed: true
 *             with_breaks:
 *               summary: Hours with lunch breaks
 *               value:
 *                 operating_hours:
 *                   monday:
 *                     open: "10:00"
 *                     close: "19:00"
 *                     break_start: "12:30"
 *                     break_end: "13:30"
 *                     closed: false
 *                   tuesday:
 *                     open: "10:00"
 *                     close: "19:00"
 *                     break_start: "12:30"
 *                     break_end: "13:30"
 *                     closed: false
 *                   wednesday:
 *                     open: "10:00"
 *                     close: "19:00"
 *                     break_start: "12:30"
 *                     break_end: "13:30"
 *                     closed: false
 *                   thursday:
 *                     open: "10:00"
 *                     close: "19:00"
 *                     break_start: "12:30"
 *                     break_end: "13:30"
 *                     closed: false
 *                   friday:
 *                     open: "10:00"
 *                     close: "20:00"
 *                     closed: false
 *                   saturday:
 *                     open: "11:00"
 *                     close: "18:00"
 *                     closed: false
 *                   sunday:
 *                     closed: true
 *             overnight_hours:
 *               summary: Overnight hours (e.g., late-night services)
 *               value:
 *                 operating_hours:
 *                   friday:
 *                     open: "22:00"
 *                     close: "02:00"
 *                     closed: false
 *                   saturday:
 *                     open: "22:00"
 *                     close: "02:00"
 *                     closed: false
 *             partial_update:
 *               summary: Update only specific days
 *               value:
 *                 operating_hours:
 *                   friday:
 *                     open: "09:00"
 *                     close: "21:00"
 *                     closed: false
 *                   saturday:
 *                     open: "10:00"
 *                     close: "22:00"
 *                     closed: false
 *             closed_days:
 *               summary: Mark specific days as closed
 *               value:
 *                 operating_hours:
 *                   sunday:
 *                     closed: true
 *                   monday:
 *                     closed: true
 *     responses:
 *       200:
 *         description: Operating hours updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     operating_hours:
 *                       $ref: '#/components/schemas/WeeklyOperatingHours'
 *                     current_status:
 *                       $ref: '#/components/schemas/ShopCurrentStatus'
 *                 message:
 *                   type: string
 *                   example: "영업시간이 성공적으로 업데이트되었습니다."
 *       400:
 *         description: Bad request - Invalid operating hours data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validation_error:
 *                 summary: Time format validation error
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     message: "영업시간 데이터가 유효하지 않습니다."
 *                     details:
 *                       - field: "monday.open"
 *                         message: "시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요."
 *                       - field: "tuesday.close"
 *                         message: "종료 시간은 시작 시간보다 늦어야 합니다."
 *               business_logic_error:
 *                 summary: Business rule violation
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "BUSINESS_LOGIC_ERROR"
 *                     message: "영업시간 설정이 비즈니스 규칙에 맞지 않습니다."
 *                     details:
 *                       - field: "operating_hours"
 *                         message: "최소 하나의 요일은 영업해야 합니다."
 *                       - field: "monday.close"
 *                         message: "영업시간이 너무 깁니다. 최대 18시간까지 가능합니다."
 *               break_time_error:
 *                 summary: Break time validation error
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     message: "영업시간 데이터가 유효하지 않습니다."
 *                     details:
 *                       - field: "monday.break_start"
 *                         message: "휴게 시간은 시작과 종료 시간을 모두 설정해야 합니다."
 *                       - field: "tuesday.break_start"
 *                         message: "휴게 시간은 영업시간 내에 있어야 합니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Shop not found - User has no registered shop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:
 *   put:
 *     summary: PUT /
 *     description: PUT endpoint for /
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.put('/',
  ...requireShopOwnerWithShop(),
  operatingHoursUpdateRateLimit,
  validateOperatingHoursComprehensive,
  async (req, res) => {
    try {
      await shopOperatingHoursController.updateOperatingHours(req, res);
    } catch (error) {
      logger.error('Error in shop operating hours PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for operating hours routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop operating hours routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '영업시간 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
