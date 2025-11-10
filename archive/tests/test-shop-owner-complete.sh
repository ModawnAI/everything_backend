#!/bin/bash

# COMPREHENSIVE SHOP OWNER DASHBOARD TEST
# Account: shopowner@test.com (SHOP OWNER, NOT SUPERADMIN)
# Shop: 엘레강스 헤어살롱 (22222222-2222-2222-2222-222222222222)

set -e

BASE_URL="http://localhost:3001"
EMAIL="shopowner@test.com"
PASSWORD="Test1234!"

echo "================================================================"
echo "🧪 SHOP OWNER DASHBOARD - COMPREHENSIVE ENDPOINT TEST"
echo "================================================================"
echo "Account: $EMAIL (SHOP OWNER)"
echo "Shop: 엘레강스 헤어살롱"
echo "================================================================"
echo ""

# 1. LOGIN AS SHOP OWNER
echo "1️⃣  AUTHENTICATION TEST"
echo "========================"
echo "Logging in as shop owner..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/shop-owner/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$LOGIN_RESPONSE" | python3 -m json.tool | head -40

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['token'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "❌ LOGIN FAILED!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
SHOP_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['shopOwner']['shop']['id'])")
echo "Shop ID from token: $SHOP_ID"
echo ""

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="${4:-200}"

  echo "📍 $name"
  echo "   $method $endpoint"

  response=$(curl -s -w "\nSTATUS:%{http_code}" -X "$method" "$BASE_URL$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

  status=$(echo "$response" | grep "STATUS:" | cut -d: -f2)
  body=$(echo "$response" | sed '/STATUS:/d')

  if [ "$status" == "$expected_status" ]; then
    echo "   ✅ PASS ($status)"
    ((PASSED++))
    echo "$body" | python3 -m json.tool 2>/dev/null | head -20 || echo "$body" | head -20
  else
    echo "   ❌ FAIL (Expected $expected_status, got $status)"
    ((FAILED++))
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
  fi
  echo ""
}

echo "2️⃣  PROFILE & AUTHENTICATION"
echo "============================="
test_endpoint "Get Shop Owner Profile" "GET" "/api/shop-owner/profile"
test_endpoint "Validate Session" "GET" "/api/shop-owner/auth/validate"
test_endpoint "Get Shop Owner Sessions" "GET" "/api/shop-owner/auth/sessions"

echo "3️⃣  DASHBOARD & ANALYTICS"
echo "=========================="
test_endpoint "Dashboard Overview" "GET" "/api/shop-owner/dashboard"
test_endpoint "Analytics - Month" "GET" "/api/shop-owner/analytics?period=month"
test_endpoint "Analytics - Week" "GET" "/api/shop-owner/analytics?period=week"
test_endpoint "Analytics - Day" "GET" "/api/shop-owner/analytics?period=day"

echo "4️⃣  RESERVATIONS"
echo "================"
test_endpoint "All Reservations" "GET" "/api/shop-owner/reservations"
test_endpoint "Reservations - Page 1" "GET" "/api/shop-owner/reservations?page=1&limit=5"
test_endpoint "Requested Reservations" "GET" "/api/shop-owner/reservations?status=requested"
test_endpoint "Confirmed Reservations" "GET" "/api/shop-owner/reservations?status=confirmed"
test_endpoint "Completed Reservations" "GET" "/api/shop-owner/reservations?status=completed"

echo "================================================================"
echo "📊 FINAL RESULTS"
echo "================================================================"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "📝 Total:  $((PASSED + FAILED))"
echo "================================================================"

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED - Shop owner dashboard is fully functional!"
  echo ""
  echo "✨ SUMMARY:"
  echo "   - Shop owner can authenticate successfully"
  echo "   - All dashboard endpoints returning data"
  echo "   - Shop has $SHOP_ID with full data"
  echo "   - Frontend can now connect to these endpoints"
  exit 0
else
  echo "⚠️  SOME TESTS FAILED - Review failures above"
  exit 1
fi
