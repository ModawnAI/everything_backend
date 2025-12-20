# Implementation Plan: Point Summary Widget & Enhanced History

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 5-7 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Frontend |
| **Dependencies** | None |

## Feedback Items Covered

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 홈 화면 제일 상단에 포인트내역 (보유포인트, 총 적립, 총 사용, 오늘 쌓인 포인트) | Frontend + Backend |
| 2 | 날짜별(캘린더 선택) 쌓인 포인트 볼 수 있게 | Frontend + Backend |
| 3 | 친구가 결제해서 포인트 쌓이면 '{닉네임}님 덕분에 +125 point 적립!' | Frontend + Backend |
| 4 | 친구가 결제 후 즉시 '친구 덕분에 용돈 받았어요!' 알림 | Backend (FCM) |

---

## Database Schema Changes

**File:** `src/migrations/XXX_update_point_transactions_referrer.sql`

```sql
-- Add referrer information to point transactions
ALTER TABLE point_transactions
ADD COLUMN IF NOT EXISTS referrer_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS referrer_nickname VARCHAR(100);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_date
ON point_transactions(user_id, created_at DESC);

-- Create index for referral queries
CREATE INDEX IF NOT EXISTS idx_point_transactions_referrer
ON point_transactions(referrer_user_id)
WHERE referrer_user_id IS NOT NULL;
```

---

## Backend Implementation

### Step 1: Create Point Summary Types

**File:** `src/types/point.types.ts` (add)

```typescript
// Point summary for home widget
export interface PointSummary {
  currentBalance: number;
  totalEarned: number;
  totalUsed: number;
  todayEarned: number;
}

// Enhanced point transaction with referrer info
export interface PointTransactionWithReferrer {
  id: string;
  userId: string;
  type: string;
  amount: number;
  description: string;
  referrerNickname?: string;
  createdAt: string;
}

// Point history filters
export interface PointHistoryFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// Point history response
export interface PointHistoryResponse {
  transactions: PointTransactionWithReferrer[];
  summary: {
    totalEarned: number;
    totalUsed: number;
    periodStart?: string;
    periodEnd?: string;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### Step 2: Update Point Service

**File:** `src/services/point.service.ts` (add methods)

```typescript
import { supabase } from '@/config/supabase';
import { notificationService } from '@/services/notification.service';
import {
  PointSummary,
  PointHistoryFilters,
  PointHistoryResponse,
  PointTransactionWithReferrer,
} from '@/types/point.types';

export class PointService {
  // ... existing methods ...

  /**
   * Get point summary for home widget
   */
  async getPointSummary(userId: string): Promise<PointSummary> {
    // Get current balance
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('point_balance')
      .eq('id', userId)
      .single();

    if (userError) {
      throw new Error(`Failed to get user balance: ${userError.message}`);
    }

    // Get aggregates from transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Total earned
    const { data: earnedData } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0);

    const totalEarned = (earnedData || []).reduce((sum, t) => sum + t.amount, 0);

    // Total used
    const { data: usedData } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .lt('amount', 0);

    const totalUsed = Math.abs((usedData || []).reduce((sum, t) => sum + t.amount, 0));

    // Today earned
    const { data: todayData } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
      .gte('created_at', todayISO);

    const todayEarned = (todayData || []).reduce((sum, t) => sum + t.amount, 0);

    return {
      currentBalance: userData?.point_balance || 0,
      totalEarned,
      totalUsed,
      todayEarned,
    };
  }

  /**
   * Get point history with date filtering and referrer info
   */
  async getPointHistory(
    userId: string,
    filters: PointHistoryFilters
  ): Promise<PointHistoryResponse> {
    const { startDate, endDate, type, limit = 20, offset = 0 } = filters;

    let query = supabase
      .from('point_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply date filters
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`);
    }

    // Apply type filter
    if (type) {
      query = query.eq('type', type);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get point history: ${error.message}`);
    }

    // Transform transactions
    const transactions: PointTransactionWithReferrer[] = (data || []).map((t) => ({
      id: t.id,
      userId: t.user_id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      referrerNickname: t.referrer_nickname,
      createdAt: t.created_at,
    }));

    // Calculate summary for the period
    const { data: summaryData } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', startDate ? `${startDate}T00:00:00Z` : '1970-01-01')
      .lte('created_at', endDate ? `${endDate}T23:59:59Z` : '2100-01-01');

    const periodEarned = (summaryData || [])
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const periodUsed = Math.abs(
      (summaryData || [])
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    return {
      transactions,
      summary: {
        totalEarned: periodEarned,
        totalUsed: periodUsed,
        periodStart: startDate,
        periodEnd: endDate,
      },
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    };
  }

  /**
   * Earn referral points with notification
   */
  async earnReferralPoints(
    referrerId: string,
    referrerNickname: string,
    friendUserId: string,
    friendNickname: string,
    paymentAmount: number,
    pointsEarned: number
  ): Promise<void> {
    // Create point transaction with referrer info
    const { error } = await supabase.from('point_transactions').insert({
      user_id: referrerId,
      type: 'referral_reward',
      amount: pointsEarned,
      description: `${friendNickname}님 추천 보상`,
      referrer_user_id: friendUserId,
      referrer_nickname: friendNickname,
      source_type: 'referral',
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to create point transaction: ${error.message}`);
    }

    // Update user balance
    await supabase.rpc('increment_point_balance', {
      p_user_id: referrerId,
      p_amount: pointsEarned,
    });

    // Send push notification
    await notificationService.sendReferralPointNotification(
      referrerId,
      friendNickname,
      pointsEarned
    );
  }
}

export const pointService = new PointService();
```

### Step 3: Update Notification Service

**File:** `src/services/notification.service.ts` (add method)

```typescript
/**
 * Send referral point earned notification
 */
async sendReferralPointNotification(
  userId: string,
  friendNickname: string,
  points: number
): Promise<void> {
  const title = '🎉 친구 덕분에 용돈 받았어요!';
  const body = `${friendNickname}님 덕분에 ${points.toLocaleString()}P가 적립되었습니다.`;

  await this.sendPushNotification(userId, {
    title,
    body,
    data: {
      type: 'referral_point_earned',
      points: points.toString(),
      friendNickname,
    },
  });

  // Also create in-app notification
  await this.createNotification(userId, {
    type: 'point',
    title,
    message: body,
    data: { points, friendNickname },
  });
}
```

### Step 4: Create API Endpoints

**File:** `src/controllers/point.controller.ts` (add methods)

```typescript
/**
 * GET /api/points/summary
 * Get point summary for home widget
 */
async getPointSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const summary = await pointService.getPointSummary(userId);

  res.json({
    success: true,
    data: summary,
  });
}

/**
 * GET /api/points/history
 * Get point history with filters
 */
async getPointHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { startDate, endDate, type, limit, offset } = req.query;

  const history = await pointService.getPointHistory(userId, {
    startDate: startDate as string,
    endDate: endDate as string,
    type: type as string,
    limit: limit ? parseInt(limit as string) : 20,
    offset: offset ? parseInt(offset as string) : 0,
  });

  res.json({
    success: true,
    data: history,
  });
}
```

**File:** `src/routes/point.routes.ts` (add routes)

```typescript
// Get point summary
router.get('/summary', authenticate, asyncHandler((req, res) => pointController.getPointSummary(req, res)));

// Get point history with filters
router.get('/history', authenticate, asyncHandler((req, res) => pointController.getPointHistory(req, res)));
```

---

## Frontend Implementation

### Step 5: Create Point Summary Widget

**File:** `src/components/home/PointSummaryWidget.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, TrendingUp, TrendingDown, Sparkles, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface PointSummary {
  currentBalance: number;
  totalEarned: number;
  totalUsed: number;
  todayEarned: number;
}

export function PointSummaryWidget() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<PointSummary>({
    queryKey: ['pointSummary'],
    queryFn: async () => {
      const response = await api.get('/points/summary');
      return response.data.data;
    },
    enabled: isAuthenticated,
    staleTime: 30000, // 30 seconds
  });

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <Card className="mx-4 p-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const items = [
    {
      label: '보유 포인트',
      value: data?.currentBalance || 0,
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '총 적립',
      value: data?.totalEarned || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: '총 사용',
      value: data?.totalUsed || 0,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: '오늘 적립',
      value: data?.todayEarned || 0,
      icon: Sparkles,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <Link href="/points">
      <Card className="mx-4 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">내 포인트</h3>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center',
                  item.bgColor
                )}
              >
                <item.icon className={cn('h-4 w-4', item.color)} />
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className={cn('text-sm font-semibold', item.color)}>
                {item.value.toLocaleString()}P
              </p>
            </div>
          ))}
        </div>
      </Card>
    </Link>
  );
}
```

### Step 6: Create Date Range Picker

**File:** `src/components/points/DateRangePicker.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onRangeChange: (start: Date | undefined, end: Date | undefined) => void;
}

const presets = [
  { label: '오늘', getRange: () => ({ start: new Date(), end: new Date() }) },
  {
    label: '이번 주',
    getRange: () => ({
      start: startOfWeek(new Date(), { locale: ko }),
      end: endOfWeek(new Date(), { locale: ko }),
    }),
  },
  {
    label: '이번 달',
    getRange: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
  { label: '전체', getRange: () => ({ start: undefined, end: undefined }) },
];

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const displayText =
    startDate && endDate
      ? `${format(startDate, 'M/d', { locale: ko })} - ${format(endDate, 'M/d', { locale: ko })}`
      : '전체 기간';

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {/* Presets */}
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => {
            const range = preset.getRange();
            onRangeChange(range.start, range.end);
          }}
        >
          {preset.label}
        </Button>
      ))}

      {/* Custom Range */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="whitespace-nowrap">
            <Calendar className="h-4 w-4 mr-1" />
            직접 선택
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={(range) => {
              onRangeChange(range?.from, range?.to);
              if (range?.from && range?.to) {
                setIsOpen(false);
              }
            }}
            locale={ko}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

### Step 7: Update Points Page

**File:** `src/app/points/page.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Gift, ShoppingBag, Users, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/points/DateRangePicker';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PointTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  referrerNickname?: string;
  createdAt: string;
}

const typeIcons: Record<string, any> = {
  referral_reward: Users,
  payment_reward: ShoppingBag,
  welcome_bonus: Gift,
  event: Sparkles,
};

export default function PointsPage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['pointHistory', startDate, endDate],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');

      const response = await api.get('/points/history', { params });
      return response.data.data;
    },
  });

  const handleRangeChange = (start: Date | undefined, end: Date | undefined) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">포인트 내역</h1>
        </div>
      </header>

      {/* Summary Card */}
      {data?.summary && (
        <Card className="m-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">기간 내 적립</p>
              <p className="text-lg font-bold text-green-600">
                +{data.summary.totalEarned.toLocaleString()}P
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">기간 내 사용</p>
              <p className="text-lg font-bold text-red-600">
                -{data.summary.totalUsed.toLocaleString()}P
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Date Filter */}
      <div className="px-4 py-2">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
        />
      </div>

      {/* Transaction List */}
      <div className="px-4 pb-4 space-y-2">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-16 w-full" />
            </Card>
          ))
        ) : (
          data?.transactions.map((tx: PointTransaction) => {
            const Icon = typeIcons[tx.type] || Sparkles;
            const isPositive = tx.amount > 0;

            return (
              <Card key={tx.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      isPositive ? 'bg-green-50' : 'bg-red-50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        isPositive ? 'text-green-600' : 'text-red-600'
                      )}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        {/* Referrer attribution */}
                        {tx.referrerNickname && (
                          <p className="text-xs text-primary mt-0.5">
                            🎁 {tx.referrerNickname}님 덕분에 적립!
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(tx.createdAt), 'M월 d일 HH:mm', {
                            locale: ko,
                          })}
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'font-semibold',
                          isPositive
                            ? 'text-green-600 border-green-200'
                            : 'text-red-600 border-red-200'
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount.toLocaleString()}P
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}

        {data?.transactions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>포인트 내역이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 8: Add Widget to Home Page

**File:** `src/app/page.tsx` (add to home)

```tsx
import { PointSummaryWidget } from '@/components/home/PointSummaryWidget';

// In the JSX, add at the top (for logged-in users)
<section className="pt-4">
  <PointSummaryWidget />
</section>
```

---

## Files Summary

### Backend

| File | Action |
|------|--------|
| `src/migrations/XXX_update_point_transactions_referrer.sql` | CREATE |
| `src/types/point.types.ts` | MODIFY |
| `src/services/point.service.ts` | MODIFY |
| `src/services/notification.service.ts` | MODIFY |
| `src/controllers/point.controller.ts` | MODIFY |
| `src/routes/point.routes.ts` | MODIFY |

### Frontend

| File | Action |
|------|--------|
| `src/components/home/PointSummaryWidget.tsx` | CREATE |
| `src/components/points/DateRangePicker.tsx` | CREATE |
| `src/app/points/page.tsx` | MODIFY |
| `src/app/page.tsx` | MODIFY |

---

## Testing Checklist

- [ ] Point summary API returns correct values
- [ ] Point summary widget displays on home page
- [ ] Date range filter works correctly
- [ ] Referrer nickname displays on referral transactions
- [ ] Push notification sent on referral point earning
- [ ] "전체 기간" shows all transactions
- [ ] Today/Week/Month presets work
- [ ] Custom date range picker works
