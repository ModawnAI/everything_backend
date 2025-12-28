# Profile Update Issue - Diagnosis Report

## User's Update Request

**Date**: 2025-11-22
**Frontend Logs**:
```javascript
📤 [Profile Edit] Sending update data: {
  "name": "KJ Yoo",
  "bookingPreferences": {
    "skinType": "dry",
    "allergyInfo": "asdf",
    "preferredStylist": "asdf",
    "specialRequests": "asdf"
  },
  "email": "info@e-beautything.com",
  "phoneNumber": "01099343991",
  "gender": "male"
}
```

## What Actually Got Saved

**Database Query Result**:
```
User ID: 265cd37d-da55-4071-aa86-91fc02b5b022
Name: KJ Yoo
Email: kj@journi.city              ❌ NOT updated
Phone: null                         ❌ NOT updated
Gender: female                      ❌ NOT updated
Booking Preferences: {}             ❌ NOT saved
Updated: 2025-11-17T11:16:13        ⚠️ OLD timestamp (5 days ago)
```

## Root Cause Analysis

### Issue #1: Request Never Reached Backend ❌

**Evidence**: Backend logs show NO profile update requests in the last 12+ hours.

**Last Activity**: 2025-11-09 07:52:18 (over 12 hours ago)
**Expected Activity**: Profile update request around current time
**Conclusion**: ❌ Frontend request **NEVER REACHED** the backend server

### Issue #2: Email & Phone Updates Not Allowed ⚠️

**Even if the request reached backend**, these fields would be rejected:

**Controller Code** (`src/controllers/user-profile.controller.ts:148-160`):
```typescript
// Remove fields that aren't allowed in profile updates (require separate verification flows)
if ('email' in updates) {
  delete transformedUpdates.email;
  logger.info('Removed email from profile update (use dedicated email change endpoint)', {
    userId
  });
}
if ('phoneNumber' in updates) {
  delete transformedUpdates.phoneNumber;
  logger.info('Removed phoneNumber from profile update (use dedicated phone change endpoint)', {
    userId
  });
}
```

**Why**: Email and phone number require verification for security reasons and must use dedicated endpoints.

### Issue #3: Gender Field Not Handled

**Status**: The `gender` field is not transformed from camelCase to snake_case, so it would be ignored by the database.

## What Should Have Happened

### Scenario A: Request Reached Backend

If the request had reached the backend:

1. ✅ **Name**: Would be updated to "KJ Yoo"
2. ❌ **Email**: Would be **REJECTED** (logged and removed)
3. ❌ **Phone**: Would be **REJECTED** (logged and removed)
4. ⚠️ **Gender**: Would be **IGNORED** (not transformed to snake_case)
5. ✅ **Booking Preferences**: Would be saved in snake_case format (after our fix)

### Scenario B: Request Never Reached Backend (ACTUAL)

**What happened**:
- ❌ Frontend sent request but it never arrived at backend
- ❌ Network error, auth failure, or wrong endpoint
- ❌ No data changed in database
- ❌ User profile shows old data from 2025-11-17

## Frontend Issues to Investigate

### 1. Check Network Request Status
```javascript
// Frontend should log:
console.log('API request status:', response.status);
console.log('API request success:', response.ok);
```

**Expected Logs**:
```
✅ 200 OK - Success
❌ 400 Bad Request - Validation error
❌ 401 Unauthorized - Auth token expired
❌ 403 Forbidden - Insufficient permissions
❌ 404 Not Found - Wrong endpoint
❌ 500 Internal Server Error - Backend error
```

### 2. Verify Endpoint URL
```javascript
// Check if frontend is calling correct endpoint
PUT https://api.e-beautything.com/api/users/profile
```

**Not**:
```
❌ PUT https://api.e-beautything.com/api/profile
❌ PUT https://api.e-beautything.com/users/profile
❌ POST instead of PUT
```

### 3. Check Auth Token
```javascript
// Frontend should include:
Authorization: Bearer <valid-jwt-token>
```

**Verify**:
- ✅ Token is not expired
- ✅ Token is included in headers
- ✅ Token format is correct

### 4. Check CORS/Network Errors
```javascript
// Frontend console should NOT show:
❌ CORS policy error
❌ Network request failed
❌ ERR_CONNECTION_REFUSED
❌ Timeout error
```

## Backend Status

### What Backend CAN Save
✅ Allowed fields for profile update:
- `name` - User's display name
- `birthDate` - Date of birth
- `profileImageUrl` - Profile image URL (after upload)
- `marketingConsent` - Marketing consent flag
- `bookingPreferences` - Booking preferences object (fixed to save in snake_case)

### What Backend REJECTS
❌ Security-sensitive fields (require verification):
- `email` - Use `/api/users/email/change` endpoint
- `phoneNumber` - Use `/api/users/phone/change` endpoint
- `password` - Use `/api/auth/change-password` endpoint

### What Backend IGNORES
⚠️ Fields not implemented:
- `gender` - Not transformed to snake_case (would need fix)

## Recommended Fixes

### Fix 1: Frontend - Debug Network Request
```typescript
try {
  const response = await apiClient.put('/users/profile', updateData);

  console.log('✅ Profile update successful:', response.data);

} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('❌ Server error:', error.response.status);
    console.error('Error data:', JSON.stringify(error.response.data, null, 2));
  } else if (error.request) {
    // Request sent but no response
    console.error('❌ No response from server');
    console.error('Request:', error.request);
  } else {
    // Error setting up request
    console.error('❌ Request setup error:', error.message);
  }
}
```

### Fix 2: Backend - Add Gender Field Support

**File**: `src/controllers/user-profile.controller.ts`

Add after line 135:
```typescript
if ('gender' in updates) {
  transformedUpdates.gender = updates.gender as string;
}
```

### Fix 3: Frontend - Remove Unsupported Fields

**Don't send these in profile update**:
```typescript
// ❌ REMOVE from profile update request:
const profileUpdate = {
  name: formData.name,
  bookingPreferences: formData.bookingPreferences,
  // DON'T INCLUDE:
  // email: formData.email,          ← Use separate endpoint
  // phoneNumber: formData.phoneNumber, ← Use separate endpoint
};

// Send separately if needed:
if (formData.email !== currentProfile.email) {
  await apiClient.post('/users/email/change', {
    newEmail: formData.email
  });
}

if (formData.phoneNumber !== currentProfile.phoneNumber) {
  await apiClient.post('/users/phone/change', {
    newPhoneNumber: formData.phoneNumber
  });
}
```

## Summary

### Primary Issue
❌ **Frontend request never reached backend** - Network/auth/endpoint issue

### Secondary Issues
❌ **Email/phone updates would be rejected** - Security policy
❌ **Gender field not handled** - Not implemented in backend

### Immediate Action Required
1. **Frontend**: Debug why profile update request isn't reaching backend
2. **Frontend**: Remove email/phoneNumber from profile update request
3. **Frontend**: Use dedicated endpoints for email/phone changes
4. **Backend**: Add gender field transformation (optional enhancement)

### Expected Behavior After Fix
✅ **Name**: Saved correctly
✅ **Booking Preferences**: Saved in snake_case format
⚠️ **Email/Phone**: Require separate verification endpoints
⚠️ **Gender**: Needs backend fix to support

---

**Diagnosed**: 2025-11-22
**Status**: Frontend network issue + backend policy restrictions
**Next Step**: Frontend team to debug network request
