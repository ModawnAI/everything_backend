#!/bin/bash

# Test CRUD Operations After Fix
# Tests if the validator fix allows GET/PUT/DELETE to work

TOKEN=$(cat /tmp/admin_token.txt)
SHOP_ID="11111111-1111-1111-1111-111111111111"
SERVICE_ID="82fee67f-b9ab-4118-889a-767619a35a0b"

echo "================================================"
echo "Testing CRUD Fix - Validator shopId Parameter"
echo "================================================"
echo ""

# Test 1: GET Service by ID (Previously Failed)
echo "1. GET Service by ID (Previously returned 404)"
echo "   GET /api/admin/shops/$SHOP_ID/services/$SERVICE_ID"
echo ""
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" | jq -C '.' | head -30

echo ""
echo "================================================"
echo ""

# Test 2: PUT Update Service (Previously Failed)
echo "2. PUT Update Service (Previously returned 404)"
echo "   PUT /api/admin/shops/$SHOP_ID/services/$SERVICE_ID"
echo ""
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"업데이트된 젤네일 - CRUD Fix Test","price_max":60000}' \
  "http://localhost:3001/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" | jq -C '.' | head -30

echo ""
echo "================================================"
echo ""

# Test 3: GET to verify update
echo "3. GET to Verify Update Worked"
echo "   GET /api/admin/shops/$SHOP_ID/services/$SERVICE_ID"
echo ""
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" | jq -C '.data | {id, name, priceMax}' | head -10

echo ""
echo "================================================"
echo "✅ CRUD Fix Test Complete!"
echo "================================================"
