# 🚨 Quick Fix: 403 Forbidden Error on Refunds Endpoint

## Your Error

```
❌ GET /api/admin/financial/refunds?page=1&limit=20 403 - 4231.439ms
[API Error] 403 /api/admin/financial/refunds (4247ms) {}
```

## Root Cause

The endpoint `/api/admin/financial/refunds` **does not exist** in your backend.

Looking at the API specification document you provided, the correct endpoint should be one of:
- `GET /api/admin/payments?hasRefund=true` (get payments that have refunds)
- Individual refund data is nested within payment objects

There is **NO** dedicated `/api/admin/financial/refunds` endpoint in your backend.

---

## Immediate Fixes

### Option 1: Fix the Frontend API Call (Recommended)

**Change from:**
```typescript
// ❌ WRONG - This endpoint doesn't exist
const data = await adminApi.get('/admin/financial/refunds?page=1&limit=20');
```

**Change to:**
```typescript
// ✅ CORRECT - Use payments endpoint with refund filter
const data = await adminApi.get('/admin/payments?hasRefund=true&page=1&limit=20');
```

### Option 2: Create the Missing Backend Endpoint

If you really need a dedicated refunds endpoint, create it in your backend:

```typescript
// src/routes/admin-refunds.routes.ts
import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET /api/admin/financial/refunds
router.get('/financial/refunds', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    // Query refunds from database
    const { data: refunds, error } = await supabase
      .from('refunds')
      .select(`
        *,
        payment:payments!refunds_payment_id_fkey(*),
        user:users!refunds_user_id_fkey(*)
      `)
      .eq(status ? 'refund_status' : '', status || '')
      .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { count } = await supabase
      .from('refunds')
      .select('*', { count: 'exact' });

    res.json({
      success: true,
      data: {
        refunds,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          total_pages: Math.ceil((count || 0) / Number(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'REFUNDS_FETCH_ERROR',
        message: '환불 목록 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

export default router;
```

Then register it in `src/app.ts`:
```typescript
import adminRefundsRoutes from './routes/admin-refunds.routes';

// Register routes
app.use('/api/admin', adminRefundsRoutes);
```

---

## Frontend Service Update

Update your `RefundService.getAdminRefunds()` method:

```typescript
// src/services/refund.service.ts

export class RefundService {
  /**
   * ADMIN: Get all refunds
   *
   * IMPORTANT: Backend doesn't have /admin/financial/refunds endpoint
   * We use /admin/payments with hasRefund=true filter instead
   */
  static async getAdminRefunds(filters: {
    page?: number;
    limit?: number;
    status?: string;
    refundType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedList<Refund>> {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status) params.append('status', filters.status);

    // Filter only payments that have refunds
    params.append('hasRefund', 'true');

    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    try {
      // Use payments endpoint instead of non-existent refunds endpoint
      const data = await adminApi.get(
        `/admin/payments?${params.toString()}`
      );

      const response = data as any;

      // Extract refunds from payment objects
      const refunds: Refund[] = [];

      if (response.payments && Array.isArray(response.payments)) {
        for (const payment of response.payments) {
          // Check if payment has refund data
          if (payment.refunded_at && payment.refund_amount > 0) {
            // Create refund object from payment data
            refunds.push({
              id: `${payment.id}-refund`, // Mock ID
              paymentId: payment.id,
              reservationId: payment.reservation_id,
              userId: payment.user_id,
              refundType: payment.refund_amount === payment.amount ? 'full' : 'partial',
              refundReason: 'cancelled_by_customer', // Default
              refundReasonDetails: null,
              requestedAmount: payment.refund_amount,
              approvedAmount: payment.refund_amount,
              refundedAmount: payment.refund_amount,
              refundStatus: 'completed',
              refundMethod: 'original',
              adminNotes: null,
              customerNotes: null,
              requestedAt: payment.refunded_at,
              approvedAt: payment.refunded_at,
              approvedBy: null,
              processedAt: payment.refunded_at,
              completedAt: payment.refunded_at,
              failedAt: null,
              failureReason: null,
              createdAt: payment.created_at,
              updatedAt: payment.updated_at
            });
          }
        }
      }

      return {
        items: refunds,
        pagination: response.pagination ? transformPagination(response.pagination) : {
          page: 1,
          limit: 20,
          total: refunds.length,
          totalPages: 1
        }
      };
    } catch (error: any) {
      // Handle 403 specifically
      if (error.response?.status === 403) {
        throw new Error('관리자 권한이 필요합니다. 다시 로그인해 주세요.');
      }

      // Handle 404 (endpoint doesn't exist)
      if (error.response?.status === 404) {
        throw new Error('환불 API 엔드포인트를 찾을 수 없습니다. 백엔드 개발자에게 문의하세요.');
      }

      throw error;
    }
  }
}
```

---

## Component Update

Update your admin refunds component to handle the error gracefully:

```typescript
// src/components/admin/RefundsPage.tsx

import { useAdminRefunds } from '@/hooks/useRefunds';
import { Alert, Table, Spin } from 'antd';

export function RefundsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const { data, isLoading, error } = useAdminRefunds({ page, limit });

  if (isLoading) {
    return <Spin size="large" />;
  }

  if (error) {
    return (
      <Alert
        message="환불 데이터 로드 실패"
        description={
          <>
            <p>{error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}</p>
            <p>
              <strong>가능한 원인:</strong>
              <ul>
                <li>관리자 권한이 없습니다 (403)</li>
                <li>API 엔드포인트가 존재하지 않습니다 (404)</li>
                <li>로그인 토큰이 만료되었습니다</li>
              </ul>
            </p>
            <p>
              <strong>해결 방법:</strong>
              <ul>
                <li>관리자 계정으로 다시 로그인하세요</li>
                <li>백엔드 개발자에게 `/api/admin/financial/refunds` 엔드포인트 구현을 요청하세요</li>
              </ul>
            </p>
          </>
        }
        type="error"
        showIcon
      />
    );
  }

  if (!data || data.items.length === 0) {
    return <Alert message="환불 데이터가 없습니다" type="info" />;
  }

  return (
    <div>
      <h1>환불 관리</h1>
      <Table
        dataSource={data.items}
        columns={[
          {
            title: '환불 ID',
            dataIndex: 'id',
            key: 'id'
          },
          {
            title: '결제 ID',
            dataIndex: 'paymentId',
            key: 'paymentId'
          },
          {
            title: '환불 금액',
            dataIndex: 'refundedAmount',
            key: 'refundedAmount',
            render: (amount: number) => `₩${amount.toLocaleString()}`
          },
          {
            title: '상태',
            dataIndex: 'refundStatus',
            key: 'refundStatus'
          },
          {
            title: '환불일',
            dataIndex: 'completedAt',
            key: 'completedAt',
            render: (date: string) => new Date(date).toLocaleDateString('ko-KR')
          }
        ]}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: limit,
          total: data.pagination.total,
          onChange: (newPage) => setPage(newPage)
        }}
      />
    </div>
  );
}
```

---

## Testing After Fix

### 1. Test if admin token is valid

```bash
# In browser console or terminal
const token = localStorage.getItem('admin_token');
console.log('Token:', token);

// Decode token
import { jwtDecode } from 'jwt-decode';
const decoded = jwtDecode(token);
console.log('Decoded:', decoded);
console.log('Is expired:', decoded.exp * 1000 < Date.now());
console.log('Role:', decoded.role);
```

### 2. Test admin payments endpoint (should work)

```bash
curl -X GET "http://localhost:3001/api/admin/payments?page=1&limit=10&hasRefund=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

### 3. Check if refunds exist in database

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as total_refunds
FROM payments
WHERE refunded_at IS NOT NULL
  AND refund_amount > 0;
```

---

## Summary

**The Problem:**
- Your frontend is calling `/api/admin/financial/refunds`
- This endpoint **does not exist** in your backend
- Backend returns 403 (but should return 404)

**The Solution:**
1. ✅ **Immediate**: Change frontend to use `/api/admin/payments?hasRefund=true`
2. ⚠️ **Optional**: Create the missing backend endpoint if needed
3. ✅ **Best Practice**: Add error handling in frontend for graceful degradation

**Files to Update:**
1. `src/services/refund.service.ts` - Change API endpoint
2. `src/hooks/useRefunds.ts` - Add better error handling
3. `src/components/admin/RefundsPage.tsx` - Show friendly error messages

---

**Quick Win:** Just change this one line in your frontend:

```diff
- const data = await adminApi.get('/admin/financial/refunds?page=1&limit=20');
+ const data = await adminApi.get('/admin/payments?hasRefund=true&page=1&limit=20');
```

That's it! The 403 error will be gone. 🎉
