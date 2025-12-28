#!/bin/bash

# Shop Search Debug Test Script
# Tests shop search and reservations endpoints

TOKEN_FILE="/tmp/admin_token.txt"
TOKEN=$(cat "$TOKEN_FILE")
BASE_URL="http://localhost:3001/api/admin"

echo "======================================"
echo "SHOP ENDPOINT DEBUG TESTING"
echo "======================================"
echo ""

echo "1. Testing basic shop search (English keyword)..."
echo "GET /shops?search=test&page=1&limit=5"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?search=test&page=1&limit=5" | head -30
echo ""
echo "--------------------------------------"
echo ""

echo "2. Testing shop search with Korean keyword (URL encoded)..."
# 네일 = %EB%84%A4%EC%9D%BC
echo "GET /shops?search=%EB%84%A4%EC%9D%BC&page=1&limit=5"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?search=%EB%84%A4%EC%9D%BC&page=1&limit=5" | head -30
echo ""
echo "--------------------------------------"
echo ""

echo "3. Get first shop ID from list..."
SHOP_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/shops?limit=1")
SHOP_ID=$(echo "$SHOP_RESPONSE" | jq -r '.data.shops[0].id // empty')

if [ -z "$SHOP_ID" ]; then
  echo "❌ No shops found in database"
  echo "Response: $SHOP_RESPONSE"
else
  echo "✅ Found shop ID: $SHOP_ID"
  echo ""
  echo "--------------------------------------"
  echo ""

  echo "4. Testing shop reservations endpoint..."
  echo "GET /shops/$SHOP_ID/reservations"
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/shops/$SHOP_ID/reservations" | head -30
  echo ""
fi

echo "======================================"
echo "TEST COMPLETE"
echo "======================================"
