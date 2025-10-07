# Frontend ↔ Backend API Summary

## Quick Reference: Service Catalog vs Users

### Service Catalog (`/api/service-catalog`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | `duration`, `images`, `service_level`, etc. | `duration_minutes`, `service_images`, (no service_level) | ✅ Frontend transform |
| **Image Format** | `images: string[]` | `service_images: ServiceImage[]` | ✅ Map to image_url |
| **Missing Fields** | `service_level`, `difficulty_level`, `is_featured`, `is_trending`, `rating_average`, `booking_count`, `tags` | Not in database | ✅ Use defaults |
| **Data Access** | `response.data` | `response` (after unwrap) | ✅ Fixed in frontend |

### Users (`/api/admin/users`)

| Aspect | What Frontend Expects | What Backend Returns | Fix Needed |
|--------|----------------------|---------------------|------------|
| **Field Names** | camelCase | camelCase ✅ | ✅ Already matches |
| **Response Structure** | Standard pagination | Extended with `currentPage`, `totalPages`, `filters` | ✅ Already compatible |
| **Computed Fields** | - | `daysSinceLastLogin`, `isActive`, `hasCompletedProfile` | ✅ Bonus fields |
| **Data Access** | `response` | `response` (after unwrap) | ✅ Already works |

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

## Users - Already Working! ✅

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

---

## Response Structures

### Service Catalog (After Auto-Unwrap)
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
    duration_minutes: number,  // ← Need to rename to 'duration'
    is_available: boolean,
    service_images: [{         // ← Need to extract image_url
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

### Users (After Auto-Unwrap)
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
    // ... all in camelCase
  }],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,         // ✅ Bonus field
  totalPages: number,          // ✅ Bonus field
  filters: { ... }             // ✅ Bonus field
}
```

---

## Key Takeaways

### Service Catalog
- **Problem**: Field name mismatches, missing fields
- **Solution**: Transform function to map fields and add defaults
- **Status**: ⚠️ Needs frontend update

### Users
- **Problem**: None
- **Solution**: None needed
- **Status**: ✅ Working correctly

### Common Pattern (Auto-Unwrap)
Both endpoints return:
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

Expected fields: `duration_minutes`, `service_images` (array of objects)

### Test Users
```bash
curl 'http://localhost:3001/api/admin/users?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected fields: `phoneNumber`, `userRole`, `totalPoints` (all camelCase)
