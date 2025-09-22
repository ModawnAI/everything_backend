import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.middleware';
import { shopContactMethodsController } from '../controllers/shop-contact-methods.controller';
import Joi from 'joi';

const router = Router();

/**
 * Validation middleware for contact methods request body
 */
const validateContactMethodsBody = (req: any, res: any, next: any) => {
  const schema = Joi.object({
    contactMethods: Joi.array().items(
      Joi.object({
        method_type: Joi.string().valid(
          'phone',
          'email',
          'kakao_channel',
          'instagram',
          'facebook',
          'website',
          'other'
        ).required(),
        value: Joi.string().required(),
        description: Joi.string().max(255).optional(),
        is_primary: Joi.boolean().optional(),
        display_order: Joi.number().integer().min(0).optional(),
        is_active: Joi.boolean().optional()
      })
    ).min(0).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.details[0].message
    });
  }
  next();
};

/**
 * Validation middleware for contact method ID parameter
 */
const validateContactMethodId = (req: any, res: any, next: any) => {
  const schema = Joi.object({
    contactMethodId: Joi.string().uuid().required()
  });

  const { error } = schema.validate(req.params);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid contact method ID format'
    });
  }
  next();
};

/**
 * Rate limiting configuration
 */
const contactMethodsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many contact methods requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const updateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 update requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many contact methods update requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ContactMethod:
 *       type: object
 *       required:
 *         - method_type
 *         - value
 *       properties:
 *         method_type:
 *           type: string
 *           enum: [phone, email, kakao_channel, instagram, facebook, website, other]
 *           description: Type of contact method
 *         value:
 *           type: string
 *           description: The contact information (phone number, email, URL, etc.)
 *         description:
 *           type: string
 *           maxLength: 255
 *           description: Optional description for the contact method
 *         is_primary:
 *           type: boolean
 *           description: Whether this is the primary contact method for its type
 *         display_order:
 *           type: integer
 *           minimum: 0
 *           description: Order in which contact methods should be displayed
 *         is_active:
 *           type: boolean
 *           description: Whether the contact method is currently active
 *     
 *     ShopContactMethod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the contact method
 *         shop_id:
 *           type: string
 *           format: uuid
 *           description: ID of the shop this contact method belongs to
 *         method_type:
 *           type: string
 *           enum: [phone, email, kakao_channel, instagram, facebook, website, other]
 *           description: Type of contact method
 *         value:
 *           type: string
 *           description: The contact information
 *         description:
 *           type: string
 *           description: Optional description for the contact method
 *         is_primary:
 *           type: boolean
 *           description: Whether this is the primary contact method for its type
 *         display_order:
 *           type: integer
 *           description: Display order
 *         is_active:
 *           type: boolean
 *           description: Whether the contact method is currently active
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the contact method was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: When the contact method was last updated
 *     
 *     ContactMethodsUpdateRequest:
 *       type: object
 *       required:
 *         - contactMethods
 *       properties:
 *         contactMethods:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ContactMethod'
 *           description: Array of contact methods to update
 *     
 *     ContactMethodsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the request was successful
 *         message:
 *           type: string
 *           description: Success or error message
 *         data:
 *           type: object
 *           properties:
 *             contactMethods:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShopContactMethod'
 *               description: Array of contact methods
 */

/**
 * @swagger
 * tags:
 *   name: Shop Contact Methods
 *   description: API endpoints for managing shop contact methods
 */

/**
 * @swagger
 * /api/shop/contact-methods:
 *   put:
 *     summary: Update shop contact methods
 *     description: Update all contact methods for a shop. This replaces existing contact methods with the provided ones.
 *     tags: [Shop Contact Methods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactMethodsUpdateRequest'
 *           examples:
 *             basic_example:
 *               summary: Basic contact methods update
 *               value:
 *                 contactMethods:
 *                   - method_type: "phone"
 *                     value: "+821012345678"
 *                     description: "Main business phone"
 *                     is_primary: true
 *                     display_order: 1
 *                     is_active: true
 *                   - method_type: "email"
 *                     value: "contact@shop.com"
 *                     description: "Customer service email"
 *                     is_primary: true
 *                     display_order: 2
 *                     is_active: true
 *                   - method_type: "kakao_channel"
 *                     value: "https://pf.kakao.com/_abc123"
 *                     description: "KakaoTalk customer service"
 *                     is_primary: false
 *                     display_order: 3
 *                     is_active: true
 *             social_media_example:
 *               summary: Social media contact methods
 *               value:
 *                 contactMethods:
 *                   - method_type: "instagram"
 *                     value: "https://instagram.com/shopname"
 *                     description: "Follow us on Instagram"
 *                     is_primary: true
 *                     display_order: 1
 *                     is_active: true
 *                   - method_type: "facebook"
 *                     value: "https://facebook.com/shopname"
 *                     description: "Like our Facebook page"
 *                     is_primary: false
 *                     display_order: 2
 *                     is_active: true
 *                   - method_type: "website"
 *                     value: "https://www.shopname.com"
 *                     description: "Visit our website"
 *                     is_primary: true
 *                     display_order: 3
 *                     is_active: true
 *     responses:
 *       200:
 *         description: Contact methods updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactMethodsResponse'
 *             examples:
 *               success_response:
 *                 summary: Successful update
 *                 value:
 *                   success: true
 *                   message: "Shop contact methods updated successfully"
 *                   data:
 *                     contactMethods:
 *                       - id: "123e4567-e89b-12d3-a456-426614174000"
 *                         shop_id: "987fcdeb-51a2-43d1-b789-123456789abc"
 *                         method_type: "phone"
 *                         value: "+821012345678"
 *                         description: "Main business phone"
 *                         is_primary: true
 *                         display_order: 1
 *                         is_active: true
 *                         created_at: "2024-01-20T10:30:00Z"
 *                         updated_at: "2024-01-20T10:30:00Z"
 *       400:
 *         description: Invalid input or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Authentication required
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.put(
  '/contact-methods',
  authenticateToken,
  updateRateLimit,
  validateContactMethodsBody,
  shopContactMethodsController.updateShopContactMethods
);

/**
 * @swagger
 * /api/shop/contact-methods:
 *   get:
 *     summary: Get shop contact methods
 *     description: Retrieve all contact methods for a shop
 *     tags: [Shop Contact Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact methods retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactMethodsResponse'
 *       401:
 *         description: Unauthorized - Authentication required
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get(
  '/contact-methods',
  authenticateToken,
  contactMethodsRateLimit,
  shopContactMethodsController.getShopContactMethods
);

/**
 * @swagger
 * /api/shop/contact-methods/{contactMethodId}:
 *   delete:
 *     summary: Delete a specific contact method
 *     description: Delete a specific contact method by its ID
 *     tags: [Shop Contact Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactMethodId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the contact method to delete
 *     responses:
 *       200:
 *         description: Contact method deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid contact method ID
 *       401:
 *         description: Unauthorized - Authentication required
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/contact-methods/:contactMethodId',
  authenticateToken,
  contactMethodsRateLimit,
  validateContactMethodId,
  shopContactMethodsController.deleteShopContactMethod
);

export default router;

