# Implementation Plan: Nearby Shops Map (Kakao Map)

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 10-14 hours |
| **Risk Level** | Medium |
| **Components Affected** | Backend + Frontend |
| **Dependencies** | Kakao Map JavaScript SDK |

## Problem Statement

Users want to discover nearby beauty shops on a map:

```
Feedback: 홈 하단에 '내주변(지도)' 들어가기 - 핑프 및 캐치테이블 카피
```

**Current State:**
- No map feature exists
- Shop discovery is list-based only
- No geospatial queries for nearby shops
- Location context not utilized

**Impact:**
1. Reduced shop discovery experience
2. Users can't visualize shop locations
3. Missing competitive feature (like Pingf, CatchTable)
4. Location-based recommendations not available

---

## Solution Architecture

### Map Technology

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Kakao Map** | Korean-focused, accurate Korean addresses, free tier | Korea-only | ✅ **Selected** |
| Google Maps | Global, well-documented | Cost, less accurate for Korean addresses | Not recommended |
| Naver Map | Korean-focused | Complex API | Backup option |

### Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Map View** | P0 | Display shops as markers on map |
| **Current Location** | P0 | Center map on user's location |
| **Shop Markers** | P0 | Custom markers by category |
| **Info Window** | P1 | Shop preview on marker click |
| **List/Map Toggle** | P1 | Switch between views |
| **Category Filter** | P2 | Filter by shop category |
| **Radius Filter** | P2 | Adjust search radius |

---

## Environment Configuration

### Backend (.env additions)

```bash
# Kakao Map API
KAKAO_REST_API_KEY=your_kakao_rest_api_key
```

### Frontend (.env additions)

```bash
# Kakao Map
NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_javascript_key
NEXT_PUBLIC_DEFAULT_LATITUDE=37.5665
NEXT_PUBLIC_DEFAULT_LONGITUDE=126.9780
NEXT_PUBLIC_FEATURE_NEARBY_MAP=true
```

---

## Backend Implementation

### Step 1: Create Geospatial Types

**File:** `src/types/geo.types.ts`

```typescript
/**
 * Geospatial Type Definitions
 */

// Coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Bounding box for map viewport
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Nearby shop search params
export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number; // Default 5km
  category?: string;
  limit?: number;
}

// Shop with distance
export interface ShopWithDistance {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceText: string;
  rating: number;
  reviewCount: number;
  thumbnailUrl: string | null;
  isOpen: boolean;
}

// Map viewport search params
export interface ViewportSearchParams {
  bounds: BoundingBox;
  category?: string;
  limit?: number;
}
```

### Step 2: Update Shop Search Service

**File:** `src/services/shop-search.service.ts` (add methods)

```typescript
/**
 * Shop Search Service - Geospatial Extensions
 */

import { supabase } from '@/config/supabase';
import {
  NearbySearchParams,
  ShopWithDistance,
  ViewportSearchParams,
  Coordinates,
} from '@/types/geo.types';

// Earth radius in km for Haversine formula
const EARTH_RADIUS_KM = 6371;

export class ShopSearchService {
  // ... existing methods ...

  /**
   * Get nearby shops with distance calculation
   */
  async getNearbyShops(params: NearbySearchParams): Promise<ShopWithDistance[]> {
    const {
      latitude,
      longitude,
      radiusKm = 5,
      category,
      limit = 50,
    } = params;

    // Use Supabase RPC for distance calculation
    // This requires a PostgreSQL function for efficiency
    const { data, error } = await supabase.rpc('get_nearby_shops', {
      user_lat: latitude,
      user_lng: longitude,
      radius_km: radiusKm,
      shop_category: category || null,
      result_limit: limit,
    });

    if (error) {
      console.error('Nearby shops query error:', error);
      throw new Error(`Failed to fetch nearby shops: ${error.message}`);
    }

    return (data || []).map((shop: any) => ({
      id: shop.id,
      name: shop.name,
      category: shop.category,
      address: shop.address,
      latitude: shop.latitude,
      longitude: shop.longitude,
      distanceKm: shop.distance_km,
      distanceText: this.formatDistance(shop.distance_km),
      rating: shop.average_rating || 0,
      reviewCount: shop.review_count || 0,
      thumbnailUrl: shop.thumbnail_url,
      isOpen: shop.is_open || false,
    }));
  }

  /**
   * Get shops within map viewport bounds
   */
  async getShopsInViewport(params: ViewportSearchParams): Promise<ShopWithDistance[]> {
    const { bounds, category, limit = 100 } = params;

    let query = supabase
      .from('shops')
      .select(`
        id,
        name,
        category,
        address,
        latitude,
        longitude,
        average_rating,
        review_count,
        thumbnail_url
      `)
      .eq('status', 'active')
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east)
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch shops in viewport: ${error.message}`);
    }

    return (data || []).map((shop) => ({
      id: shop.id,
      name: shop.name,
      category: shop.category,
      address: shop.address,
      latitude: shop.latitude,
      longitude: shop.longitude,
      distanceKm: 0, // Not calculated for viewport query
      distanceText: '',
      rating: shop.average_rating || 0,
      reviewCount: shop.review_count || 0,
      thumbnailUrl: shop.thumbnail_url,
      isOpen: false, // Would need separate calculation
    }));
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  /**
   * Format distance for display
   */
  private formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const shopSearchService = new ShopSearchService();
```

### Step 3: Create Database Function

**File:** `src/migrations/XXX_add_nearby_shops_function.sql`

```sql
-- Migration: Create geospatial function for nearby shops
-- Uses Haversine formula for distance calculation

CREATE OR REPLACE FUNCTION get_nearby_shops(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5,
  shop_category VARCHAR DEFAULT NULL,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  category VARCHAR,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  average_rating DECIMAL,
  review_count INTEGER,
  thumbnail_url TEXT,
  is_open BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.category,
    s.address,
    s.latitude,
    s.longitude,
    -- Haversine formula
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(s.latitude))
      )
    ) AS distance_km,
    s.average_rating,
    s.review_count,
    s.thumbnail_url,
    COALESCE(
      -- Simple open check (would need full logic from operating hours)
      CASE
        WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') BETWEEN 9 AND 21 THEN TRUE
        ELSE FALSE
      END,
      FALSE
    ) AS is_open
  FROM shops s
  WHERE s.status = 'active'
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND (shop_category IS NULL OR s.category = shop_category)
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(s.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$;

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_shops_coordinates
ON shops(latitude, longitude)
WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Step 4: Create API Controller

**File:** `src/controllers/shop-map.controller.ts`

```typescript
/**
 * Shop Map Controller
 * Handles map-related shop discovery endpoints
 */

import { Request, Response } from 'express';
import { shopSearchService } from '@/services/shop-search.service';
import { NearbySearchParams, ViewportSearchParams } from '@/types/geo.types';

export class ShopMapController {
  /**
   * GET /api/shops/nearby
   * Get shops near a location
   */
  async getNearbyShops(req: Request, res: Response): Promise<void> {
    try {
      const {
        lat,
        lng,
        radius = '5',
        category,
        limit = '50',
      } = req.query;

      // Validate coordinates
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid coordinates. lat and lng are required.' },
        });
        return;
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        res.status(400).json({
          success: false,
          error: { message: 'Coordinates out of valid range.' },
        });
        return;
      }

      const params: NearbySearchParams = {
        latitude,
        longitude,
        radiusKm: parseFloat(radius as string) || 5,
        category: category as string | undefined,
        limit: parseInt(limit as string) || 50,
      };

      const shops = await shopSearchService.getNearbyShops(params);

      res.json({
        success: true,
        data: {
          shops,
          center: { latitude, longitude },
          radiusKm: params.radiusKm,
          count: shops.length,
        },
      });
    } catch (error) {
      console.error('Nearby shops error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch nearby shops' },
      });
    }
  }

  /**
   * GET /api/shops/map/viewport
   * Get shops within map viewport bounds
   */
  async getShopsInViewport(req: Request, res: Response): Promise<void> {
    try {
      const { north, south, east, west, category, limit = '100' } = req.query;

      // Validate bounds
      const bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string),
      };

      if (Object.values(bounds).some(isNaN)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid bounds. north, south, east, west are required.' },
        });
        return;
      }

      const params: ViewportSearchParams = {
        bounds,
        category: category as string | undefined,
        limit: parseInt(limit as string) || 100,
      };

      const shops = await shopSearchService.getShopsInViewport(params);

      res.json({
        success: true,
        data: {
          shops,
          bounds,
          count: shops.length,
        },
      });
    } catch (error) {
      console.error('Viewport shops error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch shops in viewport' },
      });
    }
  }
}

export const shopMapController = new ShopMapController();
```

### Step 5: Add Routes

**File:** `src/routes/shop-map.routes.ts`

```typescript
/**
 * Shop Map Routes
 */

import { Router } from 'express';
import { shopMapController } from '@/controllers/shop-map.controller';
import { asyncHandler } from '@/middleware/async.middleware';

const router = Router();

/**
 * GET /api/shops/nearby
 * Get nearby shops by coordinates
 */
router.get('/nearby', asyncHandler((req, res) => shopMapController.getNearbyShops(req, res)));

/**
 * GET /api/shops/map/viewport
 * Get shops within map viewport
 */
router.get('/map/viewport', asyncHandler((req, res) => shopMapController.getShopsInViewport(req, res)));

export default router;
```

---

## Frontend Implementation

### Step 6: Create Kakao Map Hook

**File:** `src/hooks/use-kakao-map.ts`

```typescript
/**
 * Kakao Map Hook
 * Manages Kakao Map SDK loading and initialization
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

interface UseKakaoMapOptions {
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

interface UseKakaoMapReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
  kakao: any | null;
}

const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

export function useKakaoMap(options?: UseKakaoMapOptions): UseKakaoMapReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if already loaded
    if (window.kakao?.maps) {
      setIsLoaded(true);
      setIsLoading(false);
      options?.onLoad?.();
      return;
    }

    // Check for API key
    if (!KAKAO_MAP_KEY) {
      const err = new Error('Kakao Map API key is not configured');
      setError(err);
      setIsLoading(false);
      options?.onError?.(err);
      return;
    }

    // Load Kakao Maps SDK
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false&libraries=services,clusterer`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => {
        setIsLoaded(true);
        setIsLoading(false);
        options?.onLoad?.();
      });
    };

    script.onerror = () => {
      const err = new Error('Failed to load Kakao Maps SDK');
      setError(err);
      setIsLoading(false);
      options?.onError?.(err);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: Don't remove script as it might be used by other components
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    kakao: isLoaded ? window.kakao : null,
  };
}
```

### Step 7: Create Shop Map Component

**File:** `src/components/map/ShopMap.tsx`

```tsx
/**
 * ShopMap Component
 * Displays nearby shops on a Kakao Map
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin, List, Map as MapIcon, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useKakaoMap } from '@/hooks/use-kakao-map';
import { useLocation } from '@/contexts/LocationContext';
import { ShopWithDistance } from '@/types/geo.types';
import { cn } from '@/lib/utils';

interface ShopMapProps {
  shops: ShopWithDistance[];
  onShopSelect?: (shop: ShopWithDistance) => void;
  onBoundsChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  className?: string;
}

// Category colors for markers
const categoryColors: Record<string, string> = {
  nail: '#FF6B6B',
  eyelash: '#845EF7',
  waxing: '#20C997',
  hair: '#339AF0',
  default: '#FF922B',
};

// Custom marker icon SVG
const createMarkerSVG = (color: string) => `
<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.059 27.941 0 18 0z" fill="${color}"/>
  <circle cx="18" cy="18" r="8" fill="white"/>
</svg>
`;

export function ShopMap({
  shops,
  onShopSelect,
  onBoundsChange,
  className,
}: ShopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const { isLoaded, isLoading, error, kakao } = useKakaoMap();
  const { location, requestLocation } = useLocation();

  const [selectedShop, setSelectedShop] = useState<ShopWithDistance | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !kakao) return;

    const defaultCenter = new kakao.maps.LatLng(
      location?.latitude || 37.5665,
      location?.longitude || 126.9780
    );

    const mapOptions = {
      center: defaultCenter,
      level: 5, // Zoom level (1-14, lower = more zoomed in)
    };

    const map = new kakao.maps.Map(mapRef.current, mapOptions);
    mapInstanceRef.current = map;

    // Add zoom control
    const zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

    // Listen for bounds changes
    kakao.maps.event.addListener(map, 'idle', () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      onBoundsChange?.({
        south: sw.getLat(),
        west: sw.getLng(),
        north: ne.getLat(),
        east: ne.getLng(),
      });
    });

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [isLoaded, kakao, location]);

  // Update markers when shops change
  useEffect(() => {
    if (!mapInstanceRef.current || !kakao || !shops.length) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Create info window (reusable)
    if (!infoWindowRef.current) {
      infoWindowRef.current = new kakao.maps.InfoWindow({ zIndex: 1 });
    }

    // Create markers for each shop
    shops.forEach((shop) => {
      const position = new kakao.maps.LatLng(shop.latitude, shop.longitude);
      const color = categoryColors[shop.category] || categoryColors.default;

      // Create custom marker image
      const markerImage = new kakao.maps.MarkerImage(
        `data:image/svg+xml,${encodeURIComponent(createMarkerSVG(color))}`,
        new kakao.maps.Size(36, 48),
        { offset: new kakao.maps.Point(18, 48) }
      );

      const marker = new kakao.maps.Marker({
        position,
        image: markerImage,
        map,
      });

      // Click handler
      kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedShop(shop);
        onShopSelect?.(shop);

        // Show info window
        const content = `
          <div style="padding: 12px; min-width: 200px;">
            <h4 style="margin: 0 0 4px; font-weight: 600;">${shop.name}</h4>
            <p style="margin: 0; font-size: 12px; color: #666;">${shop.address}</p>
            <div style="margin-top: 8px; display: flex; gap: 8px; font-size: 12px;">
              <span>⭐ ${shop.rating.toFixed(1)}</span>
              <span>${shop.distanceText}</span>
            </div>
          </div>
        `;
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (shops.length > 1) {
      const bounds = new kakao.maps.LatLngBounds();
      shops.forEach((shop) => {
        bounds.extend(new kakao.maps.LatLng(shop.latitude, shop.longitude));
      });
      map.setBounds(bounds);
    }
  }, [shops, kakao, onShopSelect]);

  // Center on user location
  const centerOnUser = useCallback(async () => {
    if (!mapInstanceRef.current || !kakao) return;

    const loc = await requestLocation();
    if (loc) {
      const position = new kakao.maps.LatLng(loc.latitude, loc.longitude);
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setLevel(4);
    }
  }, [kakao, requestLocation]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-96 bg-gray-100 rounded-lg', className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-gray-500">지도 로딩 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-96 bg-gray-100 rounded-lg', className)}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">지도를 불러올 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* View Mode Toggle */}
      <div className="absolute top-3 left-3 z-10 flex gap-1 bg-white rounded-lg shadow-md p-1">
        <Button
          variant={viewMode === 'map' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('map')}
        >
          <MapIcon className="h-4 w-4 mr-1" />
          지도
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('list')}
        >
          <List className="h-4 w-4 mr-1" />
          목록
        </Button>
      </div>

      {/* Center on User Button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-3 right-3 z-10 shadow-md"
        onClick={centerOnUser}
      >
        <Navigation className="h-4 w-4" />
      </Button>

      {/* Map View */}
      {viewMode === 'map' && (
        <div ref={mapRef} className="w-full h-96 rounded-lg" />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="h-96 overflow-y-auto space-y-2 p-2">
          {shops.map((shop) => (
            <Card
              key={shop.id}
              className={cn(
                'p-3 cursor-pointer transition-colors',
                selectedShop?.id === shop.id && 'ring-2 ring-primary'
              )}
              onClick={() => {
                setSelectedShop(shop);
                onShopSelect?.(shop);
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-sm">{shop.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{shop.address}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {shop.distanceText}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <span>⭐ {shop.rating.toFixed(1)}</span>
                <span>리뷰 {shop.reviewCount}</span>
                {shop.isOpen && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    영업중
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Shop Count */}
      <div className="absolute bottom-3 left-3 z-10">
        <Badge variant="secondary" className="shadow-md">
          {shops.length}개 샵
        </Badge>
      </div>
    </div>
  );
}

export default ShopMap;
```

### Step 8: Create Nearby Page

**File:** `src/app/nearby/page.tsx`

```tsx
/**
 * Nearby Shops Page
 * Map-based shop discovery
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShopMap } from '@/components/map/ShopMap';
import { useLocation } from '@/contexts/LocationContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { ShopWithDistance } from '@/types/geo.types';

const categories = [
  { value: '', label: '전체' },
  { value: 'nail', label: '네일' },
  { value: 'eyelash', label: '속눈썹' },
  { value: 'waxing', label: '왁싱/눈썹문신' },
  { value: 'hair', label: '헤어' },
];

const radiusOptions = [
  { value: '1', label: '1km 이내' },
  { value: '3', label: '3km 이내' },
  { value: '5', label: '5km 이내' },
  { value: '10', label: '10km 이내' },
];

export default function NearbyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { location, requestLocation, isLoading: locationLoading } = useLocation();

  const [shops, setShops] = useState<ShopWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch nearby shops
  const fetchNearbyShops = useCallback(async () => {
    if (!location) return;

    setIsLoading(true);
    try {
      const response = await api.get('/shops/nearby', {
        params: {
          lat: location.latitude,
          lng: location.longitude,
          radius,
          category: category || undefined,
          limit: 100,
        },
      });

      if (response.data.success) {
        setShops(response.data.data.shops);
      }
    } catch (error) {
      console.error('Failed to fetch nearby shops:', error);
      toast({
        title: '오류',
        description: '주변 샵을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [location, category, radius, toast]);

  // Request location on mount
  useEffect(() => {
    if (!location) {
      requestLocation();
    }
  }, []);

  // Fetch shops when location or filters change
  useEffect(() => {
    if (location) {
      fetchNearbyShops();
    }
  }, [location, category, radius, fetchNearbyShops]);

  // Handle shop selection
  const handleShopSelect = (shop: ShopWithDistance) => {
    router.push(`/shop/${shop.id}`);
  };

  // Filter shops by search query
  const filteredShops = searchQuery
    ? shops.filter(
        (shop) =>
          shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shop.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shops;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">내 주변 샵</h1>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="샵 이름 또는 주소 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category & Radius */}
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={radius} onValueChange={setRadius}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {radiusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Map */}
      <div className="p-4">
        <ShopMap
          shops={filteredShops}
          onShopSelect={handleShopSelect}
          className="shadow-md"
        />
      </div>

      {/* Location Permission Request */}
      {!location && !locationLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-4 max-w-sm text-center">
            <h2 className="text-lg font-semibold mb-2">위치 권한 필요</h2>
            <p className="text-sm text-gray-600 mb-4">
              주변 샵을 찾으려면 위치 권한이 필요합니다.
            </p>
            <Button onClick={requestLocation} className="w-full">
              위치 권한 허용
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 9: Add Navigation Button to Home

**File:** `src/app/page.tsx` (add to home page)

```tsx
// Add this section to the home page

import Link from 'next/link';
import { MapPin } from 'lucide-react';

// In the JSX, add after categories:
<section className="px-4 py-4">
  <Link href="/nearby">
    <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-4 text-white flex items-center justify-between">
      <div>
        <h3 className="font-semibold">내 주변 샵 찾기</h3>
        <p className="text-sm text-white/80">지도에서 가까운 샵을 확인하세요</p>
      </div>
      <div className="bg-white/20 rounded-full p-3">
        <MapPin className="h-6 w-6" />
      </div>
    </div>
  </Link>
</section>
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_add_nearby_shops_function.sql` | **CREATE** | Database function |
| `src/types/geo.types.ts` | **CREATE** | Geospatial types |
| `src/services/shop-search.service.ts` | **MODIFY** | Add geospatial methods |
| `src/controllers/shop-map.controller.ts` | **CREATE** | Map API controller |
| `src/routes/shop-map.routes.ts` | **CREATE** | Map routes |
| `src/routes/index.ts` | **MODIFY** | Register map routes |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `src/types/geo.types.ts` | **CREATE** | Geospatial types |
| `src/hooks/use-kakao-map.ts` | **CREATE** | Kakao Map hook |
| `src/components/map/ShopMap.tsx` | **CREATE** | Map component |
| `src/app/nearby/page.tsx` | **CREATE** | Nearby shops page |
| `src/app/page.tsx` | **MODIFY** | Add nearby button |

---

## Kakao Developer Setup

### Required Steps

1. Go to https://developers.kakao.com
2. Create new application
3. Enable "Kakao Map" API
4. Get JavaScript key for frontend
5. Get REST API key for backend (if needed)
6. Add allowed domains: `localhost`, `app.e-beautything.com`

---

## Testing Checklist

- [ ] Kakao Map loads correctly
- [ ] User location is detected
- [ ] Nearby shops are displayed
- [ ] Distance calculation is accurate
- [ ] Category filter works
- [ ] Radius filter works
- [ ] Shop markers display correctly
- [ ] Info window shows on marker click
- [ ] List/Map toggle works
- [ ] Navigate to shop detail on select

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Map load time | <2 seconds |
| Location accuracy | <100m |
| Nearby query response | <500ms |
| User engagement | >30% click through |
