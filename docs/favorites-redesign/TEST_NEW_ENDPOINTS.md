# Testing New Favorites Endpoints - Quick Guide

## Prerequisites

You need a valid authentication token from a logged-in user. You can get this from:

1. **Browser DevTools**:
   - Log in to the app
   - Open DevTools → Application → Local Storage
   - Copy the auth token

2. **Supabase Auth**:
   - Use Supabase client to authenticate
   - Extract the JWT token

---

## Method 1: Quick Shell Test (Recommended)

**File**: `test-favorites-quick.sh`

**Usage**:
```bash
# Set your auth token as environment variable
export TEST_AUTH_TOKEN="eyJhbGc..."

# Run the test script
./test-favorites-quick.sh
```

**What it tests**:
- ✅ GET /api/user/favorites/ids (retrieve favorites)
- ✅ POST /api/user/favorites/batch (add shops)
- ✅ POST /api/user/favorites/batch (remove shops)
- ✅ Edge case: Empty arrays (should fail)
- ✅ Edge case: Batch size limit (should fail)
- ✅ Final state verification

**Output**:
```
🚀 Testing Favorites Endpoints
============================================================

📋 Test 1: GET /api/user/favorites/ids
------------------------------------------------------------
Status: 200
✅ Test 1 PASSED
📊 Current favorites: 5

🔄 Test 2: POST /api/user/favorites/batch (Add shops)
------------------------------------------------------------
Status: 200
✅ Test 2 PASSED
✅ Added: 2 shops

... (more tests)
```

---

## Method 2: TypeScript Test Suite (Comprehensive)

**File**: `test-favorites-endpoints.ts`

**Usage**:
```bash
# Set your auth token
export TEST_AUTH_TOKEN="eyJhbGc..."

# Run with ts-node
npx ts-node test-favorites-endpoints.ts
```

**What it tests**:
- All functionality from Method 1
- Performance testing (5 consecutive requests)
- Detailed error reporting
- Response time analysis

---

## Method 3: Manual cURL Tests

### Test 1: Get Favorite IDs

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.e-beautything.com/api/user/favorites/ids
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "favoriteIds": ["shop-id-1", "shop-id-2"],
    "count": 2,
    "timestamp": "2025-11-23T19:35:44.901Z"
  },
  "message": "Favorite IDs retrieved successfully"
}
```

---

### Test 2: Batch Add Favorites

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "add": ["11111111-1111-1111-1111-111111111111"],
       "remove": []
     }' \
     https://api.e-beautything.com/api/user/favorites/batch
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "added": ["11111111-1111-1111-1111-111111111111"],
    "removed": [],
    "failed": [],
    "favoriteIds": ["11111111-1111-1111-1111-111111111111", "..."],
    "count": 3
  },
  "message": "Batch toggle completed successfully"
}
```

---

### Test 3: Batch Remove Favorites

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "add": [],
       "remove": ["11111111-1111-1111-1111-111111111111"]
     }' \
     https://api.e-beautything.com/api/user/favorites/batch
```

---

### Test 4: Mixed Add/Remove

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "add": ["22222222-2222-2222-2222-222222222222"],
       "remove": ["11111111-1111-1111-1111-111111111111"]
     }' \
     https://api.e-beautything.com/api/user/favorites/batch
```

---

## Common Test Scenarios

### Scenario 1: App Launch (Cold Start)

**Goal**: Verify fast favorites sync on app launch

```bash
# Measure response time
time curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.e-beautything.com/api/user/favorites/ids
```

**Success Criteria**:
- ✅ Response time < 300ms
- ✅ Small payload (< 2KB)
- ✅ All favorite IDs returned

---

### Scenario 2: Offline Sync

**Goal**: Sync queued favorites when coming back online

```bash
# User was offline and queued 3 adds and 2 removes
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "add": ["shop1", "shop2", "shop3"],
       "remove": ["shop4", "shop5"]
     }' \
     https://api.e-beautything.com/api/user/favorites/batch
```

**Success Criteria**:
- ✅ All operations processed in single request
- ✅ Returns updated favorites list
- ✅ Failed operations reported clearly

---

### Scenario 3: Rate Limit Testing

**Goal**: Verify rate limiting works

```bash
# Make 201 requests rapidly (should get rate limited)
for i in {1..201}; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
       https://api.e-beautything.com/api/user/favorites/ids &
done
wait
```

**Success Criteria**:
- ✅ First 200 requests succeed
- ✅ 201st request returns 429 (Too Many Requests)

---

## Error Cases to Test

### Error 1: Missing Auth Token

```bash
curl https://api.e-beautything.com/api/user/favorites/ids
```

**Expected**: 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "MISSING_TOKEN",
    "message": "Missing authorization token"
  }
}
```

---

### Error 2: Empty Arrays

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"add": [], "remove": []}' \
     https://api.e-beautything.com/api/user/favorites/batch
```

**Expected**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "At least one shop ID must be provided in add or remove"
  }
}
```

---

### Error 3: Batch Size Exceeded

```bash
# Create array with 51 items (max is 50)
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"add": ["id1", "id2", ... "id51"], "remove": []}' \
     https://api.e-beautything.com/api/user/favorites/batch
```

**Expected**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Batch size cannot exceed 50 operations"
  }
}
```

---

### Error 4: Invalid Shop ID (Inactive)

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "add": ["99999999-9999-9999-9999-999999999999"],
       "remove": []
     }' \
     https://api.e-beautything.com/api/user/favorites/batch
```

**Expected**: 200 OK (partial success)
```json
{
  "success": true,
  "data": {
    "added": [],
    "removed": [],
    "failed": [
      {
        "shopId": "99999999-9999-9999-9999-999999999999",
        "error": "Shop not found"
      }
    ],
    "favoriteIds": [...],
    "count": 5
  }
}
```

---

## Performance Benchmarks

### Expected Response Times

| Endpoint | Cold Start | Warm (Cached) | Target |
|----------|-----------|---------------|---------|
| GET /api/user/favorites/ids | < 200ms | < 50ms | < 100ms |
| POST /api/user/favorites/batch | < 300ms | < 150ms | < 300ms |

### Payload Sizes

| Endpoint | Payload Size | Previous | Reduction |
|----------|-------------|----------|-----------|
| GET /favorites/ids | ~1KB | ~50KB | 98% |
| POST /favorites/batch | ~2-5KB | N/A | New |

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Invalid or expired token

**Solution**:
1. Get fresh token from app
2. Verify token format: `Bearer <token>`
3. Check token hasn't expired (usually 1 hour)

---

### Issue: Slow Response Times

**Cause**: Database or cache issues

**Solution**:
1. Check Redis is running: `/opt/bitnami/redis/bin/redis-cli ping`
2. Verify database connection
3. Check server logs: `pm2 logs ebeautything-backend`

---

### Issue: Rate Limited

**Cause**: Exceeded rate limits

**Solution**:
1. Wait 15 minutes for window to reset
2. Reduce request frequency
3. Use batch operations instead of individual calls

---

## Next Steps

After verifying backend endpoints work:

1. **Frontend Implementation**:
   - Create global favorites store hook
   - Update FavoriteButton component
   - Update Home and Favorites pages

2. **Integration Testing**:
   - Test cross-page sync
   - Verify optimistic updates
   - Test offline support

3. **Performance Testing**:
   - Measure actual payload sizes
   - Test with large favorites lists (100+)
   - Verify caching behavior

---

## Quick Reference

**Endpoints**:
```
GET  /api/user/favorites/ids    - Get lightweight favorites list
POST /api/user/favorites/batch  - Batch add/remove favorites
```

**Rate Limits**:
- GET: 200 requests / 15 minutes
- POST: 50 requests / 15 minutes

**Max Batch Size**: 50 operations

**Auth Required**: Yes (JWT Bearer token)

**Documentation**: https://api.e-beautything.com/api-docs

---

**For detailed implementation**: See `FAVORITES_BACKEND_IMPLEMENTATION_COMPLETE.md`

**For frontend guide**: See `FAVORITES_REDESIGN_MOBILE_OPTIMIZED.md`
