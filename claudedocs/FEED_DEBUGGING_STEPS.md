# Feed Posts Display Debugging Guide

## Problem
Created feed posts are not displaying in the frontend despite successful API responses (200/201).

## Debug Logging Added
Added extensive console logging to `/Users/kjyoo/ebeautything-admin/src/app/dashboard/my-shop/feed/page.tsx`:

```typescript
- 🔄 [Feed] loadPosts called - Shows user info and parameters
- 📡 [Feed] Calling FeedService.getShopOwnerPosts - Shows API call parameters
- ✅ [Feed] Posts loaded successfully - Shows full API response structure
- 📊 [Feed] State updated - Shows final state after setPosts()
```

## Manual Testing Steps

### 1. Open Browser Developer Tools
```
1. Navigate to http://localhost:3000
2. Open Chrome DevTools (Cmd+Option+I or F12)
3. Go to Console tab
4. Clear console (Cmd+K)
```

### 2. Login as Shop Owner
```
Email: shopowner@test.com
Password: Test1234!
```

### 3. Navigate to Feed Page
```
1. Click "Feed" in sidebar navigation
2. URL should be: /dashboard/my-shop/feed
3. Check console logs for:
   - "🔄 [Feed] loadPosts called"
   - Look at userId and userShopId values
```

### 4. Check What Data is Returned
Look for this log in console:
```
✅ [Feed] Posts loaded successfully
  fullResult: {success: true, data: {...}}
  postsCount: X
  pagination: {...}
```

### 5. Key Things to Verify

#### A. User Object
```
🔄 [Feed] loadPosts called
{
  hasUser: true/false,
  userId: "should be a UUID",
  userShopId: "should be a UUID or undefined",
  page: 1,
  limit: 12
}
```

**If `userId` is null/undefined**: Auth context issue - user not properly loaded

#### B. API Response Structure
```
✅ [Feed] Posts loaded successfully
{
  fullResult: {
    success: true,
    data: {
      posts: [...],
      pagination: {...}
    }
  },
  postsCount: X
}
```

**If `postsCount` is 0 but API returned 200**:
- Backend is returning empty array
- User might not have created any posts yet
- author_id filter might be wrong

**If `fullResult` structure is different**:
- Response unwrapping issue in apiService
- Backend response format mismatch

#### C. State Update
```
📊 [Feed] State updated
{
  postsLength: X,
  totalPages: Y,
  totalPosts: Z
}
```

**If this log appears but UI shows empty**:
- React rendering issue
- Posts array is in state but not rendering
- Check React DevTools for actual state

## Expected Behavior (Working Scenario)

```
1. 🔄 [Feed] loadPosts called
   { hasUser: true, userId: "uuid-xxx", page: 1, limit: 12 }

2. 📡 [Feed] Calling FeedService.getShopOwnerPosts
   { userId: "uuid-xxx", page: 1, limit: 12 }

3. ✅ [Feed] Posts loaded successfully
   { postsCount: 1, pagination: { total: 1, totalPages: 1 } }

4. 📊 [Feed] State updated
   { postsLength: 1, totalPages: 1, totalPosts: 1 }

5. UI displays: 1 post card in grid
```

## Common Issues & Solutions

### Issue 1: No userId
**Symptom**: `userId: undefined` in logs
**Cause**: Auth context not initialized
**Solution**: Check AuthContext provider wraps the page

### Issue 2: API Returns Empty Array
**Symptom**: `postsCount: 0` but API call succeeds
**Cause**: No posts match the author_id filter
**Solutions**:
- Create a new post via /dashboard/my-shop/feed/create
- Check backend: `curl http://localhost:3001/api/feed/posts -H "Authorization: Bearer TOKEN"`
- Verify user.id matches the author_id of created posts

### Issue 3: Response Structure Mismatch
**Symptom**: `result.data.posts` is undefined
**Cause**: apiService unwrapping or backend response format
**Solution**: Check the actual `fullResult` structure in logs

### Issue 4: Posts in State But Not Rendering
**Symptom**: `postsLength: X` but UI shows empty
**Cause**: React rendering issue or CSS hiding elements
**Solutions**:
- Check React DevTools - inspect Posts component state
- Check for CSS `display: none` or `visibility: hidden`
- Look for JavaScript errors in console
- Check if posts array has correct structure

## Backend API Verification

Test backend directly:
```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"shopowner@test.com","password":"Test1234!"}' \
  | jq -r '.token')

# 2. Get user info to see user ID
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. List all posts (no filter)
curl -s 'http://localhost:3001/api/feed/posts?page=1&limit=20' \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. List posts by specific author (replace USER_ID)
curl -s 'http://localhost:3001/api/feed/posts?author_id=USER_ID&page=1&limit=20' \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Next Steps After Logging Analysis

Based on what the logs show, the issue will be one of:

1. **Auth Issue**: Fix useAuth() context or user loading
2. **Empty Data**: User needs to create posts or fix author_id
3. **Response Format**: Fix apiService unwrapping or FeedService
4. **Rendering Issue**: Fix React component or CSS

Once identified, refer to the appropriate fix section.

## Test Date
2025-10-24

## Files Modified
- `/Users/kjyoo/ebeautything-admin/src/app/dashboard/my-shop/feed/page.tsx` (added debug logging)
