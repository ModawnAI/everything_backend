/**
 * Identity Verification Routes
 *
 * PortOne V2 identity verification (본인인증) endpoints
 */

import express from 'express';
import { identityVerificationController } from '../controllers/identity-verification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = express.Router();

/**
 * Rate limiter for identity verification endpoints
 * More restrictive than general API limits
 */
const identityVerificationRateLimit = rateLimit;

/**
 * @swagger
 * /api/identity-verification/prepare:
 *   post:
 *     summary: Prepare identity verification request
 *     description: Prepares PortOne V2 identity verification and returns data needed for frontend SDK
 *     tags:
 *       - Identity Verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identityVerificationId
 *             properties:
 *               identityVerificationId:
 *                 type: string
 *                 description: Unique ID for this verification request
 *                 example: "identity-verification-39ecfa97"
 *               customer:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Customer ID (max 200 chars)
 *                   phoneNumber:
 *                     type: string
 *                     description: Phone number (numbers only, no hyphens)
 *                     example: "01012345678"
 *                   fullName:
 *                     type: string
 *                     description: Full name
 *                   firstName:
 *                     type: string
 *                     description: First name (given name)
 *                   lastName:
 *                     type: string
 *                     description: Last name (family name)
 *               bypass:
 *                 type: object
 *                 description: Provider-specific bypass parameters
 *                 properties:
 *                   danal:
 *                     type: object
 *                     properties:
 *                       IsCarrier:
 *                         type: string
 *                         description: "Carrier restriction (SKT, KTF, LGT, MVNO or combinations with ';')"
 *                         example: "SKT;KTF"
 *                       AGELIMIT:
 *                         type: number
 *                         description: Minimum age requirement
 *                         example: 20
 *                       CPTITLE:
 *                         type: string
 *                         description: Service URL or app name
 *                         example: "www.eBeautything.com"
 *               customData:
 *                 type: object
 *                 description: Custom data to store with verification
 *     responses:
 *       200:
 *         description: Verification prepared successfully
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
 *                     identityVerificationId:
 *                       type: string
 *                     storeId:
 *                       type: string
 *                     channelKey:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/prepare',
  authenticateJWT(),
  identityVerificationRateLimit(),
  identityVerificationController.prepareVerification.bind(identityVerificationController)
);

/**
 * @swagger
 * /api/identity-verification/verify:
 *   post:
 *     summary: Verify identity verification result
 *     description: Verifies the identity verification result from PortOne and retrieves verified customer data
 *     tags:
 *       - Identity Verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identityVerificationId
 *             properties:
 *               identityVerificationId:
 *                 type: string
 *                 description: The identity verification ID
 *                 example: "identity-verification-39ecfa97"
 *     responses:
 *       200:
 *         description: Verification completed successfully
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
 *                     identityVerificationId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [VERIFIED, FAILED, PENDING]
 *                     verifiedCustomer:
 *                       type: object
 *                       properties:
 *                         ci:
 *                           type: string
 *                           description: Connecting Information (연계정보)
 *                         di:
 *                           type: string
 *                           description: Duplication Information (중복가입확인정보)
 *                         name:
 *                           type: string
 *                           description: Verified name
 *                         gender:
 *                           type: string
 *                           enum: [MALE, FEMALE]
 *                         birthDate:
 *                           type: string
 *                           format: date
 *                           description: Birth date (YYYY-MM-DD)
 *                         phoneNumber:
 *                           type: string
 *                           description: Verified phone number
 *                         operator:
 *                           type: string
 *                           description: Mobile carrier
 *                         isForeigner:
 *                           type: boolean
 *                           description: Whether the user is a foreigner
 *                 message:
 *                   type: string
 *       400:
 *         description: Verification failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Verification not found
 */
router.post(
  '/verify',
  authenticateJWT(),
  identityVerificationRateLimit(),
  identityVerificationController.verifyIdentity.bind(identityVerificationController)
);

/**
 * @swagger
 * /api/identity-verification/status/{identityVerificationId}:
 *   get:
 *     summary: Get verification status
 *     description: Get the current status of an identity verification request
 *     tags:
 *       - Identity Verification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identityVerificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The identity verification ID
 *     responses:
 *       200:
 *         description: Status retrieved successfully
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
 *                     exists:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                     verifiedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Verification not found
 */
router.get(
  '/status/:identityVerificationId',
  authenticateJWT(),
  identityVerificationController.getVerificationStatus.bind(identityVerificationController)
);

/**
 * @swagger
 * /api/identity-verification/danal/bypass-params:
 *   post:
 *     summary: Build Danal bypass parameters
 *     description: Helper endpoint to build Danal-specific bypass parameters
 *     tags:
 *       - Identity Verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               IsCarrier:
 *                 type: string
 *                 description: "Carrier restriction (SKT, KTF, LGT, MVNO or combinations)"
 *                 example: "SKT;KTF"
 *               AGELIMIT:
 *                 type: number
 *                 description: Minimum age requirement
 *                 example: 20
 *               CPTITLE:
 *                 type: string
 *                 description: Service URL or app name
 *                 example: "www.eBeautything.com"
 *     responses:
 *       200:
 *         description: Bypass parameters built successfully
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
 *                     bypass:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/danal/bypass-params',
  authenticateJWT(),
  identityVerificationController.buildDanalBypassParams.bind(identityVerificationController)
);

export default router;
