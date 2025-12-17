# Frontend Profile API Integration Guide

## Issue Identified

**Frontend console shows:**
```javascript
[ProfileEditPage] Initializing form with profile data:
   - Name: undefined
   - Email: undefined
   - Phone: undefined
   - Birth Date: undefined
   - Gender: undefined
   - Booking Preferences: undefined
```

**Backend logs show:**
- ❌ NO `/api/users/profile` requests received
- ❌ NO profile-related requests in last 13+ hours

**Root Cause**: Frontend is NOT calling the backend API, or the call is failing before reaching the backend.

---

## Backend API Specification

### Endpoint
```
GET https://api.e-beautything.com/api/users/profile
```

### Headers Required
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Response Structure

**Status**: `200 OK`

**Body**:
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "265cd37d-da55-4071-aa86-91fc02b5b022",
      "name": "KJ Yoo Updated",
      "email": "kj@journi.city",
      "phoneNumber": null,
      "birthDate": "1990-05-20",
      "gender": "female",
      "profileImageUrl": null,
      "bookingPreferences": {
        "skinType": "dry",
        "allergyInfo": "Peanut allergy test",
        "preferredStylist": "Jane Stylist",
        "specialRequests": "Please use organic products"
      },
      "userRole": "user",
      "userStatus": "active",
      "createdAt": "2025-11-17T11:16:13.851Z",
      "updatedAt": "2025-11-22T08:11:28.562Z"
    },
    "message": "프로필 정보를 성공적으로 조회했습니다."
  }
}
```

**Key Points**:
1. ✅ Profile is nested: `response.data.data.profile`
2. ✅ All keys are in **camelCase** (automatic transformation)
3. ✅ `bookingPreferences` contains the saved preferences
4. ✅ Response includes `success: true` wrapper

---

## Frontend Integration Options

### Option 1: Direct Backend Call (Recommended for Mobile)

```typescript
// Mobile app using direct API call
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.e-beautything.com',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken(); // Get from AsyncStorage/SecureStore
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Fetch profile
async function fetchProfile() {
  try {
    console.log('📤 Fetching profile from backend...');

    const response = await apiClient.get('/api/users/profile');

    console.log('✅ Response:', response.data);

    // Extract profile
    const profile = response.data.data.profile;

    console.log('📋 Profile data:', {
      name: profile.name,
      email: profile.email,
      bookingPreferences: profile.bookingPreferences
    });

    return profile;

  } catch (error) {
    console.error('❌ Failed to fetch profile:', error);

    if (error.response) {
      // Server responded with error
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      // No response from server
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      // Request setup error
      console.error('Error:', error.message);
    }

    throw error;
  }
}
```

### Option 2: Next.js API Proxy (Recommended for Web)

```typescript
// Next.js app using API route proxy

// File: src/app/api/users/me/route.ts
export async function GET(request: Request) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');

    // Call backend
    const response = await fetch('https://api.e-beautything.com/api/users/profile', {
      headers: {
        'Authorization': authHeader || '',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: 'Failed to fetch profile' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Backend returns: { success: true, data: { profile: {...}, message: "..." } }
    // Extract the profile and return it directly
    const profile = data.data?.profile || data.data;

    return Response.json(profile);

  } catch (error) {
    console.error('Profile fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Frontend component
async function loadProfile() {
  try {
    console.log('📤 Fetching profile via Next.js API...');

    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const profile = await response.json();

    console.log('✅ Profile loaded:', profile);

    return profile;

  } catch (error) {
    console.error('❌ Failed to load profile:', error);
    throw error;
  }
}
```

---

## Common Frontend Issues & Solutions

### Issue 1: Getting `undefined` for all fields

**Symptom**:
```javascript
Name: undefined
Email: undefined
BookingPreferences: undefined
```

**Causes**:
1. ❌ No API call being made
2. ❌ API call failing silently
3. ❌ Wrong data extraction path

**Solution**:
```typescript
// ❌ WRONG - direct access
const profile = response.data;

// ✅ CORRECT - extract from nested structure
const profile = response.data.data?.profile || response.data;
```

### Issue 2: No request reaching backend

**Symptom**: Backend logs show no incoming requests

**Causes**:
1. ❌ Missing auth token
2. ❌ CORS error blocking request
3. ❌ Wrong base URL
4. ❌ Network error

**Solution**:
```typescript
// Add detailed logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🌐 API Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      hasAuth: !!config.headers.Authorization
    });
    return config;
  },
  (error) => {
    console.error('❌ Request setup error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API Response error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);
```

### Issue 3: Auth token issues

**Symptom**: 401 Unauthorized errors

**Solution**:
```typescript
// Verify token exists and is valid
const token = await getAuthToken();

if (!token) {
  console.error('❌ No auth token found');
  // Redirect to login
  router.push('/login');
  return;
}

console.log('✅ Auth token:', token.substring(0, 20) + '...');

// Make request with token
const response = await apiClient.get('/api/users/profile', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

---

## Expected Backend Behavior

### When Frontend Calls GET /api/users/profile

**Backend will log**:
```json
{"timestamp":"2025-11-22T...","level":"info","message":"Incoming request","method":"GET","url":"/api/users/profile","ip":"..."}
```

**Backend will respond**:
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "...",
      "name": "KJ Yoo Updated",
      "email": "kj@journi.city",
      "bookingPreferences": {
        "skinType": "dry",
        "allergyInfo": "Peanut allergy test",
        "preferredStylist": "Jane Stylist",
        "specialRequests": "Please use organic products"
      },
      ...
    },
    "message": "프로필 정보를 성공적으로 조회했습니다."
  }
}
```

### If No Request Reaches Backend

**Backend logs**: (empty - no entry)

**This means**:
- ❌ Frontend didn't send the request
- ❌ Request failed before leaving browser
- ❌ Network/CORS error
- ❌ Wrong URL configured

---

## Testing Checklist

### 1. Verify API Call is Made

```typescript
useEffect(() => {
  console.log('🔍 Profile Edit Page Mounted');
  console.log('🔍 Calling fetchProfile...');

  fetchProfile()
    .then(profile => {
      console.log('✅ Profile loaded:', profile);
      setFormData(profile);
    })
    .catch(error => {
      console.error('❌ Profile load failed:', error);
    });
}, []);
```

**Expected Console**:
```
🔍 Profile Edit Page Mounted
🔍 Calling fetchProfile...
📤 Fetching profile from backend...
🌐 API Request: { method: 'get', url: '/api/users/profile', hasAuth: true }
✅ API Response: { status: 200, data: {...} }
✅ Profile loaded: { name: "KJ Yoo Updated", ... }
```

### 2. Verify Backend Receives Request

**Check backend logs**:
```bash
tail -f /home/bitnami/everything_backend/logs/combined.log | grep "users/profile"
```

**Expected**:
```json
{"timestamp":"...","message":"Incoming request","method":"GET","url":"/api/users/profile"}
```

### 3. Verify Response Structure

```typescript
const response = await apiClient.get('/api/users/profile');

console.log('Response structure:', {
  hasSuccess: 'success' in response.data,
  hasData: 'data' in response.data,
  hasProfile: 'profile' in (response.data.data || {}),
  profileKeys: Object.keys(response.data.data?.profile || {})
});
```

**Expected**:
```javascript
{
  hasSuccess: true,
  hasData: true,
  hasProfile: true,
  profileKeys: ['id', 'name', 'email', 'bookingPreferences', ...]
}
```

---

## Summary

### Backend is Working ✅
- ✅ Profile endpoint exists and works
- ✅ Returns data in correct format
- ✅ Booking preferences saved correctly
- ✅ Automatic camelCase transformation

### Frontend Issue ❌
- ❌ No API call being made to backend
- ❌ Profile data not loaded
- ❌ Form initialized with undefined values

### Required Frontend Fix
1. **Add API call** in profile edit page `useEffect`
2. **Add logging** to verify request is made
3. **Extract profile** from `response.data.data.profile`
4. **Handle errors** properly with user feedback

---

**Last Updated**: 2025-11-22
**Backend Status**: ✅ Ready and waiting for requests
**Issue Location**: Frontend - missing API call
