# Actual Shops API Specification

## Overview

This document covers ALL shop-related endpoints in the eBeautything backend. Shops have multiple endpoints for different purposes:
- **Admin Management**: `/api/admin/shops/*`
- **Public Access**: `/api/shops/*`
- **Shop Owner Management**: `/api/shop/*`
- **Search**: `/api/shops/search`

---

## Table of Contents

1. [Admin Shop Management](#admin-shop-management)
2. [Public Shop Endpoints](#public-shop-endpoints)
3. [Shop Owner Endpoints](#shop-owner-endpoints)
4. [Database Schema](#database-schema)
5. [Field Naming Convention](#field-naming-convention)

---

## Admin Shop Management

### GET `/api/admin/shops`
**Get all shops with filtering** (Admin only)

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "data": {
    "shops": ShopItem[],
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
}
```

#### ShopItem Structure (Admin List View)
```typescript
{
  "id": string,
  "name": string,
  "description": string,
  "address": string,
  "detailed_address": string,        // ⚠️ snake_case
  "phone_number": string,            // ⚠️ snake_case
  "email": string | null,
  "main_category": "nail" | "hair" | "makeup" | "skincare" | "massage" | "tattoo" | "piercing" | "eyebrow" | "eyelash",  // ⚠️ snake_case
  "sub_categories": string[],        // ⚠️ snake_case
  "shop_type": "partnered" | "non_partnered",  // ⚠️ snake_case
  "shop_status": "active" | "inactive" | "pending_approval" | "suspended" | "deleted",  // ⚠️ snake_case
  "verification_status": "pending" | "verified" | "rejected",  // ⚠️ snake_case
  "commission_rate": number,         // ⚠️ snake_case
  "is_featured": boolean,            // ⚠️ snake_case
  "created_at": string,              // ⚠️ snake_case
  "updated_at": string,              // ⚠️ snake_case
  
  // Nested owner information
  "owner": {
    "id": string,
    "name": string,
    "email": string,
    "phone_number": string          // ⚠️ snake_case
  } | null
}
```

#### Query Parameters
```typescript
{
  page?: number,                    // Default: 1
  limit?: number,                   // Default: 20, Max: 100
  status?: "active" | "inactive" | "pending_approval" | "suspended" | "deleted",
  category?: string,                // main_category filter
  shopType?: "partnered" | "non_partnered",
  verificationStatus?: "pending" | "verified" | "rejected",
  sortBy?: "created_at" | "name" | "main_category" | "shop_status" | "verification_status",
  sortOrder?: "asc" | "desc"       // Default: "desc"
}
```

### GET `/api/admin/shops/:shopId`
**Get detailed shop information** (Admin only)

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "data": ShopDetails
}
```

#### ShopDetails Structure (Full Shop Data)
```typescript
{
  "id": string,
  "owner_id": string | null,              // ⚠️ snake_case
  "name": string,
  "description": string,
  "phone_number": string,                 // ⚠️ snake_case
  "email": string | null,
  "address": string,
  "detailed_address": string,             // ⚠️ snake_case
  "postal_code": string,                  // ⚠️ snake_case
  "latitude": number,
  "longitude": number,
  "location": string,                     // PostGIS POINT data
  "shop_type": "partnered" | "non_partnered",        // ⚠️ snake_case
  "shop_status": string,                  // ⚠️ snake_case
  "verification_status": string,          // ⚠️ snake_case
  "business_license_number": string | null,  // ⚠️ snake_case
  "business_license_image_url": string | null,  // ⚠️ snake_case
  "main_category": string,                // ⚠️ snake_case
  "sub_categories": string[],             // ⚠️ snake_case
  "operating_hours": {                    // ⚠️ snake_case, JSONB object
    "monday": {
      "open": string,
      "close": string,
      "closed": boolean
    },
    // ... same for tuesday-sunday
  },
  "payment_methods": string[],            // ⚠️ snake_case
  "kakao_channel_url": string | null,     // ⚠️ snake_case
  "total_bookings": number,               // ⚠️ snake_case
  "partnership_started_at": string | null,  // ⚠️ snake_case
  "featured_until": string | null,        // ⚠️ snake_case
  "is_featured": boolean,                 // ⚠️ snake_case
  "commission_rate": number,              // ⚠️ snake_case
  "created_at": string,                   // ⚠️ snake_case
  "updated_at": string                    // ⚠️ snake_case
}
```

### POST `/api/admin/shops`
**Create a new shop** (Admin only)

#### Request Body
```json
{
  "name": string (required),
  "description": string (optional),
  "phone_number": string (optional),
  "email": string (optional),
  "address": string (required),
  "detailed_address": string (optional),
  "postal_code": string (optional),
  "latitude": number (optional),
  "longitude": number (optional),
  "main_category": string (required),
  "sub_categories": string[] (optional),
  "operating_hours": object (optional),
  "payment_methods": string[] (optional),
  "kakao_channel_url": string (optional),
  "business_license_number": string (optional),
  "business_license_image_url": string (optional),
  "owner_id": string (optional),
  "shop_status": string (optional),
  "verification_status": string (optional),
  "shop_type": string (optional),
  "commission_rate": number (optional)
}
```

### PUT `/api/admin/shops/:shopId`
**Update shop information** (Admin only)

Same structure as POST, all fields optional.

### DELETE `/api/admin/shops/:shopId`
**Soft delete a shop** (Admin only)

---

## Public Shop Endpoints

### GET `/api/shops`
**Get all shops** (Public access)

Similar to admin endpoint but with limited fields.

### GET `/api/shops/:shopId`
**Get shop details** (Public access)

Returns public shop information.

### GET `/api/shops/search`
**Search for shops**

#### Query Parameters
```typescript
{
  q?: string,                      // Search query
  category?: string,
  latitude?: number,
  longitude?: number,
  radius?: number,                 // km
  min_rating?: number,
  max_price?: number,
  sort_by?: "distance" | "rating" | "popular",
  page?: number,
  limit?: number
}
```

---

## Shop Owner Endpoints

### GET `/api/shop/profile`
**Get own shop profile** (Shop owner only)

### PUT `/api/shop/profile`
**Update own shop profile** (Shop owner only)

### GET `/api/shop/dashboard`
**Get shop dashboard stats** (Shop owner only)

---

## Database Schema

### Complete Fields in `shops` Table

```typescript
{
  id: string (UUID, PK),
  owner_id: string (UUID, FK to users),
  name: string,
  description: text,
  phone_number: string,
  email: string,
  address: string,
  detailed_address: string,
  postal_code: string,
  latitude: numeric,
  longitude: numeric,
  location: geometry (PostGIS POINT),
  shop_type: enum,
  shop_status: enum,
  verification_status: enum,
  business_license_number: string,
  business_license_image_url: string,
  main_category: enum,
  sub_categories: text[],
  operating_hours: jsonb,
  payment_methods: text[],
  kakao_channel_url: string,
  total_bookings: integer (default 0),
  partnership_started_at: timestamp,
  featured_until: timestamp,
  is_featured: boolean (default false),
  commission_rate: numeric (default 10),
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## Field Naming Convention

### ⚠️ IMPORTANT: Backend uses snake_case

Unlike Users and Reservations endpoints, **Shops endpoints return snake_case field names directly** from the database without transformation.

| Database Field | API Response | Needs Transform? |
|---------------|--------------|------------------|
| `owner_id` | `owner_id` | ✅ YES → `ownerId` |
| `phone_number` | `phone_number` | ✅ YES → `phoneNumber` |
| `detailed_address` | `detailed_address` | ✅ YES → `detailedAddress` |
| `postal_code` | `postal_code` | ✅ YES → `postalCode` |
| `shop_type` | `shop_type` | ✅ YES → `shopType` |
| `shop_status` | `shop_status` | ✅ YES → `shopStatus` |
| `verification_status` | `verification_status` | ✅ YES → `verificationStatus` |
| `business_license_number` | `business_license_number` | ✅ YES → `businessLicenseNumber` |
| `business_license_image_url` | `business_license_image_url` | ✅ YES → `businessLicenseImageUrl` |
| `main_category` | `main_category` | ✅ YES → `mainCategory` |
| `sub_categories` | `sub_categories` | ✅ YES → `subCategories` |
| `operating_hours` | `operating_hours` | ✅ YES → `operatingHours` |
| `payment_methods` | `payment_methods` | ✅ YES → `paymentMethods` |
| `kakao_channel_url` | `kakao_channel_url` | ✅ YES → `kakaoChannelUrl` |
| `total_bookings` | `total_bookings` | ✅ YES → `totalBookings` |
| `partnership_started_at` | `partnership_started_at` | ✅ YES → `partnershipStartedAt` |
| `featured_until` | `featured_until` | ✅ YES → `featuredUntil` |
| `is_featured` | `is_featured` | ✅ YES → `isFeatured` |
| `commission_rate` | `commission_rate` | ✅ YES → `commissionRate` |
| `created_at` | `created_at` | ✅ YES → `createdAt` |
| `updated_at` | `updated_at` | ✅ YES → `updatedAt` |

---

## Frontend Transform Function

```typescript
// Snake_case to camelCase transformer for shops
function transformShopItem(item: BackendShopItem): FrontendShopItem {
  return {
    id: item.id,
    ownerId: item.owner_id,
    name: item.name,
    description: item.description,
    phoneNumber: item.phone_number,
    email: item.email,
    address: item.address,
    detailedAddress: item.detailed_address,
    postalCode: item.postal_code,
    latitude: item.latitude,
    longitude: item.longitude,
    location: item.location,
    shopType: item.shop_type,
    shopStatus: item.shop_status,
    verificationStatus: item.verification_status,
    businessLicenseNumber: item.business_license_number,
    businessLicenseImageUrl: item.business_license_image_url,
    mainCategory: item.main_category,
    subCategories: item.sub_categories,
    operatingHours: item.operating_hours,
    paymentMethods: item.payment_methods,
    kakaoChannelUrl: item.kakao_channel_url,
    totalBookings: item.total_bookings,
    partnershipStartedAt: item.partnership_started_at,
    featuredUntil: item.featured_until,
    isFeatured: item.is_featured,
    commissionRate: item.commission_rate,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    
    // Transform nested owner if present
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      email: item.owner.email,
      phoneNumber: item.owner.phone_number
    } : null
  };
}
```

### Usage Example

```typescript
// In shops service
static async getShops(filters?: ShopSearchFilters): Promise<PaginatedShopResponse> {
  const params = new URLSearchParams();
  // ... build params ...

  const response = await apiService.get<ShopResponse>(url);
  const { shops, pagination } = response;  // After auto-unwrap

  // Transform shops to frontend format
  const transformedShops = shops.map(transformShopItem);

  return {
    data: transformedShops,
    pagination
  };
}
```

---

## Example Responses

### Admin GET `/api/admin/shops` Response
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "bcf743a2-161e-461d-bcb0-1d41c91d5fb2",
        "name": "더예쁜머리",
        "description": "일반미용업, 네일미용업 전문샵",
        "address": "서울특별시 종로구 종로33길 12",
        "detailed_address": "2층 2호",
        "phone_number": "+82-2-743-9700",
        "email": null,
        "main_category": "nail",
        "sub_categories": ["hair", "nail"],
        "shop_type": "non_partnered",
        "shop_status": "pending_approval",
        "verification_status": "pending",
        "commission_rate": 10,
        "is_featured": false,
        "created_at": "2025-09-22T17:07:11.198326+00:00",
        "updated_at": "2025-09-22T17:07:11.198326+00:00",
        "owner": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 223,
      "totalPages": 12
    }
  }
}
```

### GET `/api/admin/shops/:shopId` Response (Full Details)
```json
{
  "success": true,
  "data": {
    "id": "bcf743a2-161e-461d-bcb0-1d41c91d5fb2",
    "owner_id": null,
    "name": "더예쁜머리",
    "description": "일반미용업, 네일미용업 전문샵 | 7석 운영 | 네일아트 및 네일케어 전문",
    "phone_number": "+82-2-743-9700",
    "email": null,
    "address": "서울특별시 종로구 종로33길 12, 2층 2호 (효제동)",
    "detailed_address": "서울특별시 종로구 효제동 320-6번지",
    "postal_code": "110480",
    "latitude": 37.5720688,
    "longitude": 127.0015128,
    "location": "0101000020E6100000...",
    "shop_type": "non_partnered",
    "shop_status": "pending_approval",
    "verification_status": "pending",
    "business_license_number": null,
    "business_license_image_url": null,
    "main_category": "nail",
    "sub_categories": ["hair", "nail"],
    "operating_hours": {
      "monday": { "open": "09:00", "close": "21:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "21:00", "closed": false },
      "wednesday": { "open": "09:00", "close": "21:00", "closed": false },
      "thursday": { "open": "09:00", "close": "21:00", "closed": false },
      "friday": { "open": "09:00", "close": "21:00", "closed": false },
      "saturday": { "open": "09:00", "close": "20:00", "closed": false },
      "sunday": { "open": "10:00", "close": "18:00", "closed": false }
    },
    "payment_methods": ["card", "bank_transfer", "kakao_pay"],
    "kakao_channel_url": null,
    "total_bookings": 0,
    "partnership_started_at": "2016-05-11T00:00:00+00:00",
    "featured_until": null,
    "is_featured": false,
    "commission_rate": 10,
    "created_at": "2025-09-22T17:07:11.198326+00:00",
    "updated_at": "2025-09-22T17:07:11.198326+00:00"
  }
}
```

---

## Summary

### Key Points

1. **⚠️ snake_case Response**: Unlike Users and Reservations, shops endpoints return snake_case
2. **Frontend Must Transform**: All shop data needs snake_case → camelCase conversion
3. **Multiple Endpoints**: Different endpoints for admin, public, and shop owners
4. **Rich Filtering**: Extensive filter options for admin management
5. **Nested Owner Data**: Owner information joined when available
6. **JSONB Fields**: `operating_hours` is a complex JSONB object
7. **PostGIS Location**: `location` field contains geographic point data

### Status

- **Works**: ✅ API returns data correctly
- **Needs**: ✅ Frontend transform function for snake_case → camelCase
- **Sample Data**: 223 shops in database

### Frontend Implementation Checklist

1. ✅ Create transform function (`transformShopItem`)
2. ✅ Apply transform to all shop responses
3. ✅ Handle nested `owner` object transformation
4. ✅ Handle JSONB `operating_hours` structure
5. ✅ Update TypeScript interfaces to use camelCase

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
