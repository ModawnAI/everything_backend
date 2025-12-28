# Shop Admin - Shop Information Implementation Guide

Complete guide for implementing shop information viewing and editing in the shop admin frontend.

---

## Architecture

```
Shop Admin App
├── Dashboard (Overview)
├── Shop Profile (View & Edit)
├── Operating Hours Management
├── Images Gallery
├── Services Management
└── Settings
```

---

## 1. API Client for Shop Admin (`lib/api/shop-admin.ts`)

```typescript
import { apiClient } from './client';

export interface ShopProfile {
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
  verification_status: string;
  business_license_number: string;
  main_category: string;
  sub_categories: string[];
  operating_hours: Record<string, OperatingHours>;
  payment_methods: string[];
  kakao_channel_url?: string;
  total_bookings: number;
  is_featured: boolean;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface OperatingHours {
  open: string;
  close: string;
  closed: boolean;
}

// Get shop owner profile (includes shop info)
export async function getShopOwnerProfile(token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      id: string;
      email: string;
      name: string;
      role: string;
      shop: ShopProfile;
      created_at: string;
      last_login_at: string;
    };
  }>('/api/shop-owner/profile', token);
}

// Get specific shop details (if owner has multiple shops)
export async function getOwnShopDetails(shopId: string, token: string) {
  return apiClient.get<{
    success: boolean;
    data: ShopProfile;
  }>(`/api/shop-owner/shops/${shopId}`, token);
}

// Get shop operating hours
export async function getShopOperatingHours(shopId: string, token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      operating_hours: Record<string, OperatingHours>;
    };
  }>(`/api/shop-owner/shops/${shopId}/operating-hours`, token);
}

// Update shop information
export async function updateShopInfo(
  shopId: string,
  updates: Partial<ShopProfile>,
  token: string
) {
  return apiClient.put<{
    success: boolean;
    data: ShopProfile;
  }>(`/api/shops/${shopId}`, updates, token);
}
```

---

## 2. React Hooks (`hooks/useShopAdmin.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as shopAdminApi from '@/lib/api/shop-admin';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Get shop owner profile (includes shop info)
 */
export function useShopOwnerProfile() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['shopOwner', 'profile'],
    queryFn: () => shopAdminApi.getShopOwnerProfile(token),
    enabled: !!token,
  });
}

/**
 * Get own shop details
 */
export function useOwnShop(shopId: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['shopOwner', 'shop', shopId],
    queryFn: () => shopAdminApi.getOwnShopDetails(shopId, token),
    enabled: !!token && !!shopId,
  });
}

/**
 * Get shop operating hours
 */
export function useShopOperatingHours(shopId: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['shopOwner', 'operatingHours', shopId],
    queryFn: () => shopAdminApi.getShopOperatingHours(shopId, token),
    enabled: !!token && !!shopId,
  });
}

/**
 * Update shop information
 */
export function useUpdateShop(shopId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<ShopProfile>) =>
      shopAdminApi.updateShopInfo(shopId, updates, token),
    onSuccess: () => {
      // Invalidate and refetch shop data
      queryClient.invalidateQueries({ queryKey: ['shopOwner', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['shopOwner', 'shop', shopId] });
    },
  });
}
```

---

## 3. Shop Profile Page (`app/shop-admin/profile/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useShopOwnerProfile } from '@/hooks/useShopAdmin';
import Image from 'next/image';

export default function ShopProfilePage() {
  const { data, isLoading, error } = useShopOwnerProfile();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return <div className="loading">Loading shop profile...</div>;
  }

  if (error || !data?.data) {
    return <div className="error">Failed to load shop profile</div>;
  }

  const { shop } = data.data;

  return (
    <div className="shop-profile-page">
      <div className="page-header">
        <h1>Shop Profile</h1>
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {isEditing ? (
        <ShopProfileEditForm shop={shop} onCancel={() => setIsEditing(false)} />
      ) : (
        <ShopProfileView shop={shop} />
      )}
    </div>
  );
}

// ========================================
// View Mode Component
// ========================================

function ShopProfileView({ shop }: { shop: ShopProfile }) {
  return (
    <div className="profile-view">
      {/* Status Banner */}
      <div className="status-banner">
        <div className="status-item">
          <label>Shop Status</label>
          <span className={`badge ${shop.shop_status}`}>
            {shop.shop_status}
          </span>
        </div>
        <div className="status-item">
          <label>Verification</label>
          <span className={`badge ${shop.verification_status}`}>
            {shop.verification_status}
          </span>
        </div>
        {shop.is_featured && (
          <div className="status-item">
            <span className="badge featured">⭐ Featured</span>
          </div>
        )}
      </div>

      {/* Basic Information */}
      <section className="info-section">
        <h2>Basic Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Shop Name</label>
            <p>{shop.name}</p>
          </div>

          <div className="info-item">
            <label>Description</label>
            <p>{shop.description}</p>
          </div>

          <div className="info-item">
            <label>Shop Type</label>
            <p>{shop.shop_type}</p>
          </div>

          <div className="info-item">
            <label>Main Category</label>
            <p className="category-badge">{shop.main_category}</p>
          </div>

          {shop.sub_categories && shop.sub_categories.length > 0 && (
            <div className="info-item">
              <label>Sub Categories</label>
              <div className="categories">
                {shop.sub_categories.map(cat => (
                  <span key={cat} className="category-badge secondary">{cat}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Contact Information */}
      <section className="info-section">
        <h2>Contact Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Phone Number</label>
            <p>
              <a href={`tel:${shop.phone_number}`}>{shop.phone_number}</a>
            </p>
          </div>

          <div className="info-item">
            <label>Email</label>
            <p>
              <a href={`mailto:${shop.email}`}>{shop.email}</a>
            </p>
          </div>

          {shop.kakao_channel_url && (
            <div className="info-item">
              <label>Kakao Channel</label>
              <p>
                <a href={shop.kakao_channel_url} target="_blank" rel="noopener noreferrer">
                  {shop.kakao_channel_url}
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Location Information */}
      <section className="info-section">
        <h2>Location</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Address</label>
            <p>{shop.address}</p>
          </div>

          {shop.detailed_address && (
            <div className="info-item">
              <label>Detailed Address</label>
              <p>{shop.detailed_address}</p>
            </div>
          )}

          {shop.postal_code && (
            <div className="info-item">
              <label>Postal Code</label>
              <p>{shop.postal_code}</p>
            </div>
          )}

          <div className="info-item">
            <label>Coordinates</label>
            <p>
              Lat: {shop.latitude}, Lng: {shop.longitude}
            </p>
          </div>
        </div>

        {/* Map Preview */}
        {shop.latitude && shop.longitude && (
          <div className="map-preview">
            <a
              href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="map-link"
            >
              📍 View on Map
            </a>
          </div>
        )}
      </section>

      {/* Operating Hours */}
      <section className="info-section">
        <h2>Operating Hours</h2>
        <div className="operating-hours">
          {Object.entries(shop.operating_hours || {}).map(([day, hours]) => (
            <div key={day} className="hours-row">
              <span className="day">{capitalize(day)}</span>
              <span className="time">
                {hours.closed ? (
                  <span className="closed">Closed</span>
                ) : (
                  <span>{hours.open} - {hours.close}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Methods */}
      <section className="info-section">
        <h2>Payment Methods</h2>
        <div className="payment-methods">
          {shop.payment_methods?.map(method => (
            <span key={method} className="payment-badge">
              {getPaymentMethodLabel(method)}
            </span>
          ))}
        </div>
      </section>

      {/* Business Information */}
      <section className="info-section">
        <h2>Business Information</h2>
        <div className="info-grid">
          {shop.business_license_number && (
            <div className="info-item">
              <label>Business License Number</label>
              <p>{shop.business_license_number}</p>
            </div>
          )}

          <div className="info-item">
            <label>Commission Rate</label>
            <p>{shop.commission_rate}%</p>
          </div>

          <div className="info-item">
            <label>Total Bookings</label>
            <p>{shop.total_bookings}</p>
          </div>

          {shop.partnership_started_at && (
            <div className="info-item">
              <label>Partnership Started</label>
              <p>{new Date(shop.partnership_started_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ========================================
// Edit Mode Component
// ========================================

function ShopProfileEditForm({
  shop,
  onCancel
}: {
  shop: ShopProfile;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const updateShop = useUpdateShop(shop.id);

  const [formData, setFormData] = useState({
    name: shop.name,
    description: shop.description,
    phone_number: shop.phone_number,
    email: shop.email,
    address: shop.address,
    detailed_address: shop.detailed_address || '',
    postal_code: shop.postal_code || '',
    main_category: shop.main_category,
    sub_categories: shop.sub_categories || [],
    payment_methods: shop.payment_methods || [],
    kakao_channel_url: shop.kakao_channel_url || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateShop.mutateAsync(formData);
      onCancel(); // Exit edit mode
      alert('Shop information updated successfully!');
    } catch (error) {
      alert('Failed to update shop information');
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-edit-form">
      {/* Basic Information */}
      <section className="form-section">
        <h2>Basic Information</h2>

        <div className="form-group">
          <label>Shop Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            maxLength={255}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            maxLength={1000}
          />
          <small>{formData.description.length}/1000 characters</small>
        </div>

        <div className="form-group">
          <label>Main Category *</label>
          <select
            value={formData.main_category}
            onChange={(e) => setFormData({ ...formData, main_category: e.target.value })}
            required
          >
            <option value="hair">Hair</option>
            <option value="nail">Nail</option>
            <option value="makeup">Makeup</option>
            <option value="skincare">Skincare</option>
            <option value="massage">Massage</option>
            <option value="tattoo">Tattoo</option>
            <option value="piercing">Piercing</option>
            <option value="eyebrow">Eyebrow</option>
            <option value="eyelash">Eyelash</option>
          </select>
        </div>

        <div className="form-group">
          <label>Sub Categories (Optional)</label>
          <div className="checkbox-group">
            {['hair', 'nail', 'makeup', 'skincare', 'massage', 'eyelash', 'eyebrow'].map(cat => (
              <label key={cat}>
                <input
                  type="checkbox"
                  checked={formData.sub_categories.includes(cat)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        sub_categories: [...formData.sub_categories, cat]
                      });
                    } else {
                      setFormData({
                        ...formData,
                        sub_categories: formData.sub_categories.filter(c => c !== cat)
                      });
                    }
                  }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="form-section">
        <h2>Contact Information</h2>

        <div className="form-group">
          <label>Phone Number *</label>
          <input
            type="tel"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            required
            placeholder="+82-10-1234-5678"
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="shop@example.com"
          />
        </div>

        <div className="form-group">
          <label>Kakao Channel URL</label>
          <input
            type="url"
            value={formData.kakao_channel_url}
            onChange={(e) => setFormData({ ...formData, kakao_channel_url: e.target.value })}
            placeholder="https://pf.kakao.com/..."
          />
        </div>
      </section>

      {/* Location Information */}
      <section className="form-section">
        <h2>Location</h2>

        <div className="form-group">
          <label>Address *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
            placeholder="서울특별시 강남구..."
          />
        </div>

        <div className="form-group">
          <label>Detailed Address</label>
          <input
            type="text"
            value={formData.detailed_address}
            onChange={(e) => setFormData({ ...formData, detailed_address: e.target.value })}
            placeholder="건물명, 층수, 호수"
            maxLength={500}
          />
        </div>

        <div className="form-group">
          <label>Postal Code</label>
          <input
            type="text"
            value={formData.postal_code}
            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            placeholder="12345"
          />
        </div>
      </section>

      {/* Payment Methods */}
      <section className="form-section">
        <h2>Payment Methods</h2>
        <div className="checkbox-group">
          {['cash', 'card', 'mobile_payment', 'bank_transfer'].map(method => (
            <label key={method}>
              <input
                type="checkbox"
                checked={formData.payment_methods.includes(method)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      payment_methods: [...formData.payment_methods, method]
                    });
                  } else {
                    setFormData({
                      ...formData,
                      payment_methods: formData.payment_methods.filter(m => m !== method)
                    });
                  }
                }}
              />
              {getPaymentMethodLabel(method)}
            </label>
          ))}
        </div>
      </section>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </div>
    </form>
  );
}

// Helper functions
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'cash': 'Cash',
    'card': 'Card',
    'mobile_payment': 'Mobile Payment',
    'bank_transfer': 'Bank Transfer',
  };
  return labels[method] || method;
}
```

---

## 4. Operating Hours Management (`app/shop-admin/operating-hours/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useShopOwnerProfile, useShopOperatingHours } from '@/hooks/useShopAdmin';

export default function OperatingHoursPage() {
  const { data: profileData } = useShopOwnerProfile();
  const shopId = profileData?.data.shop.id;

  const { data, isLoading } = useShopOperatingHours(shopId!);
  const [hours, setHours] = useState(data?.data.operating_hours || {});

  if (isLoading) return <div>Loading...</div>;

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="operating-hours-page">
      <h1>Operating Hours</h1>

      <div className="hours-editor">
        {daysOfWeek.map(day => (
          <div key={day} className="hours-row">
            <div className="day-label">
              <label>{capitalize(day)}</label>
              <input
                type="checkbox"
                checked={!hours[day]?.closed}
                onChange={(e) => {
                  setHours({
                    ...hours,
                    [day]: {
                      ...hours[day],
                      closed: !e.target.checked
                    }
                  });
                }}
              />
              <span>Open</span>
            </div>

            <div className="time-inputs">
              <input
                type="time"
                value={hours[day]?.open || '10:00'}
                onChange={(e) => {
                  setHours({
                    ...hours,
                    [day]: { ...hours[day], open: e.target.value }
                  });
                }}
                disabled={hours[day]?.closed}
              />
              <span>to</span>
              <input
                type="time"
                value={hours[day]?.close || '20:00'}
                onChange={(e) => {
                  setHours({
                    ...hours,
                    [day]: { ...hours[day], close: e.target.value }
                  });
                }}
                disabled={hours[day]?.closed}
              />
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => saveOperatingHours(shopId!, hours)} className="btn-primary">
        Save Operating Hours
      </button>
    </div>
  );
}

async function saveOperatingHours(shopId: string, hours: any) {
  // Call update endpoint
  const { token } = useAuth();
  await updateShopInfo(shopId, { operating_hours: hours }, token);
}
```

---

## 5. Shop Info Card Component (for Dashboard)

```tsx
// components/ShopInfoCard.tsx
'use client';

import { useShopOwnerProfile } from '@/hooks/useShopAdmin';
import Link from 'next/link';

export default function ShopInfoCard() {
  const { data, isLoading } = useShopOwnerProfile();

  if (isLoading) return <div>Loading...</div>;

  const shop = data?.data.shop;
  if (!shop) return null;

  return (
    <div className="shop-info-card">
      <div className="card-header">
        <h2>{shop.name}</h2>
        <Link href="/shop-admin/profile">
          <button className="edit-btn">Edit</button>
        </Link>
      </div>

      <div className="card-body">
        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat">
            <label>Status</label>
            <span className={`badge ${shop.shop_status}`}>
              {shop.shop_status}
            </span>
          </div>

          <div className="stat">
            <label>Category</label>
            <span>{shop.main_category}</span>
          </div>

          <div className="stat">
            <label>Total Bookings</label>
            <span>{shop.total_bookings}</span>
          </div>
        </div>

        {/* Quick Info */}
        <div className="quick-info">
          <p className="address">📍 {shop.address}</p>
          <p className="phone">📞 {shop.phone_number}</p>
          <p className="email">✉️ {shop.email}</p>
        </div>

        {/* Today's Hours */}
        <div className="todays-hours">
          <label>Today's Hours</label>
          <p>{getTodaysHours(shop.operating_hours)}</p>
        </div>
      </div>
    </div>
  );
}

function getTodaysHours(operatingHours: Record<string, OperatingHours>): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const hours = operatingHours[today];

  if (!hours) return 'Not set';
  if (hours.closed) return 'Closed';
  return `${hours.open} - ${hours.close}`;
}
```

---

## 6. Dashboard Integration

```tsx
// app/shop-admin/dashboard/page.tsx
'use client';

import { useShopOwnerProfile, useShopDashboard } from '@/hooks/useShopAdmin';
import ShopInfoCard from '@/components/ShopInfoCard';

export default function ShopAdminDashboard() {
  const { data: profileData } = useShopOwnerProfile();
  const { data: dashboardData, isLoading } = useShopDashboard();

  if (isLoading) return <div>Loading...</div>;

  const ownerProfile = profileData?.data;
  const dashboard = dashboardData?.data;

  return (
    <div className="shop-admin-dashboard">
      {/* Welcome Header */}
      <div className="welcome-header">
        <h1>Welcome back, {ownerProfile?.name}!</h1>
        <p>Last login: {new Date(ownerProfile?.last_login_at || '').toLocaleString()}</p>
      </div>

      {/* Shop Info Card */}
      <ShopInfoCard />

      {/* Dashboard Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Today's Reservations</h3>
          <p className="value">{dashboard?.todayReservations || 0}</p>
        </div>

        <div className="metric-card highlight">
          <h3>Pending Requests</h3>
          <p className="value">{dashboard?.pendingReservations || 0}</p>
          {dashboard?.pendingReservations > 0 && (
            <Link href="/shop-admin/reservations?status=requested">
              <button className="action-btn">Review Now</button>
            </Link>
          )}
        </div>

        <div className="metric-card">
          <h3>Today's Revenue</h3>
          <p className="value">₩{dashboard?.todayRevenue.toLocaleString() || 0}</p>
        </div>

        <div className="metric-card">
          <h3>This Month</h3>
          <p className="value">₩{dashboard?.thisMonthRevenue.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link href="/shop-admin/reservations">
            <button className="action-card">
              📅 View All Reservations
            </button>
          </Link>

          <Link href="/shop-admin/profile">
            <button className="action-card">
              🏪 Edit Shop Profile
            </button>
          </Link>

          <Link href="/shop-admin/services">
            <button className="action-card">
              ✂️ Manage Services
            </button>
          </Link>

          <Link href="/shop-admin/analytics">
            <button className="action-card">
              📊 View Analytics
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Complete Data Flow

### When Shop Admin Logs In:

```typescript
// 1. Login
const loginResponse = await fetch('/api/shop-owner/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'shopowner@test.com',
    password: 'Test1234!'
  })
});

const { data } = await loginResponse.json();

// Response includes:
{
  token: "jwt-token",
  refreshToken: "refresh-token",
  shopOwner: {
    id: "owner-uuid",
    email: "shopowner@test.com",
    name: "Shop Owner Name",
    role: "shop_owner",
    shop: {
      id: "shop-uuid",              // ✅ Shop ID immediately available
      name: "엘레강스 헤어살롱",
      status: "active",
      mainCategory: "hair",
      address: "서울 서초구...",
      phoneNumber: "+82-10-..."
    }
  }
}

// 2. Store in context/state
setAuth({
  token: data.token,
  refreshToken: data.refreshToken,
  user: data.shopOwner,
  shopId: data.shopOwner.shop.id,  // ✅ Store shop ID
  shopName: data.shopOwner.shop.name
});

// 3. Fetch full shop details (if needed)
const shopDetails = await getOwnShopDetails(data.shopOwner.shop.id, data.token);

// 4. Load dashboard
const dashboard = await getShopDashboard(data.token);
```

---

## 8. Mobile App (React Native) Implementation

```tsx
// screens/ShopProfile.tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useShopOwnerProfile } from '@/hooks/useShopAdmin';

export default function ShopProfileScreen() {
  const { data, isLoading } = useShopOwnerProfile();

  if (isLoading) return <Text>Loading...</Text>;

  const shop = data?.data.shop;

  return (
    <ScrollView style={styles.container}>
      {/* Shop Name Header */}
      <View style={styles.header}>
        <Text style={styles.shopName}>{shop.name}</Text>
        <View style={styles.statusBadge}>
          <Text>{shop.shop_status}</Text>
        </View>
      </View>

      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${shop.phone_number}`)}>
          <Text style={styles.contactItem}>📞 {shop.phone_number}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${shop.email}`)}>
          <Text style={styles.contactItem}>✉️ {shop.email}</Text>
        </TouchableOpacity>
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text>{shop.address}</Text>
        <Text>{shop.detailed_address}</Text>
        <TouchableOpacity
          onPress={() => {
            const url = `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`;
            Linking.openURL(url);
          }}
        >
          <Text style={styles.mapLink}>View on Map</Text>
        </TouchableOpacity>
      </View>

      {/* Operating Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operating Hours</Text>
        {Object.entries(shop.operating_hours || {}).map(([day, hours]) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={styles.dayLabel}>{capitalize(day)}</Text>
            <Text style={styles.hoursText}>
              {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
            </Text>
          </View>
        ))}
      </View>

      {/* Edit Button */}
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EditShopProfile', { shop })}
      >
        <Text style={styles.editButtonText}>Edit Shop Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

## Summary - Shop Admin Implementation Flow

### 1. **Initial Load** (On Login)
```typescript
// Login returns basic shop info
POST /api/shop-owner/auth/login
→ Returns: shop { id, name, status, category, address }
```

### 2. **Dashboard Load**
```typescript
// Get dashboard metrics
GET /api/shop-owner/dashboard
→ Returns: today's stats, pending reservations, revenue

// Get full profile (includes complete shop data)
GET /api/shop-owner/profile
→ Returns: owner info + complete shop data
```

### 3. **View/Edit Shop Profile**
```typescript
// View current shop data
GET /api/shop-owner/profile
→ Returns: all shop fields

// Update shop data
PUT /api/shops/:shopId
→ Body: { name, description, phone_number, ... }
```

### 4. **Real-time Updates**
```typescript
// Connect to WebSocket
socket.emit('join_room', `shop-${shopId}`)

// Listen for new reservations
socket.on('reservation_update', (data) => {
  // Show notification + update UI
})
```

The shop admin has complete access to view and manage all shop information through these endpoints! 🏪