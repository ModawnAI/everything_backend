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
 * GET /api/admin/users/activity
 * Get user activity feed for admin monitoring
 * 
 * Query Parameters:
 * - userId: Filter activities for specific user ID
 * - activityTypes: Comma-separated activity types (login,logout,status_change,role_change,admin_action)
 * - severity: Comma-separated severity levels (low,medium,high,critical)
 * - startDate: Filter activities from this date (ISO date)
 * - endDate: Filter activities until this date (ISO date)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "activities": [
 *       {
 *         "id": "admin_uuid_timestamp",
 *         "userId": "user-uuid",
 *         "userName": "User Name",
 *         "userEmail": "user@example.com",
 *         "activityType": "status_change",
 *         "description": "Admin John updated User Name's status",
 *         "metadata": {
 *           "previousStatus": "active",
 *           "newStatus": "suspended",
 *           "reason": "Policy violation",
 *           "adminId": "admin-uuid",
 *           "adminName": "Admin John"
 *         },
 *         "ipAddress": "192.168.1.1",
 *         "userAgent": "Mozilla/5.0...",
 *         "timestamp": "2024-01-01T10:00:00Z",
 *         "severity": "high"
 *       }
 *     ],
 *     "totalCount": 150,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 3,
 *     "filters": { ... }
 *   }
 * }
 * 
 * Activity Types:
 * - login: User login events
 * - logout: User logout events
 * - status_change: User status modifications
 * - role_change: User role modifications
 * - admin_action: Administrative actions
 * - profile_update: Profile modifications
 * - reservation_update: Reservation changes
 * - payment_update: Payment events
 * 
 * Severity Levels:
 * - low: Regular activities (login, logout)
 * - medium: Moderate changes (profile updates, role changes)
 * - high: Important changes (suspensions, deletions)
 * - critical: Critical actions (admin role assignments)
 * 
 * Security Features:
 * - Requires valid admin session
 * - Real-time activity tracking
 * - Comprehensive filtering options
 * - Audit logging of activity views
 */
router.get('/activity', adminUserManagementController.getUserActivity);

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
 * PUT /api/admin/users/:id/role
 * Update user role
 * 
 * Parameters:
 * - id: User UUID
 * 
 * Request Body:
 * {
 *   "role": "shop_owner",
 *   "reason": "User requested shop owner privileges",
 *   "adminNotes": "Verified business registration documents"
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
 *       "previousRole": "user",
 *       "newRole": "shop_owner",
 *       "updatedAt": "2024-01-01T10:00:00Z"
 *     },
 *     "action": {
 *       "type": "role_update",
 *       "reason": "User requested shop owner privileges",
 *       "adminNotes": "Verified business registration documents",
 *       "performedBy": "admin-uuid",
 *       "performedAt": "2024-01-01T10:00:00Z"
 *     }
 *   }
 * }
 * 
 * Valid Roles:
 * - user: Regular user (default)
 * - shop_owner: Shop owner with business management privileges
 * - admin: Administrator with full system access
 * - influencer: Influencer with special content privileges
 * 
 * Security Features:
 * - Requires valid admin session
 * - Privilege escalation prevention (only admins can create admins)
 * - Self-role modification prevention for admins
 * - Role change validation
 * - Comprehensive audit logging
 * - Role history tracking
 */
router.put('/:id/role', adminUserManagementController.updateUserRole);

/**
 * POST /api/admin/users/bulk-action
 * Perform enhanced bulk actions on users with transaction safety
 * 
 * Request Body:
 * {
 *   "userIds": ["uuid1", "uuid2", "uuid3"],
 *   "action": "suspend",
 *   "reason": "Batch suspension for policy violation",
 *   "adminNotes": "Automated bulk action",
 *   "targetRole": "user",
 *   "useTransaction": true,
 *   "batchSize": 50
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
 *         "success": true,
 *         "previousValue": "active",
 *         "newValue": "suspended",
 *         "timestamp": "2024-01-01T10:00:00Z"
 *       },
 *       {
 *         "userId": "uuid2",
 *         "success": false,
 *         "error": "User not found",
 *         "timestamp": "2024-01-01T10:00:01Z"
 *       }
 *     ],
 *     "summary": {
 *       "total": 3,
 *       "successful": 2,
 *       "failed": 1,
 *       "skipped": 0,
 *       "processed": 3
 *     },
 *     "progress": {
 *       "currentBatch": 1,
 *       "totalBatches": 1,
 *       "completedItems": 3,
 *       "remainingItems": 0
 *     },
 *     "transactionId": "bulk_admin123_1640995200000",
 *     "rollbackAvailable": true,
 *     "executionTime": 1250
 *   }
 * }
 * 
 * Available Actions:
 * - activate: Activate suspended users
 * - suspend: Suspend active users
 * - delete: Soft delete users (mark as deleted)
 * - export: Export user data (placeholder)
 * - change_role: Change user roles (requires targetRole)
 * 
 * Request Parameters:
 * - userIds: Array of user UUIDs (required)
 * - action: Action to perform (required)
 * - reason: Reason for the action (optional)
 * - adminNotes: Additional admin notes (optional)
 * - targetRole: Target role for change_role action (required for change_role)
 * - useTransaction: Enable transaction safety (default: true)
 * - batchSize: Process in batches of this size (default: 50, max: 100)
 * 
 * Transaction Safety Features:
 * - Atomic batch processing with rollback on failure
 * - Progress tracking for large operations
 * - Detailed error reporting per user
 * - Transaction ID for audit trails
 * - Rollback availability indication
 * 
 * Security Features:
 * - Requires valid admin session
 * - Privilege escalation prevention
 * - Individual user validation
 * - Comprehensive audit logging
 * - Real-time activity broadcasting
 * - Rate limiting for bulk operations
 */
router.post('/bulk-action', adminUserManagementController.performBulkAction);

/**
 * GET /api/admin/audit/search
 * Search audit logs with comprehensive filtering
 * 
 * Query Parameters:
 * - userId: Filter by specific user ID
 * - adminId: Filter by specific admin ID
 * - actionTypes: Comma-separated list of action types
 * - targetTypes: Comma-separated list of target types
 * - categories: Comma-separated list of categories (user_management, shop_management, etc.)
 * - severity: Comma-separated list of severity levels (low, medium, high, critical)
 * - startDate: Start date for filtering (ISO string)
 * - endDate: End date for filtering (ISO string)
 * - searchTerm: Text search across admin names, action types, reasons, etc.
 * - ipAddress: Filter by IP address
 * - sessionId: Filter by session ID
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "auditLogs": [
 *       {
 *         "id": "uuid",
 *         "adminId": "uuid",
 *         "adminName": "Admin Name",
 *         "adminEmail": "admin@example.com",
 *         "actionType": "user_status_update",
 *         "targetType": "user",
 *         "targetId": "uuid",
 *         "targetName": "User Name",
 *         "reason": "Policy violation",
 *         "metadata": {...},
 *         "ipAddress": "192.168.1.1",
 *         "userAgent": "Mozilla/5.0...",
 *         "sessionId": "session_id",
 *         "timestamp": "2024-01-01T10:00:00Z",
 *         "severity": "high",
 *         "category": "user_management"
 *       }
 *     ],
 *     "totalCount": 150,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 3,
 *     "filters": {...},
 *     "aggregations": {
 *       "actionTypeCounts": {...},
 *       "adminCounts": {...},
 *       "categoryCounts": {...},
 *       "severityCounts": {...}
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Comprehensive audit trail logging
 * - IP address and session tracking
 * - Rate limiting for audit access
 */
router.get('/audit/search', adminUserManagementController.searchAuditLogs);

/**
 * GET /api/admin/users/:userId/audit
 * Get audit logs for a specific user
 * 
 * Path Parameters:
 * - userId: User ID to get audit logs for
 * 
 * Query Parameters:
 * - actionTypes: Comma-separated list of action types
 * - targetTypes: Comma-separated list of target types
 * - categories: Comma-separated list of categories
 * - severity: Comma-separated list of severity levels
 * - startDate: Start date for filtering (ISO string)
 * - endDate: End date for filtering (ISO string)
 * - searchTerm: Text search
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * Same format as audit search endpoint
 * 
 * Security Features:
 * - Requires valid admin session
 * - User-specific audit access logging
 * - Comprehensive filtering and pagination
 */
router.get('/:userId/audit', adminUserManagementController.getUserAuditLogs);

/**
 * POST /api/admin/audit/export
 * Export audit logs in various formats
 * 
 * Request Body:
 * {
 *   "format": "csv",
 *   "includeMetadata": true,
 *   "includeAggregations": false,
 *   "userId": "uuid",
 *   "adminId": "uuid",
 *   "actionTypes": ["user_status_update", "user_role_update"],
 *   "categories": ["user_management"],
 *   "severity": ["high", "critical"],
 *   "startDate": "2024-01-01T00:00:00Z",
 *   "endDate": "2024-01-31T23:59:59Z",
 *   "limit": 1000
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "downloadUrl": "/api/admin/audit/export/export_123_1640995200000",
 *     "fileName": "audit_logs_2024-01-01_export_123_1640995200000.csv",
 *     "fileSize": 1024000,
 *     "recordCount": 500,
 *     "exportId": "export_123_1640995200000",
 *     "expiresAt": "2024-01-02T10:00:00Z"
 *   }
 * }
 * 
 * Supported Formats:
 * - csv: Comma-separated values with headers
 * - json: JSON format with optional aggregations
 * - pdf: PDF report (placeholder - returns JSON for now)
 * 
 * Security Features:
 * - Requires valid admin session
 * - Export action logging
 * - File expiration for security
 * - Maximum record limits (10,000 per export)
 */
router.post('/audit/export', adminUserManagementController.exportAuditLogs);

/**
 * GET /api/admin/users/analytics
 * Get comprehensive user analytics for admin dashboard
 * 
 * Query Parameters:
 * - startDate: Start date for analytics period (ISO string)
 * - endDate: End date for analytics period (ISO string)
 * - userSegments: Comma-separated list of user segments (power_users, inactive_users, etc.)
 * - roles: Comma-separated list of user roles to filter by
 * - statuses: Comma-separated list of user statuses to filter by
 * - platforms: Comma-separated list of platforms to filter by
 * - countries: Comma-separated list of countries to filter by
 * - includeGrowthTrends: Include growth trend analysis (default: true)
 * - includeActivityPatterns: Include activity pattern analysis (default: true)
 * - includeBehavioralInsights: Include behavioral insights (default: true)
 * - includeRetentionMetrics: Include retention and lifecycle metrics (default: true)
 * - includeGeographicData: Include geographic distribution data (default: true)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "totalUsers": 5000,
 *       "activeUsers": 3500,
 *       "newUsersToday": 25,
 *       "newUsersThisWeek": 180,
 *       "newUsersThisMonth": 750,
 *       "churnRate": 2.5,
 *       "averageLifetimeValue": 150.75,
 *       "userGrowthRate": 15.2
 *     },
 *     "growthTrends": [...],
 *     "activityPatterns": [...],
 *     "behavioralInsights": [...],
 *     "lifecycleMetrics": [...],
 *     "geographicDistribution": [...],
 *     "platformUsage": [...],
 *     "userSegments": {
 *       "powerUsers": 250,
 *       "inactiveUsers": 800,
 *       "highReferralUsers": 150,
 *       "newUsers": 180,
 *       "churnedUsers": 120
 *     },
 *     "realTimeMetrics": {
 *       "activeNow": 45,
 *       "sessionsToday": 1200,
 *       "averageSessionDuration": 25,
 *       "topActions": [...]
 *     },
 *     "filters": {...},
 *     "generatedAt": "2024-01-01T10:00:00Z"
 *   }
 * }
 * 
 * Analytics Features:
 * - Comprehensive user growth and retention analysis
 * - Real-time activity monitoring and insights
 * - User segmentation and behavioral analysis
 * - Geographic and platform distribution analytics
 * - Customizable date ranges and filtering options
 * - Performance metrics and KPI tracking
 * 
 * Security Features:
 * - Requires valid admin session
 * - Analytics access logging
 * - IP address and session tracking
 * - Rate limiting for analytics access
 */
router.get('/analytics', adminUserManagementController.getUserAnalytics);

/**
 * GET /api/admin/users/search/advanced
 * Advanced user search with segments and analytics
 * 
 * Query Parameters:
 * - email: Filter by email (partial match)
 * - name: Filter by name (partial match)
 * - role: Comma-separated list of user roles
 * - status: Comma-separated list of user statuses
 * - segments: Comma-separated list of user segments (power_users, inactive_users, etc.)
 * - activityLevel: Filter by activity level (high, medium, low, inactive)
 * - registrationStartDate: Filter by registration start date
 * - registrationEndDate: Filter by registration end date
 * - lastActivityStartDate: Filter by last activity start date
 * - lastActivityEndDate: Filter by last activity end date
 * - referralMin: Minimum referral count
 * - referralMax: Maximum referral count
 * - lifetimeValueMin: Minimum lifetime value
 * - lifetimeValueMax: Maximum lifetime value
 * - platform: Comma-separated list of platforms
 * - country: Comma-separated list of countries
 * - sortBy: Sort field (created_at, last_activity, referral_count, lifetime_value, activity_score)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
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
 *         "name": "User Name",
 *         "user_role": "user",
 *         "user_status": "active",
 *         "created_at": "2024-01-01T10:00:00Z",
 *         "last_activity_at": "2024-01-15T14:30:00Z",
 *         "total_referrals": 5,
 *         "phone_number": "+1234567890",
 *         "profile_image_url": "https://...",
 *         "activityScore": 85,
 *         "segmentTags": ["power_user", "high_referral"]
 *       }
 *     ],
 *     "totalCount": 150,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 3,
 *     "filters": {...}
 *   }
 * }
 * 
 * Advanced Search Features:
 * - Multi-dimensional filtering with user segments
 * - Activity level and engagement scoring
 * - Date range filtering for registration and activity
 * - Referral count and lifetime value filtering
 * - Geographic and platform filtering
 * - Flexible sorting options
 * - Enhanced user data with analytics
 * 
 * User Segments:
 * - power_users: High activity and referral users
 * - inactive_users: Users with no recent activity
 * - high_referral_users: Users with many referrals
 * - new_users: Recently registered users
 * - churned_users: Deleted or suspended users
 * 
 * Security Features:
 * - Requires valid admin session
 * - Advanced search logging
 * - Comprehensive audit trail
 * - Rate limiting for search operations
 */
router.get('/search/advanced', adminUserManagementController.advancedUserSearch);

export default router; 