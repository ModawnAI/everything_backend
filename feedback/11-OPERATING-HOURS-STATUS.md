# Implementation Plan: Operating Hours "isOpen" Status

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 6-8 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Frontend App |
| **Dependencies** | shop_operating_hours table (exists) |

## Problem Statement

Operating hours "isOpen" status calculation is marked as TODO:

```typescript
// Frontend: Shop isOpen status not calculated
// Users can't see at a glance if a shop is currently open
// Backend has operating hours data but no real-time status endpoint
```

**Current State:**
- `shop_operating_hours` table exists with day-of-week schedules
- Backend returns raw operating hours data
- Frontend displays hours but doesn't calculate "open now" status
- No handling of special closures or holidays

**Impact:**
1. Users can't quickly see if shop is open
2. May attempt to book at closed shops
3. Poor user experience for shop discovery
4. Missing "Open Now" filter in search

---

## Database Schema (Existing)

### shop_operating_hours Table

```sql
-- Existing table structure
CREATE TABLE shop_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, day_of_week)
);
```

### New: shop_special_hours Table

```sql
-- Migration: Add special hours/holidays table
-- File: src/migrations/XXX_add_shop_special_hours.sql

CREATE TABLE IF NOT EXISTS shop_special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- Date range for special hours
  date DATE NOT NULL,
  end_date DATE, -- Optional for multi-day closures

  -- Special hours type
  type VARCHAR(50) NOT NULL DEFAULT 'holiday', -- 'holiday', 'special_hours', 'temporary_closure'

  -- Override hours (null = closed)
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT TRUE,

  -- Info
  reason VARCHAR(200), -- e.g., "설날 연휴", "인테리어 공사"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient date lookups
CREATE INDEX idx_shop_special_hours_shop_date ON shop_special_hours(shop_id, date);
CREATE INDEX idx_shop_special_hours_date ON shop_special_hours(date);

-- RLS Policy
ALTER TABLE shop_special_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view special hours"
  ON shop_special_hours FOR SELECT
  USING (true);

CREATE POLICY "Shop owners can manage special hours"
  ON shop_special_hours FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );
```

---

## Backend Implementation

### Step 1: Create Operating Hours Types

**File:** `src/types/operating-hours.types.ts`

```typescript
/**
 * Operating Hours Type Definitions
 */

// Day of week enum (0 = Sunday)
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Operating hours for a single day
export interface DailyOperatingHours {
  dayOfWeek: DayOfWeek;
  dayName: string;
  dayNameKorean: string;
  openTime: string | null; // HH:MM format
  closeTime: string | null;
  isClosed: boolean;
  breakStart: string | null;
  breakEnd: string | null;
}

// Special hours entry
export interface SpecialHours {
  id: string;
  shopId: string;
  date: string; // YYYY-MM-DD
  endDate: string | null;
  type: 'holiday' | 'special_hours' | 'temporary_closure';
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  reason: string | null;
}

// Current status result
export interface ShopOpenStatus {
  isOpen: boolean;
  isBreakTime: boolean;
  currentDay: DailyOperatingHours | null;
  nextOpenTime: string | null; // ISO datetime
  nextCloseTime: string | null; // ISO datetime
  statusText: string; // Korean status text
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  specialHoursActive: SpecialHours | null;
}

// Full operating hours response
export interface ShopOperatingHoursResponse {
  shopId: string;
  timezone: string;
  weeklyHours: DailyOperatingHours[];
  specialHours: SpecialHours[];
  currentStatus: ShopOpenStatus;
}
```

### Step 2: Create Operating Hours Service

**File:** `src/services/operating-hours.service.ts`

```typescript
/**
 * Operating Hours Service
 * Calculates real-time shop open/closed status
 */

import { supabase } from '@/config/supabase';
import {
  DayOfWeek,
  DailyOperatingHours,
  SpecialHours,
  ShopOpenStatus,
  ShopOperatingHoursResponse,
} from '@/types/operating-hours.types';

// Korean day names
const DAY_NAMES_KOREAN = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DAY_NAMES_ENGLISH = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Korea timezone
const KOREA_TIMEZONE = 'Asia/Seoul';

export class OperatingHoursService {
  /**
   * Get full operating hours with current status
   */
  async getOperatingHours(shopId: string): Promise<ShopOperatingHoursResponse> {
    // Get weekly hours
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('shop_operating_hours')
      .select('*')
      .eq('shop_id', shopId)
      .order('day_of_week');

    if (weeklyError) {
      throw new Error(`Failed to fetch operating hours: ${weeklyError.message}`);
    }

    // Get special hours for next 30 days
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 30);

    const { data: specialData, error: specialError } = await supabase
      .from('shop_special_hours')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', futureDate.toISOString().split('T')[0])
      .order('date');

    if (specialError) {
      throw new Error(`Failed to fetch special hours: ${specialError.message}`);
    }

    // Map weekly hours
    const weeklyHours: DailyOperatingHours[] = this.mapWeeklyHours(weeklyData || []);

    // Map special hours
    const specialHours: SpecialHours[] = (specialData || []).map((sh) => ({
      id: sh.id,
      shopId: sh.shop_id,
      date: sh.date,
      endDate: sh.end_date,
      type: sh.type,
      openTime: sh.open_time,
      closeTime: sh.close_time,
      isClosed: sh.is_closed,
      reason: sh.reason,
    }));

    // Calculate current status
    const currentStatus = this.calculateCurrentStatus(weeklyHours, specialHours);

    return {
      shopId,
      timezone: KOREA_TIMEZONE,
      weeklyHours,
      specialHours,
      currentStatus,
    };
  }

  /**
   * Get just the current open status (lightweight)
   */
  async getOpenStatus(shopId: string): Promise<ShopOpenStatus> {
    const response = await this.getOperatingHours(shopId);
    return response.currentStatus;
  }

  /**
   * Batch get open status for multiple shops
   */
  async getBatchOpenStatus(shopIds: string[]): Promise<Map<string, ShopOpenStatus>> {
    const results = new Map<string, ShopOpenStatus>();

    // Get all operating hours in one query
    const { data: allHours, error: hoursError } = await supabase
      .from('shop_operating_hours')
      .select('*')
      .in('shop_id', shopIds);

    if (hoursError) {
      throw new Error(`Failed to fetch operating hours: ${hoursError.message}`);
    }

    // Get special hours for today
    const today = new Date().toISOString().split('T')[0];
    const { data: specialData, error: specialError } = await supabase
      .from('shop_special_hours')
      .select('*')
      .in('shop_id', shopIds)
      .eq('date', today);

    if (specialError) {
      throw new Error(`Failed to fetch special hours: ${specialError.message}`);
    }

    // Group by shop
    const hoursByShop = new Map<string, any[]>();
    const specialByShop = new Map<string, SpecialHours[]>();

    (allHours || []).forEach((h) => {
      if (!hoursByShop.has(h.shop_id)) {
        hoursByShop.set(h.shop_id, []);
      }
      hoursByShop.get(h.shop_id)!.push(h);
    });

    (specialData || []).forEach((sh) => {
      if (!specialByShop.has(sh.shop_id)) {
        specialByShop.set(sh.shop_id, []);
      }
      specialByShop.get(sh.shop_id)!.push({
        id: sh.id,
        shopId: sh.shop_id,
        date: sh.date,
        endDate: sh.end_date,
        type: sh.type,
        openTime: sh.open_time,
        closeTime: sh.close_time,
        isClosed: sh.is_closed,
        reason: sh.reason,
      });
    });

    // Calculate status for each shop
    for (const shopId of shopIds) {
      const weeklyHours = this.mapWeeklyHours(hoursByShop.get(shopId) || []);
      const specialHours = specialByShop.get(shopId) || [];
      const status = this.calculateCurrentStatus(weeklyHours, specialHours);
      results.set(shopId, status);
    }

    return results;
  }

  /**
   * Map raw database rows to DailyOperatingHours
   */
  private mapWeeklyHours(data: any[]): DailyOperatingHours[] {
    // Create default closed entries for all days
    const hoursByDay = new Map<number, DailyOperatingHours>();

    for (let i = 0; i < 7; i++) {
      hoursByDay.set(i, {
        dayOfWeek: i as DayOfWeek,
        dayName: DAY_NAMES_ENGLISH[i],
        dayNameKorean: DAY_NAMES_KOREAN[i],
        openTime: null,
        closeTime: null,
        isClosed: true,
        breakStart: null,
        breakEnd: null,
      });
    }

    // Override with actual data
    for (const row of data) {
      hoursByDay.set(row.day_of_week, {
        dayOfWeek: row.day_of_week,
        dayName: DAY_NAMES_ENGLISH[row.day_of_week],
        dayNameKorean: DAY_NAMES_KOREAN[row.day_of_week],
        openTime: row.open_time,
        closeTime: row.close_time,
        isClosed: row.is_closed,
        breakStart: row.break_start,
        breakEnd: row.break_end,
      });
    }

    // Return sorted by day
    return Array.from(hoursByDay.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  /**
   * Calculate current open/closed status
   */
  private calculateCurrentStatus(
    weeklyHours: DailyOperatingHours[],
    specialHours: SpecialHours[]
  ): ShopOpenStatus {
    // Get current time in Korea
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: KOREA_TIMEZONE }));
    const currentDay = koreaTime.getDay() as DayOfWeek;
    const currentTime = this.formatTime(koreaTime);
    const todayDate = koreaTime.toISOString().split('T')[0];

    // Check for special hours today
    const activeSpecialHours = specialHours.find((sh) => {
      if (sh.date === todayDate) return true;
      if (sh.endDate && sh.date <= todayDate && sh.endDate >= todayDate) return true;
      return false;
    });

    // Get today's hours
    const todayHours = weeklyHours.find((h) => h.dayOfWeek === currentDay);

    // If special hours active
    if (activeSpecialHours) {
      if (activeSpecialHours.isClosed) {
        return {
          isOpen: false,
          isBreakTime: false,
          currentDay: todayHours || null,
          nextOpenTime: this.calculateNextOpenTime(weeklyHours, koreaTime, specialHours),
          nextCloseTime: null,
          statusText: activeSpecialHours.reason || '휴무',
          statusColor: 'red',
          specialHoursActive: activeSpecialHours,
        };
      }

      // Special hours with modified times
      const isOpen = this.isTimeInRange(
        currentTime,
        activeSpecialHours.openTime!,
        activeSpecialHours.closeTime!
      );

      return {
        isOpen,
        isBreakTime: false,
        currentDay: todayHours || null,
        nextOpenTime: isOpen ? null : this.calculateNextOpenTime(weeklyHours, koreaTime, specialHours),
        nextCloseTime: isOpen ? this.combineDateAndTime(koreaTime, activeSpecialHours.closeTime!) : null,
        statusText: isOpen ? '영업 중 (특별 영업시간)' : '영업 종료',
        statusColor: isOpen ? 'yellow' : 'red',
        specialHoursActive: activeSpecialHours,
        };
    }

    // Regular hours
    if (!todayHours || todayHours.isClosed) {
      return {
        isOpen: false,
        isBreakTime: false,
        currentDay: todayHours || null,
        nextOpenTime: this.calculateNextOpenTime(weeklyHours, koreaTime, specialHours),
        nextCloseTime: null,
        statusText: '오늘 휴무',
        statusColor: 'red',
        specialHoursActive: null,
      };
    }

    // Check if currently in break time
    if (todayHours.breakStart && todayHours.breakEnd) {
      const isBreakTime = this.isTimeInRange(currentTime, todayHours.breakStart, todayHours.breakEnd);
      if (isBreakTime) {
        return {
          isOpen: false,
          isBreakTime: true,
          currentDay: todayHours,
          nextOpenTime: this.combineDateAndTime(koreaTime, todayHours.breakEnd),
          nextCloseTime: this.combineDateAndTime(koreaTime, todayHours.closeTime!),
          statusText: `휴식 시간 (${todayHours.breakEnd}까지)`,
          statusColor: 'yellow',
          specialHoursActive: null,
        };
      }
    }

    // Check if within operating hours
    const isOpen = this.isTimeInRange(currentTime, todayHours.openTime!, todayHours.closeTime!);

    if (isOpen) {
      // Check if break is coming soon (within 30 minutes)
      let statusText = '영업 중';
      if (todayHours.breakStart) {
        const minutesToBreak = this.minutesBetween(currentTime, todayHours.breakStart);
        if (minutesToBreak > 0 && minutesToBreak <= 30) {
          statusText = `영업 중 (${minutesToBreak}분 후 휴식)`;
        }
      }

      // Check if closing soon (within 60 minutes)
      const minutesToClose = this.minutesBetween(currentTime, todayHours.closeTime!);
      if (minutesToClose > 0 && minutesToClose <= 60) {
        statusText = `영업 중 (${minutesToClose}분 후 마감)`;
      }

      return {
        isOpen: true,
        isBreakTime: false,
        currentDay: todayHours,
        nextOpenTime: null,
        nextCloseTime: this.combineDateAndTime(koreaTime, todayHours.closeTime!),
        statusText,
        statusColor: 'green',
        specialHoursActive: null,
      };
    }

    // Closed (before open or after close)
    const isBeforeOpen = currentTime < todayHours.openTime!;

    return {
      isOpen: false,
      isBreakTime: false,
      currentDay: todayHours,
      nextOpenTime: isBeforeOpen
        ? this.combineDateAndTime(koreaTime, todayHours.openTime!)
        : this.calculateNextOpenTime(weeklyHours, koreaTime, specialHours),
      nextCloseTime: null,
      statusText: isBeforeOpen ? `${todayHours.openTime} 오픈` : '영업 종료',
      statusColor: isBeforeOpen ? 'yellow' : 'red',
      specialHoursActive: null,
    };
  }

  /**
   * Calculate next open time
   */
  private calculateNextOpenTime(
    weeklyHours: DailyOperatingHours[],
    fromDate: Date,
    specialHours: SpecialHours[]
  ): string | null {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkDate = new Date(fromDate);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      const dayOfWeek = checkDate.getDay() as DayOfWeek;
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check for special closure
      const specialClosure = specialHours.find((sh) => {
        if (sh.date === dateStr && sh.isClosed) return true;
        if (sh.endDate && sh.date <= dateStr && sh.endDate >= dateStr && sh.isClosed) return true;
        return false;
      });

      if (specialClosure) continue;

      // Check regular hours
      const dayHours = weeklyHours.find((h) => h.dayOfWeek === dayOfWeek);
      if (dayHours && !dayHours.isClosed && dayHours.openTime) {
        return this.combineDateAndTime(checkDate, dayHours.openTime);
      }
    }

    return null;
  }

  /**
   * Helper: Check if time is in range
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    // Handle overnight hours (e.g., 22:00 - 02:00)
    if (end < start) {
      return current >= start || current < end;
    }
    return current >= start && current < end;
  }

  /**
   * Helper: Format time to HH:MM
   */
  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Helper: Combine date and time to ISO string
   */
  private combineDateAndTime(date: Date, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result.toISOString();
  }

  /**
   * Helper: Calculate minutes between two times
   */
  private minutesBetween(from: string, to: string): number {
    const [fromH, fromM] = from.split(':').map(Number);
    const [toH, toM] = to.split(':').map(Number);
    return (toH * 60 + toM) - (fromH * 60 + fromM);
  }
}

export const operatingHoursService = new OperatingHoursService();
```

### Step 3: Create API Endpoints

**File:** `src/routes/operating-hours.routes.ts`

```typescript
/**
 * Operating Hours Routes
 */

import { Router } from 'express';
import { operatingHoursService } from '@/services/operating-hours.service';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

/**
 * GET /api/shops/:shopId/status
 * Get current open/closed status for a shop
 */
router.get(
  '/:shopId/status',
  asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const status = await operatingHoursService.getOpenStatus(shopId);

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * GET /api/shops/:shopId/hours
 * Get full operating hours with current status
 */
router.get(
  '/:shopId/hours',
  asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const hours = await operatingHoursService.getOperatingHours(shopId);

    res.json({
      success: true,
      data: hours,
    });
  })
);

/**
 * POST /api/shops/status/batch
 * Get status for multiple shops
 */
router.post(
  '/status/batch',
  asyncHandler(async (req, res) => {
    const { shopIds } = req.body;

    if (!Array.isArray(shopIds) || shopIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'shopIds array is required',
      });
    }

    if (shopIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 shops per request',
      });
    }

    const statusMap = await operatingHoursService.getBatchOpenStatus(shopIds);
    const statusObject = Object.fromEntries(statusMap);

    res.json({
      success: true,
      data: statusObject,
    });
  })
);

export default router;
```

---

## Frontend Implementation

### Step 4: Create useShopStatus Hook

**File:** `src/hooks/use-shop-status.ts`

```typescript
/**
 * useShopStatus Hook
 * Fetches and manages shop open/closed status
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ShopOpenStatus } from '@/types/operating-hours.types';

interface UseShopStatusOptions {
  shopId: string;
  enabled?: boolean;
  refetchInterval?: number; // Auto-refresh interval in ms
}

export function useShopStatus({
  shopId,
  enabled = true,
  refetchInterval = 60000, // Refresh every minute by default
}: UseShopStatusOptions) {
  return useQuery<ShopOpenStatus>({
    queryKey: ['shop-status', shopId],
    queryFn: async () => {
      const response = await api.get(`/shops/${shopId}/status`);
      return response.data.data;
    },
    enabled: enabled && !!shopId,
    staleTime: 30000, // Consider stale after 30 seconds
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Batch fetch status for multiple shops
 */
export function useBatchShopStatus(shopIds: string[], enabled = true) {
  return useQuery<Record<string, ShopOpenStatus>>({
    queryKey: ['shop-status-batch', shopIds.sort().join(',')],
    queryFn: async () => {
      if (shopIds.length === 0) return {};

      const response = await api.post('/shops/status/batch', { shopIds });
      return response.data.data;
    },
    enabled: enabled && shopIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export default useShopStatus;
```

### Step 5: Create ShopStatusBadge Component

**File:** `src/components/shop/ShopStatusBadge.tsx`

```tsx
/**
 * ShopStatusBadge Component
 * Displays shop open/closed status as a badge
 */

'use client';

import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShopOpenStatus } from '@/types/operating-hours.types';

interface ShopStatusBadgeProps {
  status: ShopOpenStatus | null | undefined;
  isLoading?: boolean;
  showIcon?: boolean;
  showNextTime?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function ShopStatusBadge({
  status,
  isLoading = false,
  showIcon = true,
  showNextTime = false,
  size = 'sm',
  className,
}: ShopStatusBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn(sizeClasses[size], 'animate-pulse', className)}>
        <Clock className="h-3 w-3 mr-1" />
        확인 중...
      </Badge>
    );
  }

  if (!status) {
    return (
      <Badge variant="outline" className={cn(sizeClasses[size], colorClasses.gray, className)}>
        정보 없음
      </Badge>
    );
  }

  const colorClass = colorClasses[status.statusColor];

  // Format next time if needed
  let nextTimeText = '';
  if (showNextTime && status.nextOpenTime && !status.isOpen) {
    const nextOpen = new Date(status.nextOpenTime);
    const isToday = new Date().toDateString() === nextOpen.toDateString();
    const timeStr = nextOpen.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (isToday) {
      nextTimeText = ` (${timeStr} 오픈)`;
    } else {
      const dayStr = nextOpen.toLocaleDateString('ko-KR', { weekday: 'short' });
      nextTimeText = ` (${dayStr} ${timeStr})`;
    }
  }

  return (
    <Badge variant="outline" className={cn(sizeClasses[size], colorClass, className)}>
      {showIcon && <Clock className="h-3 w-3 mr-1" />}
      {status.statusText}
      {nextTimeText}
    </Badge>
  );
}

export default ShopStatusBadge;
```

### Step 6: Update ShopCard Component

**File:** `src/components/search/ShopCard.tsx` (update)

```tsx
// Add to imports
import { ShopStatusBadge } from '@/components/shop/ShopStatusBadge';
import { useShopStatus } from '@/hooks/use-shop-status';

// Update ShopCard component
interface ShopCardProps {
  shop: Shop;
  showStatus?: boolean;
}

export function ShopCard({ shop, showStatus = true }: ShopCardProps) {
  const { data: status, isLoading: statusLoading } = useShopStatus({
    shopId: shop.id,
    enabled: showStatus,
    refetchInterval: 60000,
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Shop image */}
      <div className="relative aspect-[4/3]">
        <img
          src={shop.main_image_url || '/placeholder-shop.jpg'}
          alt={shop.name}
          className="w-full h-full object-cover"
        />

        {/* Status badge overlay */}
        {showStatus && (
          <div className="absolute top-2 left-2">
            <ShopStatusBadge
              status={status}
              isLoading={statusLoading}
              showIcon={true}
              showNextTime={true}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Shop info */}
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-1">{shop.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {shop.address}
        </p>
        {/* ... rest of shop info ... */}
      </div>
    </div>
  );
}
```

### Step 7: Add "Open Now" Filter to Search

**File:** `src/components/search/SearchFilters.tsx` (update)

```tsx
// Add to filter options
import { Toggle } from '@/components/ui/toggle';
import { Clock } from 'lucide-react';

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

export function SearchFiltersPanel({ filters, onFiltersChange }: SearchFiltersProps) {
  return (
    <div className="space-y-4 p-4">
      {/* Open Now toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          영업 중인 샵만
        </label>
        <Toggle
          pressed={filters.openNow}
          onPressedChange={(pressed) =>
            onFiltersChange({ ...filters, openNow: pressed })
          }
          aria-label="영업 중인 샵만 보기"
        >
          {filters.openNow ? '켜짐' : '꺼짐'}
        </Toggle>
      </div>

      {/* ... other filters ... */}
    </div>
  );
}
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_add_shop_special_hours.sql` | **CREATE** | Add special hours table |
| `src/types/operating-hours.types.ts` | **CREATE** | TypeScript types |
| `src/services/operating-hours.service.ts` | **CREATE** | Status calculation service |
| `src/routes/operating-hours.routes.ts` | **CREATE** | API routes |
| `src/routes/shop.routes.ts` | **MODIFY** | Register new routes |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `src/types/operating-hours.types.ts` | **CREATE** | TypeScript types |
| `src/hooks/use-shop-status.ts` | **CREATE** | Status hook |
| `src/components/shop/ShopStatusBadge.tsx` | **CREATE** | Status badge |
| `src/components/search/ShopCard.tsx` | **MODIFY** | Add status badge |
| `src/components/search/SearchFilters.tsx` | **MODIFY** | Add "Open Now" filter |

---

## Testing Plan

### Manual Testing

- [ ] Status shows correctly during business hours
- [ ] Status shows correctly outside business hours
- [ ] Break time detection works
- [ ] Special hours override regular hours
- [ ] Holiday closures display correctly
- [ ] "Open Now" filter returns only open shops
- [ ] Status auto-refreshes every minute
- [ ] Batch status fetch works for search results

### Test Scenarios

1. **Shop open**: Status shows green "영업 중"
2. **Shop closed (regular)**: Shows red "오늘 휴무" or "영업 종료"
3. **Break time**: Shows yellow "휴식 시간"
4. **Holiday**: Shows red with holiday reason
5. **About to close**: Shows "영업 중 (30분 후 마감)"
6. **Next open time**: Shows when shop will open next

---

## Deployment Checklist

- [ ] Run migration for special_hours table
- [ ] Deploy backend service and routes
- [ ] Deploy frontend hook and components
- [ ] Update ShopCard in search results
- [ ] Add "Open Now" filter
- [ ] Test in staging
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Status accuracy | 100% |
| API response time | <100ms |
| "Open Now" filter usage | >10% of searches |
| User satisfaction | Positive feedback |
