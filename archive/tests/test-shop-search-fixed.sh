#!/bin/bash

# Test shop search after adding search parameter support

TOKEN=$(cat /tmp/admin_token.txt)
BASE_URL="http://localhost:3001/api/admin"

echo "======================================"
echo "SHOP SEARCH FIXED - TESTING"
echo "======================================"
echo ""

echo "1. Test GET /shops?search=test"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?search=test&page=1&limit=5" | jq '.' | head -40
echo ""

echo "2. Test GET /shops?search=네일 (Korean)"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?search=네일&page=1&limit=5" | jq '.' | head -40
echo ""

echo "3. Test GET /shops (no search)"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/shops?page=1&limit=3" | jq '.' | head -40
echo ""

echo "======================================"
echo "TEST COMPLETE"
echo "======================================"
