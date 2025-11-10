#!/bin/bash

# Test DELETE Operation
TOKEN=$(cat /tmp/admin_token.txt)
SHOP_ID="11111111-1111-1111-1111-111111111111"
SERVICE_ID="82fee67f-b9ab-4118-889a-767619a35a0b"

echo "=== Testing DELETE Operation ==="
echo ""
echo "DELETE /api/admin/shops/$SHOP_ID/services/$SERVICE_ID"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" | jq -C '.'

echo ""
echo "=== Verify Service is Deleted (Should Return 404) ==="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/shops/$SHOP_ID/services/$SERVICE_ID" | jq -C '.'
