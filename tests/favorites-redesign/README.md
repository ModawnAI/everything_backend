# Favorites Redesign - Test Suite

This folder contains test scripts for the new favorites endpoints.

---

## 📋 Test Files

### 1. test-favorites-quick.sh (Shell Script)
**Type**: Bash/Shell script  
**Purpose**: Quick testing without compilation  
**Best for**: Fast verification, CI/CD pipelines

**Usage**:
```bash
# Set auth token from browser or Supabase
export TEST_AUTH_TOKEN="eyJhbGc..."

# Run the test
cd /home/bitnami/everything_backend
./tests/favorites-redesign/test-favorites-quick.sh
```

**What it tests**:
- ✅ GET /api/user/favorites/ids (retrieve favorites)
- ✅ POST /api/user/favorites/batch (add shops)
- ✅ POST /api/user/favorites/batch (remove shops)
- ✅ POST /api/user/favorites/batch (mixed add/remove)
- ✅ Edge case: Empty arrays (should fail with 400)
- ✅ Edge case: Batch size limit >50 (should fail with 400)
- ✅ Edge case: Invalid data types (should fail with 400)
- ✅ Final state verification

**Output**:
- Pass/fail status for each test
- HTTP status codes
- Response summaries
- Performance metrics

---

### 2. test-favorites-endpoints.ts (TypeScript)
**Type**: TypeScript/Node.js  
**Purpose**: Comprehensive test suite with detailed reporting  
**Best for**: Development, debugging, performance analysis

**Usage**:
```bash
# Set auth token
export TEST_AUTH_TOKEN="eyJhbGc..."

# Run with ts-node
cd /home/bitnami/everything_backend
npx ts-node tests/favorites-redesign/test-favorites-endpoints.ts
```

**What it tests**:
- All tests from shell script
- **Performance testing**: 5 consecutive requests with timing
- **Detailed error reporting**: Full error objects and stack traces
- **Response validation**: Validates response structure

**Additional Features**:
- Response time analysis (avg, min, max)
- Performance benchmarks
- Type-safe interfaces
- Detailed logging

---

## 🚀 Quick Start

### Method 1: Quick Shell Test (Recommended for verification)
```bash
export TEST_AUTH_TOKEN="your-token-here"
./tests/favorites-redesign/test-favorites-quick.sh
```

### Method 2: TypeScript Test (Recommended for development)
```bash
export TEST_AUTH_TOKEN="your-token-here"
npx ts-node tests/favorites-redesign/test-favorites-endpoints.ts
```

### Method 3: Manual cURL (For specific endpoint testing)
```bash
# Test GET endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.e-beautything.com/api/user/favorites/ids

# Test POST endpoint
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"add":["shop-id-1"],"remove":[]}' \
     https://api.e-beautything.com/api/user/favorites/batch
```

---

## 🔑 Getting Auth Token

### From Browser (Easiest)
1. Log in to the app: https://ebeautything-app.vercel.app
2. Open DevTools (F12)
3. Go to: Application → Local Storage
4. Copy the Supabase auth token
5. Use as: `export TEST_AUTH_TOKEN="<copied-token>"`

### From Supabase CLI
```bash
# Login to Supabase
npx supabase login

# Get user session
npx supabase db query --sql "SELECT auth.jwt();"
```

---

## 📊 Expected Results

### Successful Tests
```
🚀 Testing Favorites Endpoints
============================================================

📋 Test 1: GET /api/user/favorites/ids
------------------------------------------------------------
Status: 200
✅ Test 1 PASSED
📊 Current favorites: 5
📝 Sample IDs: shop-id-1, shop-id-2, shop-id-3, ...

🔄 Test 2: POST /api/user/favorites/batch (Add shops)
------------------------------------------------------------
Status: 200
✅ Test 2 PASSED
✅ Added: 2 shops

... (more tests)

============================================================
✅ All tests completed!
============================================================
```

### Failed Auth (No Token)
```
❌ Error: TEST_AUTH_TOKEN environment variable is required
Usage: TEST_AUTH_TOKEN='your-bearer-token' ./test-favorites-quick.sh
```

### Failed Request (Invalid Token)
```
Status: 401
{
  "success": false,
  "error": {
    "code": "MISSING_TOKEN",
    "message": "Missing authorization token"
  }
}
```

---

## 🧪 Test Coverage

### Endpoints Tested
- ✅ `GET /api/user/favorites/ids`
- ✅ `POST /api/user/favorites/batch`

### Test Scenarios
1. **Happy Path**:
   - Get favorites list
   - Add new favorites
   - Remove existing favorites
   - Mixed add/remove operations

2. **Edge Cases**:
   - Empty arrays (validation error)
   - Batch size >50 (validation error)
   - Invalid data types (validation error)
   - Non-existent shop IDs (partial success)
   - Inactive shop IDs (partial success)

3. **Performance**:
   - Response time measurement
   - Multiple consecutive requests
   - Cache performance

4. **Error Handling**:
   - Missing auth token
   - Invalid auth token
   - Rate limiting
   - Validation errors

---

## 📈 Performance Benchmarks

### Expected Response Times
| Endpoint | Cold Start | Warm (Cached) | Target |
|----------|-----------|---------------|---------|
| GET /api/user/favorites/ids | < 200ms | < 50ms | < 100ms |
| POST /api/user/favorites/batch | < 300ms | < 150ms | < 300ms |

### Payload Sizes
| Endpoint | Payload Size | Previous | Reduction |
|----------|-------------|----------|-----------|
| GET /favorites/ids | ~1KB | ~50KB | 98% |
| POST /favorites/batch | ~2-5KB | N/A | New endpoint |

---

## 🐛 Troubleshooting

### Issue: "TEST_AUTH_TOKEN is required"
**Solution**: Export your auth token before running tests
```bash
export TEST_AUTH_TOKEN="eyJhbGc..."
```

### Issue: All tests return 401
**Cause**: Invalid or expired token  
**Solution**: Get a fresh token from the browser or Supabase

### Issue: "jq: command not found" (Shell script)
**Solution**: Install jq for JSON parsing
```bash
# Debian/Ubuntu
sudo apt-get install jq

# macOS
brew install jq
```

### Issue: Tests fail with network errors
**Solution**: 
- Check backend is running: `pm2 status ebeautything-backend`
- Verify API is accessible: `curl https://api.e-beautything.com/health`
- Check firewall/network settings

---

## 🔗 Related Documentation

**Complete Test Guide**: `/docs/favorites-redesign/TEST_NEW_ENDPOINTS.md`  
**Implementation Details**: `/docs/favorites-redesign/FAVORITES_BACKEND_IMPLEMENTATION_COMPLETE.md`  
**Architecture Design**: `/docs/favorites-redesign/FAVORITES_REDESIGN_MOBILE_OPTIMIZED.md`

**API Documentation**: https://api.e-beautything.com/api-docs

---

## 📝 Adding New Tests

### Shell Script
Edit `test-favorites-quick.sh` and add:
```bash
echo ""
echo "🧪 Test X: Your test description"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  "https://api.e-beautything.com/your-endpoint")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
# Add your assertions...
```

### TypeScript
Edit `test-favorites-endpoints.ts` and add:
```typescript
async function testYourFeature(token: string) {
  console.log('\n🧪 Testing Your Feature');
  try {
    const response = await axios.get(
      `${API_BASE_URL}/your-endpoint`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('✅ Test passed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Add to runTests() function
await testYourFeature(token);
```

---

## ✅ CI/CD Integration

### GitHub Actions Example
```yaml
- name: Test Favorites Endpoints
  env:
    TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
  run: |
    chmod +x tests/favorites-redesign/test-favorites-quick.sh
    ./tests/favorites-redesign/test-favorites-quick.sh
```

### Jenkins Example
```groovy
stage('Test Favorites') {
  steps {
    withCredentials([string(credentialsId: 'test-auth-token', variable: 'TEST_AUTH_TOKEN')]) {
      sh './tests/favorites-redesign/test-favorites-quick.sh'
    }
  }
}
```

---

**Last Updated**: November 23, 2025  
**Test Status**: ✅ All tests passing
