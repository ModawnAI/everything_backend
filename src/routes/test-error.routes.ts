import { Router } from 'express';
import { 
  AuthenticationError, 
  AuthorizationError, 
  ValidationError, 
  NotFoundError, 
  BusinessLogicError, 
  DatabaseError, 
  ExternalServiceError, 
  RateLimitError,
  throwError
} from '../middleware/error-handling.middleware';

const router = Router();

/**
 * Test endpoint for authentication error
 */

/**
 * @swagger
 * /auth-error:
 *   get:
 *     summary: /auth-error 조회
 *     description: GET endpoint for /auth-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
router.get('/auth-error', (_req, _res) => {
  throw new AuthenticationError('테스트 인증 오류');
});

/**
 * Test endpoint for authorization error
 */
/**
 * @swagger
 * /authorization-error:
 *   get:
 *     summary: /authorization-error 조회
 *     description: GET endpoint for /authorization-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/authorization-error', (_req, _res) => {
  throw new AuthorizationError('테스트 권한 오류');
});

/**
 * Test endpoint for validation error
 */
/**
 * @swagger
 * /validation-error:
 *   get:
 *     summary: /validation-error 조회
 *     description: GET endpoint for /validation-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/validation-error', (_req, _res) => {
  throw new ValidationError('테스트 유효성 검사 오류');
});

/**
 * Test endpoint for not found error
 */
/**
 * @swagger
 * /not-found-error:
 *   get:
 *     summary: /not-found-error 조회
 *     description: GET endpoint for /not-found-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/not-found-error', (_req, _res) => {
  throw new NotFoundError('테스트 리소스 없음 오류');
});

/**
 * Test endpoint for business logic error
 */
/**
 * @swagger
 * /business-error:
 *   get:
 *     summary: /business-error 조회
 *     description: GET endpoint for /business-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/business-error', (_req, _res) => {
  throw new BusinessLogicError('테스트 비즈니스 로직 오류');
});

/**
 * Test endpoint for database error
 */
/**
 * @swagger
 * /database-error:
 *   get:
 *     summary: /database-error 조회
 *     description: GET endpoint for /database-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/database-error', (_req, _res) => {
  throw new DatabaseError('테스트 데이터베이스 오류');
});

/**
 * Test endpoint for external service error
 */

/**
 * @swagger
 * /external-error:
 *   get:
 *     summary: /external-error 조회
 *     description: GET endpoint for /external-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
router.get('/external-error', (_req, _res) => {
  throw new ExternalServiceError('테스트 외부 서비스 오류');
});

/**
 * Test endpoint for rate limit error
 */
/**
 * @swagger
 * /rate-limit-error:
 *   get:
 *     summary: /rate-limit-error 조회
 *     description: GET endpoint for /rate-limit-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/rate-limit-error', (_req, _res) => {
  throw new RateLimitError('테스트 속도 제한 오류');
});

/**
 * Test endpoint for generic error with custom code
 */
/**
 * @swagger
 * /custom-error:
 *   get:
 *     summary: /custom-error 조회
 *     description: GET endpoint for /custom-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/custom-error', (_req, _res) => {
  throwError('BUSINESS_3002', '테스트 커스텀 오류');
});

/**
 * Test endpoint for async error
 */
/**
 * @swagger
 * /async-error:
 *   get:
 *     summary: /async-error 조회
 *     description: GET endpoint for /async-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/async-error', async (_req, _res) => {
  await new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('테스트 비동기 오류'));
    }, 100);
  });
});

/**
 * Test endpoint for JSON parsing error
 */
/**
 * @swagger
 * /json-error:
 *   post:
 *     summary: POST /json-error (POST /json-error)
 *     description: POST endpoint for /json-error
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.post('/json-error', (req, _res) => {
  // This will trigger JSON parsing error if malformed JSON is sent
  console.log('Received body:', req.body);
  throw new Error('JSON 파싱 오류 테스트');
});

export default router; 