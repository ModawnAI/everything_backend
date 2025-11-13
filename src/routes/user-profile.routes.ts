/**
 * User Profile Routes
 *
 * Comprehensive user profile management routes including:
 * - Profile CRUD operations
 * - Profile image upload
 * - Privacy settings management
 * - Profile completion tracking
 * - Account deletion
 */

import { Router } from 'express';
import { userProfileController } from '../controllers/user-profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import multer from 'multer';
import { validateProfileUpdate, validatePrivacySettingsUpdate } from '../validators/user-profile.express-validator';

const router = Router();

// Configure multer for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Apply authentication middleware to all routes
router.use(authenticateJWT());

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current authenticated user's complete profile
 *     description: Returns the complete profile information for the currently authenticated user (RESTful /me endpoint)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/me', userProfileController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                     profile:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         nickname:
 *                           type: string
 *                         profileImage:
 *                           type: string
 *                         birthdate:
 *                           type: string
 *                         gender:
 *                           type: string
 *                         profileComplete:
 *                           type: boolean
 *                         termsAcceptedAt:
 *                           type: string
 *                         privacyAcceptedAt:
 *                           type: string
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.get('/profile', userProfileController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 description: User's nickname
 *               birthdate:
 *                 type: string
 *                 format: date
 *                 description: User's birthdate (YYYY-MM-DD)
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: User's gender
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', validateProfileUpdate, userProfileController.updateProfile);

/**
 * @swagger
 * /api/users/settings:
 *   get:
 *     summary: Get user's privacy settings
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
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
 *                     settings:
 *                       type: object
 *                       properties:
 *                         notificationEnabled:
 *                           type: boolean
 *                         marketingEnabled:
 *                           type: boolean
 *                         profileVisibility:
 *                           type: string
 *                           enum: [public, private, friends]
 *                         language:
 *                           type: string
 *                         timezone:
 *                           type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/settings', userProfileController.getSettings);

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     summary: Update user's privacy settings
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationEnabled:
 *                 type: boolean
 *               marketingEnabled:
 *                 type: boolean
 *               profileVisibility:
 *                 type: string
 *                 enum: [public, private, friends]
 *               language:
 *                 type: string
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.put('/settings', validatePrivacySettingsUpdate, userProfileController.updateSettings);

/**
 * @swagger
 * /api/users/profile/completion:
 *   get:
 *     summary: Get profile completion status
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile completion status retrieved
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
 *                     completion:
 *                       type: object
 *                       properties:
 *                         percentage:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                         completedFields:
 *                           type: array
 *                           items:
 *                             type: string
 *                         missingFields:
 *                           type: array
 *                           items:
 *                             type: string
 *                         isComplete:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/completion', userProfileController.getProfileCompletion);

/**
 * @swagger
 * /api/users/profile/image:
 *   post:
 *     summary: Upload profile image
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file (max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
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
 *                     imageUrl:
 *                       type: string
 *                     thumbnailUrl:
 *                       type: string
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         originalSize:
 *                           type: number
 *                         optimizedSize:
 *                           type: number
 *                         format:
 *                           type: string
 *       400:
 *         description: Invalid file or upload failed
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 */
router.post('/profile/image', upload.single('image'), userProfileController.uploadProfileImage);

/**
 * @swagger
 * /api/users/profile/avatar:
 *   post:
 *     summary: Upload profile avatar (alias for /profile/image)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profile avatar file (max 5MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: Invalid file or upload failed
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 */
// Alias route for frontend compatibility - accepts 'avatar' field name
router.post('/profile/avatar', upload.single('avatar'), userProfileController.uploadProfileImage);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: Delete user account (soft delete)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for account deletion
 *               password:
 *                 type: string
 *                 description: Password for additional verification (optional)
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Password verification failed
 */
router.delete('/account', userProfileController.deleteAccount);

/**
 * @swagger
 * /api/users/terms/accept:
 *   post:
 *     summary: Accept terms and conditions
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Terms accepted successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/terms/accept', userProfileController.acceptTerms);

/**
 * @swagger
 * /api/users/privacy/accept:
 *   post:
 *     summary: Accept privacy policy
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy policy accepted successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/privacy/accept', userProfileController.acceptPrivacy);

/**
 * @swagger
 * /api/users/export:
 *   get:
 *     summary: Export user data
 *     description: Export all user data including profile, reservations, reviews, favorites, and point transactions
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data exported successfully
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
 *                     profile:
 *                       type: object
 *                     reservations:
 *                       type: array
 *                     reviews:
 *                       type: array
 *                     favorites:
 *                       type: array
 *                     pointTransactions:
 *                       type: array
 *                     exportedAt:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/export', userProfileController.exportUserData);

/**
 * @swagger
 * /api/users/profile/send-otp:
 *   post:
 *     summary: Send phone verification OTP
 *     description: Send OTP code to phone number for verification
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number to send OTP to
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       401:
 *         description: Unauthorized
 */
router.post('/profile/send-otp', userProfileController.sendPhoneOTP);

/**
 * @swagger
 * /api/users/profile/verify-phone:
 *   post:
 *     summary: Verify phone number with OTP
 *     description: Verify phone number using the OTP code sent via SMS
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number to verify
 *               otp:
 *                 type: string
 *                 description: OTP code received via SMS
 *     responses:
 *       200:
 *         description: Phone verified successfully
 *       400:
 *         description: Invalid OTP or phone number
 *       401:
 *         description: Unauthorized
 */
router.post('/profile/verify-phone', userProfileController.verifyPhone);

export default router;