import { Router } from 'express';
import { adminUserManagementController } from '../controllers/admin-user-management.controller';

const router = Router();

/**
 * Admin User Management Routes
 * 
 * Comprehensive user management for admin panel:
 * - Advanced search and filtering
 * - User status management
 * - Bulk actions
 * - User statistics and analytics
 * - Detailed user profiles
 */

/**
 * GET /api/admin/users
 * Get users with advanced search and filtering
 * 
 * Query Parameters:
 * - search: Search in name, email, phone_number
 * - role: Filter by user role (user, shop_owner, admin, influencer)
 * - status: Filter by user status (active, inactive, suspended, deleted)
 * - gender: Filter by gender (male, female, other, prefer_not_to_say)
 * - isInfluencer: Filter by influencer status (true/false)
 * - phoneVerified: Filter by phone verification (true/false)
 * - startDate: Filter by creation date range (ISO date)
 * - endDate: Filter by creation date range (ISO date)
 * - lastLoginStart: Filter by last login date range (ISO date)
 * - lastLoginEnd: Filter by last login date range (ISO date)
 * - hasReferrals: Filter by referral status (true/false)
 * - minPoints: Filter by minimum points
 * - maxPoints: Filter by maximum points
 * - sortBy: Sort field (created_at, name, email, last_login_at, total_points, total_referrals)
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
 *     "users": [
 *       {
 *         "id": "uuid",
 *         "email": "user@example.com",
 *         "phoneNumber": "+82-10-1234-5678",
 *         "phoneVerified": true,
 *         "name": "User Name",
 *         "nickname": "nickname",
 *         "gender": "female",
 *         "birthDate": "1990-01-01",
 *         "userRole": "user",
 *         "userStatus": "active",
 *         "isInfluencer": false,
 *         "influencerQualifiedAt": null,
 *         "socialProvider": "kakao",
 *         "referralCode": "ABC123",
 *         "referredByCode": "XYZ789",
 *         "totalPoints": 1500,
 *         "availablePoints": 1200,
 *         "totalReferrals": 5,
 *         "successfulReferrals": 3,
 *         "lastLoginAt": "2024-01-01T10:00:00Z",
 *         "lastLoginIp": "192.168.1.1",
 *         "termsAcceptedAt": "2024-01-01T00:00:00Z",
 *         "privacyAcceptedAt": "2024-01-01T00:00:00Z",
 *         "marketingConsent": true,
 *         "createdAt": "2024-01-01T00:00:00Z",
 *         "updatedAt": "2024-01-01T10:00:00Z",
 *         "daysSinceLastLogin": 0,
 *         "isActive": true,
 *         "hasCompletedProfile": true
 *       }
 *     ],
 *     "totalCount": 150,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 8,
 *     "filters": { ... }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - IP address validation
 * - Comprehensive audit logging
 * - Rate limiting protection
 */
router.get('/', adminUserManagementController.getUsers);

/**
 * GET /api/admin/users/statistics
 * Get user statistics for admin dashboard
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalUsers": 1500,
 *     "activeUsers": 1200,
 *     "suspendedUsers": 50,
 *     "deletedUsers": 10,
 *     "newUsersThisMonth": 150,
 *     "newUsersThisWeek": 25,
 *     "usersByRole": {
 *       "user": 1200,
 *       "shop_owner": 200,
 *       "admin": 10,
 *       "influencer": 90
 *     },
 *     "usersByStatus": {
 *       "active": 1200,
 *       "inactive": 200,
 *       "suspended": 50,
 *       "deleted": 10
 *     },
 *     "topReferrers": [
 *       {
 *         "id": "uuid",
 *         "name": "Top Referrer",
 *         "email": "referrer@example.com",
 *         "totalReferrals": 25
 *       }
 *     ],
 *     "recentActivity": [
 *       {
 *         "id": "uuid",
 *         "action": "user_suspended",
 *         "userId": "user-uuid",
 *         "userName": "User Name",
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
 */
router.get('/statistics', adminUserManagementController.getUserStatistics);

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 * 
 * Parameters:
 * - id: User UUID
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "phoneNumber": "+82-10-1234-5678",
 *     "phoneVerified": true,
 *     "name": "User Name",
 *     "nickname": "nickname",
 *     "gender": "female",
 *     "birthDate": "1990-01-01",
 *     "userRole": "user",
 *     "userStatus": "active",
 *     "isInfluencer": false,
 *     "influencerQualifiedAt": null,
 *     "socialProvider": "kakao",
 *     "referralCode": "ABC123",
 *     "referredByCode": "XYZ789",
 *     "totalPoints": 1500,
 *     "availablePoints": 1200,
 *     "totalReferrals": 5,
 *     "successfulReferrals": 3,
 *     "lastLoginAt": "2024-01-01T10:00:00Z",
 *     "lastLoginIp": "192.168.1.1",
 *     "termsAcceptedAt": "2024-01-01T00:00:00Z",
 *     "privacyAcceptedAt": "2024-01-01T00:00:00Z",
 *     "marketingConsent": true,
 *     "createdAt": "2024-01-01T00:00:00Z",
 *     "updatedAt": "2024-01-01T10:00:00Z",
 *     "statistics": {
 *       "totalReservations": 25,
 *       "completedReservations": 20,
 *       "totalPointsEarned": 2000,
 *       "totalPointsUsed": 500,
 *       "successfulReferrals": 3,
 *       "completionRate": 80.0
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Comprehensive user data with related statistics
 * - Performance optimized with joins
 */
router.get('/:id', adminUserManagementController.getUserDetails);

/**
 * PUT /api/admin/users/:id/status
 * Update user status
 * 
 * Parameters:
 * - id: User UUID
 * 
 * Request Body:
 * {
 *   "status": "suspended",
 *   "reason": "Violation of terms of service",
 *   "adminNotes": "Multiple complaints received",
 *   "notifyUser": true
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@example.com",
 *       "name": "User Name",
 *       "previousStatus": "active",
 *       "newStatus": "suspended",
 *       "updatedAt": "2024-01-01T10:00:00Z"
 *     },
 *     "action": {
 *       "type": "status_update",
 *       "reason": "Violation of terms of service",
 *       "adminNotes": "Multiple complaints received",
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
 * - Optional user notification
 * - Status history tracking
 */
router.put('/:id/status', adminUserManagementController.updateUserStatus);

/**
 * POST /api/admin/users/bulk-action
 * Perform bulk actions on users
 * 
 * Request Body:
 * {
 *   "userIds": ["uuid1", "uuid2", "uuid3"],
 *   "action": "suspend",
 *   "reason": "Batch suspension for policy violation",
 *   "adminNotes": "Automated bulk action"
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
 *         "userId": "uuid1",
 *         "success": true
 *       },
 *       {
 *         "userId": "uuid2",
 *         "success": false,
 *         "error": "User not found"
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
 * - activate: Activate suspended users
 * - suspend: Suspend active users
 * - delete: Soft delete users (mark as deleted)
 * - export: Export user data (placeholder)
 * 
 * Security Features:
 * - Requires valid admin session
 * - Bulk operation validation
 * - Individual error handling
 * - Comprehensive audit logging
 * - Rate limiting for bulk operations
 */
router.post('/bulk-action', adminUserManagementController.performBulkAction);

export default router; 