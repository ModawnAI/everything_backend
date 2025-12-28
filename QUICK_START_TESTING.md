# 🚀 Quick Start - Danal Payment Testing

## ✅ Your Configuration is Ready!

- **Backend**: Running on port 3001
- **Store ID**: `store-e8fdd5ab-363e-4b42-8326-b740a207acef`
- **Channel Key**: `channel-key-d33714da-6ff6-4e33-88a4-106dd855f122`
- **Webhook URL**: `https://api.e-beautything.com/api/webhooks/portone`

---

## 🧪 Test 1: Browser Payment Test (Easiest)

1. **Open the test file** in your browser:
   ```
   file:///home/bitnami/everything_backend/test-danal-payment.html
   ```

2. **Fill in the form** (pre-filled with test data)

3. **Click "결제하기"** to initiate payment

4. **Complete the payment** in the Danal popup

5. **Check the results** displayed on the page

---

## 🔌 Test 2: API Endpoint Test

### Test Payment Initialization:

```bash
curl -X POST http://localhost:3001/api/payments/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reservationId": "test_res_001",
    "amount": 10000,
    "isDeposit": false,
    "paymentStage": "single",
    "customerName": "홍길동",
    "customerEmail": "test@example.com",
    "customerPhone": "01012345678"
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "paymentKey": "pay_test_res_001_single_...",
    "orderId": "pay_test_res_001_single_...",
    "paymentId": "uuid-here"
  }
}
```

---

## 📊 Test 3: Check PortOne Dashboard

1. Go to: https://admin.portone.io/transactions
2. You should see test payments appear here in real-time
3. Check status, amount, and transaction details

---

## 🔍 Test 4: Verify Webhook Delivery

After a successful payment:

1. **Check webhook logs** in PortOne console:
   - Go to: Settings → Webhooks
   - View webhook delivery history

2. **Check your database**:
   ```sql
   SELECT * FROM webhook_logs
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Check backend logs**:
   ```bash
   tail -f logs/combined.log | grep -i webhook
   ```

---

## 🎯 Danal Test Cards

Use these test card numbers for Danal testing:

### Test Credit Cards:
- **Card Number**: 5570-0000-0000-0001
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)
- **Password**: Any 2 digits (e.g., 12)

### Test Results:
- **Successful Payment**: Use standard amounts (10,000원, 50,000원)
- **Failed Payment**: Try amount 1,004원 (will fail)

---

## 🚨 Troubleshooting

### Issue: Payment popup doesn't open
**Solution**: Check browser console for errors, ensure SDK loaded

### Issue: "Channel not found"
**Solution**: Verify channel key is correct in both .env and test HTML

### Issue: Webhook not received
**Solution**:
- Use production URL: `https://api.e-beautything.com/api/webhooks/portone`
- Check PortOne webhook configuration
- Verify webhook secret matches

### Issue: CORS error
**Solution**: Add your frontend domain to CORS_ORIGIN in .env

---

## 📈 Next Steps

Once testing is successful:

1. **✅ Integrate with your frontend** (Next.js app)
2. **✅ Add error handling** for failed payments
3. **✅ Set up refund testing**
4. **✅ Test different payment methods** (virtual account, transfer, etc.)
5. **✅ Monitor webhook delivery** in production

---

## 📞 Need Help?

- **PortOne Docs**: https://developers.portone.io
- **PortOne Support**: https://portone.io/korea/ko/support
- **Backend Logs**: `/home/bitnami/everything_backend/logs/`

---

**Status**: ✅ All configured and ready to test!
**Backend**: ✅ Running on port 3001
**Test File**: ✅ `test-danal-payment.html`
