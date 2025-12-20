# Implementation Plan: Home Page Sections

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 10-14 hours |
| **Risk Level** | Medium |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | Plan 21 (Nearby Shops Map) |

## Feedback Items Covered

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 가까운 네일샵 섹션 | Frontend + Backend |
| 2 | 자주 방문한 샵 섹션 | Frontend + Backend |
| 3 | Best 추천 샵 섹션 | Frontend + Backend |
| 4 | 에디터 추천 pick! 섹션 + 어드민 관리 | Frontend + Backend + Admin |

---

## Database Schema Changes

**File:** `src/migrations/XXX_add_editor_picks.sql`

```sql
-- Editor's Pick table
CREATE TABLE IF NOT EXISTS editor_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title VARCHAR(200),
  description TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_editor_picks_active ON editor_picks(active, display_order);
CREATE INDEX idx_editor_picks_dates ON editor_picks(start_date, end_date);
```

---

## Backend Implementation

### Step 1: Create Home Service

**File:** `src/services/home.service.ts`

```typescript
/**
 * Home Service
 * Provides data for home page sections
 */

import { supabase } from '@/config/supabase';

export interface HomeSection {
  type: string;
  title: string;
  shops: ShopPreview[];
}

export interface ShopPreview {
  id: string;
  name: string;
  category: string;
  thumbnailUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceKm?: number;
  distanceText?: string;
  visitCount?: number;
}

export interface EditorPick {
  id: string;
  shopId: string;
  shop: ShopPreview;
  title: string | null;
  description: string | null;
  displayOrder: number;
}

export class HomeService {
  /**
   * Get nearby nail shops
   */
  async getNearbyNailShops(
    lat: number,
    lng: number,
    limit = 10
  ): Promise<ShopPreview[]> {
    const { data, error } = await supabase.rpc('get_nearby_shops', {
      user_lat: lat,
      user_lng: lng,
      radius_km: 5,
      shop_category: 'nail',
      result_limit: limit,
    });

    if (error) {
      console.error('Nearby shops error:', error);
      return [];
    }

    return (data || []).map(this.mapShopPreview);
  }

  /**
   * Get frequently visited shops for a user
   */
  async getFrequentlyVisited(
    userId: string,
    limit = 10
  ): Promise<ShopPreview[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select(
        `
        shop_id,
        shop:shops (
          id,
          name,
          category,
          thumbnail_url,
          average_rating,
          review_count
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('reservation_date', { ascending: false });

    if (error) {
      console.error('Frequently visited error:', error);
      return [];
    }

    // Count visits per shop
    const visitCounts = new Map<string, { shop: any; count: number }>();
    (data || []).forEach((r) => {
      const shopId = r.shop_id;
      if (visitCounts.has(shopId)) {
        visitCounts.get(shopId)!.count++;
      } else {
        visitCounts.set(shopId, { shop: r.shop, count: 1 });
      }
    });

    // Sort by visit count and return top shops
    return Array.from(visitCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((v) => ({
        id: v.shop.id,
        name: v.shop.name,
        category: v.shop.category,
        thumbnailUrl: v.shop.thumbnail_url,
        rating: v.shop.average_rating || 0,
        reviewCount: v.shop.review_count || 0,
        visitCount: v.count,
      }));
  }

  /**
   * Get best recommended shops (by rating and reviews)
   */
  async getBestRecommended(limit = 10): Promise<ShopPreview[]> {
    const { data, error } = await supabase
      .from('shops')
      .select(
        `
        id,
        name,
        category,
        thumbnail_url,
        average_rating,
        review_count
      `
      )
      .eq('status', 'active')
      .gte('review_count', 5) // At least 5 reviews
      .gte('average_rating', 4.0) // At least 4.0 rating
      .order('average_rating', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Best recommended error:', error);
      return [];
    }

    return (data || []).map(this.mapShopFromDb);
  }

  /**
   * Get editor's picks
   */
  async getEditorPicks(limit = 10): Promise<EditorPick[]> {
    const now = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('editor_picks')
      .select(
        `
        id,
        shop_id,
        title,
        description,
        display_order,
        shop:shops (
          id,
          name,
          category,
          thumbnail_url,
          average_rating,
          review_count
        )
      `
      )
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('display_order', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Editor picks error:', error);
      return [];
    }

    return (data || []).map((p) => ({
      id: p.id,
      shopId: p.shop_id,
      shop: this.mapShopFromDb(p.shop),
      title: p.title,
      description: p.description,
      displayOrder: p.display_order,
    }));
  }

  /**
   * Get all home sections in one call
   */
  async getAllSections(
    userId?: string,
    lat?: number,
    lng?: number
  ): Promise<{
    nearby: ShopPreview[];
    frequentlyVisited: ShopPreview[];
    bestRecommended: ShopPreview[];
    editorPicks: EditorPick[];
  }> {
    const [nearby, frequentlyVisited, bestRecommended, editorPicks] =
      await Promise.all([
        lat && lng ? this.getNearbyNailShops(lat, lng) : Promise.resolve([]),
        userId ? this.getFrequentlyVisited(userId) : Promise.resolve([]),
        this.getBestRecommended(),
        this.getEditorPicks(),
      ]);

    return {
      nearby,
      frequentlyVisited,
      bestRecommended,
      editorPicks,
    };
  }

  private mapShopPreview(data: any): ShopPreview {
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      thumbnailUrl: data.thumbnail_url,
      rating: data.average_rating || 0,
      reviewCount: data.review_count || 0,
      distanceKm: data.distance_km,
      distanceText: data.distance_km
        ? data.distance_km < 1
          ? `${Math.round(data.distance_km * 1000)}m`
          : `${data.distance_km.toFixed(1)}km`
        : undefined,
    };
  }

  private mapShopFromDb(data: any): ShopPreview {
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      thumbnailUrl: data.thumbnail_url,
      rating: data.average_rating || 0,
      reviewCount: data.review_count || 0,
    };
  }
}

export const homeService = new HomeService();
```

### Step 2: Create Editor Picks Service (Admin)

**File:** `src/services/admin/editor-picks.service.ts`

```typescript
/**
 * Editor Picks Management Service
 */

import { supabase } from '@/config/supabase';

export interface CreateEditorPickData {
  shopId: string;
  title?: string;
  description?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
}

export class EditorPicksService {
  /**
   * Get all editor picks (admin)
   */
  async getAll(): Promise<any[]> {
    const { data, error } = await supabase
      .from('editor_picks')
      .select(
        `
        *,
        shop:shops (id, name, category, thumbnail_url),
        created_by_user:users!created_by (nickname)
      `
      )
      .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  /**
   * Create editor pick
   */
  async create(data: CreateEditorPickData, adminId: string): Promise<any> {
    const { data: pick, error } = await supabase
      .from('editor_picks')
      .insert({
        shop_id: data.shopId,
        title: data.title,
        description: data.description,
        display_order: data.displayOrder || 0,
        start_date: data.startDate,
        end_date: data.endDate,
        created_by: adminId,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return pick;
  }

  /**
   * Update editor pick
   */
  async update(
    id: string,
    data: Partial<CreateEditorPickData & { active: boolean }>
  ): Promise<any> {
    const { data: pick, error } = await supabase
      .from('editor_picks')
      .update({
        ...data,
        shop_id: data.shopId,
        display_order: data.displayOrder,
        start_date: data.startDate,
        end_date: data.endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return pick;
  }

  /**
   * Delete editor pick
   */
  async delete(id: string): Promise<void> {
    await supabase.from('editor_picks').delete().eq('id', id);
  }

  /**
   * Reorder editor picks
   */
  async reorder(picks: { id: string; order: number }[]): Promise<void> {
    for (const pick of picks) {
      await supabase
        .from('editor_picks')
        .update({ display_order: pick.order })
        .eq('id', pick.id);
    }
  }
}

export const editorPicksService = new EditorPicksService();
```

### Step 3: Create API Endpoints

**File:** `src/controllers/home.controller.ts`

```typescript
/**
 * Home Controller
 */

import { Request, Response } from 'express';
import { homeService } from '@/services/home.service';

export class HomeController {
  /**
   * GET /api/home/sections
   * Get all home page sections
   */
  async getSections(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { lat, lng } = req.query;

    const sections = await homeService.getAllSections(
      userId,
      lat ? parseFloat(lat as string) : undefined,
      lng ? parseFloat(lng as string) : undefined
    );

    res.json({
      success: true,
      data: sections,
    });
  }
}

export const homeController = new HomeController();
```

**File:** `src/routes/home.routes.ts`

```typescript
import { Router } from 'express';
import { homeController } from '@/controllers/home.controller';
import { optionalAuth } from '@/middleware/auth.middleware';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

router.get('/sections', optionalAuth, asyncHandler((req, res) => homeController.getSections(req, res)));

export default router;
```

---

## Frontend Implementation

### Step 4: Create Shop Section Component

**File:** `src/components/home/ShopSection.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Star, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ShopPreview {
  id: string;
  name: string;
  category: string;
  thumbnailUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceText?: string;
  visitCount?: number;
}

interface ShopSectionProps {
  title: string;
  shops: ShopPreview[];
  showDistance?: boolean;
  showVisitCount?: boolean;
  href?: string;
  emptyMessage?: string;
}

export function ShopSection({
  title,
  shops,
  showDistance = false,
  showVisitCount = false,
  href,
  emptyMessage = '추천 샵이 없습니다',
}: ShopSectionProps) {
  if (shops.length === 0) {
    return null;
  }

  return (
    <section className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-primary flex items-center">
            더보기
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Horizontal Scroll */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-2">
          {shops.map((shop) => (
            <Link key={shop.id} href={`/shop/${shop.id}`}>
              <Card className="w-36 flex-shrink-0 overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {shop.thumbnailUrl ? (
                    <img
                      src={shop.thumbnailUrl}
                      alt={shop.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                  {showDistance && shop.distanceText && (
                    <Badge
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs"
                    >
                      <MapPin className="h-3 w-3 mr-0.5" />
                      {shop.distanceText}
                    </Badge>
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {shop.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{shop.rating.toFixed(1)}</span>
                    <span>({shop.reviewCount})</span>
                  </div>
                  {showVisitCount && shop.visitCount && (
                    <p className="text-xs text-primary mt-1">
                      {shop.visitCount}회 방문
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
```

### Step 5: Create Editor Pick Card

**File:** `src/components/home/EditorPickCard.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Star, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EditorPick {
  id: string;
  shop: {
    id: string;
    name: string;
    category: string;
    thumbnailUrl: string | null;
    rating: number;
    reviewCount: number;
  };
  title: string | null;
  description: string | null;
}

interface EditorPickSectionProps {
  picks: EditorPick[];
}

export function EditorPickSection({ picks }: EditorPickSectionProps) {
  if (picks.length === 0) return null;

  return (
    <section className="py-4 px-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">에디터 추천 pick!</h2>
      </div>

      <div className="space-y-3">
        {picks.map((pick) => (
          <Link key={pick.id} href={`/shop/${pick.shop.id}`}>
            <Card className="flex overflow-hidden hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
                {pick.shop.thumbnailUrl ? (
                  <img
                    src={pick.shop.thumbnailUrl}
                    alt={pick.shop.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No Image
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-sm">
                      {pick.title || pick.shop.name}
                    </h3>
                    {pick.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {pick.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    추천
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{pick.shop.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    리뷰 {pick.shop.reviewCount}
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

### Step 6: Update Home Page

**File:** `src/app/page.tsx`

```tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { PointSummaryWidget } from '@/components/home/PointSummaryWidget';
import { CategoryList } from '@/components/home/CategoryList';
import { ShopSection } from '@/components/home/ShopSection';
import { EditorPickSection } from '@/components/home/EditorPickCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();

  const { data: sections, isLoading } = useQuery({
    queryKey: ['homeSections', location?.latitude, location?.longitude],
    queryFn: async () => {
      const params: any = {};
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
      }
      const response = await api.get('/home/sections', { params });
      return response.data.data;
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Point Summary (logged in only) */}
      {isAuthenticated && (
        <section className="pt-4">
          <PointSummaryWidget />
        </section>
      )}

      {/* Categories */}
      <section className="pt-4">
        <CategoryList />
      </section>

      {/* Nearby Button */}
      <section className="px-4 py-2">
        <NearbyButton />
      </section>

      {isLoading ? (
        <div className="px-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Nearby Nail Shops */}
          {sections?.nearby?.length > 0 && (
            <ShopSection
              title="가까운 네일샵"
              shops={sections.nearby}
              showDistance
              href="/nearby?category=nail"
            />
          )}

          {/* Frequently Visited (logged in only) */}
          {isAuthenticated && sections?.frequentlyVisited?.length > 0 && (
            <ShopSection
              title="자주 방문한 샵"
              shops={sections.frequentlyVisited}
              showVisitCount
            />
          )}

          {/* Best Recommended */}
          {sections?.bestRecommended?.length > 0 && (
            <ShopSection
              title="Best 추천 샵"
              shops={sections.bestRecommended}
              href="/search?sort=rating"
            />
          )}

          {/* Editor's Picks */}
          {sections?.editorPicks?.length > 0 && (
            <EditorPickSection picks={sections.editorPicks} />
          )}
        </>
      )}
    </div>
  );
}
```

---

## Admin Implementation

### Step 7: Editor Picks Management Page

**File:** `src/app/dashboard/system/editor-picks/page.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import {
  Plus,
  GripVertical,
  Edit,
  Trash2,
  Calendar,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function EditorPicksPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPick, setEditingPick] = useState<any>(null);
  const [formData, setFormData] = useState({
    shopId: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  const { data: picks, isLoading } = useQuery({
    queryKey: ['adminEditorPicks'],
    queryFn: async () => {
      const response = await adminApi.get('/admin/editor-picks');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await adminApi.post('/admin/editor-picks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminEditorPicks']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('에디터 픽이 추가되었습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await adminApi.put(`/admin/editor-picks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminEditorPicks']);
      setIsDialogOpen(false);
      resetForm();
      toast.success('에디터 픽이 수정되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.delete(`/admin/editor-picks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminEditorPicks']);
      toast.success('에디터 픽이 삭제되었습니다.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await adminApi.put(`/admin/editor-picks/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminEditorPicks']);
    },
  });

  const resetForm = () => {
    setFormData({
      shopId: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
    });
    setEditingPick(null);
  };

  const handleSubmit = () => {
    if (editingPick) {
      updateMutation.mutate({ id: editingPick.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">에디터 추천 관리</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          추가
        </Button>
      </div>

      <div className="space-y-4">
        {picks?.map((pick: any, index: number) => (
          <Card key={pick.id} className="p-4">
            <div className="flex items-center gap-4">
              <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />

              <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {pick.shop?.thumbnail_url ? (
                  <img
                    src={pick.shop.thumbnail_url}
                    alt={pick.shop.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="font-medium">{pick.title || pick.shop?.name}</h3>
                <p className="text-sm text-gray-500">{pick.shop?.name}</p>
                {pick.description && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                    {pick.description}
                  </p>
                )}
                {(pick.start_date || pick.end_date) && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    {pick.start_date &&
                      format(new Date(pick.start_date), 'M/d', { locale: ko })}
                    {' - '}
                    {pick.end_date &&
                      format(new Date(pick.end_date), 'M/d', { locale: ko })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={pick.active}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: pick.id, active: checked })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingPick(pick);
                    setFormData({
                      shopId: pick.shop_id,
                      title: pick.title || '',
                      description: pick.description || '',
                      startDate: pick.start_date || '',
                      endDate: pick.end_date || '',
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
                      deleteMutation.mutate(pick.id);
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

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPick ? '에디터 픽 수정' : '새 에디터 픽'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">샵 ID</label>
              <Input
                value={formData.shopId}
                onChange={(e) =>
                  setFormData({ ...formData, shopId: e.target.value })
                }
                placeholder="샵 UUID"
              />
            </div>
            <div>
              <label className="text-sm font-medium">제목 (선택)</label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="커스텀 제목"
              />
            </div>
            <div>
              <label className="text-sm font-medium">설명 (선택)</label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="추천 이유"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작일</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">종료일</label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmit}>
              {editingPick ? '수정' : '추가'}
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

### Backend

| File | Action |
|------|--------|
| `src/migrations/XXX_add_editor_picks.sql` | CREATE |
| `src/services/home.service.ts` | CREATE |
| `src/services/admin/editor-picks.service.ts` | CREATE |
| `src/controllers/home.controller.ts` | CREATE |
| `src/controllers/admin/editor-picks.controller.ts` | CREATE |
| `src/routes/home.routes.ts` | CREATE |
| `src/routes/admin/editor-picks.routes.ts` | CREATE |

### Frontend

| File | Action |
|------|--------|
| `src/components/home/ShopSection.tsx` | CREATE |
| `src/components/home/EditorPickCard.tsx` | CREATE |
| `src/app/page.tsx` | MODIFY |

### Admin

| File | Action |
|------|--------|
| `src/app/dashboard/system/editor-picks/page.tsx` | CREATE |

---

## Testing Checklist

- [ ] Nearby nail shops section shows with distance
- [ ] Frequently visited shows only for logged-in users
- [ ] Best recommended shows top-rated shops
- [ ] Editor picks displays featured shops
- [ ] Admin can add/edit/delete editor picks
- [ ] Active toggle works
- [ ] Date scheduling works
- [ ] Horizontal scroll works on all sections
