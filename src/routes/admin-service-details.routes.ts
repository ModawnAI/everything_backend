/**
 * Admin Service Details Routes
 *
 * Enhanced API endpoints for detailed service view in admin dashboard
 * Provides comprehensive service analytics, statistics, and management data
 */

import { Router } from 'express';
import { adminServiceDetailsController } from '../controllers/admin-service-details.controller';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';
import { validateServiceId } from '../validators/shop-service.validators';

const router = Router();


// Note: Authentication middleware is already applied in app.ts for all /api/admin/* routes

// Rate limiting for admin service detail operations
const serviceDetailRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Higher limit for admin detail views
    strategy: 'fixed_window'
  }
});

/**
 * @swagger
 * /api/admin/services/{serviceId}/details:
 *   get:
 *     summary: 서비스 상세 정보 조회 (관리자)
 *     description: |
 *       관리자를 위한 종합적인 서비스 상세 정보를 제공합니다.
 *
 *       **포함 데이터:**
 *       - 기본 서비스 정보
 *       - 샵 정보 및 소유자 정보
 *       - 예약 통계 (총 예약, 완료된 예약, 취소된 예약)
 *       - 매출 통계 (총 매출, 월별 매출 추이)
 *       - 고객 통계 (총 고객 수, 재방문 고객)
 *       - 성과 지표 (평점, 만족도, 취소율)
 *       - 최근 예약 현황
 *       - 서비스 이미지 및 미디어
 *       - 가격 변경 이력
 *       - 운영 시간 및 가용성
 *
 *       **권한:** 관리자 전용
 *     tags: [Admin Service Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 서비스 고유 식별자
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: 통계 기간
 *         example: "30d"
 *       - in: query
 *         name: include_inactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 비활성 데이터 포함 여부
 *         example: false
 *     responses:
 *       200:
 *         description: 서비스 상세 정보 조회 성공
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
 *                     serviceInfo:
 *                       $ref: '#/components/schemas/DetailedServiceInfo'
 *                     shopInfo:
 *                       $ref: '#/components/schemas/ServiceShopInfo'
 *                     statistics:
 *                       $ref: '#/components/schemas/ServiceStatistics'
 *                     performance:
 *                       $ref: '#/components/schemas/ServicePerformance'
 *                     recentActivity:
 *                       $ref: '#/components/schemas/ServiceRecentActivity'
 *                     trends:
 *                       $ref: '#/components/schemas/ServiceTrends'
 *                 message:
 *                   type: string
 *                   example: "서비스 상세 정보를 성공적으로 조회했습니다."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/ServiceNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:serviceId/details',
  serviceDetailRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await adminServiceDetailsController.getServiceDetails(req as any, res);
    } catch (error) {
      logger.error('Error in admin service details route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 상세 정보 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/services/{serviceId}/analytics:
 *   get:
 *     summary: 서비스 분석 데이터 조회 (관리자)
 *     description: |
 *       서비스의 상세 분석 데이터를 제공합니다.
 *
 *       **포함 데이터:**
 *       - 시간대별 예약 패턴
 *       - 고객 세그먼트 분석
 *       - 매출 예측 및 트렌드
 *       - 경쟁 서비스 비교
 *       - 성수기/비수기 분석
 *       - 고객 만족도 분석
 *       - ROI 및 수익성 지표
 *
 *       **권한:** 관리자 전용
 *     tags: [Admin Service Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 서비스 고유 식별자
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 6m, 1y]
 *           default: 30d
 *         description: 분석 기간
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: daily
 *         description: 데이터 세분화 수준
 *       - in: query
 *         name: compare_period
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 이전 기간과 비교 포함
 *     responses:
 *       200:
 *         description: 서비스 분석 데이터 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ServiceAnalytics'
 *                 message:
 *                   type: string
 */
router.get('/:serviceId/analytics',
  serviceDetailRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await adminServiceDetailsController.getServiceAnalytics(req as any, res);
    } catch (error) {
      logger.error('Error in admin service analytics route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 분석 데이터 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/services/{serviceId}/reservations:
 *   get:
 *     summary: 서비스 예약 목록 조회 (관리자)
 *     description: |
 *       특정 서비스의 예약 목록을 상세히 조회합니다.
 *
 *       **포함 데이터:**
 *       - 예약 상세 정보
 *       - 고객 정보
 *       - 결제 정보
 *       - 상태 변경 이력
 *       - 특별 요청사항
 *
 *       **필터링 옵션:**
 *       - 예약 상태별 필터링
 *       - 날짜 범위 설정
 *       - 결제 상태별 필터링
 *       - 고객별 필터링
 *
 *       **권한:** 관리자 전용
 *     tags: [Admin Service Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 서비스 고유 식별자
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, confirmed, completed, cancelled_by_user, cancelled_by_shop, no_show]
 *         description: 예약 상태 필터
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, deposit_paid, fully_paid, refunded]
 *         description: 결제 상태 필터
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: 건너뛸 항목 수
 *     responses:
 *       200:
 *         description: 서비스 예약 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DetailedReservation'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *                     summary:
 *                       $ref: '#/components/schemas/ReservationSummary'
 *                 message:
 *                   type: string
 */
router.get('/:serviceId/reservations',
  serviceDetailRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await adminServiceDetailsController.getServiceReservations(req as any, res);
    } catch (error) {
      logger.error('Error in admin service reservations route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 예약 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/services/{serviceId}/customers:
 *   get:
 *     summary: 서비스 고객 분석 조회 (관리자)
 *     description: |
 *       특정 서비스를 이용한 고객들의 상세 분석 정보를 제공합니다.
 *
 *       **포함 데이터:**
 *       - 고객 프로필 정보
 *       - 예약 패턴 분석
 *       - 지출 패턴 분석
 *       - 로열티 점수
 *       - 재방문율
 *       - 추천 가능성
 *
 *       **세그먼테이션:**
 *       - VIP 고객
 *       - 단골 고객
 *       - 신규 고객
 *       - 이탈 위험 고객
 *
 *       **권한:** 관리자 전용
 *     tags: [Admin Service Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 서비스 고유 식별자
 *       - in: query
 *         name: segment
 *         schema:
 *           type: string
 *           enum: [all, vip, regular, new, at_risk]
 *           default: all
 *         description: 고객 세그먼트 필터
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 6m, 1y]
 *           default: 90d
 *         description: 분석 기간
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [total_spent, visit_count, last_visit, loyalty_score]
 *           default: total_spent
 *         description: 정렬 기준
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 서비스 고객 분석 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     customers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CustomerAnalysis'
 *                     segments:
 *                       $ref: '#/components/schemas/CustomerSegments'
 *                     insights:
 *                       $ref: '#/components/schemas/CustomerInsights'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *                 message:
 *                   type: string
 */
router.get('/:serviceId/customers',
  serviceDetailRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await adminServiceDetailsController.getServiceCustomers(req as any, res);
    } catch (error) {
      logger.error('Error in admin service customers route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 고객 분석 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/services/{serviceId}/revenue:
 *   get:
 *     summary: 서비스 매출 분석 조회 (관리자)
 *     description: |
 *       특정 서비스의 상세 매출 분석 정보를 제공합니다.
 *
 *       **포함 데이터:**
 *       - 매출 추이 (일별/주별/월별)
 *       - 예약금 vs 잔금 비율
 *       - 평균 거래 금액
 *       - 매출 예측
 *       - 수익성 분석
 *       - 비용 구조 분석
 *       - ROI 계산
 *
 *       **비교 분석:**
 *       - 동일 카테고리 서비스 대비
 *       - 샵 내 다른 서비스 대비
 *       - 전년 동기 대비
 *
 *       **권한:** 관리자 전용
 *     tags: [Admin Service Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 서비스 고유 식별자
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 6m, 1y]
 *           default: 30d
 *         description: 분석 기간
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: 데이터 세분화 수준
 *       - in: query
 *         name: include_projections
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 매출 예측 포함 여부
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           enum: [KRW, USD]
 *           default: KRW
 *         description: 통화 단위
 *     responses:
 *       200:
 *         description: 서비스 매출 분석 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     revenue:
 *                       $ref: '#/components/schemas/RevenueAnalysis'
 *                     trends:
 *                       $ref: '#/components/schemas/RevenueTrends'
 *                     comparisons:
 *                       $ref: '#/components/schemas/RevenueComparisons'
 *                     projections:
 *                       $ref: '#/components/schemas/RevenueProjections'
 *                 message:
 *                   type: string
 */
router.get('/:serviceId/revenue',
  serviceDetailRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await adminServiceDetailsController.getServiceRevenue(req as any, res);
    } catch (error) {
      logger.error('Error in admin service revenue route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 매출 분석 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for admin service detail routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in admin service detail routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method,
    adminId: req.user?.id
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서비스 상세 정보 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;