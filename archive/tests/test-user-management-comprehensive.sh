#!/bin/bash

# Comprehensive User Management Test Script
# Tests all admin user management endpoints

TOKEN=$(cat /tmp/admin_token.txt)
BASE_URL="http://localhost:3001/api/admin"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
SKIPPED=0

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

  echo "$body" | jq -C '.' 2>/dev/null | head -30 || echo "$body" | head -30
  echo "Status Code: $status_code"

  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAILED - Expected $expected_status, got $status_code${NC}"
    ((FAILED++))
  fi

  # Return body for further processing
  echo "$body"
}

echo "════════════════════════════════════════════════"
echo "  COMPREHENSIVE USER MANAGEMENT TEST SUITE"
echo "  Backend: $BASE_URL"
echo "  Token: ${TOKEN:0:20}..."
echo "════════════════════════════════════════════════"

# 1. LIST USERS
echo ""
echo "──────────────────────────────────────────────────"
echo "1. USER LIST OPERATIONS"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/users?page=1&limit=10" \
  "Get users list (paginated)" "" "200"

test_endpoint "GET" "/users?page=1&limit=5&sort=createdAt:desc" \
  "Get users with sorting" "" "200"

test_endpoint "GET" "/users?search=test&page=1&limit=5" \
  "Search users by keyword" "" "200"

test_endpoint "GET" "/users?status=active&page=1&limit=5" \
  "Filter users by status" "" "200"

# 2. GET USER DETAILS
echo ""
echo "──────────────────────────────────────────────────"
echo "2. USER DETAIL OPERATIONS"
echo "──────────────────────────────────────────────────"

# Get first user ID from list
user_list=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/users?page=1&limit=1")
USER_ID=$(echo "$user_list" | jq -r '.data.users[0].id // empty')

if [ -n "$USER_ID" ]; then
  test_endpoint "GET" "/users/$USER_ID" \
    "Get user details by ID" "" "200"

  test_endpoint "GET" "/users/$USER_ID/reservations" \
    "Get user reservations" "" "200"

  test_endpoint "GET" "/users/$USER_ID/favorites" \
    "Get user favorites" "" "200"

  test_endpoint "GET" "/users/$USER_ID/activity" \
    "Get user activity log" "" "200"
else
  echo -e "${YELLOW}⚠️  No users found for detail testing${NC}"
  ((SKIPPED+=4))
fi

# 3. USER MANAGEMENT OPERATIONS
if [ -n "$USER_ID" ]; then
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "3. USER MANAGEMENT OPERATIONS"
  echo "──────────────────────────────────────────────────"

  test_endpoint "PUT" "/users/$USER_ID" \
    "Update user details" '{"displayName": "Updated Test User"}' "200"

  test_endpoint "PATCH" "/users/$USER_ID/status" \
    "Update user status" '{"status": "active"}' "200"

  # Skip ban/unban to avoid disrupting real users
  echo ""
  echo -e "${BLUE}ℹ️  Skipping ban/unban tests to preserve user data${NC}"
  ((SKIPPED+=2))
fi

# 4. USER VERIFICATION & ROLE MANAGEMENT
if [ -n "$USER_ID" ]; then
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "4. USER VERIFICATION & ROLE OPERATIONS"
  echo "──────────────────────────────────────────────────"

  test_endpoint "GET" "/users/$USER_ID/verification-status" \
    "Get user verification status" "" "200"

  # Skip role changes to avoid disrupting real users
  echo ""
  echo -e "${BLUE}ℹ️  Skipping role change tests to preserve user permissions${NC}"
  ((SKIPPED++))
fi

# 5. USER STATISTICS & ANALYTICS
echo ""
echo "──────────────────────────────────────────────────"
echo "5. USER STATISTICS OPERATIONS"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/users/statistics" \
  "Get overall user statistics" "" "200"

test_endpoint "GET" "/users/statistics?period=30d" \
  "Get user statistics for 30 days" "" "200"

# 6. BULK OPERATIONS
echo ""
echo "──────────────────────────────────────────────────"
echo "6. BULK OPERATIONS"
echo "──────────────────────────────────────────────────"

echo ""
echo -e "${BLUE}ℹ️  Skipping bulk operations to preserve data integrity${NC}"
((SKIPPED+=2))

# 7. VALIDATION & ERROR HANDLING
echo ""
echo "──────────────────────────────────────────────────"
echo "7. VALIDATION & ERROR HANDLING"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/users/invalid-uuid" \
  "Get user with invalid UUID (should fail gracefully)" "" "400,404"

test_endpoint "PUT" "/users/$USER_ID" \
  "Update user with invalid data" '{"email": "not-an-email"}' "400"

test_endpoint "GET" "/users/99999999-9999-9999-9999-999999999999" \
  "Get non-existent user" "" "404"

# 8. SEARCH & FILTERING CAPABILITIES
echo ""
echo "──────────────────────────────────────────────────"
echo "8. ADVANCED SEARCH & FILTERING"
echo "──────────────────────────────────────────────────"

test_endpoint "GET" "/users?email=test@example.com" \
  "Search by email" "" "200"

test_endpoint "GET" "/users?phoneNumber=010" \
  "Search by phone number" "" "200"

test_endpoint "GET" "/users?createdFrom=2025-01-01&createdTo=2025-12-31" \
  "Filter by date range" "" "200"

# SUMMARY
echo ""
echo "════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════"
total_tests=$((PASSED + FAILED))
echo -e "Total Tests Run: $total_tests"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${BLUE}Skipped: $SKIPPED (to preserve data)${NC}"
echo ""

# Calculate pass rate
if [ $total_tests -gt 0 ]; then
  pass_rate=$((PASSED * 100 / total_tests))
  echo "Pass Rate: $pass_rate%"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Failed endpoints may need:"
  echo "  - Permission verification (super_admin vs admin)"
  echo "  - Route implementation"
  echo "  - Additional configuration"
  exit 1
fi
