# ✅ Danal Payment Setup - COMPLETE

## 🎉 Configuration Summary

All PortOne Danal payment integration is now configured and ready for testing!

---

## 📋 Your Configuration

### PortOne Credentials
- **Store ID**: `store-e8fdd5ab-363e-4b42-8326-b740a207acef`
- **Channel Key** (Danal Payment): `channel-key-d33714da-6ff6-4e33-88a4-106dd855f122`
- **API Secret**: ✅ Configured in `.env`
- **Webhook Secret**: ✅ Configured in `.env`

### Webhook URLs (Both Active)
- **Production**: `https://api.e-beautything.com/api/webhooks/portone`
- **Local Testing (ngrok)**: `https://multisulcate-yuk-evitable.ngrok-free.dev/api/webhooks/portone`

### Backend Server
- **Local URL**: `http://localhost:3001`
- **ngrok URL**: `https://multisulcate-yuk-evitable.ngrok-free.dev`
- **Status**: ✅ Running

---

## 🚀 How to Test

### Method 1: Browser Test (Easiest)

1. **Open test file**:
   ```bash
   # Local version
   file:///home/bitnami/everything_backend/test-danal-payment.html

   # ngrok version (with webhook testing)
   file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html
   ```

2. **Fill in the form** (pre-filled with test data)

3. **Click "결제하기"**

4. **Use Danal test card**:
   - Card Number: `5570-0000-0000-0001`
   - Expiry: `12/25` (any future date)
   - CVC: `123` (any 3 digits)
   - Password: `12` (any 2 digits)

5. **Check results** in browser and backend logs

---

### Method 2: Watch Webhook Logs

Open a terminal and monitor incoming webhooks:

```bash
# Watch all logs
tail -f /home/bitnami/everything_backend/logs/combined.log | grep -i webhook

# Or watch both payment and webhook logs
tail -f /home/bitnami/everything_backend/logs/combined.log | grep -E "payment|webhook|portone"
```

---

### Method 3: Check Database

After payment, verify records were created:

```sql
-- Check payments
SELECT
  id,
  payment_status,
  amount,
  provider_order_id,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 5;

-- Check webhook logs
SELECT
  webhook_id,
  status,
  created_at,
  payload->>'type' as event_type
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 5;
```

---

### Method 4: PortOne Dashboard

Monitor live transactions:
- **URL**: https://admin.portone.io/transactions
- **View**: Real-time payment status, amounts, and details
- **Webhooks**: Check delivery status in Settings → Webhooks

---

## 🧪 Test Scenarios

### 1. Successful Card Payment
```
Amount: 10,000원
Payment Method: CARD
Card: 5570-0000-0000-0001
Expected: Payment success + Webhook received
```

### 2. Virtual Account Payment
```
Amount: 50,000원
Payment Method: VIRTUAL_ACCOUNT
Expected: Virtual account issued + Notification webhook
```

### 3. Failed Payment
```
Amount: 1,004원
Payment Method: CARD
Card: 5570-0000-0000-0001
Expected: Payment fails gracefully
```

### 4. Webhook Verification
```
After successful payment:
- Check logs: tail -f logs/combined.log | grep webhook
- Check database: SELECT * FROM webhook_logs
- Check PortOne console: Webhook delivery history
```

---

## 📊 Monitoring Commands

```bash
# Check backend server status
curl -s http://localhost:3001/health | python3 -m json.tool

# Check ngrok tunnel
curl -s http://127.0.0.1:4040/api/tunnels | python3 -m json.tool

# Test webhook endpoint
curl -X POST https://multisulcate-yuk-evitable.ngrok-free.dev/api/webhooks/portone \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'

# Watch backend logs live
tail -f logs/combined.log

# Watch error logs only
tail -f logs/error.log
```

---

## 🔍 Troubleshooting

### Payment popup doesn't open
```bash
# Check browser console
# Verify PortOne SDK loaded
# Check Store ID and Channel Key are correct
```

### Webhook not received
```bash
# 1. Verify webhook URL in PortOne console
# 2. Check ngrok tunnel is running
curl -s http://127.0.0.1:4040/api/tunnels

# 3. Check backend logs
tail -f logs/combined.log | grep webhook

# 4. Test webhook endpoint manually
curl -X POST https://multisulcate-yuk-evitable.ngrok-free.dev/api/webhooks/portone \
  -H "Content-Type: application/json" \
  -d '{"test": "manual"}'
```

### Backend not responding
```bash
# Check if server is running
ps aux | grep "npm run dev"

# Check port 3001
netstat -tuln | grep 3001

# Restart server
npm run dev:clean
```

---

## 📚 Documentation Files

All documentation is available in your backend directory:

- **Complete Testing Guide**: `PORTONE_DANAL_TESTING_GUIDE.md`
- **Quick Start Guide**: `QUICK_START_TESTING.md`
- **This Summary**: `DANAL_SETUP_COMPLETE.md`
- **Test Files**:
  - `test-danal-payment.html` - Basic test
  - `test-danal-payment-ngrok.html` - With webhook testing
  - `test-portone-config.js` - Configuration verification

---

## 🎯 Next Steps

### 1. Test Payment Flow
- [x] Configuration complete
- [ ] Test successful payment
- [ ] Verify webhook received
- [ ] Check database records
- [ ] Test refund flow

### 2. Frontend Integration
- [ ] Add payment button to Next.js app
- [ ] Implement payment confirmation flow
- [ ] Add error handling
- [ ] Style payment UI

### 3. Production Deployment
- [ ] Test with production webhook URL
- [ ] Set up monitoring alerts
- [ ] Configure error notifications
- [ ] Document payment flows for team

---

## 🔐 Security Notes

- ✅ API Secret is in `.env` (not committed to git)
- ✅ Webhook signature verification enabled
- ✅ CORS configured for your domains
- ✅ Rate limiting active on API endpoints
- ✅ Payment amount verification on backend

---

## 📞 Support Resources

- **PortOne Docs**: https://developers.portone.io
- **PortOne Support**: https://portone.io/korea/ko/support
- **Danal Docs**: https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification
- **Backend Logs**: `/home/bitnami/everything_backend/logs/`

---

## ✅ Verification Checklist

- [x] PortOne credentials configured
- [x] Backend server running
- [x] ngrok tunnel active
- [x] Webhook URL added to PortOne console
- [x] Test HTML files created
- [x] Documentation complete
- [ ] **First test payment completed** ← Do this next!

---

**Status**: ✅ **READY FOR TESTING**

**Last Updated**: 2025-11-26
**Configuration Path**: `/home/bitnami/everything_backend/.env`
**Test Files Path**: `/home/bitnami/everything_backend/`

---

## 🚀 Quick Start Command

```bash
# Open test page and start testing!
xdg-open file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html

# Or copy the path and open in browser:
# file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html
```

**Good luck with your testing! 🎉**
