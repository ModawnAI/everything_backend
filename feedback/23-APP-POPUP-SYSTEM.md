# Implementation Plan: App Popup System

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 6-8 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | Supabase Storage |

## Feedback Item

**Feedback:** 팝업 (어플 키자마자 나오는 이미지 파일로 팝업 나오게끔, 어드민에서 쉽게 관리, '닫음' '다시보지않기' 선택)

---

## Database Schema

**File:** `src/migrations/XXX_add_popup_tables.sql`

```sql
-- App popups table
CREATE TABLE IF NOT EXISTS app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_type VARCHAR(20) DEFAULT 'none', -- none, internal, external
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_audience VARCHAR(20) DEFAULT 'all', -- all, new_users, returning
  view_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Popup dismissals tracking
CREATE TABLE IF NOT EXISTS popup_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(100),
  popup_id UUID NOT NULL REFERENCES app_popups(id) ON DELETE CASCADE,
  dismiss_type VARCHAR(20) NOT NULL, -- close, never_show
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, popup_id),
  UNIQUE(device_id, popup_id)
);

-- Indexes
CREATE INDEX idx_popups_active ON app_popups(active, display_order);
CREATE INDEX idx_popups_dates ON app_popups(start_date, end_date);
CREATE INDEX idx_dismissals_user ON popup_dismissals(user_id);
CREATE INDEX idx_dismissals_device ON popup_dismissals(device_id);
```

---

## Backend Implementation

### Step 1: Create Popup Types

**File:** `src/types/popup.types.ts`

```typescript
export type PopupLinkType = 'none' | 'internal' | 'external';
export type PopupTargetAudience = 'all' | 'new_users' | 'returning';
export type DismissType = 'close' | 'never_show';

export interface Popup {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkType: PopupLinkType;
  displayOrder: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  targetAudience: PopupTargetAudience;
  viewCount: number;
  clickCount: number;
  createdAt: string;
}

export interface CreatePopupData {
  title: string;
  imageUrl: string;
  linkUrl?: string;
  linkType?: PopupLinkType;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
  targetAudience?: PopupTargetAudience;
}
```

### Step 2: Create Popup Service

**File:** `src/services/popup.service.ts`

```typescript
import { supabase } from '@/config/supabase';
import { Popup, CreatePopupData, DismissType } from '@/types/popup.types';

export class PopupService {
  /**
   * Get active popups for a user/device
   */
  async getActivePopups(
    userId?: string,
    deviceId?: string
  ): Promise<Popup[]> {
    const now = new Date().toISOString();

    // Get all active popups
    let query = supabase
      .from('app_popups')
      .select('*')
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('display_order', { ascending: true });

    const { data: popups, error } = await query;

    if (error || !popups) return [];

    // Get dismissals for this user/device
    let dismissedIds: string[] = [];

    if (userId) {
      const { data: userDismissals } = await supabase
        .from('popup_dismissals')
        .select('popup_id')
        .eq('user_id', userId)
        .eq('dismiss_type', 'never_show');

      dismissedIds = (userDismissals || []).map((d) => d.popup_id);
    } else if (deviceId) {
      const { data: deviceDismissals } = await supabase
        .from('popup_dismissals')
        .select('popup_id')
        .eq('device_id', deviceId)
        .eq('dismiss_type', 'never_show');

      dismissedIds = (deviceDismissals || []).map((d) => d.popup_id);
    }

    // Filter out dismissed popups
    const activePopups = popups.filter((p) => !dismissedIds.includes(p.id));

    // Increment view count for returned popups
    if (activePopups.length > 0) {
      const popupIds = activePopups.map((p) => p.id);
      await supabase.rpc('increment_popup_view_count', { popup_ids: popupIds });
    }

    return activePopups.map(this.mapPopup);
  }

  /**
   * Dismiss a popup
   */
  async dismissPopup(
    popupId: string,
    dismissType: DismissType,
    userId?: string,
    deviceId?: string
  ): Promise<void> {
    const dismissal: any = {
      popup_id: popupId,
      dismiss_type: dismissType,
      dismissed_at: new Date().toISOString(),
    };

    if (userId) {
      dismissal.user_id = userId;
    } else if (deviceId) {
      dismissal.device_id = deviceId;
    }

    await supabase.from('popup_dismissals').upsert(dismissal, {
      onConflict: userId ? 'user_id,popup_id' : 'device_id,popup_id',
    });
  }

  /**
   * Track popup click
   */
  async trackClick(popupId: string): Promise<void> {
    await supabase.rpc('increment_popup_click_count', { popup_id: popupId });
  }

  /**
   * Create popup (admin)
   */
  async createPopup(data: CreatePopupData, adminId: string): Promise<Popup> {
    const { data: popup, error } = await supabase
      .from('app_popups')
      .insert({
        title: data.title,
        image_url: data.imageUrl,
        link_url: data.linkUrl,
        link_type: data.linkType || 'none',
        display_order: data.displayOrder || 0,
        start_date: data.startDate,
        end_date: data.endDate,
        target_audience: data.targetAudience || 'all',
        created_by: adminId,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapPopup(popup);
  }

  /**
   * Update popup (admin)
   */
  async updatePopup(id: string, data: Partial<CreatePopupData & { active: boolean }>): Promise<Popup> {
    const { data: popup, error } = await supabase
      .from('app_popups')
      .update({
        title: data.title,
        image_url: data.imageUrl,
        link_url: data.linkUrl,
        link_type: data.linkType,
        display_order: data.displayOrder,
        start_date: data.startDate,
        end_date: data.endDate,
        target_audience: data.targetAudience,
        active: data.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapPopup(popup);
  }

  /**
   * Delete popup (admin)
   */
  async deletePopup(id: string): Promise<void> {
    await supabase.from('app_popups').delete().eq('id', id);
  }

  /**
   * Get all popups (admin)
   */
  async getAllPopups(): Promise<(Popup & { dismissCount: number })[]> {
    const { data, error } = await supabase
      .from('app_popups')
      .select('*, dismissals:popup_dismissals(count)')
      .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((p) => ({
      ...this.mapPopup(p),
      dismissCount: p.dismissals?.[0]?.count || 0,
    }));
  }

  private mapPopup(data: any): Popup {
    return {
      id: data.id,
      title: data.title,
      imageUrl: data.image_url,
      linkUrl: data.link_url,
      linkType: data.link_type,
      displayOrder: data.display_order,
      active: data.active,
      startDate: data.start_date,
      endDate: data.end_date,
      targetAudience: data.target_audience,
      viewCount: data.view_count || 0,
      clickCount: data.click_count || 0,
      createdAt: data.created_at,
    };
  }
}

export const popupService = new PopupService();
```

### Step 3: Create API Endpoints

**File:** `src/controllers/popup.controller.ts`

```typescript
import { Request, Response } from 'express';
import { popupService } from '@/services/popup.service';

export class PopupController {
  async getActivePopups(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const deviceId = req.headers['x-device-id'] as string;

    const popups = await popupService.getActivePopups(userId, deviceId);

    res.json({ success: true, data: popups });
  }

  async dismissPopup(req: Request, res: Response): Promise<void> {
    const { popupId } = req.params;
    const { dismissType } = req.body;
    const userId = req.user?.id;
    const deviceId = req.headers['x-device-id'] as string;

    await popupService.dismissPopup(popupId, dismissType, userId, deviceId);

    res.json({ success: true, message: 'Popup dismissed' });
  }

  async trackClick(req: Request, res: Response): Promise<void> {
    const { popupId } = req.params;
    await popupService.trackClick(popupId);
    res.json({ success: true });
  }
}

export const popupController = new PopupController();
```

**File:** `src/routes/popup.routes.ts`

```typescript
import { Router } from 'express';
import { popupController } from '@/controllers/popup.controller';
import { optionalAuth } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

router.get('/active', optionalAuth, asyncHandler((req, res) => popupController.getActivePopups(req, res)));
router.post('/:popupId/dismiss', optionalAuth, asyncHandler((req, res) => popupController.dismissPopup(req, res)));
router.post('/:popupId/click', asyncHandler((req, res) => popupController.trackClick(req, res)));

export default router;
```

---

## Frontend Implementation

### Step 4: Create Popup Component

**File:** `src/components/popup/AppPopup.tsx`

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Popup {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkType: 'none' | 'internal' | 'external';
}

interface AppPopupProps {
  popup: Popup;
  onClose: () => void;
}

export function AppPopup({ popup, onClose }: AppPopupProps) {
  const router = useRouter();
  const [neverShow, setNeverShow] = useState(false);

  const handleDismiss = async (type: 'close' | 'never_show') => {
    try {
      await api.post(`/popups/${popup.id}/dismiss`, {
        dismissType: type,
      });
    } catch (error) {
      console.error('Failed to dismiss popup:', error);
    }
    onClose();
  };

  const handleClose = () => {
    handleDismiss(neverShow ? 'never_show' : 'close');
  };

  const handleClick = async () => {
    // Track click
    try {
      await api.post(`/popups/${popup.id}/click`);
    } catch (error) {
      console.error('Failed to track click:', error);
    }

    // Navigate
    if (popup.linkUrl) {
      if (popup.linkType === 'internal') {
        router.push(popup.linkUrl);
      } else if (popup.linkType === 'external') {
        window.open(popup.linkUrl, '_blank');
      }
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogOverlay className="bg-black/70" />
      <DialogContent className="p-0 max-w-sm bg-transparent border-none shadow-none">
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-10 right-0 text-white hover:bg-white/20"
            onClick={handleClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Popup Image */}
          <div
            className="rounded-lg overflow-hidden cursor-pointer"
            onClick={handleClick}
          >
            <img
              src={popup.imageUrl}
              alt={popup.title}
              className="w-full h-auto"
            />
          </div>

          {/* Never show again */}
          <div className="flex items-center gap-2 mt-3 justify-center">
            <Checkbox
              id="neverShow"
              checked={neverShow}
              onCheckedChange={(checked) => setNeverShow(!!checked)}
              className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            />
            <label
              htmlFor="neverShow"
              className="text-sm text-white cursor-pointer"
            >
              다시 보지 않기
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 5: Create Popup Hook

**File:** `src/hooks/use-popup.ts`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Popup {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkType: 'none' | 'internal' | 'external';
}

export function usePopups() {
  const [currentPopup, setCurrentPopup] = useState<Popup | null>(null);
  const [popupQueue, setPopupQueue] = useState<Popup[]>([]);

  const { data: popups } = useQuery<Popup[]>({
    queryKey: ['activePopups'],
    queryFn: async () => {
      const response = await api.get('/popups/active');
      return response.data.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (popups && popups.length > 0 && popupQueue.length === 0) {
      setPopupQueue(popups);
      setCurrentPopup(popups[0]);
    }
  }, [popups]);

  const dismissCurrentPopup = () => {
    setPopupQueue((prev) => prev.slice(1));
    setCurrentPopup(popupQueue[1] || null);
  };

  return {
    currentPopup,
    dismissCurrentPopup,
    hasPopups: popupQueue.length > 0,
  };
}
```

### Step 6: Add to App Layout

**File:** `src/app/layout.tsx` (or providers)

```tsx
'use client';

import { usePopups } from '@/hooks/use-popup';
import { AppPopup } from '@/components/popup/AppPopup';

function PopupProvider({ children }: { children: React.ReactNode }) {
  const { currentPopup, dismissCurrentPopup } = usePopups();

  return (
    <>
      {children}
      {currentPopup && (
        <AppPopup popup={currentPopup} onClose={dismissCurrentPopup} />
      )}
    </>
  );
}
```

---

## Admin Implementation

### Step 7: Popup Management Page

**File:** `src/app/dashboard/system/popups/page.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  MousePointer,
  Image as ImageIcon,
  Calendar,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export default function PopupsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    linkType: 'none',
    startDate: '',
    endDate: '',
    targetAudience: 'all',
  });

  const { data: popups } = useQuery({
    queryKey: ['adminPopups'],
    queryFn: async () => {
      const response = await adminApi.get('/admin/popups');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await adminApi.post('/admin/popups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPopups']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('팝업이 생성되었습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await adminApi.put(`/admin/popups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPopups']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('팝업이 수정되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.delete(`/admin/popups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPopups']);
      toast.success('팝업이 삭제되었습니다.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await adminApi.put(`/admin/popups/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPopups']);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      imageUrl: '',
      linkUrl: '',
      linkType: 'none',
      startDate: '',
      endDate: '',
      targetAudience: 'all',
    });
    setEditingPopup(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">팝업 관리</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 팝업
        </Button>
      </div>

      <div className="grid gap-4">
        {popups?.map((popup: any) => (
          <Card key={popup.id} className="p-4">
            <div className="flex gap-4">
              {/* Preview Image */}
              <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {popup.imageUrl ? (
                  <img
                    src={popup.imageUrl}
                    alt={popup.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{popup.title}</h3>
                    {popup.linkUrl && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        {popup.linkType === 'external' ? (
                          <ExternalLink className="h-3 w-3" />
                        ) : (
                          <LinkIcon className="h-3 w-3" />
                        )}
                        <span className="truncate max-w-xs">{popup.linkUrl}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant={popup.active ? 'default' : 'secondary'}>
                    {popup.active ? '활성' : '비활성'}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{popup.viewCount?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MousePointer className="h-4 w-4" />
                    <span>{popup.clickCount?.toLocaleString()}</span>
                  </div>
                  {popup.startDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(popup.startDate), 'M/d', { locale: ko })}
                        {popup.endDate && (
                          <> - {format(new Date(popup.endDate), 'M/d', { locale: ko })}</>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={popup.active}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: popup.id, active: checked })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingPopup(popup);
                    setFormData({
                      title: popup.title,
                      imageUrl: popup.imageUrl,
                      linkUrl: popup.linkUrl || '',
                      linkType: popup.linkType,
                      startDate: popup.startDate?.split('T')[0] || '',
                      endDate: popup.endDate?.split('T')[0] || '',
                      targetAudience: popup.targetAudience,
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('삭제하시겠습니까?')) {
                      deleteMutation.mutate(popup.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPopup ? '팝업 수정' : '새 팝업'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">제목</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="팝업 제목"
              />
            </div>
            <div>
              <label className="text-sm font-medium">이미지 URL</label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">링크 URL (선택)</label>
              <Input
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://... 또는 /path"
              />
            </div>
            <div>
              <label className="text-sm font-medium">링크 타입</label>
              <Select
                value={formData.linkType}
                onValueChange={(v) => setFormData({ ...formData, linkType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  <SelectItem value="internal">앱 내부</SelectItem>
                  <SelectItem value="external">외부 링크</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작일</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">종료일</label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (editingPopup) {
                  updateMutation.mutate({ id: editingPopup.id, data: formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
            >
              {editingPopup ? '수정' : '생성'}
            </Button>
          </div>
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
| Backend | `src/migrations/XXX_add_popup_tables.sql` | CREATE |
| Backend | `src/types/popup.types.ts` | CREATE |
| Backend | `src/services/popup.service.ts` | CREATE |
| Backend | `src/controllers/popup.controller.ts` | CREATE |
| Backend | `src/routes/popup.routes.ts` | CREATE |
| Frontend | `src/components/popup/AppPopup.tsx` | CREATE |
| Frontend | `src/hooks/use-popup.ts` | CREATE |
| Frontend | `src/app/layout.tsx` | MODIFY |
| Admin | `src/app/dashboard/system/popups/page.tsx` | CREATE |

---

## Testing Checklist

- [ ] Popup displays on app open
- [ ] Close button dismisses popup
- [ ] "다시 보지 않기" checkbox works
- [ ] Popup links work (internal/external)
- [ ] View/click tracking works
- [ ] Admin can create popups
- [ ] Admin can schedule popups (dates)
- [ ] Admin can toggle active status
- [ ] Admin can delete popups
