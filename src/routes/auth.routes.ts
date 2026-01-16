import { Router } from 'express';
import { authenticateJWT, optionalAuth } from '../middleware/auth.middleware';
import { rateLimit, loginRateLimit } from '../middleware/rate-limit.middleware';
import AuthController from '../controllers/auth.controller';
import { socialAuthController } from '../controllers/social-auth.controller';
import { naverAuthController } from '../controllers/naver-auth.controller';
import { kakaoAuthController } from '../controllers/kakao-auth.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import {
  socialLoginSchema,
  userRegistrationSchema,
  phoneVerificationInitiateSchema,
  phoneVerificationConfirmSchema,
  passCallbackSchema
} from '../validators/social-auth.validators';
import Joi from 'joi';

/**
 * Authentication Routes
 * 
 * Handles all authentication-related endpoints:
 * - POST /auth/social-login - Social authentication (Kakao, Apple, Google)
 * - POST /auth/register - User registration and profile completion
 * - POST /auth/send-verification-code - Initiate phone verification (PASS/SMS)
 * - POST /auth/verify-phone - Confirm phone verification
 * - POST /auth/pass/callback - PASS verification callback
 * - GET /auth/providers - Provider configuration status
 * - POST /auth/refresh - Token refresh with rotation
 * - POST /auth/logout - Single device logout
 * - POST /auth/logout-all - All devices logout
 * - GET /auth/sessions - Get user sessions
 */

const router = Router();

// Validation schemas
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().min(1).max(1000),
  deviceInfo: Joi.object({
    deviceId: Joi.string().optional().max(255),
    platform: Joi.string().valid('ios', 'android', 'web').optional(),
    version: Joi.string().optional().max(50)
  }).optional()
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().min(1).max(1000)
});

/**
 * @swagger
 * /api/auth/social-login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Social authentication login (Social authentication login)
 *     description: Authenticate user with social providers (Kakao, Apple, Google)
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - token
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [kakao, apple, google]
 *                 description: Social provider name
 *               token:
 *                 type: string
 *                 description: Social provider access token
 *               fcmToken:
 *                 type: string
 *                 description: Firebase FCM token for notifications
 *               deviceInfo:
 *                 type: object
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                   platform:
 *                     type: string
 *                     enum: [ios, android, web]
 *                   version:
 *                     type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   $ref: '#/components/schemas/TokenPair'
 *                 isNewUser:
 *                   type: boolean
 *                 profileComplete:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */

/**
 * @swagger
 * /social-login:
 *   post:
 *     summary: POST /social-login (POST /social-login)
 *     description: POST endpoint for /social-login
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [인증]
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
router.post('/social-login',
  socialAuthController.socialLoginRateLimit, // Use enhanced rate limiting with progressive penalties
  validateRequestBody(socialLoginSchema),
  socialAuthController.socialLogin
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Complete user registration (Complete user registration)
 *     description: Complete user registration with profile information
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phoneNumber
 *               - birthDate
 *               - termsAccepted
 *               - privacyAccepted
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 description: User's birth date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: User's gender
 *               nickname:
 *                 type: string
 *                 description: User's nickname
 *               referredByCode:
 *                 type: string
 *                 description: Referral code if referred by another user
 *               marketingConsent:
 *                 type: boolean
 *                 description: Consent to marketing communications
 *               termsAccepted:
 *                 type: boolean
 *                 description: Terms of service acceptance
 *               privacyAccepted:
 *                 type: boolean
 *                 description: Privacy policy acceptance
 *     responses:
 *       200:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 profileComplete:
 *                   type: boolean
 *                 referralCode:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: POST /register (POST /register)
 *     description: POST endpoint for /register
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [인증]
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
router.post('/register',
  loginRateLimit(), // Use strict rate limiting for registration attempts
  validateRequestBody(userRegistrationSchema),
  socialAuthController.registerUser
);

/**
 * @swagger
 * /api/auth/send-verification-code:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Send phone verification code (Send phone verification code)
 *     description: Initiate phone verification with PASS certification or SMS
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number to verify
 *               method:
 *                 type: string
 *                 enum: [pass, sms]
 *                 description: Verification method
 *               userId:
 *                 type: string
 *                 description: User ID for existing user verification
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 method:
 *                   type: string
 *                   enum: [pass, sms]
 *                 txId:
 *                   type: string
 *                   description: Transaction ID for verification
 *                 redirectUrl:
 *                   type: string
 *                   description: PASS redirect URL (for PASS method)
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: Verification expiration time
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */

/**
 * @swagger
 * /send-verification-code:
 *   post:
 *     summary: POST /send-verification-code (POST /send-verification-code)
 *     description: POST endpoint for /send-verification-code
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [인증]
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
router.post('/send-verification-code',
  loginRateLimit(), // Use strict rate limiting for verification attempts
  validateRequestBody(phoneVerificationInitiateSchema),
  socialAuthController.sendVerificationCode
);

/**
 * POST /api/auth/verify-phone
 * Confirm phone verification with OTP code or PASS result
 * 
 * Rate limited: 10 requests per minute per IP
 * Body: { txId: string, otpCode?: string, passResult?: object, method: 'pass'|'sms' }
 * Returns: { verified, userId?, phoneNumber, method, message }
 */
/**
 * @swagger
 * /verify-phone:
 *   post:
 *     summary: POST /verify-phone (POST /verify-phone)
 *     description: POST endpoint for /verify-phone
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

router.post('/verify-phone',
  loginRateLimit(), // Use strict rate limiting for verification confirmation
  validateRequestBody(phoneVerificationConfirmSchema),
  socialAuthController.verifyPhone
);

/**
 * POST /api/auth/pass/callback
 * Handle PASS verification callback from PASS service
 * 
 * Rate limited: Standard rate limiting
 * Body: { txId: string, result: 'success'|'failure', ci?: string, di?: string, errorCode?, errorMessage? }
 * Returns: Redirect to success/error page
 */
/**
 * @swagger
 * /pass/callback:
 *   post:
 *     summary: POST /pass/callback (POST /pass/callback)
 *     description: POST endpoint for /pass/callback
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

router.post('/pass/callback',
  rateLimit(), // Standard rate limiting for callbacks
  validateRequestBody(passCallbackSchema),
  socialAuthController.handlePassCallback
);

/**
 * GET /api/auth/providers
 * Get social provider configuration status
 * 
 * Rate limited: Standard rate limiting
 * Returns: Configuration status for each provider
 */

/**
 * @swagger
 * /providers:
 *   get:
 *     summary: /providers 조회
 *     description: GET endpoint for /providers
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [인증]
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
router.get('/providers',
  rateLimit(),
  socialAuthController.getProviderStatus
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token (Refresh access token)
 *     description: Refresh access token using refresh token
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *               deviceInfo:
 *                 type: object
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                   platform:
 *                     type: string
 *                     enum: [ios, android, web]
 *                   version:
 *                     type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/refresh',
  loginRateLimit(), // Use strict rate limiting for token refresh
  validateRequestBody(refreshTokenSchema),
  AuthController.refreshToken
);

/**
 * POST /api/auth/logout
 * Logout from current device (revoke refresh token)
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication (optional - graceful if token is invalid)
 * Body: { refreshToken: string }
 */

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: POST /logout (POST /logout)
 *     description: POST endpoint for /logout
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [인증]
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
router.post('/logout',
  rateLimit(),
  optionalAuth(), // Optional auth - allow logout even with invalid token
  validateRequestBody(logoutSchema),
  AuthController.logout
);

/**
 * POST /api/auth/logout-all
 * Logout from all devices (revoke all user's refresh tokens)
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 */
/**
 * @swagger
 * /logout-all:
 *   post:
 *     summary: POST /logout-all (POST /logout-all)
 *     description: POST endpoint for /logout-all
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

router.post('/logout-all',
  rateLimit(),
  authenticateJWT(),
  AuthController.logoutAll
);

/**
 * GET /api/auth/sessions
 * Get user's active sessions/devices
 * 
 * Rate limited: Standard rate limiting  
 * Requires: Authentication
 * Returns: List of active sessions with device info
 */
/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: /sessions 조회
 *     description: GET endpoint for /sessions
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

router.get('/sessions',
  rateLimit(),
  authenticateJWT(),
  AuthController.getSessions
);

/**
 * POST /api/auth/supabase-session
 * Process Supabase Auth session from frontend
 *
 * Rate limited: Standard rate limiting
 * Body: { fcmToken?: string, deviceInfo?: object }
 * Headers: Authorization: Bearer <supabase_access_token>
 */

/**
 * @swagger
 * /supabase-session:
 *   post:
 *     summary: POST /supabase-session (POST /supabase-session)
 *     description: Process Supabase Auth session from frontend
 *
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *
 *       ---
 *
 *     tags: [인증]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Firebase FCM token for notifications
 *               deviceInfo:
 *                 type: object
 *                 properties:
 *                   platform:
 *                     type: string
 *                     enum: [ios, android, web]
 *                   version:
 *                     type: string
 *                   deviceId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Session processed successfully
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.post('/supabase-session',
  rateLimit(),
  socialAuthController.processSupabaseSession
);

/**
 * POST /api/auth/refresh-supabase
 * Refresh Supabase Auth session using refresh token
 *
 * Rate limited: Standard rate limiting
 * Body: { refreshToken: string }
 */

/**
 * @swagger
 * /refresh-supabase:
 *   post:
 *     summary: POST /refresh-supabase (POST /refresh-supabase)
 *     description: POST endpoint for /refresh-supabase
 *
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *
 *       ---
 *
 *     tags: [인증]
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
router.post('/refresh-supabase',
  rateLimit(),
  socialAuthController.refreshSupabaseSession
);

// ============================================
// Naver OAuth Routes
// ============================================

/**
 * @swagger
 * /api/auth/naver:
 *   get:
 *     tags:
 *       - Authentication
 *       - Naver OAuth
 *     summary: Initiate Naver OAuth login
 *     description: Redirects user to Naver authorization page for OAuth login
 *     parameters:
 *       - in: query
 *         name: returnUrl
 *         schema:
 *           type: string
 *         description: URL to redirect after successful authentication
 *     responses:
 *       302:
 *         description: Redirect to Naver authorization page
 *       503:
 *         description: Naver OAuth not configured
 */
router.get('/naver',
  rateLimit(),
  naverAuthController.initiateAuth
);

/**
 * @swagger
 * /api/auth/naver/callback:
 *   get:
 *     tags:
 *       - Authentication
 *       - Naver OAuth
 *     summary: Handle Naver OAuth callback
 *     description: Processes OAuth callback from Naver and creates/updates user session
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Naver
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       302:
 *         description: Redirect to success or error page
 */
router.get('/naver/callback',
  rateLimit(),
  naverAuthController.handleCallback
);

/**
 * @swagger
 * /api/auth/naver/token:
 *   post:
 *     tags:
 *       - Authentication
 *       - Naver OAuth
 *     summary: Authenticate with Naver access token (Mobile App)
 *     description: Authenticate user using Naver access token obtained from mobile SDK
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Naver access token from mobile SDK
 *               fcmToken:
 *                 type: string
 *                 description: Firebase FCM token for push notifications
 *               deviceInfo:
 *                 type: object
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                   platform:
 *                     type: string
 *                     enum: [ios, android, web]
 *                   appVersion:
 *                     type: string
 *                   osVersion:
 *                     type: string
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 *                     isNewUser:
 *                       type: boolean
 *                     profileComplete:
 *                       type: boolean
 *       400:
 *         description: Missing access token
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: Account is inactive
 *       500:
 *         description: Authentication failed
 */
router.post('/naver/token',
  loginRateLimit(),
  naverAuthController.authenticateWithToken
);

/**
 * @swagger
 * /api/auth/naver/unlink:
 *   delete:
 *     tags:
 *       - Authentication
 *       - Naver OAuth
 *     summary: Unlink Naver account
 *     description: Unlink Naver account from user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Naver access token for revoking (optional)
 *     responses:
 *       200:
 *         description: Account unlinked successfully
 *       400:
 *         description: Account is not linked to Naver
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Unlink failed
 */
router.delete('/naver/unlink',
  rateLimit(),
  authenticateJWT(),
  naverAuthController.unlinkAccount
);

/**
 * @swagger
 * /api/auth/naver/status:
 *   get:
 *     tags:
 *       - Authentication
 *       - Naver OAuth
 *     summary: Check Naver OAuth status
 *     description: Check if Naver OAuth is configured and available
 *     responses:
 *       200:
 *         description: Status retrieved
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
 *                     configured:
 *                       type: boolean
 *                     available:
 *                       type: boolean
 *                     provider:
 *                       type: string
 */
router.get('/naver/status',
  rateLimit(),
  naverAuthController.getStatus
);

// ============================================
// Kakao OAuth Routes (Direct Implementation)
// ============================================

// ============================================================================
// DEPRECATED: Kakao Custom JWT Routes (2025-01)
// Now using Supabase OAuth for Kakao login. These routes are disabled.
// Kakao login is handled by Supabase the same way as Google/Apple OAuth.
// See: feature/supabase-kakao-oauth branch
// ============================================================================

// /**
//  * @swagger
//  * /api/auth/kakao:
//  *   get:
//  *     deprecated: true
//  *     tags:
//  *       - Authentication
//  *       - Kakao OAuth
//  *     summary: Initiate Kakao OAuth login (DEPRECATED - Use Supabase OAuth)
//  */
// router.get('/kakao',
//   rateLimit(),
//   kakaoAuthController.initiateAuth
// );

// /**
//  * @swagger
//  * /api/auth/kakao/callback:
//  *   get:
//  *     deprecated: true
//  *     tags:
//  *       - Authentication
//  *       - Kakao OAuth
//  *     summary: Handle Kakao OAuth callback (DEPRECATED - Use Supabase OAuth)
//  */
// router.get('/kakao/callback',
//   rateLimit(),
//   kakaoAuthController.handleCallback
// );

// /**
//  * @swagger
//  * /api/auth/kakao/token:
//  *   post:
//  *     deprecated: true
//  *     tags:
//  *       - Authentication
//  *       - Kakao OAuth
//  *     summary: Authenticate with Kakao access token (DEPRECATED - Use Supabase OAuth)
//  */
// router.post('/kakao/token',
//   loginRateLimit(),
//   kakaoAuthController.authenticateWithToken
// );

// /**
//  * @swagger
//  * /api/auth/kakao/unlink:
//  *   delete:
//  *     deprecated: true
//  *     tags:
//  *       - Authentication
//  *       - Kakao OAuth
//  *     summary: Unlink Kakao account (DEPRECATED - Use Supabase OAuth)
//  */
// router.delete('/kakao/unlink',
//   rateLimit(),
//   authenticateJWT(),
//   kakaoAuthController.unlinkAccount
// );

// Keep status endpoint active for debugging
/**
 * @swagger
 * /api/auth/kakao/status:
 *   get:
 *     tags:
 *       - Authentication
 *       - Kakao OAuth
 *     summary: Check Kakao OAuth status (NOTE - Custom JWT deprecated, use Supabase)
 *     description: Check if Kakao OAuth is configured. Note - Custom JWT routes are deprecated, use Supabase OAuth.
 *     responses:
 *       200:
 *         description: Status retrieved
 */
router.get('/kakao/status',
  rateLimit(),
  kakaoAuthController.getStatus
);

export default router; 