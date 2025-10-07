/**
 * Comprehensive Admin User Management Test
 * Tests all admin APIs for managing ALL USERS in the system
 * (Regular users, shop owners, influencers, etc. - managed by admins)
 */

import { runAgentOrchestrator } from '../agent-orchestrator';
import { logger } from '../utils/logger';

const adminUserManagementTestPrompt = `
Execute a comprehensive, systematic test of ALL admin APIs for managing USERS in the eBeautything platform.

**SCOPE**: Test admin's ability to manage ALL types of users:
- Regular users
- Shop owners
- Influencers
- Other admins (with proper permission checks)

## Test Methodology
Test EVERY endpoint one by one, methodically and thoroughly. For each endpoint:
1. Test with valid data
2. Test with invalid/edge cases
3. Validate response structure
4. Verify database changes using Supabase MCP
5. Check audit logging
6. Capture screenshots of frontend if applicable

## API Endpoints to Test (13 Total)

### 1. GET /api/admin/users
**Purpose**: Get users with advanced search and filtering
**Tests to perform**:
- Get all users (no filters)
- Search by email keyword
- Filter by role (user, shop_owner, admin, influencer)
- Filter by status (active, inactive, suspended, deleted)
- Filter by gender
- Filter by isInfluencer
- Filter by phone verification status
- Filter by date ranges (created_at, last_login_at)
- Filter by points range
- Test pagination (page 1, page 2)
- Test sorting (by name, email, created_at, points)
- Test combined filters
- Validate database results using Supabase MCP: \`SELECT * FROM users LIMIT 10\`

### 2. GET /api/admin/users/statistics
**Purpose**: Get user statistics for dashboard
**Tests to perform**:
- Fetch overall statistics
- Verify totalUsers count
- Verify usersByRole breakdown
- Verify usersByStatus breakdown
- Verify topReferrers list
- Cross-check counts with database:
  - \`SELECT user_role, COUNT(*) FROM users GROUP BY user_role\`
  - \`SELECT user_status, COUNT(*) FROM users GROUP BY user_status\`

### 3. GET /api/admin/users/activity
**Purpose**: Get user activity feed
**Tests to perform**:
- Get all recent activities
- Filter by specific userId
- Filter by activityTypes (login, logout, status_change, role_change)
- Filter by severity (low, medium, high, critical)
- Filter by date range
- Test pagination
- Verify activities exist in database

### 4. GET /api/admin/users/:id
**Purpose**: Get detailed user information
**Tests to perform**:
- Get details for a valid user ID
- Test with invalid user ID (should return 404)
- Verify all user fields are returned
- Verify statistics are calculated correctly
- Cross-check with database: \`SELECT * FROM users WHERE id = '<user-id>'\`

### 5. PUT /api/admin/users/:id/status
**Purpose**: Update user status
**Tests to perform**:
- Change user from active to suspended
- Change user from suspended to active
- Change user to inactive
- Test with reason and adminNotes
- Test with notifyUser flag
- Verify status change in database: \`SELECT user_status FROM users WHERE id = '<user-id>'\`
- Verify audit log was created
- Test unauthorized status changes
- Test invalid status values

### 6. PUT /api/admin/users/:id/role
**Purpose**: Update user role
**Tests to perform**:
- Change user role from user to shop_owner
- Change role from shop_owner to influencer
- Test privilege escalation prevention (non-admin trying to create admin)
- Test with reason and adminNotes
- Verify role change in database: \`SELECT user_role FROM users WHERE id = '<user-id>'\`
- Verify audit log was created
- Test invalid role values

### 7. POST /api/admin/users/bulk-action
**Purpose**: Perform bulk actions on users
**Tests to perform**:
- Bulk activate multiple suspended users
- Bulk suspend multiple active users
- Bulk delete users (soft delete)
- Bulk change roles for multiple users
- Test transaction safety (useTransaction: true)
- Test batch processing (different batch sizes: 10, 50, 100)
- Test partial failures (mix of valid and invalid user IDs)
- Verify all changes in database
- Verify transaction rollback on failure

### 8. GET /api/admin/users/audit/search
**Purpose**: Search audit logs
**Tests to perform**:
- Search all audit logs
- Filter by userId
- Filter by adminId
- Filter by actionTypes
- Filter by targetTypes
- Filter by categories (user_management, shop_management)
- Filter by severity levels
- Filter by date range
- Search by searchTerm (text search)
- Filter by ipAddress
- Filter by sessionId
- Test pagination
- Verify aggregations are returned

### 9. GET /api/admin/users/:userId/audit
**Purpose**: Get audit logs for specific user
**Tests to perform**:
- Get all audit logs for a user
- Filter by actionTypes
- Filter by severity
- Filter by date range
- Test pagination
- Verify logs match database

### 10. POST /api/admin/users/audit/export
**Purpose**: Export audit logs
**Tests to perform**:
- Export as CSV format
- Export as JSON format
- Export with metadata included
- Export with aggregations included
- Export with various filters applied
- Verify download URL is generated
- Verify file size and record count
- Test export limits (max 10,000 records)

### 11. GET /api/admin/users/analytics
**Purpose**: Get comprehensive user analytics
**Tests to perform**:
- Get analytics with default parameters
- Filter by date range
- Filter by user segments (power_users, inactive_users, etc.)
- Filter by roles
- Filter by platforms
- Filter by countries
- Include/exclude different analytics sections:
  - Growth trends
  - Activity patterns
  - Behavioral insights
  - Retention metrics
  - Geographic data
- Verify all metrics are calculated correctly
- Cross-check summary stats with database

### 12. GET /api/admin/users/search/advanced
**Purpose**: Advanced user search with segments
**Tests to perform**:
- Search by email (partial match)
- Search by name (partial match)
- Filter by user segments
- Filter by activity level (high, medium, low, inactive)
- Filter by registration date range
- Filter by last activity date range
- Filter by referral count range
- Filter by lifetime value range
- Filter by platform
- Filter by country
- Test various sort options
- Test pagination
- Verify activity scores and segment tags

## Frontend Testing

### Admin User Management UI (http://localhost:3000/admin/users)
**Tests to perform**:
1. Navigate to users page
2. Take screenshot of user list
3. Test search functionality in UI
4. Test filter dropdowns
5. Test user detail modal/page
6. Test status change action
7. Test role change action
8. Test bulk selection
9. Test bulk actions
10. Verify UI updates after API changes
11. Test pagination controls
12. Test sort column headers

## Database Validation (Supabase MCP)

For EACH API operation, validate using Supabase MCP:
- Query users table to verify changes
- Query audit_logs table to verify logging
- Query admin_activity_logs for admin actions
- Verify data integrity constraints
- Check cascade behaviors

## Test Execution Order
1. **Setup**: Login as admin, get auth token
2. **Read Operations**: Test all GET endpoints first (statistics, activity, details, search)
3. **Single Modifications**: Test individual PUT endpoints (status, role)
4. **Bulk Operations**: Test bulk-action endpoint
5. **Audit & Analytics**: Test audit search, export, analytics
6. **Frontend Integration**: Test admin UI with browser automation
7. **Cleanup**: Revert any test changes

## Expected Deliverables

Provide a detailed test report with:
1. **Summary**: Total endpoints tested, pass/fail count
2. **Detailed Results**: For each of the 13 endpoints:
   - Request details
   - Response status and data
   - Database validation results
   - Any issues or anomalies
3. **Performance Metrics**: Response times for each endpoint
4. **Database Integrity**: Confirmation all data is correct
5. **Audit Trail**: Verification all actions are logged
6. **Frontend Screenshots**: UI validation screenshots
7. **Recommendations**: Any issues found or improvements suggested

Execute these tests systematically, one endpoint at a time, with full validation at each step.
`;

export async function runAdminUserManagementTest() {
  logger.info('🧪 Starting Comprehensive Admin User Management Test');

  try {
    const result = await runAgentOrchestrator(adminUserManagementTestPrompt);

    if (result.success) {
      logger.info('✅ Admin User Management Test completed successfully');
      return result;
    } else {
      logger.error('❌ Admin User Management Test failed', { error: result.error });
      throw new Error(result.error);
    }
  } catch (error: any) {
    logger.error('❌ Fatal error in Admin User Management Test', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Run test (ESM compatible)
runAdminUserManagementTest()
  .then(() => {
    logger.info('Test execution completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test execution failed', { error: error.message });
    process.exit(1);
  });
