# Shop Search API - Frontend Integration Fix

## Problem Summary

The frontend is experiencing errors when calling the `/api/shops` endpoint:

```
GET http://localhost:3003/api/shops?query=sa&limit=10 500 (Internal Server Error)
TypeError: shopResponse.data.map is not a function
TypeError: searchResults.data.forEach is not a function
```

## Root Cause

**Response Structure Mismatch:**

The backend returns:
```json
{
  "success": true,
  "data": {
    "shops": [...],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 5
    }
  }
}
```

The frontend expects:
```json
{
  "success": true,
  "data": [...]  // Array directly
}
```

## Backend Fixes Applied

### 1. ✅ Added Text Search Support

The `/api/shops` endpoint now supports the `query` parameter for full-text search across:
- Shop name
- Shop description
- Shop address

**Example:**
```bash
GET /api/shops?query=beauty&limit=10
```

### 2. ✅ Added Sorting Support

New query parameters:
- `sort_by`: Field to sort by (default: `created_at`)
  - `relevance` → sorts by `created_at`
  - Any other shop field (e.g., `name`, `rating`)
- `sort_order`: `asc` or `desc` (default: `desc`)

**Example:**
```bash
GET /api/shops?query=salon&sort_by=name&sort_order=asc
```

### 3. ✅ Added Page-based Pagination

The endpoint now supports both:
- **Offset-based**: `offset` and `limit`
- **Page-based**: `page` and `limit`

**Example:**
```bash
# Page-based (recommended for frontend)
GET /api/shops?page=1&limit=20

# Offset-based (still supported)
GET /api/shops?offset=0&limit=20
```

## Frontend Fix Required

### Location
File: `src/lib/api/client.ts` or similar API client file

### Current Code (BROKEN)
```typescript
// ❌ This fails because data is an object, not an array
const shopResponse = await api.get('/api/shops', { query: 'salon' });
shopResponse.data.map(shop => ...);  // ERROR: data.map is not a function
```

### Fixed Code (CORRECT)
```typescript
// ✅ Access the shops array from data.shops
const shopResponse = await api.get('/api/shops', { query: 'salon' });
const shops = shopResponse.data.shops;  // Extract shops array
const pagination = shopResponse.data.pagination;  // Extract pagination info

shops.map(shop => ...);  // Works correctly
```

## Complete API Reference

### Endpoint
`GET /api/shops`

### Query Parameters

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `query` | string | Search text (name, description, address) | - | `?query=beauty` |
| `status` | string | Filter by shop status | - | `?status=active` |
| `category` | string | Filter by main category | - | `?category=nail` |
| `shopType` | string | Filter by shop type | - | `?shopType=partnered` |
| `ownerId` | string | Filter by owner ID | - | `?ownerId=uuid` |
| `page` | number | Page number (1-based) | - | `?page=1` |
| `limit` | number | Results per page | `50` | `?limit=20` |
| `offset` | number | Offset for pagination | `0` | `?offset=20` |
| `sort_by` | string | Sort field | `created_at` | `?sort_by=name` |
| `sort_order` | string | Sort direction (`asc`/`desc`) | `desc` | `?sort_order=asc` |

### Response Structure

```typescript
interface ShopSearchResponse {
  success: boolean;
  data: {
    shops: Shop[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  };
}

interface Shop {
  id: string;
  name: string;
  description?: string;
  phone_number?: string;
  email?: string;
  address: string;
  detailed_address?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  main_category: string;
  sub_categories?: string[];
  shop_status: string;
  shop_type: string;
  contact_methods: ContactMethod[];
  shop_images: ShopImage[];
  // ... other fields
}
```

## Frontend Implementation Examples

### 1. Basic Search
```typescript
async function searchShops(searchQuery: string) {
  const response = await api.get('/api/shops', {
    query: searchQuery,
    limit: 20
  });

  // ✅ Extract shops array from nested structure
  const shops = response.data.shops;
  const pagination = response.data.pagination;

  return { shops, pagination };
}
```

### 2. Paginated Search with Sorting
```typescript
async function searchShopsWithPagination(
  searchQuery: string,
  page: number = 1,
  sortBy: string = 'relevance'
) {
  const response = await api.get('/api/shops', {
    query: searchQuery,
    page: page,
    limit: 20,
    sort_by: sortBy,
    sort_order: 'desc'
  });

  return {
    shops: response.data.shops,
    pagination: response.data.pagination,
    hasMore: response.data.shops.length === 20
  };
}
```

### 3. Search Suggestions (Autocomplete)
```typescript
async function getSearchSuggestions(searchQuery: string) {
  if (searchQuery.length < 2) return [];

  const response = await api.get('/api/shops', {
    query: searchQuery,
    limit: 10
  });

  // ✅ Correctly access nested shops array
  return response.data.shops.map(shop => ({
    id: shop.id,
    name: shop.name,
    address: shop.address,
    category: shop.main_category
  }));
}
```

### 4. Update Search Context (search-context.tsx)
```typescript
// File: src/contexts/search-context.tsx or similar

// ❌ BEFORE (Broken)
const searchShops = async (query: string) => {
  const result = await api.get('/api/shops', { query });
  return result.data.map(shop => ...);  // ERROR!
};

// ✅ AFTER (Fixed)
const searchShops = async (query: string) => {
  const result = await api.get('/api/shops', { query });
  return result.data.shops.map(shop => ...);  // Correct!
};
```

### 5. Update Search Engine (engine.ts)
```typescript
// File: src/lib/search/engine.ts or similar

// ❌ BEFORE (Broken)
async function getSearchSuggestions(query: string) {
  const searchResults = await api.get('/api/shops', { query, limit: 10 });
  searchResults.data.forEach(result => ...);  // ERROR!
}

// ✅ AFTER (Fixed)
async function getSearchSuggestions(query: string) {
  const searchResults = await api.get('/api/shops', { query, limit: 10 });
  searchResults.data.shops.forEach(result => ...);  // Correct!
}
```

## Testing

### 1. Test Backend Locally
```bash
# Start backend server
npm run dev

# Test search endpoint
curl "http://localhost:3001/api/shops?query=beauty&limit=5"

# Expected response structure:
# {
#   "success": true,
#   "data": {
#     "shops": [...],
#     "pagination": { "limit": 5, "offset": 0, "total": 3 }
#   }
# }
```

### 2. Test Frontend Integration
1. Update all files that call `/api/shops` to use `response.data.shops`
2. Search for all instances of `.data.map` or `.data.forEach` on shop responses
3. Test search functionality in browser
4. Verify no more "is not a function" errors

## Files to Update in Frontend

Based on the error logs, update these files:

1. **src/lib/api/client.ts**
   - Update shop API response type definitions

2. **src/lib/search/engine.ts**
   - Line 642: `shopResponse.data.map` → `shopResponse.data.shops.map`
   - Line 802: `searchResults.data.forEach` → `searchResults.data.shops.forEach`

3. **src/contexts/search-context.tsx**
   - Line 178: Update `search` function to use `result.data.shops`
   - Line 358: Update `getSuggestions` function to use `result.data.shops`

4. **src/components/search/search-interface.tsx**
   - Update any direct shop data access to use nested structure

## Summary

### Backend Changes ✅
- Added `query` parameter for text search
- Added `sort_by` and `sort_order` parameters
- Added `page` parameter for page-based pagination
- All changes are **backward compatible**

### Frontend Changes Required 🔴
- **Critical:** Update all code accessing `/api/shops` response
- **Pattern:** Change `response.data` → `response.data.shops`
- **Benefit:** Access to pagination metadata via `response.data.pagination`

### Migration Checklist
- [ ] Update API client type definitions
- [ ] Fix `engine.ts` (lines 642, 802)
- [ ] Fix `search-context.tsx` (lines 178, 358)
- [ ] Fix `search-interface.tsx` (line 71, 84)
- [ ] Test search functionality
- [ ] Test pagination
- [ ] Test sorting
- [ ] Verify no console errors

## Need Help?

If you encounter issues:
1. Check backend logs: `tail -f logs/combined.log`
2. Check frontend console for detailed error messages
3. Verify API response structure with curl or Postman
4. Ensure backend is running on port 3001
5. Ensure frontend is configured to proxy to backend

---

**Last Updated:** 2025-11-13
**Backend Version:** everything_backend v1.0
**Status:** ✅ Backend fixed, 🔴 Frontend update required
