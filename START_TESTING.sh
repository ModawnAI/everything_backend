#!/bin/bash

# Danal Payment Testing - Quick Start Script
# Opens the browser test file and starts monitoring logs

echo "=================================="
echo "🧪 Danal Payment Testing"
echo "=================================="
echo ""

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "✅ Backend server: Running on port 3001"
else
  echo "❌ Backend server: NOT RUNNING"
  echo "   Start with: npm run dev"
  exit 1
fi

# Check if ngrok is running
if curl -s https://multisulcate-yuk-evitable.ngrok-free.dev/health > /dev/null 2>&1; then
  echo "✅ ngrok tunnel: Active"
else
  echo "❌ ngrok tunnel: NOT RUNNING"
  echo "   Start with: ngrok http 3001 --domain=multisulcate-yuk-evitable.ngrok-free.dev"
  exit 1
fi

echo "✅ Webhook endpoint: Ready"
echo ""
echo "=================================="
echo "📋 Test Information"
echo "=================================="
echo ""
echo "Test File: test-danal-payment-ngrok.html"
echo "Webhook URL: https://multisulcate-yuk-evitable.ngrok-free.dev/api/webhooks/portone"
echo ""
echo "Danal Test Card:"
echo "  Card: 5570-0000-0000-0001"
echo "  Expiry: 12/25"
echo "  CVC: 123"
echo "  Password: 12"
echo ""
echo "=================================="
echo "🎯 Next Steps"
echo "=================================="
echo ""
echo "1. Open the test HTML file in your browser:"
echo "   file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html"
echo ""
echo "2. Fill in the form and click '결제하기'"
echo ""
echo "3. Complete payment with the test card above"
echo ""
echo "4. Monitor logs in another terminal:"
echo "   tail -f logs/combined.log | grep -i webhook"
echo ""
echo "=================================="
echo "📊 Monitoring"
echo "=================================="
echo ""
echo "Starting log monitor (press Ctrl+C to stop)..."
echo ""

# Start monitoring logs
tail -f logs/combined.log | grep -i --color=always "webhook\|payment\|portone"
