import { Router } from 'express';
import { authenticateJWT, optionalAuth } from '../middleware/auth.middleware';
import { rateLimit, loginRateLimit } from '../middleware/rate-limit.middleware';
import AuthController from '../controllers/auth.controller';
import { socialAuthController } from '../controllers/social-auth.controller';
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
 *     summary: Social authentication login
 *     description: Authenticate user with social providers (Kakao, Apple, Google)
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
router.post('/social-login',
  loginRateLimit(), // Use strict rate limiting for login attempts
  validateRequestBody(socialLoginSchema),
  socialAuthController.socialLogin
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Complete user registration
 *     description: Complete user registration with profile information
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
 *     summary: Send phone verification code
 *     description: Initiate phone verification with PASS certification or SMS
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
 *     summary: Refresh access token
 *     description: Refresh access token using refresh token
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
router.get('/sessions',
  rateLimit(),
  authenticateJWT(),
  AuthController.getSessions
);

/**
 * POST /api/auth/refresh-supabase
 * Refresh Supabase Auth session using refresh token
 * 
 * Rate limited: Standard rate limiting
 * Body: { refreshToken: string }
 */
router.post('/refresh-supabase',
  rateLimit(),
  socialAuthController.refreshSupabaseSession
);

export default router; 