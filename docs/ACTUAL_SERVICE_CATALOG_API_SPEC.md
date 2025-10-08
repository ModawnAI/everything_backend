# Actual Service Catalog API Specification

## What the Backend Actually Returns

### GET `/api/service-catalog`

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "data": {
    "services": ServiceItem[],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

#### ServiceItem Structure (Actual Backend Fields)

```typescript
{
  "id": string,
  "shop_id": string,
  "name": string,
  "description": string | null,
  "category": "nail" | "eyelash" | "waxing" | "eyebrow_tattoo",
  "price_min": number | null,
  "price_max": number | null,
  "duration_minutes": number,  // NOTE: duration_minutes, NOT duration
  "deposit_amount": number | null,
  "deposit_percentage": number | null,
  "is_available": boolean,
  "booking_advance_days": number,
  "cancellation_hours": number,
  "display_order": number,
  "created_at": string (ISO date),
  "updated_at": string (ISO date),
  "service_images": ServiceImage[]  // Array of objects, NOT strings
}
```

#### ServiceImage Structure
```typescript
{
  "id": string,
  "service_id": string,
  "image_url": string,
  "display_order": number,
  "created_at": string
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "50ff6d4a-e027-44ae-baba-76aef727f0bb",
        "shop_id": "813b63ff-56ef-43b2-9b85-cd4306a53da5",
        "name": "전신 왁싱",
        "description": "팔, 다리, 겨드랑이 포함",
        "category": "waxing",
        "price_min": 97225,
        "price_max": 108028,
        "duration_minutes": 120,
        "deposit_amount": null,
        "deposit_percentage": 20,
        "is_available": true,
        "booking_advance_days": 30,
        "cancellation_hours": 24,
        "display_order": 2,
        "created_at": "2025-10-07T02:23:17.083+00:00",
        "updated_at": "2025-10-07T03:55:19.782+00:00",
        "service_images": []
      }
    ],
    "totalCount": 792,
    "hasMore": true
  }
}
```

## Field Mappings for Frontend

The frontend needs to map these backend fields:

| Backend Field | Frontend Should Use As | Notes |
|--------------|----------------------|-------|
| `duration_minutes` | `duration` | Rename field |
| `service_images` | `images` | Extract `image_url` from array: `service_images.map(img => img.image_url)` |
| N/A | `service_level` | **Not in database** - default to `'basic'` |
| N/A | `difficulty_level` | **Not in database** - default to `'beginner'` |
| N/A | `is_featured` | **Not in database** - default to `false` |
| N/A | `is_trending` | **Not in database** - default to `false` |
| N/A | `rating_average` | **Not in database** - default to `0` |
| N/A | `booking_count` | **Not in database** - default to `0` |
| N/A | `tags` | **Not in database** - default to `[]` |

## Frontend Transform Function

```typescript
// In serviceCatalog.ts
function transformServiceItem(item: BackendServiceItem): FrontendServiceItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    category: item.category,
    price_min: item.price_min || 0,
    price_max: item.price_max || 0,
    duration: item.duration_minutes || 0,  // ← duration_minutes to duration
    service_level: 'basic',  // ← Not in database, use default
    difficulty_level: 'beginner',  // ← Not in database, use default
    is_available: item.is_available,
    is_featured: false,  // ← Not in database, use default
    is_trending: false,  // ← Not in database, use default
    rating_average: 0,  // ← Not in database, use default
    booking_count: 0,  // ← Not in database, use default
    tags: [],  // ← Not in database, use default
    images: item.service_images?.map(img => img.image_url) || [],  // ← Transform array
    created_at: item.created_at,
    updated_at: item.updated_at
  };
}

static async getServices(filters?: ServiceCatalogSearchFilters): Promise<PaginatedServiceResponse> {
  const params = new URLSearchParams();
  // ... build params ...

  const response = await apiService.get<ServiceCatalogResponse['data']>(url);
  const { services, totalCount, hasMore } = response;  // ← Fixed: Direct access, not response.data

  // Transform backend items to frontend format
  const transformedServices = services.map(transformServiceItem);

  return {
    data: transformedServices,
    pagination: {
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      total: totalCount,
      totalPages: Math.ceil(totalCount / (filters?.limit || 20)),
      hasMore,
    },
  };
}
```

## Query Parameters (What Backend Accepts)

```typescript
{
  category?: "nail" | "eyelash" | "waxing" | "eyebrow_tattoo",
  service_level?: "basic" | "premium" | "luxury",  // NOTE: Not actually used (no column)
  difficulty_level?: "beginner" | "intermediate" | "advanced",  // NOTE: Not actually used
  featured_only?: boolean,  // NOTE: Not actually used (no column)
  trending_only?: boolean,  // NOTE: Not actually used (no column)
  include_unavailable?: boolean,
  limit?: number,  // Default: 50
  sort_by?: "price" | "duration" | "newest",
  sort_order?: "asc" | "desc"
}
```

## Additional Endpoints

### GET `/api/service-catalog/stats`
```json
{
  "success": true,
  "data": {
    "total_services": 792,
    "services_by_category": {
      "nail": 331,
      "eyelash": 160,
      "waxing": 160,
      "eyebrow_tattoo": 65
    },
    "services_by_level": {},  // Empty (no service_level column)
    "average_price_by_category": {
      "nail": 43364.03,
      "eyelash": 65200.66,
      "waxing": 58697.76,
      "eyebrow_tattoo": 145066.58
    },
    "most_popular_services": [],  // Empty (no booking data)
    "trending_services": [],  // Empty (no trending column)
    "recently_added": ServiceItem[],
    "total_bookings": 0,
    "average_rating": 0,
    "last_updated": "2025-10-07T04:13:42.802Z"
  }
}
```

### GET `/api/service-catalog/config`
Returns configuration metadata.

### GET `/api/service-catalog/popular?limit=5`
Returns popular services (currently empty - no popularity tracking).

### GET `/api/service-catalog/trending?limit=5`
Returns trending services (currently empty - no trending tracking).

## Summary

**Key Changes Needed in Frontend:**

1. **Fix serviceCatalog.ts line 52**: 
   ```typescript
   // Change from:
   const { services, totalCount, hasMore } = response.data;  // ❌
   
   // To:
   const { services, totalCount, hasMore } = response;  // ✅
   ```

2. **Add transform function** to map backend fields to frontend expectations

3. **Handle missing fields** by providing defaults for fields not in database

4. **Transform image arrays** from objects to strings: 
   ```typescript
   images: service_images?.map(img => img.image_url) || []
   ```
