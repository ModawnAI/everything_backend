# Implementation Plan: Payment History & Settlement Schedule

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 6-8 hours |
| **Risk Level** | Medium |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | None |

## Feedback Items Covered

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 마이페이지에 결제내역 추가, 결제당 쌓인 포인트 옆에 따로 적혀있기 | Frontend + Backend |
| 2 | 고객 결제시 결제 화면에서 포인트 사용액이 얼마 활용됐는지 확인 | Admin |
| 3 | '재무관리'에서 정산 예정. 0월 0일 000 금액 정산 예정 | Backend + Admin |

---

## Database Schema Changes

**File:** `src/migrations/XXX_add_settlement_schedule_table.sql`

```sql
-- Settlement schedules table
CREATE TABLE IF NOT EXISTS settlement_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  platform_fee_rate DECIMAL(5,4) DEFAULT 0.05, -- 5%
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, processing, completed, failed
  paid_at TIMESTAMPTZ,
  bank_account_info JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_settlement_shop ON settlement_schedules(shop_id);
CREATE INDEX idx_settlement_status ON settlement_schedules(status);
CREATE INDEX idx_settlement_date ON settlement_schedules(scheduled_date);

-- Function to calculate settlement
CREATE OR REPLACE FUNCTION calculate_shop_settlement(
  p_shop_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_sales DECIMAL,
  platform_fee DECIMAL,
  net_amount DECIMAL,
  reservation_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fee_rate DECIMAL := 0.05; -- 5% platform fee
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.amount), 0) AS total_sales,
    COALESCE(SUM(p.amount) * v_fee_rate, 0) AS platform_fee,
    COALESCE(SUM(p.amount) * (1 - v_fee_rate), 0) AS net_amount,
    COUNT(DISTINCT r.id)::INTEGER AS reservation_count
  FROM reservations r
  JOIN payments p ON r.id = p.reservation_id
  WHERE r.shop_id = p_shop_id
    AND r.status = 'completed'
    AND p.status = 'completed'
    AND r.reservation_date >= p_start_date
    AND r.reservation_date <= p_end_date;
END;
$$;
```

---

## Backend Implementation

### Step 1: Create Settlement Types

**File:** `src/types/settlement.types.ts`

```typescript
/**
 * Settlement Type Definitions
 */

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Settlement {
  id: string;
  shopId: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  platformFee: number;
  platformFeeRate: number;
  netAmount: number;
  scheduledDate: string;
  status: SettlementStatus;
  paidAt: string | null;
  bankAccountInfo: BankAccountInfo | null;
  notes: string | null;
  createdAt: string;
}

export interface BankAccountInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface UpcomingSettlement {
  scheduledDate: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmount: number;
  reservationCount: number;
  platformFee: number;
  netAmount: number;
}

export interface PaymentHistoryItem {
  id: string;
  shopName: string;
  serviceName: string;
  reservationDate: string;
  paymentDate: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  pointsUsed: number;
  pointsEarned: number;
  status: string;
}
```

### Step 2: Create Settlement Service

**File:** `src/services/settlement.service.ts`

```typescript
/**
 * Settlement Service
 * Handles shop payment settlements
 */

import { supabase } from '@/config/supabase';
import { Settlement, UpcomingSettlement } from '@/types/settlement.types';

export class SettlementService {
  private readonly SETTLEMENT_DAY = 15; // Day of month for settlement
  private readonly PAYOUT_DELAY_DAYS = 7;

  /**
   * Get upcoming settlement for a shop
   */
  async getUpcomingSettlement(shopId: string): Promise<UpcomingSettlement | null> {
    // Calculate period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate scheduled date
    const scheduledDate = new Date(now.getFullYear(), now.getMonth(), this.SETTLEMENT_DAY);
    if (scheduledDate < now) {
      scheduledDate.setMonth(scheduledDate.getMonth() + 1);
    }

    // Get settlement calculation
    const { data, error } = await supabase.rpc('calculate_shop_settlement', {
      p_shop_id: shopId,
      p_start_date: periodStart.toISOString().split('T')[0],
      p_end_date: periodEnd.toISOString().split('T')[0],
    });

    if (error) {
      console.error('Settlement calculation error:', error);
      return null;
    }

    const result = data?.[0];
    if (!result || result.total_sales === 0) {
      return null;
    }

    return {
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      estimatedAmount: result.total_sales,
      reservationCount: result.reservation_count,
      platformFee: result.platform_fee,
      netAmount: result.net_amount,
    };
  }

  /**
   * Get settlement history
   */
  async getSettlementHistory(
    shopId: string,
    limit = 12
  ): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlement_schedules')
      .select('*')
      .eq('shop_id', shopId)
      .order('scheduled_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get settlement history: ${error.message}`);
    }

    return (data || []).map((s) => ({
      id: s.id,
      shopId: s.shop_id,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      totalSales: parseFloat(s.total_sales),
      platformFee: parseFloat(s.platform_fee),
      platformFeeRate: parseFloat(s.platform_fee_rate),
      netAmount: parseFloat(s.net_amount),
      scheduledDate: s.scheduled_date,
      status: s.status,
      paidAt: s.paid_at,
      bankAccountInfo: s.bank_account_info,
      notes: s.notes,
      createdAt: s.created_at,
    }));
  }
}

export const settlementService = new SettlementService();
```

### Step 3: Create Payment History Service

**File:** `src/services/payment-history.service.ts`

```typescript
/**
 * Payment History Service
 * User payment history with point info
 */

import { supabase } from '@/config/supabase';
import { PaymentHistoryItem } from '@/types/settlement.types';

export class PaymentHistoryService {
  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ payments: PaymentHistoryItem[]; total: number }> {
    // Get payments
    const { data, error, count } = await supabase
      .from('payments')
      .select(
        `
        id,
        amount,
        deposit_amount,
        balance_amount,
        points_used,
        status,
        created_at,
        reservation:reservations!inner (
          id,
          reservation_date,
          shop:shops!inner (
            id,
            name
          ),
          service:shop_services (
            name
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get payment history: ${error.message}`);
    }

    // Get points earned for each payment
    const paymentIds = (data || []).map((p) => p.id);
    const { data: pointsData } = await supabase
      .from('point_transactions')
      .select('source_id, amount')
      .in('source_id', paymentIds)
      .eq('source_type', 'payment')
      .gt('amount', 0);

    const pointsMap = new Map(
      (pointsData || []).map((p) => [p.source_id, p.amount])
    );

    const payments: PaymentHistoryItem[] = (data || []).map((p) => ({
      id: p.id,
      shopName: p.reservation?.shop?.name || '',
      serviceName: p.reservation?.service?.name || '',
      reservationDate: p.reservation?.reservation_date || '',
      paymentDate: p.created_at,
      totalAmount: p.amount,
      depositAmount: p.deposit_amount || 0,
      balanceAmount: p.balance_amount || 0,
      pointsUsed: p.points_used || 0,
      pointsEarned: pointsMap.get(p.id) || 0,
      status: p.status,
    }));

    return { payments, total: count || 0 };
  }
}

export const paymentHistoryService = new PaymentHistoryService();
```

### Step 4: Create API Endpoints

**File:** `src/controllers/payment.controller.ts` (add)

```typescript
/**
 * GET /api/payments/history
 * Get user's payment history
 */
async getUserPaymentHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { limit = '20', offset = '0' } = req.query;

  const result = await paymentHistoryService.getUserPaymentHistory(
    userId,
    parseInt(limit as string),
    parseInt(offset as string)
  );

  res.json({
    success: true,
    data: result,
  });
}
```

**File:** `src/controllers/shop-owner/financial.controller.ts` (add)

```typescript
/**
 * GET /shop-owner/settlements/upcoming
 * Get upcoming settlement
 */
async getUpcomingSettlement(req: Request, res: Response): Promise<void> {
  const shopId = req.shop!.id;

  const settlement = await settlementService.getUpcomingSettlement(shopId);

  res.json({
    success: true,
    data: settlement,
  });
}

/**
 * GET /shop-owner/settlements/history
 * Get settlement history
 */
async getSettlementHistory(req: Request, res: Response): Promise<void> {
  const shopId = req.shop!.id;
  const { limit = '12' } = req.query;

  const history = await settlementService.getSettlementHistory(
    shopId,
    parseInt(limit as string)
  );

  res.json({
    success: true,
    data: history,
  });
}
```

---

## Frontend Implementation

### Step 5: Create Payment History Page

**File:** `src/app/profile/payments/page.tsx`

```tsx
'use client';

import React from 'react';
import { ArrowLeft, CreditCard, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PaymentHistoryItem {
  id: string;
  shopName: string;
  serviceName: string;
  reservationDate: string;
  paymentDate: string;
  totalAmount: number;
  pointsUsed: number;
  pointsEarned: number;
  status: string;
}

const statusLabels: Record<string, { text: string; color: string }> = {
  completed: { text: '결제완료', color: 'bg-green-100 text-green-700' },
  pending: { text: '대기중', color: 'bg-yellow-100 text-yellow-700' },
  refunded: { text: '환불됨', color: 'bg-gray-100 text-gray-700' },
  cancelled: { text: '취소됨', color: 'bg-red-100 text-red-700' },
};

export default function PaymentHistoryPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: async () => {
      const response = await api.get('/payments/history');
      return response.data.data;
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">결제 내역</h1>
        </div>
      </header>

      {/* Payment List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))
        ) : (
          data?.payments?.map((payment: PaymentHistoryItem) => (
            <Card key={payment.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium">{payment.shopName}</h3>
                  <p className="text-sm text-gray-500">{payment.serviceName}</p>
                </div>
                <Badge
                  className={cn(
                    'text-xs',
                    statusLabels[payment.status]?.color
                  )}
                >
                  {statusLabels[payment.status]?.text}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  {format(new Date(payment.paymentDate), 'M월 d일', { locale: ko })}
                </span>
                <span className="font-semibold">
                  ₩{payment.totalAmount.toLocaleString()}
                </span>
              </div>

              {/* Points Info */}
              <div className="flex gap-4 mt-3 pt-3 border-t">
                {payment.pointsUsed > 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <CreditCard className="h-3 w-3" />
                    <span>-{payment.pointsUsed.toLocaleString()}P 사용</span>
                  </div>
                )}
                {payment.pointsEarned > 0 && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Gift className="h-3 w-3" />
                    <span>+{payment.pointsEarned.toLocaleString()}P 적립</span>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}

        {data?.payments?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>결제 내역이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 6: Add to MyPage

**File:** `src/app/profile/page.tsx` (add link)

```tsx
<Link href="/profile/payments" className="flex items-center justify-between p-4 border-b">
  <div className="flex items-center gap-3">
    <CreditCard className="h-5 w-5 text-gray-600" />
    <span>결제 내역</span>
  </div>
  <ChevronRight className="h-5 w-5 text-gray-400" />
</Link>
```

---

## Admin Implementation

### Step 7: Settlement Schedule Component

**File:** `src/app/dashboard/my-shop/financial/page.tsx` (add section)

```tsx
'use client';

import React from 'react';
import { CalendarDays, TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface UpcomingSettlement {
  scheduledDate: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmount: number;
  reservationCount: number;
  platformFee: number;
  netAmount: number;
}

export function SettlementSection() {
  const { data: settlement, isLoading } = useQuery<UpcomingSettlement>({
    queryKey: ['upcomingSettlement'],
    queryFn: async () => {
      const response = await adminApi.get('/shop-owner/settlements/upcoming');
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">정산 예정</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!settlement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">정산 예정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>이번 정산 예정 내역이 없습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">정산 예정</CardTitle>
          <Badge variant="outline">
            <CalendarDays className="h-3 w-3 mr-1" />
            {format(new Date(settlement.scheduledDate), 'M월 d일', { locale: ko })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-primary/5 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-1">예상 정산 금액</p>
          <p className="text-2xl font-bold text-primary">
            ₩{settlement.netAmount.toLocaleString()}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">정산 기간</span>
            <span>
              {format(new Date(settlement.periodStart), 'M/d', { locale: ko })} -{' '}
              {format(new Date(settlement.periodEnd), 'M/d', { locale: ko })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">총 매출</span>
            <span>₩{settlement.estimatedAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">플랫폼 수수료 (5%)</span>
            <span className="text-red-600">
              -₩{settlement.platformFee.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">완료 예약</span>
            <span>{settlement.reservationCount}건</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 8: Payment Point Usage in Reservation Details

**File:** `src/app/dashboard/my-shop/operations/page.tsx` (add to reservation detail)

```tsx
// In reservation detail view, show point usage
const ReservationPaymentInfo = ({ reservation }) => {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <h4 className="font-medium text-sm">결제 정보</h4>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">서비스 금액</span>
          <span>₩{reservation.totalAmount?.toLocaleString()}</span>
        </div>

        {reservation.pointsUsed > 0 && (
          <div className="flex justify-between text-red-600">
            <span>포인트 사용</span>
            <span>-₩{reservation.pointsUsed.toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between font-semibold pt-2 border-t">
          <span>실결제액</span>
          <span>
            ₩{(reservation.totalAmount - (reservation.pointsUsed || 0)).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

## Files Summary

### Backend

| File | Action |
|------|--------|
| `src/migrations/XXX_add_settlement_schedule_table.sql` | CREATE |
| `src/types/settlement.types.ts` | CREATE |
| `src/services/settlement.service.ts` | CREATE |
| `src/services/payment-history.service.ts` | CREATE |
| `src/controllers/payment.controller.ts` | MODIFY |
| `src/controllers/shop-owner/financial.controller.ts` | MODIFY |
| `src/routes/payment.routes.ts` | MODIFY |
| `src/routes/shop-owner/financial.routes.ts` | MODIFY |

### Frontend

| File | Action |
|------|--------|
| `src/app/profile/payments/page.tsx` | CREATE |
| `src/app/profile/page.tsx` | MODIFY |

### Admin

| File | Action |
|------|--------|
| `src/app/dashboard/my-shop/financial/page.tsx` | MODIFY |
| `src/app/dashboard/my-shop/operations/page.tsx` | MODIFY |

---

## Testing Checklist

- [ ] Payment history shows all user payments
- [ ] Points used/earned displayed per payment
- [ ] Settlement calculation is accurate
- [ ] Upcoming settlement shows correct date
- [ ] Platform fee calculated correctly (5%)
- [ ] Settlement history loads
- [ ] Point usage visible in shop admin
