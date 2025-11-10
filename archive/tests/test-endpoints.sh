#!/bin/bash

# Shop and Admin Endpoint Testing Script
# Tests the dashboard separation architecture implementation

BASE_URL="http://localhost:3001"
COLORS_ENABLED=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_color() {
    local color=$1
    shift
    if [ "$COLORS_ENABLED" = true ]; then
        echo -e "${color}$@${NC}"
    else
        echo "$@"
    fi
}

# Function to print test header
print_test_header() {
    echo
    print_color "$CYAN" "=========================================="
    print_color "$CYAN" "$1"
    print_color "$CYAN" "=========================================="
}

# Function to print test result
print_result() {
    local status=$1
    local message=$2

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$status" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        print_color "$GREEN" "✅ PASS: $message"
    elif [ "$status" = "FAIL" ]; then
        TESTS_FAILED=$((TESTS_FAILED + 1))
        print_color "$RED" "❌ FAIL: $message"
    elif [ "$status" = "SKIP" ]; then
        print_color "$YELLOW" "⚠️  SKIP: $message"
    else
        print_color "$BLUE" "ℹ️  INFO: $message"
    fi
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local expected_status=$4
    local data=$5
    local description=$6

    print_color "$BLUE" "\n→ Testing: $description"
    print_color "$BLUE" "  $method $endpoint"

    local response
    local http_code

    if [ -n "$data" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json")
    fi

    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')

    print_color "$BLUE" "  Expected: HTTP $expected_status"
    print_color "$BLUE" "  Received: HTTP $http_code"

    if [ "$http_code" = "$expected_status" ]; then
        print_result "PASS" "$description"

        # Try to parse JSON and show success field
        if echo "$body" | jq . >/dev/null 2>&1; then
            local success=$(echo "$body" | jq -r '.success // "N/A"')
            local error_code=$(echo "$body" | jq -r '.error.code // "N/A"')
            print_color "$BLUE" "  Response: success=$success, error_code=$error_code"
        fi
    else
        print_result "FAIL" "$description (Expected $expected_status, got $http_code)"

        # Show error details if available
        if echo "$body" | jq . >/dev/null 2>&1; then
            local error_msg=$(echo "$body" | jq -r '.error.message // .message // "No error message"')
            print_color "$RED" "  Error: $error_msg"
        fi
    fi
}

# Main test execution
print_test_header "🧪 SHOP & ADMIN ENDPOINT TESTING"

echo
print_color "$YELLOW" "📋 Prerequisites Check"
echo "  • Server should be running on $BASE_URL"
echo "  • Database should have test data"
echo "  • jq (JSON processor) should be installed"

# Check if server is running
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    print_result "FAIL" "Server is not running at $BASE_URL"
    echo
    print_color "$RED" "❌ Cannot proceed without running server."
    print_color "$YELLOW" "Start the server with: npm run dev"
    exit 1
fi

print_result "PASS" "Server is running"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_result "SKIP" "jq not installed (optional, for pretty output)"
fi

print_test_header "🔐 AUTHENTICATION SETUP"

# NOTE: In a real scenario, these tokens would be obtained from login endpoints
# For testing, you need to provide valid tokens
echo
print_color "$YELLOW" "⚠️  Token Configuration Required"
echo
echo "To run these tests, you need to set the following environment variables:"
echo "  • ADMIN_TOKEN - JWT token for platform admin"
echo "  • SHOP_TOKEN - JWT token for shop owner"
echo "  • SHOP_ID - The shop ID associated with SHOP_TOKEN"
echo "  • OTHER_SHOP_ID - A different shop ID (for access denial test)"
echo
echo "Example:"
echo "  export ADMIN_TOKEN='eyJhbGc...'"
echo "  export SHOP_TOKEN='eyJhbGc...'"
echo "  export SHOP_ID='shop-123'"
echo "  export OTHER_SHOP_ID='shop-456'"
echo

# Check if tokens are provided
if [ -z "$ADMIN_TOKEN" ]; then
    print_result "SKIP" "ADMIN_TOKEN not set - skipping admin tests"
    ADMIN_TOKEN=""
fi

if [ -z "$SHOP_TOKEN" ]; then
    print_result "SKIP" "SHOP_TOKEN not set - skipping shop owner tests"
    SHOP_TOKEN=""
fi

if [ -z "$SHOP_ID" ]; then
    print_result "SKIP" "SHOP_ID not set - skipping shop-scoped tests"
    SHOP_ID=""
fi

if [ -z "$OTHER_SHOP_ID" ]; then
    print_result "SKIP" "OTHER_SHOP_ID not set - skipping cross-shop access test"
    OTHER_SHOP_ID=""
fi

# Test 1: Health Check (No Auth Required)
print_test_header "Test 1: Health Check (No Authentication)"
test_endpoint "GET" "/health" "" "200" "" "Health check endpoint"

# Test 2: Shop Owner Accessing Own Shop Reservations
if [ -n "$SHOP_TOKEN" ] && [ -n "$SHOP_ID" ]; then
    print_test_header "Test 2: Shop Owner Accessing Own Shop Reservations"
    test_endpoint "GET" "/api/shops/$SHOP_ID/reservations?page=1&limit=10" "$SHOP_TOKEN" "200" "" \
        "Shop owner viewing own shop reservations"
else
    print_test_header "Test 2: Shop Owner Accessing Own Shop Reservations"
    print_result "SKIP" "Missing SHOP_TOKEN or SHOP_ID"
fi

# Test 3: Shop Owner Accessing Different Shop (Should Fail)
if [ -n "$SHOP_TOKEN" ] && [ -n "$OTHER_SHOP_ID" ]; then
    print_test_header "Test 3: Shop Owner Accessing Different Shop (Security Test)"
    test_endpoint "GET" "/api/shops/$OTHER_SHOP_ID/reservations" "$SHOP_TOKEN" "403" "" \
        "Shop owner attempting cross-shop access (should be DENIED)"
else
    print_test_header "Test 3: Shop Owner Accessing Different Shop"
    print_result "SKIP" "Missing SHOP_TOKEN or OTHER_SHOP_ID"
fi

# Test 4: Platform Admin Accessing Any Shop
if [ -n "$ADMIN_TOKEN" ] && [ -n "$SHOP_ID" ]; then
    print_test_header "Test 4: Platform Admin Accessing Any Shop"
    test_endpoint "GET" "/api/shops/$SHOP_ID/reservations?page=1&limit=5" "$ADMIN_TOKEN" "200" "" \
        "Platform admin accessing any shop"
else
    print_test_header "Test 4: Platform Admin Accessing Any Shop"
    print_result "SKIP" "Missing ADMIN_TOKEN or SHOP_ID"
fi

# Test 5: Platform Admin Getting All Reservations
if [ -n "$ADMIN_TOKEN" ]; then
    print_test_header "Test 5: Platform Admin Getting All Reservations"
    test_endpoint "GET" "/api/admin/reservations?page=1&limit=10" "$ADMIN_TOKEN" "200" "" \
        "Platform admin viewing all reservations across all shops"
else
    print_test_header "Test 5: Platform Admin Getting All Reservations"
    print_result "SKIP" "Missing ADMIN_TOKEN"
fi

# Test 6: Shop Owner Accessing Own Shop Payments
if [ -n "$SHOP_TOKEN" ] && [ -n "$SHOP_ID" ]; then
    print_test_header "Test 6: Shop Owner Accessing Own Shop Payments"
    test_endpoint "GET" "/api/shops/$SHOP_ID/payments?page=1&limit=10" "$SHOP_TOKEN" "200" "" \
        "Shop owner viewing own shop payments"
else
    print_test_header "Test 6: Shop Owner Accessing Own Shop Payments"
    print_result "SKIP" "Missing SHOP_TOKEN or SHOP_ID"
fi

# Test 7: Platform Admin Getting All Payments
if [ -n "$ADMIN_TOKEN" ]; then
    print_test_header "Test 7: Platform Admin Getting All Payments"
    test_endpoint "GET" "/api/admin/payments?page=1&limit=10" "$ADMIN_TOKEN" "200" "" \
        "Platform admin viewing all payments across all shops"
else
    print_test_header "Test 7: Platform Admin Getting All Payments"
    print_result "SKIP" "Missing ADMIN_TOKEN"
fi

# Test 8: Unauthenticated Access (Should Fail)
print_test_header "Test 8: Unauthenticated Access (Security Test)"
if [ -n "$SHOP_ID" ]; then
    test_endpoint "GET" "/api/shops/$SHOP_ID/reservations" "" "401" "" \
        "Accessing shop endpoint without token (should be DENIED)"
else
    print_result "SKIP" "Missing SHOP_ID"
fi

# Test 9: Admin Endpoint Without Admin Role (Should Fail)
if [ -n "$SHOP_TOKEN" ]; then
    print_test_header "Test 9: Admin Endpoint Without Admin Role (Security Test)"
    test_endpoint "GET" "/api/admin/reservations" "$SHOP_TOKEN" "403" "" \
        "Shop owner accessing admin endpoint (should be DENIED)"
else
    print_test_header "Test 9: Admin Endpoint Without Admin Role"
    print_result "SKIP" "Missing SHOP_TOKEN"
fi

# Test Results Summary
print_test_header "📊 TEST RESULTS SUMMARY"

echo
print_color "$CYAN" "Total Tests Run: $TESTS_RUN"
print_color "$GREEN" "Tests Passed:    $TESTS_PASSED"
print_color "$RED" "Tests Failed:    $TESTS_FAILED"
echo

if [ $TESTS_FAILED -eq 0 ]; then
    print_color "$GREEN" "✅ All tests passed!"
    exit 0
else
    print_color "$RED" "❌ Some tests failed. Please review the output above."
    exit 1
fi
