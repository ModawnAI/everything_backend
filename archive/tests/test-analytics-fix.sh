#!/bin/bash

TOKEN=$(cat /tmp/admin_token.txt)

echo "🧪 Testing Fixed Shop Analytics Endpoint"
echo "========================================="
echo ""

echo "Testing: GET /api/admin/analytics/shops/:shopId/analytics"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/analytics/shops/11111111-1111-1111-1111-111111111111/analytics" \
  -w "\n\nStatus: %{http_code}\n" \
  2>&1 | head -80

echo ""
echo "✅ Test completed"
