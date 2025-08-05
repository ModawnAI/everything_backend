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
router.get('/auth-error', (_req, _res) => {
  throw new AuthenticationError('테스트 인증 오류');
});

/**
 * Test endpoint for authorization error
 */
router.get('/authorization-error', (_req, _res) => {
  throw new AuthorizationError('테스트 권한 오류');
});

/**
 * Test endpoint for validation error
 */
router.get('/validation-error', (_req, _res) => {
  throw new ValidationError('테스트 유효성 검사 오류');
});

/**
 * Test endpoint for not found error
 */
router.get('/not-found-error', (_req, _res) => {
  throw new NotFoundError('테스트 리소스 없음 오류');
});

/**
 * Test endpoint for business logic error
 */
router.get('/business-error', (_req, _res) => {
  throw new BusinessLogicError('테스트 비즈니스 로직 오류');
});

/**
 * Test endpoint for database error
 */
router.get('/database-error', (_req, _res) => {
  throw new DatabaseError('테스트 데이터베이스 오류');
});

/**
 * Test endpoint for external service error
 */
router.get('/external-error', (_req, _res) => {
  throw new ExternalServiceError('테스트 외부 서비스 오류');
});

/**
 * Test endpoint for rate limit error
 */
router.get('/rate-limit-error', (_req, _res) => {
  throw new RateLimitError('테스트 속도 제한 오류');
});

/**
 * Test endpoint for generic error with custom code
 */
router.get('/custom-error', (_req, _res) => {
  throwError('BUSINESS_3002', '테스트 커스텀 오류');
});

/**
 * Test endpoint for async error
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
router.post('/json-error', (req, _res) => {
  // This will trigger JSON parsing error if malformed JSON is sent
  console.log('Received body:', req.body);
  throw new Error('JSON 파싱 오류 테스트');
});

export default router; 