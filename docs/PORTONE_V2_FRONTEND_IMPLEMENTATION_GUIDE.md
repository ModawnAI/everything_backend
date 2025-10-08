# PortOne V2 Frontend Implementation Guide

## 🎯 Overview

This comprehensive guide provides detailed instructions for frontend developers to implement PortOne V2 payment integration with the 에뷰리띵 backend. The backend is now fully configured for PortOne V2 with proper environment variables, SDK integration, and database schema (after manual migration).

---

## 📋 Prerequisites

### 1. Database Migration Status
**⚠️ IMPORTANT**: Before implementing frontend features, ensure the database migration is completed:

```bash
# Check migration status
npm run migrate:portone-v2:check

# If migration is incomplete, execute manually:
# 1. Go to: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql
# 2. Execute: sql/portone_v2_schema_migration.sql
```

### 2. Environment Configuration
All PortOne V2 environment variables are configured:
- `PORTONE_V2_STORE_ID`: test_store_id
- `PORTONE_V2_CHANNEL_KEY`: test_channel_key
- `PORTONE_V2_API_SECRET`: test_api_secret_for_development
- `PORTONE_V2_WEBHOOK_SECRET`: test_webhook_secret
- `PORTONE_V2_BASE_URL`: https://api.portone.io

---

## 🏗️ Backend API Architecture

The backend exposes RESTful endpoints for PortOne V2 integration following consistent patterns:

### Base URLs
- **Main API**: `http://localhost:3001/api/v1`
- **Admin API**: `http://localhost:3001/api/admin/v1`
- **Service API**: `http://localhost:3001/api/service/v1`

### Authentication
All endpoints require proper JWT authentication:
```javascript
headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
```

---

## 💳 PortOne V2 Payment Integration

### 1. Payment Initialization

#### **Frontend Request:**
```javascript
// Initialize PortOne payment
const initializePayment = async (paymentData) => {
  const response = await fetch('/api/v1/payments/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Basic payment information
      amount: 50000,
      currency: 'KRW',
      orderName: '뷰티 예약 결제',

      // Customer information
      customer: {
        customerId: 'user_123',
        fullName: '홍길동',
        phoneNumber: '01012345678',
        email: 'user@example.com'
      },

      // PortOne V2 specific fields
      method: 'portone',
      payMethod: 'card', // card, virtual_account, transfer, mobile
      channelKey: 'test_channel_key', // From environment
      storeId: 'test_store_id', // From environment

      // Business logic fields
      reservationId: 'res_123',
      shopId: 'shop_456',
      serviceIds: ['svc_1', 'svc_2'],

      // Optional fields
      successUrl: 'https://yourapp.com/payment/success',
      failureUrl: 'https://yourapp.com/payment/failure',
      metadata: {
        source: 'mobile_app',
        version: '1.0.0'
      }
    })
  });

  const result = await response.json();
  return result;
};
```

#### **Backend Response:**
```javascript
{
  "success": true,
  "data": {
    "paymentId": "pay_abc123def456",
    "paymentKey": "portone_key_789xyz",
    "channelKey": "test_channel_key",
    "storeId": "test_store_id",
    "amount": 50000,
    "currency": "KRW",
    "orderName": "뷰티 예약 결제",
    "status": "ready",
    "checkoutUrl": "https://checkout.portone.io/...",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "virtualAccount": null, // Only for virtual_account method
    "customer": {
      "customerId": "user_123",
      "fullName": "홍길동",
      "phoneNumber": "01012345678"
    },
    "expiresAt": "2024-12-25T15:30:00Z",
    "createdAt": "2024-12-25T14:30:00Z"
  },
  "message": "Payment initialized successfully"
}
```

### 2. Virtual Account Payment

For virtual account payments, the flow is different:

```javascript
// Initialize virtual account payment
const initializeVirtualAccount = async (paymentData) => {
  const response = await fetch('/api/v1/payments/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...paymentData,
      method: 'portone',
      payMethod: 'virtual_account',

      // Virtual account specific options
      virtualAccountOptions: {
        bankCode: 'KB', // Optional: preferred bank
        dueDate: '2024-12-26T23:59:59Z', // Payment deadline
        cashReceiptType: 'PERSONAL' // PERSONAL, BUSINESS, NONE
      }
    })
  });

  const result = await response.json();

  if (result.success && result.data.virtualAccount) {
    // Display virtual account information to user
    const { bankName, accountNumber, holderName, dueDate } = result.data.virtualAccount;

    showVirtualAccountInfo({
      bankName,
      accountNumber,
      holderName,
      amount: result.data.amount,
      dueDate
    });
  }

  return result;
};
```

### 3. Payment Status Monitoring

#### **Real-time Status Check:**
```javascript
const checkPaymentStatus = async (paymentId) => {
  const response = await fetch(`/api/v1/payments/${paymentId}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });

  const result = await response.json();
  return result;
};

// Poll payment status for real-time updates
const pollPaymentStatus = (paymentId, callback) => {
  const interval = setInterval(async () => {
    try {
      const status = await checkPaymentStatus(paymentId);
      callback(status);

      // Stop polling if payment is completed or failed
      if (['paid', 'failed', 'cancelled'].includes(status.data.status)) {
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Status check failed:', error);
      callback({ success: false, error: error.message });
    }
  }, 3000); // Check every 3 seconds

  return interval;
};
```

#### **WebSocket Integration (Real-time):**
```javascript
// Connect to payment status WebSocket
const connectPaymentWebSocket = (paymentId, callbacks) => {
  const socket = io('http://localhost:3001', {
    auth: {
      token: userToken
    }
  });

  // Join payment room for real-time updates
  socket.emit('join_payment_room', paymentId);

  // Listen for payment status updates
  socket.on('payment_status_update', (data) => {
    console.log('Payment status update:', data);
    callbacks.onStatusUpdate?.(data);

    switch (data.status) {
      case 'paid':
        callbacks.onPaymentSuccess?.(data);
        break;
      case 'failed':
        callbacks.onPaymentFailure?.(data);
        break;
      case 'virtual_account_issued':
        callbacks.onVirtualAccountIssued?.(data);
        break;
    }
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    callbacks.onError?.(error);
  });

  return socket;
};
```

### 4. Payment Confirmation

After payment completion, confirm the payment on backend:

```javascript
const confirmPayment = async (paymentId) => {
  const response = await fetch(`/api/v1/payments/${paymentId}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();

  if (result.success) {
    // Payment confirmed successfully
    // Redirect to success page or update UI
    console.log('Payment confirmed:', result.data);
  } else {
    // Handle confirmation failure
    console.error('Payment confirmation failed:', result.error);
  }

  return result;
};
```

---

## 🔧 Admin Dashboard Integration

### 1. Payment Management

#### **List Payments with PortOne Filter:**
```javascript
const getPayments = async (filters = {}) => {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    method: filters.method || 'all', // 'portone', 'toss', 'all'
    status: filters.status || 'all',
    dateFrom: filters.dateFrom || '',
    dateTo: filters.dateTo || '',
    paymentKey: filters.paymentKey || '',
    storeId: filters.storeId || ''
  });

  const response = await fetch(`/api/admin/v1/payments?${queryParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  const result = await response.json();
  return result;
};
```

#### **PortOne Payment Details:**
```javascript
const getPortOnePaymentDetails = async (paymentId) => {
  const response = await fetch(`/api/admin/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  const result = await response.json();

  if (result.success && result.data.method === 'portone') {
    const payment = result.data;

    // PortOne specific fields
    console.log('PortOne Payment Details:', {
      paymentKey: payment.paymentKey,
      channelKey: payment.channelKey,
      storeId: payment.storeId,
      gatewayMethod: payment.gatewayMethod,
      gatewayTransactionId: payment.gatewayTransactionId,
      virtualAccountInfo: payment.virtualAccountInfo,
      gatewayMetadata: payment.gatewayMetadata
    });
  }

  return result;
};
```

### 2. Refund Management

```javascript
const initiateRefund = async (paymentId, refundData) => {
  const response = await fetch(`/api/admin/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: refundData.amount, // Partial or full refund
      reason: refundData.reason,
      cancelReason: refundData.cancelReason, // For PortOne
      metadata: {
        refundedBy: 'admin',
        refundType: refundData.type || 'admin_initiated'
      }
    })
  });

  const result = await response.json();
  return result;
};
```

### 3. Financial Reporting

```javascript
const getPortOneFinancialReport = async (dateRange) => {
  const response = await fetch('/api/admin/v1/reports/financial', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      method: 'portone', // Filter for PortOne payments only
      includeMetadata: true,
      groupBy: ['status', 'gatewayMethod'] // Group by PortOne payment methods
    })
  });

  const result = await response.json();

  if (result.success) {
    const report = result.data;

    // Display PortOne specific metrics
    console.log('PortOne Financial Report:', {
      totalTransactions: report.totalTransactions,
      totalAmount: report.totalAmount,
      averageAmount: report.averageAmount,
      methodBreakdown: report.methodBreakdown, // card, virtual_account, etc.
      successRate: report.successRate,
      refundRate: report.refundRate,
      virtualAccountMetrics: report.virtualAccountMetrics
    });
  }

  return result;
};
```

---

## 🎨 Frontend UI Components

### 1. Payment Method Selection

```jsx
// React component for payment method selection
const PaymentMethodSelector = ({ onMethodSelect, amount }) => {
  const [selectedMethod, setSelectedMethod] = useState('card');

  const paymentMethods = [
    {
      id: 'card',
      name: '신용카드/체크카드',
      icon: '💳',
      description: '즉시 결제 완료'
    },
    {
      id: 'virtual_account',
      name: '가상계좌',
      icon: '🏦',
      description: '계좌번호로 입금'
    },
    {
      id: 'transfer',
      name: '계좌이체',
      icon: '💰',
      description: '본인 계좌에서 이체'
    },
    {
      id: 'mobile',
      name: '휴대폰 소액결제',
      icon: '📱',
      description: '휴대폰 요금과 함께 결제'
    }
  ];

  return (
    <div className="payment-method-selector">
      <h3>결제 방법 선택</h3>
      <div className="payment-amount">
        결제 금액: {amount.toLocaleString()}원
      </div>

      {paymentMethods.map(method => (
        <div
          key={method.id}
          className={`payment-method ${selectedMethod === method.id ? 'selected' : ''}`}
          onClick={() => {
            setSelectedMethod(method.id);
            onMethodSelect(method.id);
          }}
        >
          <span className="icon">{method.icon}</span>
          <div className="info">
            <div className="name">{method.name}</div>
            <div className="description">{method.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 2. Virtual Account Display

```jsx
// Component for displaying virtual account information
const VirtualAccountInfo = ({ virtualAccount, amount, dueDate }) => {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Show toast notification
  };

  return (
    <div className="virtual-account-info">
      <h3>가상계좌 입금 정보</h3>

      <div className="account-details">
        <div className="bank-info">
          <label>은행명</label>
          <span>{virtualAccount.bankName}</span>
        </div>

        <div className="account-number">
          <label>계좌번호</label>
          <div className="copy-field">
            <span>{virtualAccount.accountNumber}</span>
            <button onClick={() => copyToClipboard(virtualAccount.accountNumber)}>
              복사
            </button>
          </div>
        </div>

        <div className="holder-name">
          <label>예금주</label>
          <span>{virtualAccount.holderName}</span>
        </div>

        <div className="amount">
          <label>입금 금액</label>
          <span className="highlight">{amount.toLocaleString()}원</span>
        </div>

        <div className="due-date">
          <label>입금 기한</label>
          <span>{new Date(dueDate).toLocaleString()}</span>
        </div>
      </div>

      <div className="instructions">
        <h4>입금 안내</h4>
        <ul>
          <li>위 계좌로 정확한 금액을 입금해주세요.</li>
          <li>입금자명은 예약자명과 동일해야 합니다.</li>
          <li>입금 확인 후 자동으로 예약이 확정됩니다.</li>
          <li>기한 내 입금하지 않으면 예약이 취소됩니다.</li>
        </ul>
      </div>
    </div>
  );
};
```

### 3. Payment Status Component

```jsx
// Real-time payment status component
const PaymentStatusTracker = ({ paymentId }) => {
  const [status, setStatus] = useState('pending');
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const socket = connectPaymentWebSocket(paymentId, {
      onStatusUpdate: (data) => {
        setStatus(data.status);
        setPaymentData(data);
      },
      onPaymentSuccess: (data) => {
        // Redirect to success page or show success modal
        window.location.href = '/payment/success';
      },
      onPaymentFailure: (data) => {
        // Show failure modal
        showPaymentFailureModal(data);
      },
      onVirtualAccountIssued: (data) => {
        // Show virtual account information
        setStatus('virtual_account_issued');
        setPaymentData(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [paymentId]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          message: '결제 준비 중...',
          color: 'orange'
        };
      case 'virtual_account_issued':
        return {
          icon: '🏦',
          message: '가상계좌 발급 완료',
          color: 'blue'
        };
      case 'paid':
        return {
          icon: '✅',
          message: '결제 완료',
          color: 'green'
        };
      case 'failed':
        return {
          icon: '❌',
          message: '결제 실패',
          color: 'red'
        };
      default:
        return {
          icon: '⏳',
          message: '처리 중...',
          color: 'gray'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="payment-status-tracker">
      <div className={`status-indicator ${statusDisplay.color}`}>
        <span className="icon">{statusDisplay.icon}</span>
        <span className="message">{statusDisplay.message}</span>
      </div>

      {status === 'virtual_account_issued' && paymentData?.virtualAccount && (
        <VirtualAccountInfo
          virtualAccount={paymentData.virtualAccount}
          amount={paymentData.amount}
          dueDate={paymentData.expiresAt}
        />
      )}
    </div>
  );
};
```

---

## 🚀 Implementation Steps

### Phase 1: Basic Payment Integration (Week 1)
1. **Environment Setup**: Verify all environment variables are configured
2. **Database Migration**: Execute the SQL migration manually via Supabase dashboard
3. **Basic Payment Flow**: Implement payment initialization for card payments
4. **Status Monitoring**: Add basic payment status checking

### Phase 2: Advanced Features (Week 2)
1. **Virtual Account**: Implement virtual account payment flow
2. **Real-time Updates**: Integrate WebSocket for real-time status updates
3. **Error Handling**: Add comprehensive error handling and user feedback
4. **UI Components**: Create reusable payment UI components

### Phase 3: Admin Dashboard (Week 3)
1. **Payment Management**: Build admin payment listing and details
2. **Refund System**: Implement refund initiation and tracking
3. **Financial Reporting**: Add PortOne-specific financial reports
4. **Monitoring Dashboard**: Create payment method performance metrics

### Phase 4: Testing & Optimization (Week 4)
1. **Integration Testing**: Test all payment methods end-to-end
2. **Performance Optimization**: Optimize API calls and database queries
3. **Security Review**: Ensure all security best practices are implemented
4. **Documentation**: Complete user and developer documentation

---

## 🔐 Security Considerations

### 1. API Security
- Always use HTTPS in production
- Validate JWT tokens on every request
- Implement rate limiting for payment endpoints
- Log all payment-related activities for audit

### 2. Data Protection
- Never store sensitive payment data on frontend
- Use secure storage for JWT tokens
- Implement proper session management
- Encrypt sensitive data in transit and at rest

### 3. Webhook Security
- Verify webhook signatures using `PORTONE_V2_WEBHOOK_SECRET`
- Validate webhook payload structure
- Implement idempotency for webhook processing
- Use HTTPS endpoints for webhook URLs

### 4. Frontend Security
```javascript
// Example: Secure token storage
const secureTokenStorage = {
  setToken: (token) => {
    // Use secure storage (not localStorage for sensitive data)
    sessionStorage.setItem('auth_token', token);
  },

  getToken: () => {
    return sessionStorage.getItem('auth_token');
  },

  removeToken: () => {
    sessionStorage.removeItem('auth_token');
  }
};

// Example: Request interceptor with token validation
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api/v1'
});

apiClient.interceptors.request.use((config) => {
  const token = secureTokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      secureTokenStorage.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 🧪 Testing Guidelines

### 1. Test Data
Use the configured test values:
- Store ID: `test_store_id`
- Channel Key: `test_channel_key`
- API Secret: `test_api_secret_for_development`

### 2. Payment Method Testing
```javascript
// Test different payment methods
const testPaymentMethods = [
  {
    method: 'card',
    testCards: [
      { number: '4111111111111111', cvc: '123', expiry: '12/25' },
      { number: '5555555555554444', cvc: '123', expiry: '12/25' }
    ]
  },
  {
    method: 'virtual_account',
    testBanks: ['KB', 'NH', 'SHINHAN', 'WOORI']
  }
];
```

### 3. Error Scenario Testing
- Network failures
- Invalid payment data
- Expired payments
- Insufficient funds
- Webhook failures

---

## 📞 Support & Troubleshooting

### Common Issues

1. **Payment Initialization Fails**
   - Check environment variables
   - Verify database migration is complete
   - Ensure proper authentication

2. **Status Updates Not Working**
   - Verify WebSocket connection
   - Check webhook configuration
   - Ensure proper event handling

3. **Virtual Account Issues**
   - Verify bank code compatibility
   - Check due date configuration
   - Ensure proper account number format

### Debug Commands
```bash
# Check server health
curl http://localhost:3001/health

# Verify migration status
npm run migrate:portone-v2:check

# Run comprehensive tests
npm run test:integration:payment
```

### Getting Help
- Backend API Documentation: http://localhost:3001/api-docs
- Admin API Documentation: http://localhost:3001/admin-docs
- PortOne Official Documentation: https://developers.portone.io/

---

## ✅ Verification Checklist

Before going live, ensure:

- [ ] Database migration executed successfully
- [ ] All environment variables configured
- [ ] Payment initialization works for all methods
- [ ] Real-time status updates functional
- [ ] Virtual account flow tested
- [ ] Admin dashboard operational
- [ ] Refund system working
- [ ] Webhook security implemented
- [ ] Error handling comprehensive
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Documentation updated

---

*This guide provides the foundation for implementing PortOne V2 payment integration with the 에뷰리띵 backend. For specific implementation details or troubleshooting, refer to the API documentation or contact the backend development team.*