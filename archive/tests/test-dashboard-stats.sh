#!/bin/bash

# Test Dashboard Stats Endpoint
TOKEN=$(cat /tmp/admin_token.txt)

echo "=== Testing Dashboard Stats Endpoint ==="
echo ""
echo "GET /api/admin/dashboard/stats"
echo "(Previously returned 404, should now return 200)"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/dashboard/stats" | jq -C '.' | head -50

echo ""
echo "================================================"
echo ""

echo "Also testing original /overview endpoint:"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/dashboard/overview" | jq -C '.' | head -50
