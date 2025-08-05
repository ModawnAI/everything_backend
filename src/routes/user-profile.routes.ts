/**
 * User Profile Routes
 * 
 * Defines all user profile management endpoints with proper middleware,
 * validation, and authentication
 */

import { Router } from 'express';
import multer from 'multer';
import { userProfileController } from '../controllers/user-profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import {
  profileUpdateSchema,
  privacySettingsUpdateSchema,
  accountDeletionSchema,
  profileImageUploadSchema,
  termsAcceptanceSchema,
  privacyAcceptanceSchema,
  profileCompletionQuerySchema,
  settingsQuerySchema,
  profileQuerySchema
} from '../validators/user-profile.validators';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// =============================================
// PROFILE MANAGEMENT ENDPOINTS
// =============================================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(profileQuerySchema),
  userProfileController.getProfile
);

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(profileUpdateSchema),
  userProfileController.updateProfile
);

/**
 * GET /api/users/profile/completion
 * Get profile completion status
 */
router.get('/profile/completion',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(profileCompletionQuerySchema),
  userProfileController.getProfileCompletion
);

/**
 * POST /api/users/profile/image
 * Upload profile image
 */
router.post('/profile/image',
  rateLimit(),
  authenticateJWT(),
  upload.single('image'),
  (req: any, res: any, next: any) => {
    // Validate uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: '업로드할 이미지 파일을 선택해주세요.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate file size
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: '이미지 파일 크기는 5MB 이하여야 합니다.',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  },
  userProfileController.uploadProfileImage
);

// =============================================
// PRIVACY SETTINGS ENDPOINTS
// =============================================

/**
 * GET /api/users/settings
 * Get current user's privacy settings
 */
router.get('/settings',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(settingsQuerySchema),
  userProfileController.getSettings
);

/**
 * PUT /api/users/settings
 * Update current user's privacy settings
 */
router.put('/settings',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(privacySettingsUpdateSchema),
  userProfileController.updateSettings
);

// =============================================
// TERMS AND PRIVACY ACCEPTANCE ENDPOINTS
// =============================================

/**
 * POST /api/users/terms/accept
 * Accept terms and conditions
 */
router.post('/terms/accept',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(termsAcceptanceSchema),
  userProfileController.acceptTerms
);

/**
 * POST /api/users/privacy/accept
 * Accept privacy policy
 */
router.post('/privacy/accept',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(privacyAcceptanceSchema),
  userProfileController.acceptPrivacy
);

// =============================================
// ACCOUNT MANAGEMENT ENDPOINTS
// =============================================

/**
 * DELETE /api/users/account
 * Delete user account (soft delete)
 */
router.delete('/account',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(accountDeletionSchema),
  userProfileController.deleteAccount
);

export default router; 