/**
 * Registration Routes
 * 
 * Routes for the complete user registration flow
 */

import { Router } from 'express';
import { registrationController } from '../controllers/registration.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas using Joi
const socialLoginSchema = Joi.object({
  provider: Joi.string().valid('kakao', 'apple', 'google').required(),
  token: Joi.string().min(1).required().messages({
    'string.empty': 'Token is required',
    'any.required': 'Token is required'
  }),
  deviceInfo: Joi.object({
    userAgent: Joi.string().optional(),
    timezone: Joi.string().optional(),
    screenResolution: Joi.string().optional()
  }).optional()
});

const profileSetupSchema = Joi.object({
  sessionId: Joi.string().min(1).required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  }),
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Name is required',
    'string.max': 'Name too long',
    'any.required': 'Name is required'
  }),
  nickname: Joi.string().max(50).optional().messages({
    'string.max': 'Nickname too long'
  }),
  birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': 'Invalid birth date format (YYYY-MM-DD)',
    'any.required': 'Birth date is required'
  }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  phoneNumber: Joi.string().min(1).required().messages({
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required'
  }),
  referredByCode: Joi.string().length(8).optional().messages({
    'string.length': 'Referral code must be 8 characters'
  })
});

const phoneVerificationSchema = Joi.object({
  sessionId: Joi.string().min(1).required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  }),
  method: Joi.string().valid('sms', 'pass').required(),
  phoneNumber: Joi.string().min(1).required().messages({
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required'
  })
});

const otpVerificationSchema = Joi.object({
  sessionId: Joi.string().min(1).required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  }),
  verificationId: Joi.string().min(1).required().messages({
    'string.empty': 'Verification ID is required',
    'any.required': 'Verification ID is required'
  }),
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP must be 6 digits',
    'any.required': 'OTP is required'
  })
});

const termsAcceptanceSchema = Joi.object({
  sessionId: Joi.string().min(1).required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  }),
  termsAccepted: Joi.boolean().required(),
  privacyAccepted: Joi.boolean().required(),
  marketingConsent: Joi.boolean().required()
});

const accountActivationSchema = Joi.object({
  sessionId: Joi.string().min(1).required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  })
});

// Rate limiting configurations
const registrationRateLimit = rateLimit({
  config: {
    max: 5, // 5 attempts per hour
    windowMs: 60 * 60 * 1000, // 1 hour
    strategy: 'sliding_window',
    scope: 'ip',
    enableHeaders: true,
    message: {
      error: 'Too many registration attempts. Please try again later.',
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
    }
  }
});

const phoneVerificationRateLimit = rateLimit({
  config: {
    max: 3, // 3 SMS per hour per IP
    windowMs: 60 * 60 * 1000, // 1 hour
    strategy: 'sliding_window',
    scope: 'ip',
    enableHeaders: true,
    message: {
      error: 'Too many phone verification attempts. Please try again later.',
      code: 'PHONE_VERIFICATION_RATE_LIMIT_EXCEEDED'
    }
  }
});

const otpVerificationRateLimit = rateLimit({
  config: {
    max: 10, // 10 OTP attempts per hour per IP
    windowMs: 60 * 60 * 1000, // 1 hour
    strategy: 'sliding_window',
    scope: 'ip',
    enableHeaders: true,
    message: {
      error: 'Too many OTP verification attempts. Please try again later.',
      code: 'OTP_VERIFICATION_RATE_LIMIT_EXCEEDED'
    }
  }
});

/**
 * Registration Flow Routes
 */


/**
 * @swagger
 * /social-login:
 *   post:
 *     summary: POST /social-login (POST /social-login)
 *     description: POST endpoint for /social-login
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
// Step 1: Social Login
router.post('/social-login',
  registrationRateLimit,
  validateRequestBody(socialLoginSchema),
  registrationController.socialLogin.bind(registrationController)
);

// Step 2: Profile Setup
/**
 * @swagger
 * /profile-setup:
 *   post:
 *     summary: POST /profile-setup (POST /profile-setup)
 *     description: POST endpoint for /profile-setup
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

router.post('/profile-setup',
  validateRequestBody(profileSetupSchema),
  registrationController.setupProfile.bind(registrationController)
);

// Step 3a: Send Phone Verification
/**
 * @swagger
 * /phone-verification/send:
 *   post:
 *     summary: POST /phone-verification/send (POST /phone-verification/send)
 *     description: POST endpoint for /phone-verification/send
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

router.post('/phone-verification/send',
  phoneVerificationRateLimit,
  validateRequestBody(phoneVerificationSchema),
  registrationController.sendPhoneVerification.bind(registrationController)
);

// Step 3b: Verify Phone OTP
/**
 * @swagger
 * /phone-verification/verify:
 *   post:
 *     summary: POST /phone-verification/verify (POST /phone-verification/verify)
 *     description: POST endpoint for /phone-verification/verify
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

router.post('/phone-verification/verify',
  otpVerificationRateLimit,
  validateRequestBody(otpVerificationSchema),
  registrationController.verifyPhoneOTP.bind(registrationController)
);

// Step 4: Terms Acceptance
/**
 * @swagger
 * /terms-acceptance:
 *   post:
 *     summary: POST /terms-acceptance (POST /terms-acceptance)
 *     description: POST endpoint for /terms-acceptance
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

router.post('/terms-acceptance',
  validateRequestBody(termsAcceptanceSchema),
  registrationController.acceptTerms.bind(registrationController)
);


/**
 * @swagger
 * /activate:
 *   post:
 *     summary: POST /activate (POST /activate)
 *     description: POST endpoint for /activate
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
// Step 5: Account Activation
router.post('/activate',
  validateRequestBody(accountActivationSchema),
  registrationController.activateAccount.bind(registrationController)
);

// Get session status
/**
 * @swagger
 * /session/:sessionId:
 *   get:
 *     summary: /session/:sessionId 조회
 *     description: GET endpoint for /session/:sessionId
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

router.get('/session/:sessionId',
  registrationController.getSessionStatus.bind(registrationController)
);

// Health check
/**
 * @swagger
 * /health:
 *   get:
 *     summary: /health 조회
 *     description: GET endpoint for /health
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

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Registration service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
