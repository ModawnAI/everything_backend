#!/bin/bash

# CRUD Operations Testing Script
# Tests Create, Read, Update, Delete operations and verifies data in Supabase

set -e

TOKEN=$(cat /tmp/admin_token.txt)
BASE_URL="http://localhost:3001"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "==========================================="
echo "🧪 CRUD OPERATIONS TESTING WITH SUPABASE"
echo "==========================================="
echo ""

# Function to test and verify CRUD operations
test_crud() {
  local entity=$1
  local endpoint=$2
  local create_data=$3
  local update_data=$4

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Testing CRUD: $entity${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # CREATE
  echo -e "${YELLOW}1. CREATE - Testing POST $endpoint${NC}"
  create_response=$(curl -s -X POST "$BASE_URL$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$create_data" \
    -w "\n%{http_code}")

  create_http_code=$(echo "$create_response" | tail -n 1)
  create_body=$(echo "$create_response" | sed '$ d')

  if [[ $create_http_code -ge 200 && $create_http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ CREATE Success: $create_http_code${NC}"
    created_id=$(echo "$create_body" | jq -r '.data.id // .data.service.id // .data.shop.id // ""')
    echo "Created ID: $created_id"
    echo "$create_body" | jq -C '.' 2>/dev/null | head -20
  else
    echo -e "${RED}❌ CREATE Failed: $create_http_code${NC}"
    echo "$create_body" | jq -C '.' 2>/dev/null
    return 1
  fi
  echo ""

  # READ
  echo -e "${YELLOW}2. READ - Testing GET $endpoint/$created_id${NC}"
  read_response=$(curl -s -X GET "$BASE_URL$endpoint/$created_id" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

  read_http_code=$(echo "$read_response" | tail -n 1)
  read_body=$(echo "$read_response" | sed '$ d')

  if [[ $read_http_code -ge 200 && $read_http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ READ Success: $read_http_code${NC}"
    echo "$read_body" | jq -C '.' 2>/dev/null | head -20
  else
    echo -e "${RED}❌ READ Failed: $read_http_code${NC}"
    echo "$read_body" | jq -C '.' 2>/dev/null
  fi
  echo ""

  # UPDATE
  echo -e "${YELLOW}3. UPDATE - Testing PUT $endpoint/$created_id${NC}"
  update_response=$(curl -s -X PUT "$BASE_URL$endpoint/$created_id" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$update_data" \
    -w "\n%{http_code}")

  update_http_code=$(echo "$update_response" | tail -n 1)
  update_body=$(echo "$update_response" | sed '$ d')

  if [[ $update_http_code -ge 200 && $update_http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ UPDATE Success: $update_http_code${NC}"
    echo "$update_body" | jq -C '.' 2>/dev/null | head -20
  else
    echo -e "${YELLOW}⚠️  UPDATE Status: $update_http_code${NC}"
    echo "$update_body" | jq -C '.' 2>/dev/null
  fi
  echo ""

  # DELETE
  echo -e "${YELLOW}4. DELETE - Testing DELETE $endpoint/$created_id${NC}"
  delete_response=$(curl -s -X DELETE "$BASE_URL$endpoint/$created_id" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

  delete_http_code=$(echo "$delete_response" | tail -n 1)
  delete_body=$(echo "$delete_response" | sed '$ d')

  if [[ $delete_http_code -ge 200 && $delete_http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ DELETE Success: $delete_http_code${NC}"
    echo "$delete_body" | jq -C '.' 2>/dev/null
  else
    echo -e "${YELLOW}⚠️  DELETE Status: $delete_http_code${NC}"
    echo "$delete_body" | jq -C '.' 2>/dev/null
  fi
  echo ""

  # VERIFY DELETION
  echo -e "${YELLOW}5. VERIFY - Checking deleted resource${NC}"
  verify_response=$(curl -s -X GET "$BASE_URL$endpoint/$created_id" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

  verify_http_code=$(echo "$verify_response" | tail -n 1)

  if [[ $verify_http_code == "404" ]]; then
    echo -e "${GREEN}✅ VERIFY Success: Resource properly deleted (404)${NC}"
  else
    echo -e "${YELLOW}⚠️  VERIFY: Resource still exists or different status ($verify_http_code)${NC}"
  fi
  echo ""
}

# Test Shop Services CRUD
SHOP_ID="11111111-1111-1111-1111-111111111111"  # Premium Nail Studio from seed data

CREATE_SERVICE_DATA='{
  "name": "테스트 젤네일",
  "description": "CRUD 테스트를 위한 서비스",
  "category": "nail",
  "price_min": 30000,
  "price_max": 50000,
  "duration_minutes": 90,
  "is_available": true
}'

UPDATE_SERVICE_DATA='{
  "name": "업데이트된 젤네일",
  "description": "업데이트 테스트",
  "price_min": 35000,
  "price_max": 55000,
  "duration_minutes": 100
}'

test_crud "Shop Service" "/api/admin/shops/$SHOP_ID/services" "$CREATE_SERVICE_DATA" "$UPDATE_SERVICE_DATA"

echo "==========================================="
echo "✅ CRUD Testing Complete!"
echo "==========================================="
