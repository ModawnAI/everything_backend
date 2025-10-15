#!/bin/bash

# Comprehensive API Endpoint Testing Script
# Testing all endpoints with authentication

set -e

TOKEN=$(cat /tmp/admin_token.txt)
BASE_URL="http://localhost:3001"

echo "==================================="
echo "🧪 COMPREHENSIVE API ENDPOINT TESTING"
echo "==================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local desc=$4

  echo -n "Testing $method $endpoint... "

  if [ -z "$data" ]; then
    response=$(curl -s -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -w "\n%{http_code}")
  else
    response=$(curl -s -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\n%{http_code}")
  fi

  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$ d')

  if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ $http_code${NC}"
    echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  elif [[ $http_code -ge 400 && $http_code -lt 500 ]]; then
    echo -e "${YELLOW}⚠️  $http_code${NC}"
    echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}❌ $http_code${NC}"
    echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  fi

  echo ""
  sleep 0.5
}

echo "📋 SECTION 1: Admin Authentication Endpoints"
echo "============================================="
test_endpoint "GET" "/api/admin/auth/validate" "" "Validate session"
test_endpoint "GET" "/api/admin/auth/profile" "" "Get admin profile"
test_endpoint "GET" "/api/admin/auth/sessions" "" "Get active sessions"

echo ""
echo "📋 SECTION 2: Super Admin - Dashboard"
echo "============================================="
test_endpoint "GET" "/api/admin/dashboard/stats" "" "Dashboard stats"

echo ""
echo "📋 SECTION 3: Super Admin - Shops Management"
echo "============================================="
test_endpoint "GET" "/api/admin/shops?page=1&limit=10" "" "List shops"
test_endpoint "GET" "/api/admin/shops?status=active&page=1&limit=5" "" "List active shops"

echo ""
echo "📋 SECTION 4: Super Admin - Users Management"
echo "============================================="
test_endpoint "GET" "/api/admin/users?page=1&limit=10" "" "List users"

echo ""
echo "📋 SECTION 5: Super Admin - Reservations"
echo "============================================="
test_endpoint "GET" "/api/admin/reservations?page=1&limit=10" "" "List reservations"

echo ""
echo "📋 SECTION 6: Super Admin - Analytics"
echo "============================================="
test_endpoint "GET" "/api/admin/analytics" "" "Analytics data"

echo ""
echo "📋 SECTION 7: Service Catalog (Public)"
echo "============================================="
test_endpoint "GET" "/api/service-catalog?page=1&limit=10" "" "Service catalog"
test_endpoint "GET" "/api/service-catalog/categories" "" "Service categories"

echo ""
echo "==================================="
echo "✅ Testing Complete!"
echo "==================================="
