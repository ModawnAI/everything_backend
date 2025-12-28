#!/bin/bash

# Quick test script for new favorites endpoints
# Usage: TEST_AUTH_TOKEN="your-token-here" ./test-favorites-quick.sh

API_BASE="https://api.e-beautything.com"

# Check if auth token is provided
if [ -z "$TEST_AUTH_TOKEN" ]; then
  echo "❌ Error: TEST_AUTH_TOKEN environment variable is required"
  echo "Usage: TEST_AUTH_TOKEN='your-bearer-token' ./test-favorites-quick.sh"
  exit 1
fi

echo "🚀 Testing Favorites Endpoints"
echo "============================================================"

# Test 1: GET /api/user/favorites/ids
echo ""
echo "📋 Test 1: GET /api/user/favorites/ids"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/user/favorites/ids")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Test 1 PASSED"
  FAVORITE_COUNT=$(echo "$BODY" | jq '.data.count' 2>/dev/null)
  echo "📊 Current favorites: $FAVORITE_COUNT"
  
  # Extract a favorite ID for testing removal
  FIRST_FAVORITE=$(echo "$BODY" | jq -r '.data.favoriteIds[0]' 2>/dev/null)
else
  echo "❌ Test 1 FAILED"
fi

# Test 2: POST /api/user/favorites/batch (Add operation)
echo ""
echo "🔄 Test 2: POST /api/user/favorites/batch (Add shops)"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "add": ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"],
    "remove": []
  }' \
  "$API_BASE/api/user/favorites/batch")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Test 2 PASSED"
  ADDED=$(echo "$BODY" | jq '.data.added | length' 2>/dev/null)
  FAILED=$(echo "$BODY" | jq '.data.failed | length' 2>/dev/null)
  echo "✅ Added: $ADDED shops"
  echo "⚠️ Failed: $FAILED shops"
else
  echo "❌ Test 2 FAILED"
fi

# Test 3: POST /api/user/favorites/batch (Remove operation)
echo ""
echo "🔄 Test 3: POST /api/user/favorites/batch (Remove shop)"
echo "------------------------------------------------------------"

if [ -n "$FIRST_FAVORITE" ] && [ "$FIRST_FAVORITE" != "null" ]; then
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"add\": [],
      \"remove\": [\"$FIRST_FAVORITE\"]
    }" \
    "$API_BASE/api/user/favorites/batch")

  HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

  echo "Status: $HTTP_STATUS"
  echo "Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Test 3 PASSED"
    REMOVED=$(echo "$BODY" | jq '.data.removed | length' 2>/dev/null)
    echo "✅ Removed: $REMOVED shops"
  else
    echo "❌ Test 3 FAILED"
  fi
else
  echo "⏭️ Skipping (no favorites to remove)"
fi

# Test 4: Edge case - Empty arrays
echo ""
echo "🧪 Test 4: Edge Case - Empty arrays (should fail)"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "add": [],
    "remove": []
  }' \
  "$API_BASE/api/user/favorites/batch")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_STATUS" = "400" ]; then
  echo "✅ Test 4 PASSED (correctly rejected)"
else
  echo "❌ Test 4 FAILED (should have returned 400)"
fi

# Test 5: Edge case - Batch size limit
echo ""
echo "🧪 Test 5: Edge Case - Batch size limit (should fail)"
echo "------------------------------------------------------------"

# Create array with 51 items
LARGE_BATCH=$(printf '"%s",' $(seq 1 51 | xargs -I {} echo "11111111-1111-1111-1111-111111111111") | sed 's/,$//')

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"add\": [$LARGE_BATCH],
    \"remove\": []
  }" \
  "$API_BASE/api/user/favorites/batch")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_STATUS" = "400" ]; then
  echo "✅ Test 5 PASSED (correctly rejected)"
else
  echo "❌ Test 5 FAILED (should have returned 400)"
fi

# Test 6: Verify final state
echo ""
echo "🔍 Test 6: Verify final favorites state"
echo "------------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/user/favorites/ids")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "200" ]; then
  FINAL_COUNT=$(echo "$BODY" | jq '.data.count' 2>/dev/null)
  echo "✅ Final favorites count: $FINAL_COUNT"
  echo "📝 Sample IDs:"
  echo "$BODY" | jq '.data.favoriteIds[0:3]' 2>/dev/null
else
  echo "❌ Failed to get final state"
fi

echo ""
echo "============================================================"
echo "✅ All tests completed!"
echo "============================================================"
