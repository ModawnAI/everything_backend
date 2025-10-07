# Frontend ↔ Backend API Summary

## Quick Reference: All Endpoints Comparison

### Service Catalog (`/api/service-catalog`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | `duration`, `images`, `service_level`, etc. | `duration_minutes`, `service_images`, (no service_level) | ⚠️ Frontend transform required |
| **Image Format** | `images: string[]` | `service_images: ServiceImage[]` | ⚠️ Map to image_url |
| **Missing Fields** | `service_level`, `difficulty_level`, `is_featured`, `is_trending`, `rating_average`, `booking_count`, `tags` | Not in database | ⚠️ Use defaults |
| **Data Access** | `response.data` | `response` (after unwrap) | ⚠️ Fixed in frontend |
| **Status** | - | - | **⚠️ Needs Transform** |

### Users (`/api/admin/users`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | camelCase | camelCase ✅ | ✅ Already matches |
| **Response Structure** | Standard pagination | Extended with `currentPage`, `totalPages`, `filters` | ✅ Already compatible |
| **Computed Fields** | - | `daysSinceLastLogin`, `isActive`, `hasCompletedProfile` | ✅ Bonus fields |
| **Data Access** | `response` | `response` (after unwrap) | ✅ Already works |
| **Status** | - | - | **✅ Works Directly** |

### Reservations (`/api/admin/reservations`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | camelCase | camelCase ✅ | ✅ Already matches |
| **Response Structure** | Standard pagination | Extended with `currentPage`, `totalPages`, `filters` | ✅ Already compatible |
| **Nested Data** | - | `customer`, `shop`, `services`, `payments` objects | ✅ Rich relationships included |
| **Computed Fields** | - | `daysUntilReservation`, `isOverdue`, `isToday`, `isPast`, `totalPaidAmount`, `outstandingAmount` | ✅ Business logic included |
| **Data Access** | `response` | `response` (after unwrap) | ✅ Already works |
| **Status** | - | - | **✅ Works Directly** |

### Shops (`/api/admin/shops`, `/api/shops`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | camelCase | snake_case (e.g., `phone_number`, `main_category`, `shop_status`) | ⚠️ Frontend transform required |
| **Complex Fields** | `operatingHours` object | `operating_hours` JSONB | ⚠️ Convert to camelCase |
| **Location** | `location` object | PostGIS POINT, `location_address`, `location_description` | ⚠️ Transform structure |
| **Nested Data** | - | `owner` object (with snake_case fields) | ⚠️ Transform nested fields |
| **Data Access** | `response` | `response` (after unwrap) | ✅ Already works |
| **Status** | - | - | **⚠️ Needs Transform** |

---

## Service Catalog Fix Checklist

### 1. Fix Data Access (serviceCatalog.ts)
```typescript
// ❌ WRONG
const { services, totalCount, hasMore } = response.data;

// ✅ CORRECT
const { services, totalCount, hasMore } = response;
```

### 2. Add Transform Function
```typescript
function transformServiceItem(item: any) {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    category: item.category,
    price_min: item.price_min || 0,
    price_max: item.price_max || 0,
    duration: item.duration_minutes || 0,  // ← Rename
    service_level: 'basic',                // ← Default
    difficulty_level: 'beginner',          // ← Default
    is_available: item.is_available,
    is_featured: false,                    // ← Default
    is_trending: false,                    // ← Default
    rating_average: 0,                     // ← Default
    booking_count: 0,                      // ← Default
    tags: [],                              // ← Default
    images: item.service_images?.map(img => img.image_url) || [],  // ← Transform
    created_at: item.created_at,
    updated_at: item.updated_at
  };
}
```

### 3. Use Transform in Service
```typescript
const response = await apiService.get('/api/service-catalog');
const { services, totalCount, hasMore } = response;

const transformedServices = services.map(transformServiceItem);

return {
  data: transformedServices,
  pagination: { ... }
};
```

---

## Shops Fix Checklist

### 1. Add Transform Function for Shops
```typescript
function transformShopItem(item: BackendShopItem): FrontendShopItem {
  return {
    id: item.id,
    name: item.name,
    phoneNumber: item.phone_number,              // ← snake_case → camelCase
    detailedAddress: item.detailed_address,      // ← snake_case → camelCase
    mainCategory: item.main_category,            // ← snake_case → camelCase
    subCategories: item.sub_categories,          // ← snake_case → camelCase
    shopType: item.shop_type,                    // ← snake_case → camelCase
    shopStatus: item.shop_status,                // ← snake_case → camelCase
    verificationStatus: item.verification_status, // ← snake_case → camelCase
    businessNumber: item.business_number,        // ← snake_case → camelCase

    // JSONB operating_hours transformation
    operatingHours: item.operating_hours,        // ← Already object, just rename

    // Location fields
    locationAddress: item.location_address,      // ← snake_case → camelCase
    locationDescription: item.location_description,
    location: item.location,                      // PostGIS POINT

    // Nested owner transformation
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      email: item.owner.email,
      phoneNumber: item.owner.phone_number,      // ← Transform nested field
      userRole: item.owner.user_role             // ← Transform nested field
    } : null,

    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}
```

### 2. Use Transform in Service
```typescript
const response = await apiService.get('/api/admin/shops');
const { shops, totalCount, hasMore } = response;

const transformedShops = shops.map(transformShopItem);

return {
  data: transformedShops,
  pagination: { totalCount, hasMore }
};
```

---

## Users & Reservations - Already Working! ✅

### Users Endpoint
The users endpoint is **already correctly implemented**:

```typescript
const response = await apiService.get('/api/admin/users');
const { users, totalCount, currentPage, totalPages, hasMore } = response;

// Use directly - no transform needed
users.forEach(user => {
  console.log(user.phoneNumber);  // ✅ camelCase
  console.log(user.userRole);     // ✅ camelCase
  console.log(user.totalPoints);  // ✅ camelCase
});
```

### Reservations Endpoint
The reservations endpoint is **already correctly implemented**:

```typescript
const response = await apiService.get('/api/admin/reservations');
const { reservations, totalCount, currentPage, totalPages, hasMore } = response;

// Use directly - no transform needed, includes nested relationships
reservations.forEach(reservation => {
  console.log(reservation.reservationDate);      // ✅ camelCase
  console.log(reservation.totalAmount);          // ✅ camelCase
  console.log(reservation.customer.name);        // ✅ Nested customer object
  console.log(reservation.shop.address);         // ✅ Nested shop object
  console.log(reservation.services[0].name);     // ✅ Array of service objects
  console.log(reservation.payments[0].amount);   // ✅ Array of payment objects
  console.log(reservation.daysUntilReservation); // ✅ Computed field
  console.log(reservation.totalPaidAmount);      // ✅ Computed field
});
```

---

## Response Structures (After Auto-Unwrap)

### Service Catalog
```typescript
{
  services: [{
    id: string,
    shop_id: string,
    name: string,
    description: string,
    category: string,
    price_min: number,
    price_max: number,
    duration_minutes: number,  // ⚠️ Need to rename to 'duration'
    is_available: boolean,
    service_images: [{         // ⚠️ Need to extract image_url
      id: string,
      image_url: string
    }],
    created_at: string,
    updated_at: string
  }],
  totalCount: number,
  hasMore: boolean
}
```

### Users
```typescript
{
  users: [{
    id: string,
    email: string,
    phoneNumber: string,       // ✅ Already camelCase
    phoneVerified: boolean,
    name: string,
    nickname: string,
    userRole: string,          // ✅ Already camelCase
    userStatus: string,
    isInfluencer: boolean,
    totalPoints: number,       // ✅ Already camelCase
    availablePoints: number,
    daysSinceLastLogin: number,// ✅ Computed field
    isActive: boolean,         // ✅ Computed field
    hasCompletedProfile: boolean, // ✅ Computed field
    // ... all in camelCase
  }],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,         // ✅ Extended pagination
  totalPages: number,          // ✅ Extended pagination
  filters: { ... }             // ✅ Query parameters echoed
}
```

### Reservations
```typescript
{
  reservations: [{
    id: string,
    reservationDate: string,   // ✅ camelCase
    reservationTime: string,   // ✅ camelCase
    reservationDatetime: string,
    status: string,
    totalAmount: number,       // ✅ camelCase
    depositAmount: number,
    remainingAmount: number,
    pointsUsed: number,
    pointsEarned: number,

    customer: {                // ✅ Nested relationship
      id: string,
      name: string,
      email: string,
      phoneNumber: string
    },

    shop: {                    // ✅ Nested relationship
      id: string,
      name: string,
      address: string,
      mainCategory: string
    },

    services: [{               // ✅ Array of services
      id: string,
      name: string,
      category: string,
      quantity: number,
      unitPrice: number,
      totalPrice: number
    }],

    payments: [{               // ✅ Array of payments
      id: string,
      paymentStatus: string,
      amount: number,
      isDeposit: boolean
    }],

    daysUntilReservation: number, // ✅ Computed field
    isOverdue: boolean,        // ✅ Computed field
    isToday: boolean,          // ✅ Computed field
    isPast: boolean,           // ✅ Computed field
    totalPaidAmount: number,   // ✅ Computed field
    outstandingAmount: number, // ✅ Computed field

    createdAt: string,
    updatedAt: string
  }],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,         // ✅ Extended pagination
  totalPages: number,          // ✅ Extended pagination
  filters: { ... }             // ✅ Query parameters echoed
}
```

### Shops (Admin)
```typescript
{
  shops: [{
    id: string,
    name: string,
    phone_number: string,      // ⚠️ snake_case
    detailed_address: string,  // ⚠️ snake_case
    main_category: string,     // ⚠️ snake_case
    sub_categories: string[],  // ⚠️ snake_case
    shop_type: string,         // ⚠️ snake_case
    shop_status: string,       // ⚠️ snake_case
    verification_status: string, // ⚠️ snake_case
    business_number: string,   // ⚠️ snake_case

    operating_hours: {         // ⚠️ snake_case (JSONB)
      monday: {
        open: string,
        close: string,
        closed: boolean
      },
      // ... other days
    },

    location: string,          // PostGIS POINT
    location_address: string,  // ⚠️ snake_case
    location_description: string,

    owner: {                   // Nested relationship
      id: string,
      name: string,
      email: string,
      phone_number: string,    // ⚠️ snake_case
      user_role: string        // ⚠️ snake_case
    },

    created_at: string,        // ⚠️ snake_case
    updated_at: string         // ⚠️ snake_case
  }],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,
  totalPages: number,
  filters: { ... }
}
```

---

## Key Takeaways

### Service Catalog
- **Problem**: Field name mismatches (`duration_minutes` vs `duration`), missing fields
- **Solution**: Transform function to map fields and add defaults
- **Status**: ⚠️ **Needs Frontend Transform**
- **Data**: 792 services available

### Users
- **Problem**: None
- **Solution**: None needed - already camelCase
- **Status**: ✅ **Works Directly**
- **Bonus**: Computed fields (`daysSinceLastLogin`, `isActive`, `hasCompletedProfile`)
- **Data**: 22 users seeded

### Reservations
- **Problem**: None
- **Solution**: None needed - already camelCase with rich nested data
- **Status**: ✅ **Works Directly**
- **Bonus**: Nested relationships (`customer`, `shop`, `services`, `payments`) + computed fields
- **Data**: 315 reservations seeded

### Shops
- **Problem**: All fields in snake_case (`phone_number`, `main_category`, etc.)
- **Solution**: Transform function for snake_case → camelCase conversion
- **Status**: ⚠️ **Needs Frontend Transform**
- **Complex**: JSONB `operating_hours`, PostGIS `location`, nested `owner` object
- **Data**: 223 shops seeded

### Common Pattern (Auto-Unwrap)
All endpoints return:
```json
{
  "success": true,
  "data": { ... }
}
```

Frontend interceptor unwraps to just `{ ... }`, so:
```typescript
const response = await apiService.get('/api/...');
// response = data content (unwrapped)
```

---

## Testing

### Test Service Catalog
```bash
curl 'http://localhost:3001/api/service-catalog?limit=2'
```

Expected fields: `duration_minutes`, `service_images` (array of objects) ⚠️ snake_case

### Test Users
```bash
curl 'http://localhost:3001/api/admin/users?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected fields: `phoneNumber`, `userRole`, `totalPoints` ✅ camelCase

### Test Reservations
```bash
curl 'http://localhost:3001/api/admin/reservations?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected fields: `reservationDate`, `totalAmount`, nested `customer`, `shop`, `services`, `payments` ✅ camelCase

### Test Shops
```bash
curl 'http://localhost:3001/api/admin/shops?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected fields: `phone_number`, `main_category`, `shop_status`, `operating_hours` ⚠️ snake_case
