# Frontend Authentication Issue - 401 Unauthorized

## 🐛 Problem

Frontend is getting **401 Unauthorized** errors when calling favorites endpoints:

```
PUT https://api.e-beautything.com/api/shops/22222222-2222-2222-2222-222222222222/favorite 401
GET https://api.e-beautything.com/api/user/favorites/ids 401
```

**Error in console**:
```
[useFavoriteToggle] Error: Failed to toggle favorite: 401
```

---

## 🔍 Root Cause

**Backend logs show**:
```
[AUTH-DEBUG-1] authenticateJWT middleware started {
  hasAuthHeader: false,  // ❌ No Authorization header!
  ...
}
[AUTH-DEBUG-3] Token extracted from header: no
```

**The frontend is NOT sending the Authorization header with requests.**

---

## ✅ Solution

The frontend needs to include the Authorization header with the Bearer token in **ALL** API requests to protected endpoints.

### Required Header Format

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔧 Frontend Fixes

### Fix 1: Axios Interceptor (Recommended)

If using Axios, add an interceptor to automatically attach the token:

```typescript
// src/lib/api-client.ts or similar

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.e-beautything.com/api'
});

// Add request interceptor to attach token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from wherever it's stored
    const token = getAuthToken(); // Your token retrieval function
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper to get token
function getAuthToken(): string | null {
  // Option 1: From localStorage
  return localStorage.getItem('auth_token');
  
  // Option 2: From Supabase
  // const { data } = await supabase.auth.getSession();
  // return data.session?.access_token ?? null;
  
  // Option 3: From cookie
  // return getCookie('auth_token');
}

export default apiClient;
```

---

### Fix 2: Manual Header in Each Request

If not using interceptors, add headers manually:

```typescript
// ❌ Before (Missing auth)
export const getFavoriteIds = () => {
  return apiClient.get('/user/favorites/ids');
};

// ✅ After (With auth)
export const getFavoriteIds = () => {
  const token = getAuthToken();
  return apiClient.get('/user/favorites/ids', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const toggleFavorite = (shopId: string) => {
  const token = getAuthToken();
  return apiClient.put(`/shops/${shopId}/favorite`, {}, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};
```

---

### Fix 3: React Query with Axios

If using React Query:

```typescript
// src/hooks/use-favorites-store.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client'; // With interceptor configured

export const useFavoritesStore = () => {
  return useQuery({
    queryKey: ['favorites', 'ids'],
    queryFn: async () => {
      // Token will be added by interceptor
      const { data } = await apiClient.get('/user/favorites/ids');
      return data.data.favoriteIds;
    },
  });
};

export const useFavoriteToggle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (shopId: string) => {
      // Token will be added by interceptor
      const { data } = await apiClient.put(`/shops/${shopId}/favorite`);
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
};
```

---

### Fix 4: Fetch API

If using fetch instead of axios:

```typescript
const token = getAuthToken();

// GET request
fetch('https://api.e-beautything.com/api/user/favorites/ids', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// PUT request
fetch(`https://api.e-beautything.com/api/shops/${shopId}/favorite`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🔍 Where to Get the Token

### Option 1: Supabase Auth (Recommended)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
```

### Option 2: localStorage

```typescript
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || 
         localStorage.getItem('supabase.auth.token');
}
```

### Option 3: Cookies

```typescript
function getAuthToken(): string | null {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
    ?.split('=')[1] ?? null;
}
```

---

## 🧪 Testing the Fix

### Test 1: Check Headers in Browser

1. Open DevTools (F12)
2. Go to Network tab
3. Trigger a favorites action
4. Click on the request
5. Check **Request Headers** section
6. Should see:
   ```
   Authorization: Bearer eyJhbGc...
   ```

### Test 2: Console Test

```javascript
// In browser console
const token = localStorage.getItem('auth_token'); // Or your token source
console.log('Token:', token ? 'Found ✅' : 'Missing ❌');

// Test request
fetch('https://api.e-beautything.com/api/user/favorites/ids', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

### Expected Results

**With valid token**:
```json
{
  "success": true,
  "data": {
    "favoriteIds": ["id1", "id2"],
    "count": 2
  }
}
```

**With missing token**:
```json
{
  "success": false,
  "error": {
    "code": "MISSING_TOKEN",
    "message": "Missing authorization token"
  }
}
```

**With invalid/expired token**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token"
  }
}
```

---

## 📋 Implementation Checklist

- [ ] Identify where API client is configured
- [ ] Add axios interceptor OR manual headers
- [ ] Implement `getAuthToken()` function
- [ ] Test token retrieval works
- [ ] Test API calls include Authorization header
- [ ] Verify no more 401 errors in console
- [ ] Test favorites functionality end-to-end

---

## 🚨 Common Mistakes

### Mistake 1: Token Not Refreshed
```typescript
// ❌ Wrong - Token cached at app load
const token = getAuthToken();
apiClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${token}`; // Stale token!
});

// ✅ Correct - Token fetched on each request
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken(); // Fresh token each time
  config.headers.Authorization = `Bearer ${token}`;
});
```

### Mistake 2: Async Token Retrieval Not Awaited
```typescript
// ❌ Wrong
apiClient.interceptors.request.use((config) => {
  const token = await getAuthToken(); // Can't await in non-async
});

// ✅ Correct
apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken(); // Properly awaited
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Mistake 3: Token Format
```typescript
// ❌ Wrong formats
Authorization: token
Authorization: "Bearer ${token}"
Authorization: `${token}`

// ✅ Correct format
Authorization: `Bearer ${token}`
```

---

## 🔄 Token Refresh Flow

If tokens expire, implement refresh logic:

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh token
        const newToken = await refreshAuthToken();
        
        // Update header and retry
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        await logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## 📖 Related Issues

**Issue 1**: Duplicate `/api` in URL path
- **Fix**: See `FRONTEND_API_PATH_FIX.md`

**Issue 2**: Missing Authorization header (this document)
- **Fix**: Add axios interceptor or manual headers

**Issue 3**: Token expired
- **Fix**: Implement token refresh flow

---

## 🔗 Backend Verification

The backend is correctly configured and working:

**Test with curl**:
```bash
# Without token (should return 401)
curl https://api.e-beautything.com/api/user/favorites/ids

# With token (should return data)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.e-beautything.com/api/user/favorites/ids
```

**Backend logs confirm**:
```
[AUTH-DEBUG-1] authenticateJWT middleware started {
  hasAuthHeader: false,  // Frontend not sending header
  ...
}
```

---

## 💡 Best Practices

1. **Centralize auth logic**: One `getAuthToken()` function
2. **Use interceptors**: Don't repeat headers in every call
3. **Handle token expiry**: Implement refresh flow
4. **Log auth errors**: Help debug issues
5. **Type safety**: Use TypeScript for token handling

```typescript
// Example centralized auth
export class AuthService {
  private static instance: AuthService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new AuthService();
    }
    return this.instance;
  }
  
  async getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }
  
  async refreshToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.refreshSession();
    return session?.access_token ?? null;
  }
  
  async logout(): Promise<void> {
    await supabase.auth.signOut();
    localStorage.removeItem('auth_token');
  }
}
```

---

**Issue Reported**: November 23, 2025  
**Status**: Frontend fix required  
**Backend**: ✅ Working correctly - requires Authorization header  
**Frontend**: ❌ Not sending Authorization header
