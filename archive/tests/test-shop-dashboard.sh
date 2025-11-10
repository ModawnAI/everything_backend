#!/bin/bash

# Shop Dashboard Comprehensive Test Script
# Testing all endpoints for shop: 엘레강스 헤어살롱 (22222222-2222-2222-2222-222222222222)
# Shopowner: shopowner@test.com

TOKEN=$(cat /tmp/shop-token.txt)
BASE_URL="http://localhost:3001"
SHOP_ID="22222222-2222-2222-2222-222222222222"

echo "========================================================"
echo "🧪 SHOP DASHBOARD COMPREHENSIVE TEST"
echo "========================================================"
echo "Shop: 엘레강스 헤어살롱"
echo "Shop ID: $SHOP_ID"
echo "========================================================"
echo ""

# Test counter
PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"

  echo "📍 Testing: $name"
  echo "   Method: $method $endpoint"

  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
  body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$http_status" == "200" ] || [ "$http_status" == "201" ]; then
    echo "   ✅ PASSED (Status: $http_status)"
    echo "$body" | python3 -m json.tool 2>/dev/null | head -30
    ((PASSED++))
  else
    echo "   ❌ FAILED (Status: $http_status)"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    ((FAILED++))
  fi
  echo ""
}

echo "========================================="
echo "1️⃣  AUTHENTICATION & PROFILE TESTS"
echo "========================================="
echo ""

test_endpoint "Shop Owner Profile" "GET" "/api/shop-owner/profile"
test_endpoint "Session Validation" "GET" "/api/shop-owner/auth/validate"

echo ""
echo "========================================="
echo "2️⃣  DASHBOARD OVERVIEW TESTS"
echo "========================================="
echo ""

test_endpoint "Dashboard Overview" "GET" "/api/shop-owner/dashboard"
test_endpoint "Analytics (Month)" "GET" "/api/shop-owner/analytics?period=month"
test_endpoint "Analytics (Week)" "GET" "/api/shop-owner/analytics?period=week"

echo ""
echo "========================================="
echo "3️⃣  RESERVATIONS TESTS"
echo "========================================="
echo ""

test_endpoint "All Reservations" "GET" "/api/shop-owner/reservations"
test_endpoint "Pending Reservations" "GET" "/api/shop-owner/reservations/pending"
test_endpoint "Reservations (Requested Status)" "GET" "/api/shop-owner/reservations?status=requested"
test_endpoint "Reservations (Confirmed Status)" "GET" "/api/shop-owner/reservations?status=confirmed"

echo ""
echo "========================================="
echo "📊  TEST SUMMARY"
echo "========================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "📝 Total:  $((PASSED + FAILED))"
echo "========================================="

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  exit 0
else
  echo "⚠️  SOME TESTS FAILED"
  exit 1
fi
