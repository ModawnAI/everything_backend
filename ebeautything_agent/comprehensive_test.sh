#!/bin/bash

# eBeautything Platform Comprehensive E2E Test Script
# ====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Results file
RESULTS_FILE="./test_results.json"
START_TIME=$(date +%s)

# Backend and Frontend URLs
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# Admin credentials
ADMIN_EMAIL="admin@ebeautything.com"
ADMIN_PASSWORD="Admin123!@#"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}eBeautything E2E Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to log test results
log_test() {
    local test_name=$1
    local status=$2
    local response_time=$3
    local details=$4

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓${NC} $test_name (${response_time}ms)"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗${NC} $test_name"
        echo -e "  ${RED}Error: $details${NC}"
    fi
}

# Test 1: Backend Health Check
echo -e "\n${YELLOW}[TEST 1] Backend Health Check${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}" "$BACKEND_URL/health")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME_TOTAL" | cut -d: -f2)
TIME_MS=$(echo "$TIME_TOTAL * 1000" | bc | cut -d. -f1)

if [ "$HTTP_STATUS" = "200" ]; then
    log_test "Backend Health Check" "PASS" "$TIME_MS" ""
else
    log_test "Backend Health Check" "FAIL" "$TIME_MS" "Expected 200, got $HTTP_STATUS"
fi

# Test 2: Admin Login
echo -e "\n${YELLOW}[TEST 2] Admin Login${NC}"
LOGIN_START=$(date +%s%3N)
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/admin/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
LOGIN_END=$(date +%s%3N)
LOGIN_TIME=$((LOGIN_END - LOGIN_START))

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log_test "Admin Login" "PASS" "$LOGIN_TIME" ""

    # Validate JWT token structure
    TOKEN_PARTS=$(echo "$ADMIN_TOKEN" | awk -F'.' '{print NF}')
    if [ "$TOKEN_PARTS" = "3" ]; then
        log_test "JWT Token Structure Validation" "PASS" "0" ""
    else
        log_test "JWT Token Structure Validation" "FAIL" "0" "Invalid JWT structure"
    fi
else
    log_test "Admin Login" "FAIL" "$LOGIN_TIME" "Login failed"
    ADMIN_TOKEN=""
fi

# Test 3: Session Validation
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "\n${YELLOW}[TEST 3] Session Validation${NC}"
    VALIDATE_START=$(date +%s%3N)
    VALIDATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$BACKEND_URL/api/admin/auth/validate")
    VALIDATE_END=$(date +%s%3N)
    VALIDATE_TIME=$((VALIDATE_END - VALIDATE_START))
    VALIDATE_STATUS=$(echo "$VALIDATE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

    if [ "$VALIDATE_STATUS" = "200" ]; then
        log_test "Session Validation" "PASS" "$VALIDATE_TIME" ""
    else
        log_test "Session Validation" "FAIL" "$VALIDATE_TIME" "Validation failed"
    fi
fi

# Test 4: Admin Profile
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "\n${YELLOW}[TEST 4] Admin Profile Retrieval${NC}"
    PROFILE_START=$(date +%s%3N)
    PROFILE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$BACKEND_URL/api/admin/auth/profile")
    PROFILE_END=$(date +%s%3N)
    PROFILE_TIME=$((PROFILE_END - PROFILE_START))
    PROFILE_STATUS=$(echo "$PROFILE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

    if [ "$PROFILE_STATUS" = "200" ]; then
        log_test "Admin Profile Retrieval" "PASS" "$PROFILE_TIME" ""
    else
        log_test "Admin Profile Retrieval" "FAIL" "$PROFILE_TIME" "Profile fetch failed"
    fi
fi

# Test 5: Shop Management API
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "\n${YELLOW}[TEST 5] Shop Management API${NC}"
    SHOPS_START=$(date +%s%3N)
    SHOPS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$BACKEND_URL/api/admin/shops?page=1&limit=10")
    SHOPS_END=$(date +%s%3N)
    SHOPS_TIME=$((SHOPS_END - SHOPS_START))
    SHOPS_STATUS=$(echo "$SHOPS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

    if [ "$SHOPS_STATUS" = "200" ]; then
        log_test "Shop List API" "PASS" "$SHOPS_TIME" ""
    else
        log_test "Shop List API" "FAIL" "$SHOPS_TIME" "Shop list fetch failed"
    fi
fi

# Test 6: Frontend Accessibility
echo -e "\n${YELLOW}[TEST 6] Frontend Accessibility${NC}"
FRONTEND_START=$(date +%s%3N)
FRONTEND_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$FRONTEND_URL")
FRONTEND_END=$(date +%s%3N)
FRONTEND_TIME=$((FRONTEND_END - FRONTEND_START))
FRONTEND_STATUS=$(echo "$FRONTEND_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$FRONTEND_STATUS" = "200" ]; then
    log_test "Frontend Accessibility" "PASS" "$FRONTEND_TIME" ""
else
    log_test "Frontend Accessibility" "FAIL" "$FRONTEND_TIME" "Frontend not accessible"
fi

# Test 7: Unauthorized Access Test
echo -e "\n${YELLOW}[TEST 7] Security - Unauthorized Access${NC}"
UNAUTH_START=$(date +%s%3N)
UNAUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    "$BACKEND_URL/api/admin/auth/profile")
UNAUTH_END=$(date +%s%3N)
UNAUTH_TIME=$((UNAUTH_END - UNAUTH_START))
UNAUTH_STATUS=$(echo "$UNAUTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$UNAUTH_STATUS" = "401" ] || [ "$UNAUTH_STATUS" = "403" ]; then
    log_test "Unauthorized Access Blocked" "PASS" "$UNAUTH_TIME" ""
else
    log_test "Unauthorized Access Blocked" "FAIL" "$UNAUTH_TIME" "Expected 401/403, got $UNAUTH_STATUS"
fi

# Test 8: Logout
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "\n${YELLOW}[TEST 8] Admin Logout${NC}"
    LOGOUT_START=$(date +%s%3N)
    LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$BACKEND_URL/api/admin/auth/logout")
    LOGOUT_END=$(date +%s%3N)
    LOGOUT_TIME=$((LOGOUT_END - LOGOUT_START))
    LOGOUT_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

    if [ "$LOGOUT_STATUS" = "200" ]; then
        log_test "Admin Logout" "PASS" "$LOGOUT_TIME" ""
    else
        log_test "Admin Logout" "FAIL" "$LOGOUT_TIME" "Logout failed"
    fi
fi

# Calculate total duration
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Print summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo -e "Duration: ${TOTAL_DURATION}s"
echo -e "Success Rate: $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%"
echo -e "${BLUE}========================================${NC}\n"

# Generate JSON report
cat > "$RESULTS_FILE" <<EOF
{
  "testRunTimestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "testSuite": "eBeautything Platform Comprehensive E2E Test",
  "summary": {
    "totalTests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "skipped": 0,
    "duration": ${TOTAL_DURATION},
    "successRate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
  },
  "backend": {
    "url": "$BACKEND_URL",
    "status": "running"
  },
  "frontend": {
    "url": "$FRONTEND_URL",
    "status": "running"
  }
}
EOF

echo -e "${GREEN}Test results saved to: $RESULTS_FILE${NC}\n"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
