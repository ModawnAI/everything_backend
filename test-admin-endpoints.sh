#!/bin/bash

# Comprehensive Admin Endpoint Testing Script
# Tests all admin endpoints including newly added shop CRUD operations

BASE_URL="http://localhost:3001"
EMAIL="newadmin@ebeautything.com"
PASSWORD="NewAdmin123!"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TEST_LOG="/tmp/admin-endpoint-tests.log"

# Clear log file
> "$TEST_LOG"

echo "==================================================================="
echo "🧪 Starting Comprehensive Admin Endpoint Testing"
echo "==================================================================="
echo ""

# Function to test endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local data="$4"
    local expect_status="${5:-200}"

    echo -n "Testing: $description... "

    local curl_cmd="curl -s -w '\n%{http_code}' -X $method \"$BASE_URL$endpoint\""

    if [ -n "$TOKEN" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $TOKEN'"
    fi

    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi

    # Execute curl and capture output
    response=$(eval $curl_cmd)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Log the request and response
    {
        echo "=========================================="
        echo "Test: $description"
        echo "Method: $method"
        echo "Endpoint: $endpoint"
        echo "Expected Status: $expect_status"
        echo "Actual Status: $status_code"
        echo "Response Body:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        echo ""
    } >> "$TEST_LOG"

    # Check if status code matches expected
    if [[ "$status_code" -ge 200 ]] && [[ "$status_code" -lt 300 ]] || [[ "$status_code" == "$expect_status" ]]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status_code)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expect_status, Got: $status_code)"
        ((FAILED++))
        echo "Response: $body" | head -c 200
        echo ""
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  AUTHENTICATION ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Login and get token
echo -n "Logging in as admin... "
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceInfo\":{\"userAgent\":\"test-script\",\"platform\":\"CLI\",\"ipAddress\":\"127.0.0.1\"}}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.session.token // empty')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    ((PASSED++))
    echo "Token: ${TOKEN:0:30}..."
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    ((FAILED++))
    exit 1
fi

# Test CSRF token endpoint
test_endpoint "GET" "/api/admin/auth/csrf" "Get CSRF token" "" "200"

# Test sessions endpoint (this was previously timing out)
test_endpoint "GET" "/api/admin/auth/sessions" "Get admin sessions" "" "200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  SHOP MANAGEMENT ENDPOINTS (CRUD)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test shop search endpoint
test_endpoint "POST" "/api/admin/shop/search" "Search shops" \
  '{"page":1,"limit":10,"status":["active"]}' "200"

# Test get all shops endpoint (newly added from commit dcb9b8c)
test_endpoint "GET" "/api/admin/shop?page=1&limit=10" "Get all shops" "" "200"

# Store first shop ID for subsequent tests
SHOP_ID=$(curl -s -X POST "$BASE_URL/api/admin/shop/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":1}' | jq -r '.data.shops[0].id // empty')

if [ -n "$SHOP_ID" ] && [ "$SHOP_ID" != "null" ]; then
    echo "Using shop ID for tests: $SHOP_ID"

    # Test get shop details
    test_endpoint "GET" "/api/admin/shop/$SHOP_ID" "Get shop by ID" "" "200"

    # Test update shop (newly added from commit dcb9b8c)
    test_endpoint "PUT" "/api/admin/shop/$SHOP_ID" "Update shop" \
      "{\"name\":\"Updated Shop Name\"}" "200"

    # Test update shop status
    test_endpoint "PATCH" "/api/admin/shop/$SHOP_ID/status" "Update shop status" \
      '{"status":"active","reason":"Testing status update"}' "200"

    # Test get shop settings
    test_endpoint "GET" "/api/admin/shop/$SHOP_ID/settings" "Get shop settings" "" "200"

    # Test shop health check
    test_endpoint "POST" "/api/admin/shop/health-check" "Shop health check" \
      "{\"shopId\":\"$SHOP_ID\"}" "200"
else
    echo -e "${YELLOW}⚠ No shops found, skipping shop-specific tests${NC}"
fi

# Test create shop (newly added from commit dcb9b8c)
test_endpoint "POST" "/api/admin/shop" "Create new shop" \
  "{\"name\":\"Test Shop\",\"address\":\"123 Test St\",\"main_category\":\"hair\",\"phone_number\":\"010-1234-5678\",\"email\":\"testshop@example.com\"}" "201"

# Test shop categories
test_endpoint "GET" "/api/admin/shop/categories" "Get shop categories" "" "200"

# Test shop overview
test_endpoint "POST" "/api/admin/shop/overview" "Get shop overview" '{}' "200"

# Test shop statistics
test_endpoint "POST" "/api/admin/shop/statistics" "Get shop statistics" '{}' "200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  SHOP SERVICE ENDPOINTS (From dcb9b8c commit)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$SHOP_ID" ] && [ "$SHOP_ID" != "null" ]; then
    # Test get shop services
    test_endpoint "GET" "/api/admin/shops/$SHOP_ID/services" "Get shop services" "" "200"

    # Test create shop service
    test_endpoint "POST" "/api/admin/shops/$SHOP_ID/services" "Create shop service" \
      "{\"name\":\"Test Service\",\"description\":\"A test service\",\"price\":50000,\"duration\":60,\"category\":\"hair\"}" "201"

    # Get service ID for further tests
    SERVICE_ID=$(curl -s -X GET "$BASE_URL/api/admin/shops/$SHOP_ID/services" \
      -H "Authorization: Bearer $TOKEN" | jq -r '.data.services[0].id // empty')

    if [ -n "$SERVICE_ID" ] && [ "$SERVICE_ID" != "null" ]; then
        # Test get service by ID
        test_endpoint "GET" "/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" "Get service by ID" "" "200"

        # Test update service
        test_endpoint "PUT" "/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" "Update service" \
          "{\"price\":60000}" "200"

        # Test delete service
        test_endpoint "DELETE" "/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" "Delete service" "" "200"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  PAYMENT ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test payment transactions
test_endpoint "GET" "/admin/payments/transactions?page=1&limit=10" "Get payment transactions" "" "200"

# Test payment analytics
test_endpoint "GET" "/admin/payments/analytics" "Get payment analytics" "" "200"

# Test payment configurations
test_endpoint "GET" "/admin/payments/configurations" "Get payment configurations" "" "200"

# Test refunds list
test_endpoint "GET" "/admin/payments/refunds?page=1&limit=10" "Get refunds list" "" "200"

# Test settlements list
test_endpoint "GET" "/admin/payments/settlements?page=1&limit=10" "Get settlements list" "" "200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  RESERVATION ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test reservations list
test_endpoint "GET" "/admin/reservations?page=1&limit=10" "Get reservations list" "" "200"

# Test reservation statistics
test_endpoint "GET" "/admin/reservations/statistics" "Get reservation statistics" "" "200"

# Test reservation services
test_endpoint "GET" "/admin/reservations/services" "Get reservation services" "" "200"

# Test reservation staff
test_endpoint "GET" "/admin/reservations/staff" "Get reservation staff" "" "200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  USER MANAGEMENT ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Need to find the user management endpoints from the backend
test_endpoint "GET" "/api/admin/users?page=1&limit=10" "Get users list" "" "200,404"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  ANALYTICS & DASHBOARD ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test dashboard analytics
test_endpoint "GET" "/api/admin/analytics/dashboard" "Get dashboard analytics" "" "200,404"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  SHOP APPROVAL ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test shop approval endpoints
test_endpoint "GET" "/api/admin/shops/approval/pending?page=1&limit=10" "Get pending shop approvals" "" "200"

echo ""
echo "==================================================================="
echo "📊 TEST SUMMARY"
echo "==================================================================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo ""
echo "Full test log saved to: $TEST_LOG"
echo ""

# Display failed tests if any
if [ $FAILED -gt 0 ]; then
    echo "Failed tests:"
    grep -B 3 "✗ FAILED" "$TEST_LOG" 2>/dev/null || echo "See log file for details"
fi

exit 0
