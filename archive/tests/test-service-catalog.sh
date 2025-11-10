#!/bin/bash

# Test Service Catalog Categories Endpoint
TOKEN=$(cat /tmp/admin_token.txt)

echo "=== Testing Service Catalog Categories Endpoint ==="
echo ""
echo "GET /api/service-catalog/categories"
echo "(Previously returned 500, should now return 200)"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/service-catalog/categories" | jq -C '.' | head -50

echo ""
echo "================================================"
echo ""
echo "Also testing original /metadata endpoint:"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/service-catalog/metadata" | jq -C '.' | head -50
