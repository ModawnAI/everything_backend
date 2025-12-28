# Implementation Plan: Shop Entry Request

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 4-6 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | None |

## Feedback Item

**Feedback:** 홈에 '입점 요청, 우리동네샾 입점 요청하기' 추가

---

## Database Schema

**File:** `src/migrations/XXX_add_shop_entry_requests.sql`

```sql
CREATE TABLE IF NOT EXISTS shop_entry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES users(id),
  requester_email VARCHAR(255),
  requester_phone VARCHAR(20),
  shop_name VARCHAR(200) NOT NULL,
  shop_address TEXT,
  shop_phone VARCHAR(20),
  shop_category VARCHAR(50),
  additional_info TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, contacted, registered, rejected
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shop_entry_requests_status ON shop_entry_requests(status);
CREATE INDEX idx_shop_entry_requests_created ON shop_entry_requests(created_at DESC);
```

---

## Backend Implementation

### Service

**File:** `src/services/shop-entry-request.service.ts`

```typescript
import { supabase } from '@/config/supabase';

export interface ShopEntryRequest {
  id: string;
  requesterUserId: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  shopCategory: string | null;
  additionalInfo: string | null;
  status: string;
  adminNotes: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CreateRequestData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopCategory?: string;
  additionalInfo?: string;
  requesterEmail?: string;
  requesterPhone?: string;
}

export class ShopEntryRequestService {
  async submitRequest(
    data: CreateRequestData,
    userId?: string
  ): Promise<ShopEntryRequest> {
    const { data: request, error } = await supabase
      .from('shop_entry_requests')
      .insert({
        requester_user_id: userId,
        requester_email: data.requesterEmail,
        requester_phone: data.requesterPhone,
        shop_name: data.shopName,
        shop_address: data.shopAddress,
        shop_phone: data.shopPhone,
        shop_category: data.shopCategory,
        additional_info: data.additionalInfo,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapRequest(request);
  }

  async getRequests(
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<{ requests: ShopEntryRequest[]; total: number }> {
    let query = supabase
      .from('shop_entry_requests')
      .select('*, requester:users(nickname, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);
    return {
      requests: (data || []).map(this.mapRequest),
      total: count || 0,
    };
  }

  async updateStatus(
    id: string,
    status: string,
    adminNotes: string | null,
    adminId: string
  ): Promise<ShopEntryRequest> {
    const { data: request, error } = await supabase
      .from('shop_entry_requests')
      .update({
        status,
        admin_notes: adminNotes,
        processed_by: adminId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapRequest(request);
  }

  private mapRequest(data: any): ShopEntryRequest {
    return {
      id: data.id,
      requesterUserId: data.requester_user_id,
      requesterEmail: data.requester_email || data.requester?.email,
      requesterPhone: data.requester_phone,
      shopName: data.shop_name,
      shopAddress: data.shop_address,
      shopPhone: data.shop_phone,
      shopCategory: data.shop_category,
      additionalInfo: data.additional_info,
      status: data.status,
      adminNotes: data.admin_notes,
      processedAt: data.processed_at,
      createdAt: data.created_at,
    };
  }
}

export const shopEntryRequestService = new ShopEntryRequestService();
```

### Controller & Routes

**File:** `src/controllers/shop-entry-request.controller.ts`

```typescript
import { Request, Response } from 'express';
import { shopEntryRequestService } from '@/services/shop-entry-request.service';

export class ShopEntryRequestController {
  async submitRequest(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const request = await shopEntryRequestService.submitRequest(req.body, userId);
    res.status(201).json({ success: true, data: request });
  }
}

export const shopEntryRequestController = new ShopEntryRequestController();
```

**File:** `src/routes/shop-entry-request.routes.ts`

```typescript
import { Router } from 'express';
import { shopEntryRequestController } from '@/controllers/shop-entry-request.controller';
import { optionalAuth } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

router.post('/', optionalAuth, asyncHandler((req, res) => shopEntryRequestController.submitRequest(req, res)));

export default router;
```

---

## Frontend Implementation

**File:** `src/app/shop-request/page.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Store, MapPin, Phone, Tag, Info, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

const categories = [
  { value: 'nail', label: '네일' },
  { value: 'eyelash', label: '속눈썹' },
  { value: 'waxing', label: '왁싱/눈썹문신' },
  { value: 'hair', label: '헤어' },
  { value: 'other', label: '기타' },
];

export default function ShopRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    shopAddress: '',
    shopPhone: '',
    shopCategory: '',
    additionalInfo: '',
    requesterEmail: '',
    requesterPhone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shopName) {
      toast({ title: '샵 이름을 입력해주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/shop-entry-requests', formData);
      setIsSubmitted(true);
    } catch (error) {
      toast({ title: '요청 실패. 다시 시도해주세요.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">요청이 접수되었습니다!</h2>
          <p className="text-gray-500 mb-6">
            입점 요청이 성공적으로 접수되었습니다.
            검토 후 연락드리겠습니다.
          </p>
          <Button onClick={() => router.push('/')} className="w-full">
            홈으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">우리동네 샵 입점 요청</h1>
        </div>
      </header>

      <div className="p-4">
        <Card className="p-4 mb-4 bg-primary/5">
          <p className="text-sm text-gray-600">
            원하시는 샵이 에뷰리띵에 없나요?
            <br />
            입점 요청을 해주시면 저희가 직접 연락드리겠습니다.
          </p>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Store className="h-4 w-4" />
              샵 이름 *
            </label>
            <Input
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              placeholder="예: 네일아트 강남점"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <MapPin className="h-4 w-4" />
              샵 주소
            </label>
            <Input
              value={formData.shopAddress}
              onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
              placeholder="예: 서울시 강남구 역삼동 123-45"
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Phone className="h-4 w-4" />
              샵 연락처
            </label>
            <Input
              value={formData.shopPhone}
              onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })}
              placeholder="02-1234-5678"
            />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Tag className="h-4 w-4" />
              카테고리
            </label>
            <Select
              value={formData.shopCategory}
              onValueChange={(v) => setFormData({ ...formData, shopCategory: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1 mb-1">
              <Info className="h-4 w-4" />
              추가 정보
            </label>
            <Textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              placeholder="샵에 대한 추가 정보가 있다면 알려주세요."
              rows={3}
            />
          </div>

          <hr className="my-4" />

          <p className="text-sm text-gray-500">
            입점 관련 연락을 받으실 연락처를 입력해주세요 (선택)
          </p>

          <div>
            <label className="text-sm font-medium mb-1">이메일</label>
            <Input
              type="email"
              value={formData.requesterEmail}
              onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1">연락처</label>
            <Input
              value={formData.requesterPhone}
              onChange={(e) => setFormData({ ...formData, requesterPhone: e.target.value })}
              placeholder="010-1234-5678"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '요청 중...' : '입점 요청하기'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### Add Button to Home Page

**File:** `src/app/page.tsx` (add section)

```tsx
<Link href="/shop-request">
  <Card className="mx-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-none">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium">우리동네 샵 입점 요청</h3>
        <p className="text-sm text-gray-500">원하는 샵이 없다면 요청해주세요!</p>
      </div>
      <Store className="h-8 w-8 text-primary" />
    </div>
  </Card>
</Link>
```

---

## Admin Implementation

**File:** `src/app/dashboard/system/shop-requests/page.tsx`

```tsx
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const statusOptions = [
  { value: 'pending', label: '대기중', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'contacted', label: '연락완료', color: 'bg-blue-100 text-blue-700' },
  { value: 'registered', label: '입점완료', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: '거절', color: 'bg-red-100 text-red-700' },
];

export default function ShopRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = React.useState<string>('');

  const { data } = useQuery({
    queryKey: ['shopEntryRequests', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus ? `?status=${selectedStatus}` : '';
      const response = await adminApi.get(`/admin/shop-entry-requests${params}`);
      return response.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: any) => {
      await adminApi.patch(`/admin/shop-entry-requests/${id}`, { status, adminNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shopEntryRequests']);
      toast.success('상태가 업데이트되었습니다.');
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">입점 요청 관리</h1>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {data?.requests?.map((request: any) => (
          <Card key={request.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">{request.shopName}</h3>
                <p className="text-sm text-gray-500">{request.shopAddress}</p>
              </div>
              <Badge className={statusOptions.find((s) => s.value === request.status)?.color}>
                {statusOptions.find((s) => s.value === request.status)?.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-500">카테고리:</span> {request.shopCategory || '-'}
              </div>
              <div>
                <span className="text-gray-500">샵 연락처:</span> {request.shopPhone || '-'}
              </div>
              <div>
                <span className="text-gray-500">요청자 이메일:</span> {request.requesterEmail || '-'}
              </div>
              <div>
                <span className="text-gray-500">요청자 연락처:</span> {request.requesterPhone || '-'}
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">추가 정보:</span>
                <p className="mt-1">{request.additionalInfo || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">요청일:</span>{' '}
                {format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
              </div>
            </div>

            <div className="flex gap-2">
              {statusOptions.map((s) => (
                <Button
                  key={s.value}
                  variant={request.status === s.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: request.id, status: s.value, notes: null })}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## Files Summary

| Component | File | Action |
|-----------|------|--------|
| Backend | `src/migrations/XXX_add_shop_entry_requests.sql` | CREATE |
| Backend | `src/services/shop-entry-request.service.ts` | CREATE |
| Backend | `src/controllers/shop-entry-request.controller.ts` | CREATE |
| Backend | `src/routes/shop-entry-request.routes.ts` | CREATE |
| Frontend | `src/app/shop-request/page.tsx` | CREATE |
| Frontend | `src/app/page.tsx` | MODIFY |
| Admin | `src/app/dashboard/system/shop-requests/page.tsx` | CREATE |

---

## Testing Checklist

- [ ] Entry request form submits correctly
- [ ] Success message displays after submission
- [ ] Home page shows entry request button
- [ ] Admin can view all requests
- [ ] Admin can filter by status
- [ ] Admin can update request status
