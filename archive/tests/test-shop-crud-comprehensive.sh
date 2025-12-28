#!/bin/bash

# Comprehensive Shop CRUD Test Script
# Tests all admin shop management endpoints

TOKEN=$(cat /tmp/admin_token.txt)
BASE_URL="http://localhost:3001/api/admin"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local data=$4
  local expected_status=$5

  echo ""
  echo "================================================"
  echo "TEST: $description"
  echo "METHOD: $method $endpoint"
  echo "================================================"

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint")
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  echo "Status Code: $status_code"

  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAILED - Expected $expected_status, got $status_code${NC}"
    ((FAILED++))
  fi

  # Return body for further processing if needed
  echo "$body"
}

echo "════════════════════════════════════════════════"
echo "  COMPREHENSIVE SHOP CRUD TEST SUITE"
echo "  Backend: $BASE_URL"
echo "  Token: ${TOKEN:0:20}..."
echo "════════════════════════════════════════════════"

# 1. LIST SHOPS (paginated)
echo ""
echo "──────────────────────────────────────────────────"
echo "1. SHOP LIST OPERATIONS"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/shops?page=1&limit=10" \
  "Get shops list (page 1, limit 10)" "" "200"

test_endpoint "GET" "/shops?status=active&page=1&limit=5" \
  "Get active shops only" "" "200"

test_endpoint "GET" "/shops?search=네일&page=1&limit=5" \
  "Search shops by keyword" "" "200"

# 2. GET SHOP DETAILS
echo ""
echo "──────────────────────────────────────────────────"
echo "2. SHOP DETAIL OPERATIONS"
echo "──────────────────────────────────────────────────"

# Get first shop ID from list
shop_list=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?page=1&limit=1")
SHOP_ID=$(echo "$shop_list" | jq -r '.data.shops[0].id // empty')

if [ -n "$SHOP_ID" ]; then
  test_endpoint "GET" "/shops/$SHOP_ID" \
    "Get shop details by ID" "" "200"

  test_endpoint "GET" "/shops/$SHOP_ID/services" \
    "Get shop services" "" "200"

  test_endpoint "GET" "/shops/$SHOP_ID/reservations" \
    "Get shop reservations" "" "200"
else
  echo -e "${YELLOW}⚠️  No shops found for detail testing${NC}"
fi

# 3. CREATE SHOP
echo ""
echo "──────────────────────────────────────────────────"
echo "3. SHOP CREATE OPERATIONS"
echo "──────────────────────────────────────────────────"

CREATE_DATA='{
  "businessName": "테스트 네일샵",
  "description": "자동 테스트용 샵",
  "category": "nail",
  "phoneNumber": "02-1234-5678",
  "address": {
    "fullAddress": "서울시 강남구 테스트동 123",
    "postalCode": "06234"
  },
  "businessHours": {
    "monday": { "open": "10:00", "close": "20:00" },
    "tuesday": { "open": "10:00", "close": "20:00" }
  }
}'

create_response=$(test_endpoint "POST" "/shops" \
  "Create new shop" "$CREATE_DATA" "201")

NEW_SHOP_ID=$(echo "$create_response" | jq -r '.data.shop.id // empty')

# 4. UPDATE SHOP
if [ -n "$NEW_SHOP_ID" ]; then
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "4. SHOP UPDATE OPERATIONS"
  echo "──────────────────────────────────────────────────"

  UPDATE_DATA='{
    "businessName": "업데이트된 테스트 네일샵",
    "description": "업데이트 테스트 완료"
  }'

  test_endpoint "PUT" "/shops/$NEW_SHOP_ID" \
    "Update shop details" "$UPDATE_DATA" "200"

  test_endpoint "PATCH" "/shops/$NEW_SHOP_ID/status" \
    "Update shop status" '{"status": "inactive"}' "200"
fi

# 5. SHOP SERVICES MANAGEMENT
if [ -n "$NEW_SHOP_ID" ]; then
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "5. SHOP SERVICES OPERATIONS"
  echo "──────────────────────────────────────────────────"

  SERVICE_DATA='{
    "name": "젤 네일 기본",
    "serviceType": "nail",
    "priceMin": 30000,
    "priceMax": 50000,
    "duration": 60,
    "description": "기본 젤 네일 서비스"
  }'

  service_response=$(test_endpoint "POST" "/shops/$NEW_SHOP_ID/services" \
    "Add service to shop" "$SERVICE_DATA" "201")

  SERVICE_ID=$(echo "$service_response" | jq -r '.data.service.id // empty')

  if [ -n "$SERVICE_ID" ]; then
    test_endpoint "GET" "/shops/$NEW_SHOP_ID/services/$SERVICE_ID" \
      "Get service details" "" "200"

    SERVICE_UPDATE='{
      "name": "젤 네일 프리미엄",
      "priceMax": 70000
    }'

    test_endpoint "PUT" "/shops/$NEW_SHOP_ID/services/$SERVICE_ID" \
      "Update service" "$SERVICE_UPDATE" "200"

    test_endpoint "DELETE" "/shops/$NEW_SHOP_ID/services/$SERVICE_ID" \
      "Delete service" "" "200"
  fi
fi

# 6. DELETE SHOP
if [ -n "$NEW_SHOP_ID" ]; then
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "6. SHOP DELETE OPERATIONS"
  echo "──────────────────────────────────────────────────"

  test_endpoint "DELETE" "/shops/$NEW_SHOP_ID" \
    "Delete shop" "" "200"

  test_endpoint "GET" "/shops/$NEW_SHOP_ID" \
    "Verify shop deleted (should 404)" "" "404"
fi

# 7. EDGE CASES & VALIDATION
echo ""
echo "──────────────────────────────────────────────────"
echo "7. VALIDATION & ERROR HANDLING"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/shops/invalid-uuid" \
  "Get shop with invalid UUID" "" "400"

test_endpoint "POST" "/shops" \
  "Create shop with missing required fields" '{"businessName": "Test"}' "400"

test_endpoint "GET" "/shops/99999999-9999-9999-9999-999999999999" \
  "Get non-existent shop" "" "404"

# SUMMARY
echo ""
echo "════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
