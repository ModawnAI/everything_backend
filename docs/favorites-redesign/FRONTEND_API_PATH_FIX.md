# Frontend API Path Fix - Duplicate /api Issue

## 🐛 Issue

The frontend is making requests to:
```
❌ https://api.e-beautything.com/api/api/user/favorites/ids
```

This causes a **401 Unauthorized** error because the path is incorrect.

The correct path should be:
```
✅ https://api.e-beautything.com/api/user/favorites/ids
```

---

## 🔍 Root Cause

The frontend API client is adding `/api` twice:
1. Once in the `baseURL` configuration
2. Once in the endpoint path

**Example of incorrect configuration**:
```typescript
// api-client.ts or similar
const apiClient = axios.create({
  baseURL: 'https://api.e-beautything.com/api'  // Base URL includes /api
});

// favorites-api.ts or hooks file
apiClient.get('/api/user/favorites/ids')  // Path also includes /api
// Result: /api + /api/user/favorites/ids = /api/api/user/favorites/ids ❌
```

---

## ✅ Solution

Choose **ONE** of these solutions:

### Solution 1: Remove `/api` from endpoint calls (Recommended)

**Change endpoint calls to remove the `/api` prefix:**

```typescript
// ❌ Before (Wrong)
export const getFavoriteIds = () => {
  return apiClient.get('/api/user/favorites/ids');
};

export const batchToggleFavorites = (data: { add: string[], remove: string[] }) => {
  return apiClient.post('/api/user/favorites/batch', data);
};

// ✅ After (Correct)
export const getFavoriteIds = () => {
  return apiClient.get('/user/favorites/ids');
};

export const batchToggleFavorites = (data: { add: string[], remove: string[] }) => {
  return apiClient.post('/user/favorites/batch', data);
};
```

**This is recommended because**:
- Other API calls likely already use this pattern
- Consistent with existing codebase
- Minimal changes needed

---

### Solution 2: Remove `/api` from baseURL

**Change the API client configuration:**

```typescript
// ❌ Before (if this is the issue)
const apiClient = axios.create({
  baseURL: 'https://api.e-beautything.com/api'
});

// ✅ After
const apiClient = axios.create({
  baseURL: 'https://api.e-beautything.com'
});

// Keep full paths in endpoint calls:
apiClient.get('/api/user/favorites/ids')  // Now correct
```

**Warning**: This requires updating **ALL** existing API calls in the codebase.

---

## 🔍 How to Find the Issue

### Step 1: Find the API client configuration

Search for where axios or fetch is configured:

```bash
# In the frontend project
grep -r "baseURL" src/
grep -r "api.e-beautything.com" src/
grep -r "axios.create" src/
```

### Step 2: Find the favorites API calls

Search for the new endpoint calls:

```bash
grep -r "favorites/ids" src/
grep -r "favorites/batch" src/
```

### Step 3: Check for duplicate /api

Look for patterns like:
```typescript
// Pattern that causes the issue
baseURL: 'https://api.e-beautything.com/api'
// + 
apiClient.get('/api/...')
```

---

## 📝 Example Files to Check

Common locations where this might be:

1. **API Client Setup**:
   - `src/lib/api-client.ts`
   - `src/utils/axios.ts`
   - `src/config/api.ts`
   - `src/services/api.ts`

2. **Favorites API Calls**:
   - `src/api/favorites.ts`
   - `src/services/favorites.ts`
   - `src/hooks/use-favorites.ts`
   - `src/hooks/use-favorites-store.ts`

3. **Environment Config**:
   - `.env`
   - `.env.local`
   - `next.config.js` (if using Next.js)

---

## 🧪 Testing the Fix

After making changes, verify the correct URL is being called:

### In Browser DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Trigger a favorites action
4. Check the request URL in the Network tab
5. Should see: `https://api.e-beautything.com/api/user/favorites/ids` ✅

### Quick Test in Console
```javascript
// In browser console
fetch('https://api.e-beautything.com/api/user/favorites/ids', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(console.log)
```

Expected response (with valid token):
```json
{
  "success": true,
  "data": {
    "favoriteIds": ["id1", "id2", ...],
    "count": 5,
    "timestamp": "2025-11-23T19:51:11.202Z"
  },
  "message": "Favorite IDs retrieved successfully"
}
```

---

## 📋 Checklist

After fixing:
- [ ] Verify baseURL configuration
- [ ] Check endpoint paths don't start with `/api` (if baseURL includes `/api`)
- [ ] Test GET /user/favorites/ids
- [ ] Test POST /user/favorites/batch
- [ ] Check browser Network tab shows correct URL
- [ ] Verify no 401 errors in console
- [ ] Test favorites functionality works end-to-end

---

## 🔗 Related

**Backend is correct**: The backend routes are properly configured and working.

**Verified**:
```bash
curl https://api.e-beautything.com/api/user/favorites/ids
# Returns: {"success":false,"error":{"code":"MISSING_TOKEN",...}}
# This is correct - 401 because no auth token provided
```

**Backend Routes**:
- `src/routes/favorites.routes.ts:408` - GET `/user/favorites/ids`
- `src/routes/favorites.routes.ts:473` - POST `/user/favorites/batch`

These are registered under the `/api` prefix in the main app.

---

## 💡 Prevention

To prevent this in the future:

1. **Use a constants file**:
```typescript
// src/constants/api-endpoints.ts
export const API_ENDPOINTS = {
  FAVORITES_IDS: '/user/favorites/ids',
  FAVORITES_BATCH: '/user/favorites/batch',
  // ... other endpoints
};

// Usage:
apiClient.get(API_ENDPOINTS.FAVORITES_IDS);
```

2. **Add TypeScript types**:
```typescript
type ApiEndpoint = '/user/favorites/ids' | '/user/favorites/batch';

const get = (endpoint: ApiEndpoint) => apiClient.get(endpoint);
```

3. **Add automated tests**:
```typescript
describe('API Client', () => {
  it('should not duplicate /api in URL', () => {
    const url = buildUrl('/user/favorites/ids');
    expect(url).toBe('https://api.e-beautything.com/api/user/favorites/ids');
    expect(url).not.toContain('/api/api/');
  });
});
```

---

**Issue Reported**: November 23, 2025  
**Status**: Frontend fix required  
**Backend**: ✅ Working correctly
