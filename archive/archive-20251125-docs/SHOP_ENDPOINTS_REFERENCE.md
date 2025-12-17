# Shop Information Endpoints - Complete Reference

## Public Shop Endpoints (For Users/Customers)

### 1. Get All Shops
**GET** `/api/shops`

**Query Parameters:**
- `status` - Filter by shop_status (active, inactive, pending_approval)
- `category` - Filter by main_category (nail, hair, makeup, skincare, massage, tattoo, piercing, eyebrow, eyelash)
- `shopType` - Filter by shop_type (partnered, direct)
- `ownerId` - Filter by owner_id (UUID)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "uuid",
        "owner_id": "uuid",
        "name": "Shop Name",
        "description": "Shop description",
        "phone_number": "+82-10-1234-5678",
        "email": "shop@example.com",
        "address": "서울특별시 강남구",
        "detailed_address": "건물명 층수",
        "postal_code": "12345",
        "latitude": 37.5665,
        "longitude": 126.9780,
        "shop_type": "partnered",
        "shop_status": "active",
        "verification_status": "verified",
        "main_category": "hair",
        "sub_categories": ["nail", "makeup"],
        "operating_hours": {
          "monday": {"open": "10:00", "close": "20:00", "closed": false}
        },
        "payment_methods": ["cash", "card", "mobile_payment"],
        "kakao_channel_url": "https://...",
        "total_bookings": 150,
        "is_featured": true,
        "commission_rate": 15,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "contact_methods": [
          {
            "id": "uuid",
            "contact_type": "phone",
            "contact_value": "+82-10-1234-5678",
            "label": "매장 전화",
            "is_active": true,
            "is_primary": true,
            "display_order": 1
          }
        ]
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 100
    }
  }
}
```

---

### 2. Get Single Shop Details
**GET** `/api/shops/:id`

**Path Parameters:**
- `id` - Shop UUID (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Shop Name",
    "description": "Detailed description",
    "address": "Full address",
    "phone_number": "+82-10-1234-5678",
    "email": "shop@example.com",
    "main_category": "hair",
    "sub_categories": ["nail"],
    "shop_status": "active",
    "operating_hours": {},
    "payment_methods": ["card", "cash"],

    "shop_images": [
      {
        "image_url": "https://...",
        "alt_text": "Shop interior",
        "is_primary": true,
        "display_order": 1
      }
    ],

    "shop_services": [
      {
        "id": "uuid",
        "name": "헤어 컷",
        "description": "기본 컷",
        "category": "hair",
        "price_min": 30000,
        "price_max": 50000,
        "duration_minutes": 60,
        "is_available": true,
        "display_order": 1
      }
    ],

    "statistics": {
      "totalBookings": 150,
      "totalReviews": 45,
      "averageRating": 4.8
    }
  }
}
```

---

### 3. Get Nearby Shops (Location-Based)
**GET** `/api/shops/nearby`

**Query Parameters:**
- `latitude` - User's latitude (required)
- `longitude` - User's longitude (required)
- `radius` - Search radius in km (default: 10)
- `category` - Filter by category
- `shopType` - Filter by type
- `onlyFeatured` - Boolean (default: false)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Example:**
```
GET /api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=5&category=nail&limit=20
```

---

### 4. Get Popular Shops
**GET** `/api/shops/popular`

**Query Parameters:**
- `category` - Filter by category
- `limit` - Max results (default: 20)

**Example:**
```
GET /api/shops/popular?category=hair&limit=10
```

---

### 5. Get Shops Within Map Bounds
**GET** `/api/shops/bounds`

**Query Parameters:**
- `neLat` - Northeast latitude (required)
- `neLng` - Northeast longitude (required)
- `swLat` - Southwest latitude (required)
- `swLng` - Southwest longitude (required)
- `category` - Filter by category

**Example:**
```
GET /api/shops/bounds?neLat=37.6&neLng=127.0&swLat=37.5&swLng=126.9&category=nail
```

---

## Shop Owner Endpoints (Authenticated - For Shop Admins)

### 6. Get Own Shop Details
**GET** `/api/shop-owner/shops/:id`

**Path Parameters:**
- `id` - Shop UUID (must be owned by authenticated user)

**Authentication:** Required (Shop Owner JWT)

**Response:** Full shop details including all fields

---

### 7. Get Shop Operating Hours
**GET** `/api/shop-owner/shops/:id/operating-hours`

**Authentication:** Required (Shop Owner JWT)

**Response:**
```json
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": {"open": "10:00", "close": "20:00", "closed": false},
      "tuesday": {"open": "10:00", "close": "20:00", "closed": false},
      "wednesday": {"open": "10:00", "close": "20:00", "closed": false},
      "thursday": {"open": "10:00", "close": "20:00", "closed": false},
      "friday": {"open": "10:00", "close": "21:00", "closed": false},
      "saturday": {"open": "10:00", "close": "21:00", "closed": false},
      "sunday": {"open": "11:00", "close": "19:00", "closed": false}
    }
  }
}
```

---

### 8. Get Shop Dashboard Data
**GET** `/api/shop-owner/dashboard`

**Authentication:** Required (Shop Owner JWT)

**Response:**
```json
{
  "success": true,
  "data": {
    "todayReservations": 15,
    "pendingReservations": 3,
    "todayRevenue": 450000,
    "thisWeekRevenue": 2500000,
    "thisMonthRevenue": 8900000,
    "recentPendingReservations": [...],
    "upcomingReservations": [...],
    "statistics": {
      "totalBookings": 1250,
      "completionRate": 92.5,
      "averageRating": 4.7
    }
  }
}
```

---

### 9. Get Shop Analytics
**GET** `/api/shop-owner/analytics`

**Authentication:** Required (Shop Owner JWT)

**Query Parameters:**
- `period` - Time period (day, week, month, year)
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 8900000,
      "byPeriod": [...],
      "growth": 15.5
    },
    "reservations": {
      "total": 250,
      "byStatus": {...},
      "byCategory": {...}
    },
    "customers": {
      "total": 180,
      "newCustomers": 25,
      "returningCustomers": 155
    },
    "performance": {
      "completionRate": 92.5,
      "cancellationRate": 5.2,
      "noShowRate": 2.3
    }
  }
}
```

---

### 10. Get Shop Profile
**GET** `/api/shop-owner/profile`

**Authentication:** Required (Shop Owner JWT)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "shopowner@example.com",
    "name": "Shop Owner Name",
    "role": "shop_owner",
    "status": "active",
    "shop": {
      "id": "uuid",
      "name": "Shop Name",
      "status": "active",
      "main_category": "hair",
      "address": "Full address",
      "phone_number": "+82-10-1234-5678",
      "description": "Shop description"
    },
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": "2025-11-12T15:00:00Z"
  }
}
```

---

## Shop Images Endpoints

### 11. Get Shop Images
**GET** `/api/shops/:shopId/images`

**Response:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": "uuid",
        "shop_id": "uuid",
        "image_url": "https://storage.url/image.jpg",
        "alt_text": "Shop interior",
        "is_primary": true,
        "display_order": 1,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

### 12. Upload Shop Image
**POST** `/api/shops/:shopId/images`

**Authentication:** Required (Shop Owner JWT)

**Request:** Multipart form-data with image file

### 13. Set Primary Image
**POST** `/api/shops/:shopId/images/:imageId/set-primary`

**Authentication:** Required (Shop Owner JWT)

### 14. Update Image
**PUT** `/api/shops/:shopId/images/:imageId`

**Authentication:** Required (Shop Owner JWT)

### 15. Delete Image
**DELETE** `/api/shops/:shopId/images/:imageId`

**Authentication:** Required (Shop Owner JWT)

---

## Shop Services Endpoints

### 16. Get Shop Services (via shop details)
Included in **GET** `/api/shops/:id` response

Or use service-specific endpoints to get detailed service information.

---

## Shop Contact Methods

### 17. Get Shop Contact Methods
Included in **GET** `/api/shops` response as `contact_methods` array

Contains:
- Phone numbers
- Kakao channel
- Instagram
- Website
- Email
- Other contact methods

---

## Shop Search & Discovery

### 18. Search Shops
Use `/api/shops/nearby` with location parameters

### 19. Browse by Category
Use `/api/shops?category=hair&status=active`

### 20. Map View (Bounds)
Use `/api/shops/bounds` with map bounds parameters

---

## Shop Statistics & Analytics

### 21. Quick Analytics Dashboard
**GET** `/api/shops/:shopId/analytics/dashboard/quick`

### 22. Revenue Analytics
**GET** `/api/shops/:shopId/analytics/revenue`

---

## Summary - Main Endpoints to Get Shop Information

| Endpoint | Purpose | Auth Required | Returns |
|----------|---------|---------------|---------|
| `GET /api/shops` | Browse all shops | No | List with filters |
| `GET /api/shops/:id` | Shop details | No | Full shop data + images + services + stats |
| `GET /api/shops/nearby` | Location search | No | Shops within radius |
| `GET /api/shops/popular` | Popular shops | No | Top rated/booked shops |
| `GET /api/shops/bounds` | Map view | No | Shops in map bounds |
| `GET /api/shop-owner/profile` | Own shop info | Yes (Shop Owner) | Shop owner + shop data |
| `GET /api/shop-owner/shops/:id` | Own shop details | Yes (Shop Owner) | Full shop details |
| `GET /api/shop-owner/dashboard` | Dashboard stats | Yes (Shop Owner) | Metrics + pending items |
| `GET /api/shop-owner/analytics` | Analytics data | Yes (Shop Owner) | Revenue, bookings, customers |

---

## Frontend Implementation Examples

### User App - Browse Shops
```typescript
// Get all active shops
const response = await fetch('/api/shops?status=active&limit=50');
const { data } = await response.json();
console.log(data.shops); // Array of shops with contact_methods
```

### User App - Shop Details Page
```typescript
// Get single shop with images, services, and statistics
const response = await fetch(`/api/shops/${shopId}`);
const { data } = await response.json();
console.log(data.shop_images);    // Images array
console.log(data.shop_services);  // Services array
console.log(data.statistics);     // Bookings, reviews, rating
```

### Shop Admin App - Get Own Shop
```typescript
// Get own shop profile
const response = await fetch('/api/shop-owner/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
console.log(data.shop); // Own shop information
```

### Shop Admin App - Dashboard
```typescript
// Get dashboard with today's stats
const response = await fetch('/api/shop-owner/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
console.log(data.todayReservations);
console.log(data.todayRevenue);
console.log(data.pendingReservations);
```

---

## Complete Shop Data Structure

All shop endpoints return data from the `shops` table with these columns:

```typescript
interface Shop {
  // Identity
  id: string;
  owner_id: string;

  // Basic Info
  name: string;
  description: string;
  phone_number: string;
  email: string;

  // Location
  address: string;
  detailed_address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  location: string; // PostGIS point

  // Business Info
  shop_type: 'partnered' | 'direct';
  shop_status: 'active' | 'inactive' | 'pending_approval' | 'suspended';
  verification_status: 'pending' | 'verified' | 'rejected';
  business_license_number: string;
  business_license_image_url: string;

  // Categories & Services
  main_category: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  sub_categories: string[];

  // Operations
  operating_hours: {
    [day: string]: {
      open: string;
      close: string;
      closed: boolean;
    }
  };
  payment_methods: string[];

  // Contact & Marketing
  kakao_channel_url: string;

  // Metrics
  total_bookings: number;
  partnership_started_at: string;
  featured_until: string;
  is_featured: boolean;
  commission_rate: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Related Data (when joined)
  shop_images?: ShopImage[];
  shop_services?: ShopService[];
  contact_methods?: ContactMethod[];
  statistics?: {
    totalBookings: number;
    totalReviews: number;
    averageRating: number;
  };
}
```

---

## Notes

- All endpoints return standardized JSON responses with `success` and `data` fields
- Authentication uses JWT Bearer tokens
- Rate limiting is applied to prevent abuse
- Shop owner endpoints require ownership verification
- Public endpoints don't require authentication
- Images and services are included via joins in relevant endpoints
