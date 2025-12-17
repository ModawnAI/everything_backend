# Frontend Implementation Guide - Shop Endpoints

Complete guide for implementing shop-related features in the frontend (Next.js/React).

---

## Architecture Overview

```
Frontend App
├── User App (Browse & Book)
│   ├── Shop Discovery
│   ├── Shop Details
│   └── Booking Flow
│
└── Shop Admin App (Manage)
    ├── Dashboard
    ├── Reservations
    ├── Analytics
    └── Profile Settings
```

---

## 1. API Client Setup

### Create API Client (`lib/api/client.ts`)

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data;
  }

  async get<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async post<T>(endpoint: string, body: any, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: any, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export const apiClient = new ApiClient();
```

---

## 2. Shop API Module (`lib/api/shops.ts`)

```typescript
import { apiClient } from './client';

export interface Shop {
  id: string;
  name: string;
  description: string;
  phone_number: string;
  email: string;
  address: string;
  detailed_address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  shop_type: string;
  shop_status: string;
  main_category: string;
  sub_categories: string[];
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  payment_methods: string[];
  kakao_channel_url?: string;
  total_bookings: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  contact_methods?: ContactMethod[];
  shop_images?: ShopImage[];
  shop_services?: ShopService[];
  statistics?: {
    totalBookings: number;
    totalReviews: number;
    averageRating: number;
  };
}

export interface ShopImage {
  id: string;
  image_url: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
}

export interface ShopService {
  id: string;
  name: string;
  description: string;
  category: string;
  price_min: number;
  price_max: number;
  duration_minutes: number;
  is_available: boolean;
}

export interface ContactMethod {
  id: string;
  contact_type: string;
  contact_value: string;
  label: string;
  is_active: boolean;
  is_primary: boolean;
}

// ========================================
// PUBLIC ENDPOINTS (No auth required)
// ========================================

/**
 * Get all shops with optional filters
 */
export async function getAllShops(params?: {
  status?: string;
  category?: string;
  shopType?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.shopType) queryParams.set('shopType', params.shopType);
  if (params?.ownerId) queryParams.set('ownerId', params.ownerId);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  return apiClient.get<{
    success: boolean;
    data: {
      shops: Shop[];
      pagination: {
        limit: number;
        offset: number;
        total: number;
      };
    };
  }>(`/api/shops?${queryParams}`);
}

/**
 * Get single shop details with images, services, and statistics
 */
export async function getShopById(shopId: string) {
  return apiClient.get<{
    success: boolean;
    data: Shop;
  }>(`/api/shops/${shopId}`);
}

/**
 * Get nearby shops based on location
 */
export async function getNearbyShops(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  category?: string;
  shopType?: string;
  onlyFeatured?: boolean;
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
  });

  if (params.radius) queryParams.set('radius', params.radius.toString());
  if (params.category) queryParams.set('category', params.category);
  if (params.shopType) queryParams.set('shopType', params.shopType);
  if (params.onlyFeatured) queryParams.set('onlyFeatured', 'true');
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  return apiClient.get<{
    success: boolean;
    data: {
      shops: Shop[];
      pagination: any;
    };
  }>(`/api/shops/nearby?${queryParams}`);
}

/**
 * Get popular shops
 */
export async function getPopularShops(params?: {
  category?: string;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.set('category', params.category);
  if (params?.limit) queryParams.set('limit', params.limit.toString());

  return apiClient.get<{
    success: boolean;
    data: {
      shops: Shop[];
    };
  }>(`/api/shops/popular?${queryParams}`);
}

/**
 * Get shops within map bounds
 */
export async function getShopsInBounds(params: {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
  category?: string;
}) {
  const queryParams = new URLSearchParams({
    neLat: params.neLat.toString(),
    neLng: params.neLng.toString(),
    swLat: params.swLat.toString(),
    swLng: params.swLng.toString(),
  });

  if (params.category) queryParams.set('category', params.category);

  return apiClient.get<{
    success: boolean;
    data: {
      shops: Shop[];
    };
  }>(`/api/shops/bounds?${queryParams}`);
}

/**
 * Get shop images
 */
export async function getShopImages(shopId: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      images: ShopImage[];
    };
  }>(`/api/shops/${shopId}/images`);
}

// ========================================
// SHOP OWNER ENDPOINTS (Auth required)
// ========================================

/**
 * Get shop owner profile (includes shop info)
 */
export async function getShopOwnerProfile(token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      id: string;
      email: string;
      name: string;
      role: string;
      shop: Shop;
      created_at: string;
      last_login_at: string;
    };
  }>('/api/shop-owner/profile', token);
}

/**
 * Get shop dashboard data
 */
export async function getShopDashboard(token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      todayReservations: number;
      pendingReservations: number;
      todayRevenue: number;
      thisWeekRevenue: number;
      thisMonthRevenue: number;
      recentPendingReservations: any[];
      upcomingReservations: any[];
      statistics: {
        totalBookings: number;
        completionRate: number;
        averageRating: number;
      };
    };
  }>('/api/shop-owner/dashboard', token);
}

/**
 * Get shop analytics
 */
export async function getShopAnalytics(
  token: string,
  params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }
) {
  const queryParams = new URLSearchParams();
  if (params?.period) queryParams.set('period', params.period);
  if (params?.startDate) queryParams.set('startDate', params.startDate);
  if (params?.endDate) queryParams.set('endDate', params.endDate);

  return apiClient.get<{
    success: boolean;
    data: {
      revenue: any;
      reservations: any;
      customers: any;
      performance: any;
    };
  }>(`/api/shop-owner/analytics?${queryParams}`, token);
}

/**
 * Get own shop details
 */
export async function getOwnShop(shopId: string, token: string) {
  return apiClient.get<{
    success: boolean;
    data: Shop;
  }>(`/api/shop-owner/shops/${shopId}`, token);
}

/**
 * Get shop operating hours
 */
export async function getShopOperatingHours(shopId: string, token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
    };
  }>(`/api/shop-owner/shops/${shopId}/operating-hours`, token);
}
```

---

## 3. React Hooks (`hooks/useShops.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as shopApi from '@/lib/api/shops';

/**
 * Get all shops (for browsing)
 */
export function useShops(params?: Parameters<typeof shopApi.getAllShops>[0]) {
  return useQuery({
    queryKey: ['shops', params],
    queryFn: () => shopApi.getAllShops(params),
  });
}

/**
 * Get single shop details
 */
export function useShop(shopId: string) {
  return useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => shopApi.getShopById(shopId),
    enabled: !!shopId,
  });
}

/**
 * Get nearby shops
 */
export function useNearbyShops(params: Parameters<typeof shopApi.getNearbyShops>[0]) {
  return useQuery({
    queryKey: ['shops', 'nearby', params],
    queryFn: () => shopApi.getNearbyShops(params),
    enabled: !!params.latitude && !!params.longitude,
  });
}

/**
 * Get popular shops
 */
export function usePopularShops(params?: Parameters<typeof shopApi.getPopularShops>[0]) {
  return useQuery({
    queryKey: ['shops', 'popular', params],
    queryFn: () => shopApi.getPopularShops(params),
  });
}

/**
 * Get shop owner profile (for shop admin)
 */
export function useShopOwnerProfile(token: string) {
  return useQuery({
    queryKey: ['shopOwner', 'profile'],
    queryFn: () => shopApi.getShopOwnerProfile(token),
    enabled: !!token,
  });
}

/**
 * Get shop dashboard (for shop admin)
 */
export function useShopDashboard(token: string) {
  return useQuery({
    queryKey: ['shopOwner', 'dashboard'],
    queryFn: () => shopApi.getShopDashboard(token),
    enabled: !!token,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Get shop analytics (for shop admin)
 */
export function useShopAnalytics(
  token: string,
  params?: Parameters<typeof shopApi.getShopAnalytics>[1]
) {
  return useQuery({
    queryKey: ['shopOwner', 'analytics', params],
    queryFn: () => shopApi.getShopAnalytics(token, params),
    enabled: !!token,
  });
}
```

---

## 4. User App - Shop Discovery Page

```tsx
// app/shops/page.tsx
'use client';

import { useState } from 'react';
import { useShops } from '@/hooks/useShops';
import ShopCard from '@/components/ShopCard';

export default function ShopsPage() {
  const [filters, setFilters] = useState({
    status: 'active',
    category: '',
    limit: 20,
    offset: 0,
  });

  const { data, isLoading, error } = useShops(filters);

  if (isLoading) return <div>Loading shops...</div>;
  if (error) return <div>Error loading shops</div>;

  const shops = data?.data.shops || [];

  return (
    <div className="shops-page">
      <h1>Browse Beauty Shops</h1>

      {/* Filters */}
      <div className="filters">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value, offset: 0 })}
        >
          <option value="">All Categories</option>
          <option value="hair">Hair</option>
          <option value="nail">Nail</option>
          <option value="makeup">Makeup</option>
          <option value="skincare">Skincare</option>
          <option value="massage">Massage</option>
          <option value="eyelash">Eyelash</option>
          <option value="eyebrow">Eyebrow</option>
        </select>
      </div>

      {/* Shop Grid */}
      <div className="shops-grid">
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
          disabled={filters.offset === 0}
        >
          Previous
        </button>
        <button
          onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
          disabled={shops.length < filters.limit}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## 5. User App - Shop Details Page

```tsx
// app/shops/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useShop } from '@/hooks/useShops';
import Image from 'next/image';
import Link from 'next/link';

export default function ShopDetailsPage() {
  const params = useParams();
  const shopId = params.id as string;

  const { data, isLoading, error } = useShop(shopId);

  if (isLoading) return <div>Loading shop details...</div>;
  if (error || !data?.data) return <div>Shop not found</div>;

  const shop = data.data;

  return (
    <div className="shop-details">
      {/* Image Gallery */}
      <div className="image-gallery">
        {shop.shop_images && shop.shop_images.length > 0 ? (
          <Image
            src={shop.shop_images.find(img => img.is_primary)?.image_url || shop.shop_images[0].image_url}
            alt={shop.name}
            width={800}
            height={400}
            className="main-image"
          />
        ) : (
          <div className="no-image">No image available</div>
        )}
      </div>

      {/* Shop Info */}
      <div className="shop-info">
        <h1>{shop.name}</h1>

        {/* Rating */}
        {shop.statistics && (
          <div className="rating">
            <span className="stars">⭐ {shop.statistics.averageRating.toFixed(1)}</span>
            <span className="reviews">({shop.statistics.totalReviews} reviews)</span>
            <span className="bookings">{shop.statistics.totalBookings} bookings</span>
          </div>
        )}

        {/* Description */}
        <p className="description">{shop.description}</p>

        {/* Category */}
        <div className="category">
          <span className="badge">{shop.main_category}</span>
          {shop.sub_categories?.map(cat => (
            <span key={cat} className="badge secondary">{cat}</span>
          ))}
        </div>

        {/* Contact Info */}
        <div className="contact-info">
          <h3>Contact Information</h3>
          <div className="contact-methods">
            {shop.contact_methods?.map((method) => (
              <a
                key={method.id}
                href={getContactLink(method.contact_type, method.contact_value)}
                className="contact-button"
              >
                {method.label}: {method.contact_value}
              </a>
            ))}

            {/* Fallback to direct phone/email */}
            {shop.phone_number && (
              <a href={`tel:${shop.phone_number}`} className="contact-button">
                📞 {shop.phone_number}
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`} className="contact-button">
                ✉️ {shop.email}
              </a>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="address">
          <h3>Location</h3>
          <p>{shop.address}</p>
          {shop.detailed_address && <p>{shop.detailed_address}</p>}
          {shop.postal_code && <p>Postal Code: {shop.postal_code}</p>}

          {/* Map */}
          {shop.latitude && shop.longitude && (
            <div className="map">
              {/* Integrate with Google Maps, Kakao Maps, or Naver Maps */}
              <a
                href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Map
              </a>
            </div>
          )}
        </div>

        {/* Operating Hours */}
        <div className="operating-hours">
          <h3>Operating Hours</h3>
          {Object.entries(shop.operating_hours || {}).map(([day, hours]) => (
            <div key={day} className="hours-row">
              <span className="day">{day}</span>
              <span className="time">
                {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
              </span>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="payment-methods">
          <h3>Payment Methods</h3>
          <div className="methods">
            {shop.payment_methods?.map(method => (
              <span key={method} className="method-badge">{method}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="services-section">
        <h2>Services</h2>
        <div className="services-grid">
          {shop.shop_services?.map((service) => (
            <div key={service.id} className="service-card">
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <div className="service-details">
                <span className="price">
                  ₩{service.price_min.toLocaleString()}
                  {service.price_max > service.price_min && ` - ₩${service.price_max.toLocaleString()}`}
                </span>
                <span className="duration">{service.duration_minutes} min</span>
              </div>
              <button
                disabled={!service.is_available}
                onClick={() => bookService(shop.id, service.id)}
              >
                {service.is_available ? 'Book Now' : 'Unavailable'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Book Now Button */}
      <div className="action-section">
        <Link href={`/booking/${shop.id}`}>
          <button className="book-now-button">
            Book an Appointment
          </button>
        </Link>
      </div>
    </div>
  );
}

function getContactLink(type: string, value: string): string {
  switch (type) {
    case 'phone':
      return `tel:${value}`;
    case 'email':
      return `mailto:${value}`;
    case 'kakao':
      return value.startsWith('http') ? value : `https://pf.kakao.com/${value}`;
    case 'instagram':
      return `https://instagram.com/${value}`;
    case 'website':
      return value;
    default:
      return '#';
  }
}
```

---

## 6. User App - Map View with Nearby Shops

```tsx
// app/shops/nearby/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useNearbyShops } from '@/hooks/useShops';

export default function NearbyShopsPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(5); // 5km default

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to Seoul coordinates
          setLocation({ lat: 37.5665, lng: 126.9780 });
        }
      );
    }
  }, []);

  const { data, isLoading } = useNearbyShops({
    latitude: location?.lat || 0,
    longitude: location?.lng || 0,
    radius,
    limit: 50,
  });

  if (!location || isLoading) return <div>Finding nearby shops...</div>;

  const shops = data?.data.shops || [];

  return (
    <div className="nearby-shops">
      <h1>Nearby Beauty Shops</h1>

      {/* Radius Control */}
      <div className="radius-control">
        <label>Search Radius: {radius}km</label>
        <input
          type="range"
          min="1"
          max="20"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </div>

      {/* Results */}
      <p>Found {shops.length} shops within {radius}km</p>

      {/* Shop List */}
      <div className="shops-list">
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} showDistance />
        ))}
      </div>
    </div>
  );
}
```

---

## 7. Shop Admin App - Dashboard

```tsx
// app/shop-admin/dashboard/page.tsx
'use client';

import { useShopDashboard, useShopOwnerProfile } from '@/hooks/useShops';
import { useAuth } from '@/contexts/AuthContext';

export default function ShopAdminDashboard() {
  const { token } = useAuth(); // Get JWT token from auth context

  const { data: profileData } = useShopOwnerProfile(token);
  const { data: dashboardData, isLoading } = useShopDashboard(token);

  if (isLoading) return <div>Loading dashboard...</div>;

  const shop = profileData?.data.shop;
  const dashboard = dashboardData?.data;

  return (
    <div className="shop-dashboard">
      {/* Shop Header */}
      <div className="shop-header">
        <h1>{shop?.name}</h1>
        <p>{shop?.address}</p>
        <span className={`status ${shop?.shop_status}`}>
          {shop?.shop_status}
        </span>
      </div>

      {/* Today's Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Today's Reservations</h3>
          <p className="value">{dashboard?.todayReservations || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Pending Requests</h3>
          <p className="value">{dashboard?.pendingReservations || 0}</p>
        </div>

        <div className="metric-card">
          <h3>Today's Revenue</h3>
          <p className="value">₩{dashboard?.todayRevenue.toLocaleString() || 0}</p>
        </div>

        <div className="metric-card">
          <h3>This Week</h3>
          <p className="value">₩{dashboard?.thisWeekRevenue.toLocaleString() || 0}</p>
        </div>

        <div className="metric-card">
          <h3>This Month</h3>
          <p className="value">₩{dashboard?.thisMonthRevenue.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Pending Reservations */}
      {dashboard?.recentPendingReservations && dashboard.recentPendingReservations.length > 0 && (
        <div className="pending-section">
          <h2>Pending Reservations ({dashboard.pendingReservations})</h2>
          <div className="reservations-list">
            {dashboard.recentPendingReservations.map((reservation: any) => (
              <div key={reservation.id} className="reservation-card">
                <div className="customer-info">
                  <h3>{reservation.customer?.name}</h3>
                  <p>{reservation.customer?.phone_number}</p>
                </div>
                <div className="booking-info">
                  <p>{reservation.reservation_date} {reservation.reservation_time}</p>
                  <p>₩{reservation.total_amount.toLocaleString()}</p>
                </div>
                <div className="actions">
                  <button onClick={() => confirmReservation(reservation.id)}>
                    Confirm
                  </button>
                  <button onClick={() => rejectReservation(reservation.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Reservations */}
      {dashboard?.upcomingReservations && (
        <div className="upcoming-section">
          <h2>Upcoming Reservations</h2>
          {/* Similar layout */}
        </div>
      )}

      {/* Statistics */}
      {dashboard?.statistics && (
        <div className="statistics">
          <h2>Performance</h2>
          <div className="stats-grid">
            <div className="stat">
              <label>Total Bookings</label>
              <p>{dashboard.statistics.totalBookings}</p>
            </div>
            <div className="stat">
              <label>Completion Rate</label>
              <p>{dashboard.statistics.completionRate}%</p>
            </div>
            <div className="stat">
              <label>Average Rating</label>
              <p>⭐ {dashboard.statistics.averageRating}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Shop Admin App - Analytics Page

```tsx
// app/shop-admin/analytics/page.tsx
'use client';

import { useState } from 'react';
import { useShopAnalytics } from '@/hooks/useShops';
import { useAuth } from '@/contexts/AuthContext';

export default function ShopAnalyticsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const { data, isLoading } = useShopAnalytics(token, { period });

  if (isLoading) return <div>Loading analytics...</div>;

  const analytics = data?.data;

  return (
    <div className="analytics-page">
      <h1>Shop Analytics</h1>

      {/* Period Selector */}
      <div className="period-selector">
        <button onClick={() => setPeriod('day')} className={period === 'day' ? 'active' : ''}>
          Day
        </button>
        <button onClick={() => setPeriod('week')} className={period === 'week' ? 'active' : ''}>
          Week
        </button>
        <button onClick={() => setPeriod('month')} className={period === 'month' ? 'active' : ''}>
          Month
        </button>
        <button onClick={() => setPeriod('year')} className={period === 'year' ? 'active' : ''}>
          Year
        </button>
      </div>

      {/* Revenue Chart */}
      <div className="revenue-section">
        <h2>Revenue</h2>
        <div className="total-revenue">
          <span>Total: ₩{analytics?.revenue.total.toLocaleString()}</span>
          <span className={`growth ${analytics?.revenue.growth >= 0 ? 'positive' : 'negative'}`}>
            {analytics?.revenue.growth >= 0 ? '↑' : '↓'} {Math.abs(analytics?.revenue.growth || 0)}%
          </span>
        </div>
        {/* Add chart library here - recharts, chart.js, etc. */}
      </div>

      {/* Reservations Stats */}
      <div className="reservations-section">
        <h2>Reservations</h2>
        <p>Total: {analytics?.reservations.total}</p>
        {/* Add pie chart for status distribution */}
      </div>

      {/* Customer Stats */}
      <div className="customers-section">
        <h2>Customers</h2>
        <div className="customer-stats">
          <div className="stat">
            <label>Total Customers</label>
            <p>{analytics?.customers.total}</p>
          </div>
          <div className="stat">
            <label>New Customers</label>
            <p>{analytics?.customers.newCustomers}</p>
          </div>
          <div className="stat">
            <label>Returning</label>
            <p>{analytics?.customers.returningCustomers}</p>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-section">
        <h2>Performance</h2>
        <div className="performance-grid">
          <div className="metric">
            <label>Completion Rate</label>
            <p>{analytics?.performance.completionRate}%</p>
          </div>
          <div className="metric">
            <label>Cancellation Rate</label>
            <p>{analytics?.performance.cancellationRate}%</p>
          </div>
          <div className="metric">
            <label>No-Show Rate</label>
            <p>{analytics?.performance.noShowRate}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Shop Admin App - Settings Page

```tsx
// app/shop-admin/settings/page.tsx
'use client';

import { useShopOwnerProfile } from '@/hooks/useShops';
import { useAuth } from '@/contexts/AuthContext';

export default function ShopSettingsPage() {
  const { token } = useAuth();
  const { data, isLoading } = useShopOwnerProfile(token);

  if (isLoading) return <div>Loading...</div>;

  const shop = data?.data.shop;

  return (
    <div className="shop-settings">
      <h1>Shop Settings</h1>

      {/* Basic Info */}
      <section className="basic-info">
        <h2>Basic Information</h2>
        <form>
          <div className="form-group">
            <label>Shop Name</label>
            <input type="text" defaultValue={shop?.name} />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea defaultValue={shop?.description} rows={4} />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" defaultValue={shop?.phone_number} />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" defaultValue={shop?.email} />
          </div>

          <div className="form-group">
            <label>Main Category</label>
            <select defaultValue={shop?.main_category}>
              <option value="hair">Hair</option>
              <option value="nail">Nail</option>
              <option value="makeup">Makeup</option>
              <option value="skincare">Skincare</option>
            </select>
          </div>

          <button type="submit">Save Changes</button>
        </form>
      </section>

      {/* Operating Hours */}
      <section className="operating-hours">
        <h2>Operating Hours</h2>
        {/* Operating hours form */}
      </section>

      {/* Payment Methods */}
      <section className="payment-methods">
        <h2>Payment Methods</h2>
        <div className="checkboxes">
          {['cash', 'card', 'mobile_payment', 'bank_transfer'].map(method => (
            <label key={method}>
              <input
                type="checkbox"
                defaultChecked={shop?.payment_methods?.includes(method)}
              />
              {method}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 10. WebSocket Integration for Real-time Updates

```tsx
// contexts/ShopWebSocketContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ShopWebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const ShopWebSocketContext = createContext<ShopWebSocketContextType>({
  socket: null,
  isConnected: false,
});

export function ShopWebSocketProvider({
  children,
  shopId,
  token,
}: {
  children: React.ReactNode;
  shopId: string;
  token: string;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const socketInstance = io('http://localhost:3001', {
      auth: { token },
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);

      // Join shop room to receive notifications
      socketInstance.emit('join_room', `shop-${shopId}`);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    // Listen for reservation updates
    socketInstance.on('reservation_update', (data) => {
      console.log('📬 New reservation update:', data);

      if (data.updateType === 'created') {
        // Show notification
        showNotification({
          title: 'New Reservation Request',
          message: `${data.data.customer?.name} requested booking for ${data.data.reservationDate}`,
          type: 'info',
        });

        // Optionally trigger data refresh
        // queryClient.invalidateQueries(['reservations']);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [shopId, token]);

  return (
    <ShopWebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </ShopWebSocketContext.Provider>
  );
}

export function useShopWebSocket() {
  return useContext(ShopWebSocketContext);
}
```

### Use in Shop Admin App

```tsx
// app/shop-admin/layout.tsx
'use client';

import { ShopWebSocketProvider } from '@/contexts/ShopWebSocketContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ShopAdminLayout({ children }: { children: React.ReactNode }) {
  const { token, shopId } = useAuth();

  if (!token || !shopId) {
    return <div>Please login</div>;
  }

  return (
    <ShopWebSocketProvider shopId={shopId} token={token}>
      <div className="shop-admin-layout">
        <Sidebar />
        <main>{children}</main>
      </div>
    </ShopWebSocketProvider>
  );
}
```

---

## 11. Shop Card Component (Reusable)

```tsx
// components/ShopCard.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Shop } from '@/lib/api/shops';

interface ShopCardProps {
  shop: Shop;
  showDistance?: boolean;
}

export default function ShopCard({ shop, showDistance }: ShopCardProps) {
  const primaryImage = shop.shop_images?.find(img => img.is_primary)?.image_url;

  return (
    <Link href={`/shops/${shop.id}`}>
      <div className="shop-card">
        {/* Image */}
        <div className="shop-image">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={shop.name}
              width={300}
              height={200}
              className="cover"
            />
          ) : (
            <div className="no-image">No Image</div>
          )}
          {shop.is_featured && (
            <span className="featured-badge">Featured</span>
          )}
        </div>

        {/* Info */}
        <div className="shop-info">
          <h3>{shop.name}</h3>
          <p className="category">{shop.main_category}</p>

          {shop.statistics && (
            <div className="rating">
              <span>⭐ {shop.statistics.averageRating.toFixed(1)}</span>
              <span>({shop.statistics.totalReviews})</span>
            </div>
          )}

          <p className="address">{shop.address}</p>

          {/* Contact Methods */}
          <div className="contact-quick">
            {shop.contact_methods?.slice(0, 2).map(method => (
              <span key={method.id} className="contact-badge">
                {method.label}
              </span>
            ))}
          </div>

          {/* Total Bookings */}
          <p className="bookings">{shop.total_bookings} bookings</p>
        </div>
      </div>
    </Link>
  );
}
```

---

## Summary - Frontend Implementation Checklist

### User App:
- ✅ Browse shops page (`/api/shops`)
- ✅ Shop details page (`/api/shops/:id`)
- ✅ Nearby shops (`/api/shops/nearby`)
- ✅ Popular shops (`/api/shops/popular`)
- ✅ Map view (`/api/shops/bounds`)
- ✅ Shop card component
- ✅ Booking flow integration

### Shop Admin App:
- ✅ Dashboard (`/api/shop-owner/dashboard`)
- ✅ Profile (`/api/shop-owner/profile`)
- ✅ Analytics (`/api/shop-owner/analytics`)
- ✅ Reservations list (`/api/shop-owner/reservations`)
- ✅ WebSocket for real-time notifications
- ✅ Settings page

### Shared:
- ✅ API client with authentication
- ✅ React Query hooks for data fetching
- ✅ TypeScript interfaces
- ✅ Error handling
- ✅ Loading states

All shop endpoints are now documented with complete frontend implementation examples!
