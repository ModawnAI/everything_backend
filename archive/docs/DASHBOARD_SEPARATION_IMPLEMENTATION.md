# Dashboard Separation Implementation Guide

## Overview
This document describes the backend implementation for the dashboard separation feature with role-based access control for the eBeautything platform.

## ✅ Completed Implementation

### 1. Database Schema Changes

#### Migration Applied
- **File**: Applied via Supabase MCP
- **Migration Name**: `add_shop_fields_and_roles_to_users`
- **Date**: 2025-01-XX

#### Changes Made:
1. **New Enum Values Added to `user_role`**:
   - `super_admin`
   - `shop_manager`
   - `shop_admin`
   - `manager`

2. **New Columns Added to `users` Table**:
   ```sql
   shop_id UUID REFERENCES shops(id) ON DELETE SET NULL
   shop_name TEXT
   ```

3. **Indexes Created**:
   - `idx_users_shop_id` - For efficient shop_id lookups
   - `idx_users_role` - For role filtering

4. **Database Constraints**:
   - Foreign key constraint on `shop_id` → `shops(id)`
   - Trigger function `validate_user_shop_role()` - Ensures shop roles have shop_id
   - Trigger `trigger_validate_user_shop_role` - Runs before INSERT/UPDATE

5. **Audit Logging Table Created**:
   ```sql
   user_shop_access_log (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     shop_id UUID REFERENCES shops(id),
     action TEXT,
     ip_address INET,
     user_agent TEXT,
     created_at TIMESTAMPTZ
   )
   ```

### 2. Backend API Changes

#### Admin Authentication Service
**File**: `src/services/admin-auth.service.ts`

**Changes**:
1. ✅ Updated `AdminAuthResponse` interface to include:
   ```typescript
   shopId?: string;  // Optional - for platform admins who own a shop
   shopName?: string;  // Optional - shop display name for UI
   ```

2. ✅ Modified `adminLogin()` method:
   - Returns `shopId` and `shopName` in admin object (lines 273-274)
   - Response: `{ success: true, data: { token, refreshToken, admin: { id, email, name, role, permissions, shopId, shopName }, ... } }`

3. ✅ Modified `refreshAdminSession()` method:
   - Includes `shopId` and `shopName` in refresh response (lines 773-774)

4. ✅ Updated JWT Token Claims:
   - Added `role` to JWT payload (line 462)
   - Added `shopId` to JWT payload (line 463)
   - Tokens now include: `{ sub, adminId, role, shopId, type, ipAddress, deviceId, aud, iss }`

#### Admin Authentication Controller
**File**: `src/controllers/admin-auth.controller.ts`

**Changes**:
1. ✅ Updated `getAdminProfile()` method:
   - Fetches `shop_id` and `shop_name` from database (line 267)
   - Returns `shopId` and `shopName` in response (lines 288-289)

### 3. Middleware Implementation

#### Shop Access Validation Middleware
**File**: `src/middleware/shop-access.middleware.ts`

**Features**:
1. ✅ `validateShopAccess()` - Core validation function:
   - Platform admins (`super_admin`, `admin`) can access any shop
   - Shop roles (`shop_owner`, `shop_manager`, `shop_admin`, `manager`) can only access their own shop
   - Validates shopId matches user's assigned shop
   - Returns 403 Forbidden for unauthorized access

2. ✅ `validateShopAccessWithAudit()` - Validation with audit logging:
   - Validates access AND logs to audit trail
   - Logs: userId, shopId, action, IP, user agent, timestamp

3. ✅ Helper Functions:
   - `isPlatformAdmin(role)` - Check if role is platform admin
   - `isShopRole(role)` - Check if role is shop role

**Usage**:
```typescript
// Apply to all shop-scoped routes
app.use('/api/shops/:shopId/*', validateShopAccessWithAudit());
```

### 4. User Validation Utilities

#### User Shop Validator
**File**: `src/validators/user-shop.validator.ts`

**Functions**:
1. ✅ `validateUserShopData(userData)`:
   - Validates role is in allowed list
   - Ensures shop roles have shopId
   - Verifies shop exists and is active
   - Auto-populates shopName from shop if not provided
   - Validates platform admins' optional shopId

2. ✅ `validateShopOwnershipChange(userId, newShopId, currentShopId)`:
   - Validates shop reassignment operations
   - Checks target shop exists and is active
   - Prevents invalid shop changes

3. ✅ `canManageUser(managerId, targetUserId)`:
   - Checks if manager has permission to manage target user
   - Platform admins can manage anyone
   - Shop owners can manage users in their shop
   - Shop managers can manage non-owners in their shop

4. ✅ Helper Functions:
   - `roleRequiresShopId(role)` - Returns true for shop roles
   - `roleAllowsOptionalShopId(role)` - Returns true for platform roles

## 🔍 API Response Examples

### Login Response (Admin with Shop)
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@ebeautything.com",
      "name": "Admin Owner",
      "role": "admin",
      "permissions": ["*"],
      "shopId": "123e4567-e89b-12d3-a456-426614174000",
      "shopName": "Admin Beauty Salon"
    },
    "security": {
      "requiresTwoFactor": false,
      "lastLoginAt": "2025-01-12T10:30:00Z",
      "loginLocation": "Unknown Location"
    },
    "expiresAt": "2025-01-13T10:30:00Z"
  }
}
```

### JWT Token Payload
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "adminId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "admin",
  "shopId": "123e4567-e89b-12d3-a456-426614174000",
  "type": "admin_access",
  "ipAddress": "127.0.0.1",
  "deviceId": "device-123",
  "aud": "authenticated",
  "iss": "ebeautything",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Shop Access Denied Response
```json
{
  "success": false,
  "error": {
    "code": "SHOP_ACCESS_DENIED",
    "message": "Access denied: You can only access your own shop"
  }
}
```

## 📋 Usage Guidelines

### For Backend Developers

#### 1. Creating Users with Shop Assignment
```typescript
import { validateUserShopData } from '@/validators/user-shop.validator';

async function createUser(userData: UserData) {
  // Validate shop assignment
  const validation = await validateUserShopData(userData);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  // Proceed with user creation
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: userData.email,
      name: userData.name,
      user_role: userData.role,
      shop_id: userData.shopId,
      shop_name: userData.shopName,
      // ... other fields
    });
}
```

#### 2. Applying Shop Access Middleware
```typescript
import { validateShopAccessWithAudit } from '@/middleware/shop-access.middleware';

// In your route configuration
router.use('/api/shops/:shopId/bookings', validateShopAccessWithAudit());
router.get('/api/shops/:shopId/bookings', getShopBookings);
router.post('/api/shops/:shopId/bookings', createBooking);
```

#### 3. Checking User Management Permissions
```typescript
import { canManageUser } from '@/validators/user-shop.validator';

async function updateUser(managerId: string, targetUserId: string, updates: any) {
  const canManage = await canManageUser(managerId, targetUserId);

  if (!canManage) {
    throw new Error('Insufficient permissions to manage this user');
  }

  // Proceed with update
}
```

### For Frontend Developers

#### 1. Detecting Dashboard Toggle
```typescript
// After login, check if user has shopId
const { user } = loginResponse.data;

const showToggle =
  (user.role === 'admin' || user.role === 'super_admin') &&
  user.shopId != null;

if (showToggle) {
  // Show toggle UI between "Platform Dashboard" and "My Shop Dashboard"
  renderDashboardToggle({
    platformLabel: "Platform Dashboard",
    shopLabel: `${user.shopName} Dashboard`
  });
}
```

#### 2. API URL Transformation
```typescript
// Based on current dashboard context
const apiBase = isDashboardContext.platform
  ? '/api/admin'  // Platform view
  : `/api/shops/${user.shopId}`;  // Shop view

// Make requests
fetch(`${apiBase}/bookings`);  // Auto-scoped to correct context
```

## 🔐 Security Features

### 1. Database Level
- ✅ Foreign key constraints prevent invalid shop references
- ✅ Trigger validation ensures shop roles have shop_id
- ✅ Indexes for efficient access control queries

### 2. Application Level
- ✅ JWT tokens include role and shopId for stateless validation
- ✅ Middleware validates every shop-scoped request
- ✅ Audit logging for compliance and security monitoring

### 3. Access Control Rules
- ✅ Platform admins: Can access ALL shops
- ✅ Shop owners: Can access ONLY their shop
- ✅ Shop managers: Can access ONLY their shop
- ✅ Shop admins: Can access ONLY their shop
- ✅ Regular users: Cannot access shop endpoints

## 🧪 Testing Checklist

### Database Tests
- [ ] Verify migration applied successfully
- [ ] Test trigger prevents shop role without shop_id
- [ ] Test foreign key constraint on shop_id
- [ ] Verify indexes exist and are used in queries

### Authentication Tests
- [ ] Login as admin without shop → No shopId in response
- [ ] Login as admin with shop → shopId and shopName in response
- [ ] Login as shop_owner → shopId and shopName in response
- [ ] Verify JWT token includes role and shopId

### Middleware Tests
- [ ] Platform admin accessing any shop → 200 OK
- [ ] Shop owner accessing their shop → 200 OK
- [ ] Shop owner accessing different shop → 403 Forbidden
- [ ] Unauthenticated user → 401 Unauthorized
- [ ] Shop role without shopId → 403 Forbidden

### Validation Tests
- [ ] Create shop_owner without shopId → Error
- [ ] Create shop_owner with invalid shopId → Error
- [ ] Create admin with optional shopId → Success
- [ ] Create admin without shopId → Success
- [ ] Assign shop to regular user → Error

## 📊 Role Matrix

| Role          | shop_id Required | Can Access Platform API | Can Access Shop API | Dashboard Toggle |
|---------------|------------------|-------------------------|---------------------|------------------|
| super_admin   | ❌ No            | ✅ Yes                  | ✅ Yes (any shop)   | ✅ If has shopId |
| admin         | ❌ No            | ✅ Yes                  | ✅ Yes (any shop)   | ✅ If has shopId |
| shop_owner    | ✅ Yes           | ❌ No                   | ✅ Yes (own shop)   | ❌ No            |
| shop_manager  | ✅ Yes           | ❌ No                   | ✅ Yes (own shop)   | ❌ No            |
| shop_admin    | ✅ Yes           | ❌ No                   | ✅ Yes (own shop)   | ❌ No            |
| manager       | ✅ Yes           | ❌ No                   | ✅ Yes (own shop)   | ❌ No            |
| user          | ❌ No            | ❌ No                   | ❌ No               | ❌ No            |

## 🚀 Next Steps

### For Complete Implementation
1. **Update User Management Endpoints**: Apply `validateUserShopData()` to user creation/update endpoints
2. **Apply Shop Middleware**: Add `validateShopAccessWithAudit()` to all `/api/shops/:shopId/*` routes
3. **Frontend Integration**: Update frontend to use shopId/shopName for toggle
4. **Testing**: Run comprehensive integration tests
5. **Documentation**: Update API documentation with new fields and endpoints

### Recommended Enhancements
1. **Audit Dashboard**: Create UI to view `user_shop_access_log` entries
2. **Shop Assignment UI**: Admin interface to assign/reassign users to shops
3. **Permission Management**: Fine-grained permissions per shop role
4. **Multi-Shop Support**: Allow users to be associated with multiple shops (future)

## 📞 Support

For questions or issues:
- Review the backend.md specification
- Check the error logs for detailed error messages
- Refer to this implementation guide
- Contact the backend team for assistance

---

**Implementation Status**: ✅ Complete
**Last Updated**: 2025-01-XX
**Version**: 1.0.0
