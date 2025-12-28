# Implementation Plan: Customer Management (Memos & Calendar)

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 6-8 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Admin |
| **Dependencies** | None |

## Feedback Items Covered

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 대시보드에 '이번달 신규고객' 추가. 달력기능 추가 | Backend + Admin |
| 2 | 고객관리 고객별로 메모값 입력하기 기능 | Backend + Admin |

---

## Database Schema

**File:** `src/migrations/XXX_add_customer_memos.sql`

```sql
-- Customer memos table
CREATE TABLE IF NOT EXISTS customer_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memo TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, customer_user_id)
);

CREATE INDEX idx_customer_memos_shop ON customer_memos(shop_id);
CREATE INDEX idx_customer_memos_customer ON customer_memos(customer_user_id);
```

---

## Backend Implementation

### Step 1: Customer Service

**File:** `src/services/shop-owner/customer.service.ts`

```typescript
import { supabase } from '@/config/supabase';

export interface ShopCustomer {
  id: string;
  nickname: string;
  email: string;
  profileImage: string | null;
  firstVisit: string;
  lastVisit: string;
  visitCount: number;
  totalSpent: number;
  memo: string | null;
}

export interface NewCustomersData {
  count: number;
  customers: ShopCustomer[];
  periodStart: string;
  periodEnd: string;
}

export class CustomerService {
  /**
   * Get new customers for a shop within a date range
   */
  async getNewCustomers(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<NewCustomersData> {
    // Get reservations in the period where it was the customer's first visit
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        user_id,
        reservation_date,
        user:users (
          id,
          nickname,
          email,
          profile_image
        )
      `)
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .gte('reservation_date', startDate)
      .lte('reservation_date', endDate)
      .order('reservation_date', { ascending: true });

    if (error) throw new Error(error.message);

    // Find first-time customers
    const firstTimeCustomers = new Map<string, any>();
    const seenBefore = new Set<string>();

    // Get all historical reservations to check if truly new
    const { data: allReservations } = await supabase
      .from('reservations')
      .select('user_id, reservation_date')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .lt('reservation_date', startDate);

    (allReservations || []).forEach((r) => seenBefore.add(r.user_id));

    (data || []).forEach((r) => {
      if (!seenBefore.has(r.user_id) && !firstTimeCustomers.has(r.user_id)) {
        firstTimeCustomers.set(r.user_id, {
          id: r.user_id,
          nickname: r.user?.nickname || 'Unknown',
          email: r.user?.email || '',
          profileImage: r.user?.profile_image,
          firstVisit: r.reservation_date,
          lastVisit: r.reservation_date,
          visitCount: 1,
          totalSpent: 0,
          memo: null,
        });
      }
    });

    return {
      count: firstTimeCustomers.size,
      customers: Array.from(firstTimeCustomers.values()),
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /**
   * Get customer memo
   */
  async getCustomerMemo(
    shopId: string,
    customerId: string
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('customer_memos')
      .select('memo')
      .eq('shop_id', shopId)
      .eq('customer_user_id', customerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data?.memo || null;
  }

  /**
   * Save customer memo
   */
  async saveCustomerMemo(
    shopId: string,
    customerId: string,
    memo: string,
    createdBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('customer_memos')
      .upsert({
        shop_id: shopId,
        customer_user_id: customerId,
        memo,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_id,customer_user_id',
      });

    if (error) throw new Error(error.message);
  }

  /**
   * Get all customers with memos
   */
  async getCustomersWithMemos(
    shopId: string,
    limit = 50,
    offset = 0
  ): Promise<{ customers: ShopCustomer[]; total: number }> {
    // Get unique customers from reservations
    const { data, error, count } = await supabase
      .from('reservations')
      .select(`
        user_id,
        user:users (
          id,
          nickname,
          email,
          profile_image
        )
      `, { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .order('reservation_date', { ascending: false });

    if (error) throw new Error(error.message);

    // Aggregate by customer
    const customerMap = new Map<string, any>();
    (data || []).forEach((r) => {
      if (!customerMap.has(r.user_id)) {
        customerMap.set(r.user_id, {
          id: r.user_id,
          nickname: r.user?.nickname || 'Unknown',
          email: r.user?.email || '',
          profileImage: r.user?.profile_image,
          visitCount: 1,
        });
      } else {
        customerMap.get(r.user_id).visitCount++;
      }
    });

    const customerIds = Array.from(customerMap.keys()).slice(offset, offset + limit);

    // Get memos for these customers
    const { data: memos } = await supabase
      .from('customer_memos')
      .select('customer_user_id, memo')
      .eq('shop_id', shopId)
      .in('customer_user_id', customerIds);

    const memoMap = new Map((memos || []).map((m) => [m.customer_user_id, m.memo]));

    const customers = customerIds.map((id) => ({
      ...customerMap.get(id),
      memo: memoMap.get(id) || null,
    }));

    return {
      customers,
      total: customerMap.size,
    };
  }
}

export const customerService = new CustomerService();
```

### Step 2: API Endpoints

**File:** `src/controllers/shop-owner/customer.controller.ts`

```typescript
import { Request, Response } from 'express';
import { customerService } from '@/services/shop-owner/customer.service';

export class CustomerController {
  async getNewCustomers(req: Request, res: Response): Promise<void> {
    const shopId = req.shop!.id;
    const { startDate, endDate } = req.query;

    const data = await customerService.getNewCustomers(
      shopId,
      startDate as string,
      endDate as string
    );

    res.json({ success: true, data });
  }

  async getCustomers(req: Request, res: Response): Promise<void> {
    const shopId = req.shop!.id;
    const { limit = '50', offset = '0' } = req.query;

    const data = await customerService.getCustomersWithMemos(
      shopId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ success: true, data });
  }

  async getCustomerMemo(req: Request, res: Response): Promise<void> {
    const shopId = req.shop!.id;
    const { customerId } = req.params;

    const memo = await customerService.getCustomerMemo(shopId, customerId);

    res.json({ success: true, data: { memo } });
  }

  async saveCustomerMemo(req: Request, res: Response): Promise<void> {
    const shopId = req.shop!.id;
    const userId = req.user!.id;
    const { customerId } = req.params;
    const { memo } = req.body;

    await customerService.saveCustomerMemo(shopId, customerId, memo, userId);

    res.json({ success: true, message: '메모가 저장되었습니다.' });
  }
}

export const customerController = new CustomerController();
```

**File:** `src/routes/shop-owner/customer.routes.ts`

```typescript
import { Router } from 'express';
import { customerController } from '@/controllers/shop-owner/customer.controller';
import { authenticate, requireShopOwner } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

router.use(authenticate, requireShopOwner);

router.get('/new', asyncHandler((req, res) => customerController.getNewCustomers(req, res)));
router.get('/', asyncHandler((req, res) => customerController.getCustomers(req, res)));
router.get('/:customerId/memo', asyncHandler((req, res) => customerController.getCustomerMemo(req, res)));
router.put('/:customerId/memo', asyncHandler((req, res) => customerController.saveCustomerMemo(req, res)));

export default router;
```

---

## Admin Implementation

### Step 3: New Customers Widget with Calendar

**File:** `src/components/dashboard/NewCustomersWidget.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { Users, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export function NewCustomersWidget() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['newCustomers', dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return null;
      const response = await adminApi.get('/shop-owner/customers/new', {
        params: {
          startDate: format(dateRange.from, 'yyyy-MM-dd'),
          endDate: format(dateRange.to, 'yyyy-MM-dd'),
        },
      });
      return response.data.data;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            신규 고객
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, 'M/d', { locale: ko })} - ${format(dateRange.to, 'M/d', { locale: ko })}`
                  : '기간 선택'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={ko}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary">
            <TrendingUp className="h-8 w-8" />
            {data?.count || 0}
          </div>
          <p className="text-sm text-gray-500 mt-1">명</p>
        </div>

        {data?.customers && data.customers.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">최근 신규 고객</h4>
            <div className="space-y-2">
              {data.customers.slice(0, 5).map((customer: any) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    {customer.nickname.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{customer.nickname}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(customer.firstVisit), 'M/d', { locale: ko })} 첫 방문
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 4: Customer Memo in Customer Detail

**File:** `src/app/dashboard/my-shop/customers/page.tsx` (update)

```tsx
'use client';

import React, { useState } from 'react';
import { Search, User, MessageSquare, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { toast } from 'sonner';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [memo, setMemo] = useState('');

  const { data } = useQuery({
    queryKey: ['shopCustomers'],
    queryFn: async () => {
      const response = await adminApi.get('/shop-owner/customers');
      return response.data.data;
    },
  });

  const saveMemoMutation = useMutation({
    mutationFn: async ({ customerId, memo }: { customerId: string; memo: string }) => {
      await adminApi.put(`/shop-owner/customers/${customerId}/memo`, { memo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shopCustomers']);
      toast.success('메모가 저장되었습니다.');
    },
  });

  const filteredCustomers = (data?.customers || []).filter(
    (c: any) =>
      c.nickname.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCustomerClick = (customer: any) => {
    setSelectedCustomer(customer);
    setMemo(customer.memo || '');
  };

  const handleSaveMemo = () => {
    if (selectedCustomer) {
      saveMemoMutation.mutate({
        customerId: selectedCustomer.id,
        memo,
      });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">고객 관리</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="고객 검색 (닉네임, 이메일)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Customer List */}
      <div className="grid gap-4">
        {filteredCustomers.map((customer: any) => (
          <Card
            key={customer.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCustomerClick(customer)}
          >
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={customer.profileImage} />
                <AvatarFallback>{customer.nickname.charAt(0)}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{customer.nickname}</h3>
                  <Badge variant="outline" className="text-xs">
                    {customer.visitCount}회 방문
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">{customer.email}</p>
              </div>

              {customer.memo && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  메모
                </Badge>
              )}
            </div>

            {/* Memo Preview */}
            {customer.memo && (
              <p className="mt-3 text-sm text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded">
                {customer.memo}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Customer Detail Dialog */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={() => setSelectedCustomer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객 상세</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedCustomer.profileImage} />
                  <AvatarFallback>
                    {selectedCustomer.nickname.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">
                    {selectedCustomer.nickname}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedCustomer.visitCount}회 방문
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-1 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  고객 메모
                </label>
                <Textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="이 고객에 대한 메모를 입력하세요..."
                  rows={4}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSaveMemo}
                disabled={saveMemoMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                메모 저장
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Files Summary

| Component | File | Action |
|-----------|------|--------|
| Backend | `src/migrations/XXX_add_customer_memos.sql` | CREATE |
| Backend | `src/services/shop-owner/customer.service.ts` | MODIFY |
| Backend | `src/controllers/shop-owner/customer.controller.ts` | MODIFY |
| Backend | `src/routes/shop-owner/customer.routes.ts` | MODIFY |
| Admin | `src/components/dashboard/NewCustomersWidget.tsx` | CREATE |
| Admin | `src/app/dashboard/my-shop/customers/page.tsx` | MODIFY |
| Admin | `src/app/dashboard/my-shop/page.tsx` | MODIFY (add widget) |

---

## Testing Checklist

- [ ] New customers widget shows correct count
- [ ] Calendar date picker works
- [ ] Customer list displays with visit count
- [ ] Customer memo can be saved
- [ ] Memo displays in customer list preview
- [ ] Search filters customers correctly
