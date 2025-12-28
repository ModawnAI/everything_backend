# Feed Image Upload Fix

## Issue
Frontend getting 400 Bad Request error when uploading images to `/api/feed/upload-images`

## Root Cause
There are **two** upload endpoints with different permission requirements:

### 1. `/api/feed/upload-images` (feed.routes.ts)
```typescript
router.post('/upload-images',
  feedGeneralRateLimit,
  feedInteractionRateLimit,
  requireFeedPostPermission('create'), // ❌ Requires RBAC permission
  upload.array('images', 10),
  feedController.uploadImages.bind(feedController)
);
```
**Requirements:**
- JWT authentication
- Rate limiting
- **RBAC permission:** `feed_posts:create` - Users may not have this permission
- Multer file upload

### 2. `/api/user/feed/upload-images` (user-feed.routes.ts)
```typescript
router.post('/upload-images',
  rateLimit(),
  upload.array('images', 10), // ✅ Only requires authentication
  feedController.uploadImages.bind(feedController)
);
```
**Requirements:**
- JWT authentication (via router-level middleware)
- Rate limiting
- Multer file upload
- **No RBAC permission check** - Works for all authenticated users

## Solution

### Option 1: Use User Feed Endpoint (Recommended)
Frontend should call `/api/user/feed/upload-images` instead of `/api/feed/upload-images`

**Pros:**
- No RBAC permission setup needed
- Works immediately for all authenticated users
- Same controller, same functionality

**Implementation:**
```typescript
// Frontend change
const uploadUrl = '/api/user/feed/upload-images'; // ✅ Use this
// const uploadUrl = '/api/feed/upload-images'; // ❌ Don't use this
```

### Option 2: Remove RBAC from Feed Endpoint
Remove the `requireFeedPostPermission('create')` middleware from `/api/feed/upload-images`

**Changes needed:**
```typescript
// In src/routes/feed.routes.ts, line 1428-1436
router.post('/upload-images',
  feedGeneralRateLimit,
  feedInteractionRateLimit,
  // REMOVE: requireFeedPostPermission('create'),
  upload.array('images', 10),
  feedController.uploadImages.bind(feedController)
);
```

**Pros:**
- Maintains backward compatibility if frontend already calls this endpoint
- No frontend changes needed

**Cons:**
- Less fine-grained access control
- Bypasses RBAC system for uploads

## Request Format (Both Endpoints)
```typescript
POST /api/user/feed/upload-images  // or /api/feed/upload-images
Content-Type: multipart/form-data
Authorization: Bearer <token>

FormData:
- images: File[] (max 10 files, 10MB each)
- altText_0: string (optional)
- altText_1: string (optional)
- displayOrder_0: number (optional)
- displayOrder_1: number (optional)
```

## Response Format
```json
{
  "success": true,
  "message": "Images uploaded successfully",
  "data": {
    "images": [
      {
        "imageUrl": "https://storage.supabase.co/.../medium/user123/image.webp",
        "thumbnailUrl": "https://storage.supabase.co/.../thumbnails/user123/image.webp",
        "altText": "Optional alt text",
        "displayOrder": 1,
        "metadata": {
          "originalSize": 2048576,
          "optimizedSize": 512000,
          "width": 800,
          "height": 600,
          "format": "webp"
        }
      }
    ]
  }
}
```

## Recommended Action
**Use Option 1** - Update frontend to call `/api/user/feed/upload-images`

This is the cleanest solution that:
- Works immediately without backend changes
- Appropriate for user-facing upload functionality
- Maintains authentication security
- Avoids RBAC complexity for a simple upload operation

## Testing
Both endpoints use the same controller and service, so they have identical functionality:
- Image validation (format, size, dimensions)
- Sharp processing (thumbnail, medium, large sizes)
- WebP conversion
- Supabase storage upload
- Metadata generation

Test with:
```bash
curl -X POST http://localhost:3001/api/user/feed/upload-images \
  -H "Authorization: Bearer <token>" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "altText_0=First image" \
  -F "displayOrder_0=1"
```
