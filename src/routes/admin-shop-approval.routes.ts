import { Router } from 'express';
import { adminShopApprovalController } from '../controllers/admin-shop-approval.controller';

const router = Router();

/**
 * Admin Shop Approval Routes
 * 
 * Comprehensive shop approval and verification workflows:
 * - Shop listing with advanced filtering
 * - Individual and bulk approval/rejection
 * - Verification statistics and analytics
 * - Detailed shop approval information
 * - Business license validation
 * - Admin review and approval process
 */

/**
 * GET /api/admin/shops/approval
 * Get shops for approval with advanced filtering
 * 
 * Query Parameters:
 * - status: Filter by shop status (active, inactive, pending_approval, suspended, deleted)
 * - verificationStatus: Filter by verification status (pending, verified, rejected)
 * - category: Filter by service category (nail, eyelash, waxing, eyebrow_tattoo, hair)
 * - search: Search in name, description, address
 * - startDate: Filter by creation date range (ISO date)
 * - endDate: Filter by creation date range (ISO date)
 * - hasBusinessLicense: Filter by business license status (true/false)
 * - isFeatured: Filter by featured status (true/false)
 * - sortBy: Sort field (created_at, name, verification_status, total_bookings)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "shops": [
 *       {
 *         "id": "uuid",
 *         "name": "Beauty Salon",
 *         "description": "Professional beauty services",
 *         "phoneNumber": "+82-10-1234-5678",
 *         "email": "salon@example.com",
 *         "address": "123 Main St, Seoul",
 *         "detailedAddress": "Building A, Floor 2",
 *         "postalCode": "12345",
 *         "latitude": 37.5665,
 *         "longitude": 126.9780,
 *         "shopType": "partnered",
 *         "shopStatus": "pending_approval",
 *         "verificationStatus": "pending",
 *         "businessLicenseNumber": "1234567890",
 *         "businessLicenseImageUrl": "https://example.com/license.jpg",
 *         "mainCategory": "nail",
 *         "subCategories": ["eyelash", "waxing"],
 *         "operatingHours": { "monday": "09:00-18:00" },
 *         "paymentMethods": ["card", "kakao_pay"],
 *         "kakaoChannelUrl": "https://pf.kakao.com/example",
 *         "totalBookings": 150,
 *         "partnershipStartedAt": null,
 *         "featuredUntil": null,
 *         "isFeatured": false,
 *         "commissionRate": 15.0,
 *         "createdAt": "2024-01-01T00:00:00Z",
 *         "updatedAt": "2024-01-01T00:00:00Z",
 *         "owner": {
 *           "id": "uuid",
 *           "name": "Owner Name",
 *           "email": "owner@example.com",
 *           "phoneNumber": "+82-10-1234-5678",
 *           "userStatus": "active"
 *         },
 *         "daysSinceSubmission": 5,
 *         "isUrgent": false,
 *         "hasCompleteDocuments": true
 *       }
 *     ],
 *     "totalCount": 25,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 2,
 *     "filters": { ... }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - IP address validation
 * - Comprehensive audit logging
 * - Rate limiting protection
 * - Document completeness analysis
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: GET /
 *     description: GET endpoint for /
 *     tags: [Shops]
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
router.get('/', adminShopApprovalController.getShopsForApproval);

/**
 * GET /api/admin/shops/approval/statistics
 * Get shop verification statistics for admin dashboard
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalShops": 500,
 *     "pendingShops": 25,
 *     "approvedShops": 400,
 *     "rejectedShops": 50,
 *     "verifiedShops": 375,
 *     "newShopsThisMonth": 45,
 *     "newShopsThisWeek": 8,
 *     "shopsByCategory": {
 *       "nail": 200,
 *       "eyelash": 150,
 *       "waxing": 100,
 *       "eyebrow_tattoo": 30,
 *       "hair": 20
 *     },
 *     "shopsByStatus": {
 *       "active": 375,
 *       "inactive": 100,
 *       "pending_approval": 25
 *     },
 *     "shopsByVerificationStatus": {
 *       "pending": 25,
 *       "verified": 400,
 *       "rejected": 50
 *     },
 *     "averageApprovalTime": 3.5,
 *     "topCategories": [
 *       {
 *         "category": "nail",
 *         "count": 200,
 *         "percentage": 40.0
 *       }
 *     ],
 *     "recentApprovals": [
 *       {
 *         "id": "uuid",
 *         "shopName": "Beauty Salon",
 *         "action": "approve",
 *         "adminName": "Admin User",
 *         "timestamp": "2024-01-01T10:00:00Z"
 *       }
 *     ]
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Real-time data aggregation
 * - Performance optimized queries
 * - Approval time tracking
 */

/**
 * @swagger
 * /statistics:
 *   get:
 *     summary: GET /statistics
 *     description: GET endpoint for /statistics
 *     tags: [Shops]
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
router.get('/statistics', adminShopApprovalController.getShopVerificationStatistics);

/**
 * PUT /api/admin/shops/:id/approval
 * Approve or reject a shop
 * 
 * Parameters:
 * - id: Shop UUID
 * 
 * Request Body:
 * {
 *   "action": "approve",
 *   "reason": "All documents verified and requirements met",
 *   "adminNotes": "Business license verified with government database",
 *   "verificationNotes": "Phone number and email confirmed",
 *   "notifyOwner": true,
 *   "autoActivate": true
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "shop": {
 *       "id": "uuid",
 *       "name": "Beauty Salon",
 *       "previousStatus": "pending_approval",
 *       "newStatus": "active",
 *       "previousVerificationStatus": "pending",
 *       "newVerificationStatus": "verified",
 *       "updatedAt": "2024-01-01T10:00:00Z"
 *     },
 *     "action": {
 *       "type": "approval",
 *       "reason": "All documents verified and requirements met",
 *       "adminNotes": "Business license verified with government database",
 *       "verificationNotes": "Phone number and email confirmed",
 *       "performedBy": "admin-uuid",
 *       "performedAt": "2024-01-01T10:00:00Z"
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Status change validation
 * - Comprehensive audit logging
 * - Optional owner notification
 * - Verification history tracking
 * - Auto-activation option
 */

/**
 * @swagger
 * /:id:
 *   put:
 *     summary: PUT /:id
 *     description: PUT endpoint for /:id
 *     tags: [Shops]
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
router.put('/:id', adminShopApprovalController.processShopApproval);

/**
 * GET /api/admin/shops/:id/approval/details
 * Get detailed shop approval information
 * 
 * Parameters:
 * - id: Shop UUID
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "Beauty Salon",
 *     "description": "Professional beauty services",
 *     "phoneNumber": "+82-10-1234-5678",
 *     "email": "salon@example.com",
 *     "address": "123 Main St, Seoul",
 *     "detailedAddress": "Building A, Floor 2",
 *     "postalCode": "12345",
 *     "latitude": 37.5665,
 *     "longitude": 126.9780,
 *     "shopType": "partnered",
 *     "shopStatus": "pending_approval",
 *     "verificationStatus": "pending",
 *     "businessLicenseNumber": "1234567890",
 *     "businessLicenseImageUrl": "https://example.com/license.jpg",
 *     "mainCategory": "nail",
 *     "subCategories": ["eyelash", "waxing"],
 *     "operatingHours": { "monday": "09:00-18:00" },
 *     "paymentMethods": ["card", "kakao_pay"],
 *     "kakaoChannelUrl": "https://pf.kakao.com/example",
 *     "totalBookings": 150,
 *     "partnershipStartedAt": null,
 *     "featuredUntil": null,
 *     "isFeatured": false,
 *     "commissionRate": 15.0,
 *     "createdAt": "2024-01-01T00:00:00Z",
 *     "updatedAt": "2024-01-01T00:00:00Z",
 *     "owner": {
 *       "id": "uuid",
 *       "name": "Owner Name",
 *       "email": "owner@example.com",
 *       "phoneNumber": "+82-10-1234-5678",
 *       "userStatus": "active",
 *       "joinedAt": "2023-12-01T00:00:00Z"
 *     },
 *     "services": [
 *       {
 *         "id": "uuid",
 *         "name": "Manicure",
 *         "category": "nail",
 *         "priceMin": 15000,
 *         "priceMax": 25000,
 *         "isAvailable": true
 *       }
 *     ],
 *     "images": [
 *       {
 *         "id": "uuid",
 *         "imageUrl": "https://example.com/shop1.jpg",
 *         "altText": "Shop interior",
 *         "isPrimary": true,
 *         "displayOrder": 1
 *       }
 *     ],
 *     "verificationHistory": [
 *       {
 *         "id": "uuid",
 *         "action": "approve",
 *         "reason": "All requirements met",
 *         "adminNotes": "Documents verified",
 *         "verificationNotes": "Phone confirmed",
 *         "reviewedBy": "admin-uuid",
 *         "adminName": "Admin User",
 *         "adminEmail": "admin@example.com",
 *         "reviewedAt": "2024-01-01T10:00:00Z",
 *         "createdAt": "2024-01-01T10:00:00Z"
 *       }
 *     ],
 *     "approvalAnalysis": {
 *       "documentCompleteness": 85.7,
 *       "completedDocuments": ["business_license_number", "name", "address", "main_category", "phone_number"],
 *       "missingDocuments": ["business_license_image_url"],
 *       "daysSinceSubmission": 5,
 *       "isUrgent": false,
 *       "hasCompleteDocuments": true,
 *       "recommendation": "Request business license documentation"
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Comprehensive shop data with related information
 * - Document completeness analysis
 * - Approval recommendation engine
 * - Performance optimized with joins
 */

/**
 * @swagger
 * /:id/details:
 *   get:
 *     summary: GET /:id/details
 *     description: GET endpoint for /:id/details
 *     tags: [Shops]
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
router.get('/:id/details', adminShopApprovalController.getShopApprovalDetails);

/**
 * POST /api/admin/shops/bulk-approval
 * Perform bulk approval/rejection actions
 * 
 * Request Body:
 * {
 *   "shopIds": ["uuid1", "uuid2", "uuid3"],
 *   "action": "approve",
 *   "reason": "Batch approval for complete documentation",
 *   "adminNotes": "All shops have submitted required documents",
 *   "autoActivate": true
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       {
 *         "shopId": "uuid1",
 *         "success": true
 *       },
 *       {
 *         "shopId": "uuid2",
 *         "success": false,
 *         "error": "Shop not found"
 *       }
 *     ],
 *     "summary": {
 *       "total": 3,
 *       "successful": 2,
 *       "failed": 1
 *     }
 *   }
 * }
 * 
 * Available Actions:
 * - approve: Approve shops with complete documentation
 * - reject: Reject shops with insufficient documentation
 * 
 * Security Features:
 * - Requires valid admin session
 * - Bulk operation validation
 * - Individual error handling
 * - Comprehensive audit logging
 * - Rate limiting for bulk operations
 * - Auto-activation option
 */

/**
 * @swagger
 * /bulk-approval:
 *   post:
 *     summary: POST /bulk-approval
 *     description: POST endpoint for /bulk-approval
 *     tags: [Shops]
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
router.post('/bulk-approval', adminShopApprovalController.performBulkApproval);

export default router; 