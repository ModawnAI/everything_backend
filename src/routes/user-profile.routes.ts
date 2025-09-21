/**
 * User Profile Routes
 * 
 * Defines all user profile management endpoints with proper middleware,
 * validation, and authentication
 */

import { Router } from 'express';
import multer from 'multer';
import { userProfileController } from '../controllers/user-profile.controller';
import { userSettingsController } from '../controllers/user-settings.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { 
  requireEnhancedAuth, 
  sensitiveOperationRateLimit, 
  logProfileSecurityEvent 
} from '../middleware/profile-security.middleware';
import { 
  sanitizeProfileInput, 
  sanitizePrivacySettingsInput, 
  sanitizeAccountDeletionInput 
} from '../middleware/input-sanitization.middleware';
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
import {
  validateProfileUpdate,
  validatePrivacySettingsUpdate,
  validateAccountDeletion,
  validateTermsAcceptance,
  validatePrivacyAcceptance,
  validateProfileImageUpload,
  validateProfileQuery,
  validateSettingsQuery,
  validateProfileCompletionQuery,
  handleValidationErrors,
  sanitizeProfileData,
  validateFileUpload
} from '../validators/user-profile.express-validator';
import {
  validateUserSettingsUpdate,
  validateBulkSettingsUpdate,
  validateSettingsReset,
  handleValidationErrors as handleSettingsValidationErrors
} from '../validators/user-settings.express-validator';

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
  validateProfileQuery,
  handleValidationErrors,
  userProfileController.getProfile
);

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile',
  rateLimit(),
  authenticateJWT(),
  sanitizeProfileInput,
  requireEnhancedAuth({
    operation: 'profile_update',
    riskLevel: 'medium',
    requiresRecentAuth: true
  }),
  sensitiveOperationRateLimit('profile_update'),
  validateProfileUpdate,
  handleValidationErrors,
  sanitizeProfileData,
  userProfileController.updateProfile
);

/**
 * GET /api/users/profile/completion
 * Get profile completion status
 */
router.get('/profile/completion',
  rateLimit(),
  authenticateJWT(),
  validateProfileCompletionQuery,
  handleValidationErrors,
  userProfileController.getProfileCompletion
);

/**
 * POST /api/users/profile/image
 * Upload profile image
 */
router.post('/profile/image',
  rateLimit(),
  authenticateJWT(),
  requireEnhancedAuth({
    operation: 'image_upload',
    riskLevel: 'medium',
    requiresRecentAuth: true
  }),
  sensitiveOperationRateLimit('image_upload'),
  upload.single('image'),
  validateFileUpload,
  validateProfileImageUpload,
  handleValidationErrors,
  userProfileController.uploadProfileImage
);

// =============================================
// PRIVACY SETTINGS ENDPOINTS
// =============================================

/**
 * GET /api/users/settings
 * Get current user's comprehensive settings
 */
router.get('/settings',
  rateLimit(),
  authenticateJWT(),
  validateSettingsQuery,
  handleValidationErrors,
  userSettingsController.getSettings
);

/**
 * PUT /api/users/settings
 * Update current user's comprehensive settings
 */
router.put('/settings',
  rateLimit(),
  authenticateJWT(),
  sanitizePrivacySettingsInput,
  requireEnhancedAuth({
    operation: 'settings_update',
    riskLevel: 'high',
    requiresRecentAuth: true
  }),
  sensitiveOperationRateLimit('settings_update'),
  validateUserSettingsUpdate,
  handleSettingsValidationErrors,
  sanitizeProfileData,
  userSettingsController.updateSettings
);

/**
 * PUT /api/users/settings/bulk
 * Bulk update user settings
 */
router.put('/settings/bulk',
  rateLimit(),
  authenticateJWT(),
  sanitizePrivacySettingsInput,
  requireEnhancedAuth({
    operation: 'settings_update',
    riskLevel: 'high',
    requiresRecentAuth: true
  }),
  sensitiveOperationRateLimit('settings_update'),
  validateBulkSettingsUpdate,
  handleSettingsValidationErrors,
  sanitizeProfileData,
  userSettingsController.bulkUpdateSettings
);

/**
 * POST /api/users/settings/reset
 * Reset user settings to defaults
 */
router.post('/settings/reset',
  rateLimit(),
  authenticateJWT(),
  requireEnhancedAuth({
    operation: 'settings_update',
    riskLevel: 'high',
    requiresRecentAuth: true
  }),
  sensitiveOperationRateLimit('settings_reset'),
  validateSettingsReset,
  handleSettingsValidationErrors,
  userSettingsController.resetSettings
);

/**
 * GET /api/users/settings/defaults
 * Get default settings values
 */
router.get('/settings/defaults',
  rateLimit(),
  authenticateJWT(),
  userSettingsController.getDefaultSettings
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
  validateTermsAcceptance,
  handleValidationErrors,
  userProfileController.acceptTerms
);

/**
 * POST /api/users/privacy/accept
 * Accept privacy policy
 */
router.post('/privacy/accept',
  rateLimit(),
  authenticateJWT(),
  validatePrivacyAcceptance,
  handleValidationErrors,
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
  sanitizeAccountDeletionInput,
  requireEnhancedAuth({
    operation: 'account_deletion',
    riskLevel: 'critical',
    requiresRecentAuth: true,
    requiresDeviceVerification: true
  }),
  sensitiveOperationRateLimit('account_deletion'),
  validateAccountDeletion,
  handleValidationErrors,
  sanitizeProfileData,
  userProfileController.deleteAccount
);

export default router; 