# Feed Routes Consistency Analysis

## Executive Summary

Analysis of feed endpoints consistency between admin/general feed (`/api/feed`) and user-specific feed (`/api/user/feed`).

**Key Findings:**
- ✅ Both routes use the same `FeedController` - ensures consistent business logic
- ⚠️ **CRITICAL**: Different rate limiting configurations
- ⚠️ **CRITICAL**: Different Multer upload configurations
- ⚠️ User feed has additional endpoints not in admin feed
- ✅ URL normalization applied consistently in `feed.service.ts`

---

## Route Mounting (src/app.ts:486-487)

```typescript
app.use('/api/feed', feedRoutes);           // Admin/general feed
app.use('/api/user/feed', userFeedRoutes);  // User-specific feed
```

---

## Controller Implementation

**Both routes use the same controller:**
- `src/controllers/feed.controller.ts` - Single source of truth
- This ensures consistent business logic, validation, and data transformations
- ✅ URL normalization applied in `feed.service.ts` `transformPostsToCamelCase()` method

---

## Endpoint Comparison

### Core CRUD Operations

| Endpoint | `/api/feed` | `/api/user/feed` | Status |
|----------|-------------|------------------|---------|
| POST /posts | ✅ | ✅ | Consistent |
| GET /posts | ✅ | ✅ | Consistent |
| GET /posts/:postId | ✅ | ✅ | Consistent |
| PUT /posts/:postId | ✅ | ✅ | Consistent |
| DELETE /posts/:postId | ✅ | ✅ | Consistent |

### Interaction Endpoints

| Endpoint | `/api/feed` | `/api/user/feed` | Status |
|----------|-------------|------------------|---------|
| POST /posts/:postId/like | ✅ (toggle) | ✅ (toggle) | Consistent |
| DELETE /posts/:postId/like | ❌ | ✅ | **User has explicit unlike** |
| POST /posts/:postId/comments | ✅ | ✅ | Consistent |
| GET /posts/:postId/comments | ✅ | ✅ | Consistent |
| PUT /comments/:commentId | ❌ | ✅ | **User can edit comments** |
| DELETE /comments/:commentId | ❌ | ✅ | **User can delete comments** |
| POST /comments/:commentId/like | ❌ | ✅ | **User can like comments** |

### Discovery & Personal Endpoints

| Endpoint | `/api/feed` | `/api/user/feed` | Status |
|----------|-------------|------------------|---------|
| GET /my-posts | ❌ | ✅ | **User-specific feature** |
| GET /discover | ❌ | ✅ | **User-specific feature** |

### Media Upload

| Endpoint | `/api/feed` | `/api/user/feed` | Status |
|----------|-------------|------------------|---------|
| POST /upload-images | ✅ | ✅ | **Different configs** ⚠️ |

---

## Critical Differences

### 1. Rate Limiting Configuration ⚠️

#### `/api/feed` (feed.routes.ts)
```typescript
// Custom rate limiting with different windows
const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 posts per hour
  message: 'Too many posts created, try again later'
});

const interactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  max: 100,                   // 100 interactions per 5 minutes
  message: 'Too many interactions, slow down'
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                   // 200 requests per 15 minutes
  message: 'Too many requests'
});
```

#### `/api/user/feed` (user-feed.routes.ts)
```typescript
// Uses DEFAULT rate limiter from system
// No custom rate limiting configuration
// Falls back to global rate limiting middleware
```

**Impact:**
- Admin feed has stricter, targeted rate limits
- User feed relies on system-wide defaults
- **Risk**: User feed may allow higher request volumes
- **Recommendation**: Apply consistent rate limiting to both

---

### 2. Multer Upload Configuration ⚠️

#### `/api/feed` (feed.routes.ts:1872-1914)
```typescript
const feedUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB
    files: 10,
    fields: 10,
    fieldSize: 1024 * 1024       // 1MB per field
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images allowed'));
    }
  }
});

// Custom error handling
router.post('/upload-images',
  (req, res, next) => {
    feedUpload.array('images', 10)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: 'Upload failed',
          message: `Multer error: ${err.message}`
        });
      }
      // ... additional error handling
      next();
    });
  },
  feedController.uploadImages
);
```

#### `/api/user/feed` (user-feed.routes.ts:591-592)
```typescript
// Uses default upload middleware
router.post('/upload-images',
  upload.array('images', 10),  // Default upload config
  feedController.uploadImages
);
```

**Impact:**
- Admin feed has explicit size limits and error handling
- User feed uses default config (may have different limits)
- **Risk**: Inconsistent file size limits and error messages
- **Recommendation**: Use the same upload configuration

---

### 3. Swagger Documentation

#### `/api/feed` (feed.routes.ts)
- ✅ Comprehensive Swagger documentation for all endpoints
- ✅ Request/response schemas defined
- ✅ Error responses documented

#### `/api/user/feed` (user-feed.routes.ts)
- ⚠️ Less comprehensive documentation
- ⚠️ Some endpoints lack schema definitions

---

## URL Normalization ✅

**Status: Consistently Applied**

All feed responses go through `feed.service.ts` which applies `normalizeSupabaseUrl()`:

```typescript
// feed.service.ts:1273-1287
private transformPostsToCamelCase(posts: any[]): any[] {
  return posts.map(post => ({
    ...post,
    author: post.author ? {
      ...post.author,
      profile_image_url: post.author.profile_image_url
        ? normalizeSupabaseUrl(post.author.profile_image_url)
        : post.author.profile_image_url
    } : undefined,
    images: post.images?.map((img: any) => ({
      id: img.id,
      imageUrl: img.image_url
        ? normalizeSupabaseUrl(img.image_url)
        : img.image_url,
      thumbnailUrl: img.thumbnail_url
        ? normalizeSupabaseUrl(img.thumbnail_url)
        : img.thumbnail_url,
      altText: img.alt_text,
      displayOrder: img.display_order
    })) || []
  }));
}
```

**This ensures:**
- ✅ Profile image URLs are normalized
- ✅ Post image URLs are normalized
- ✅ Thumbnail URLs are normalized
- ✅ Works for both `/api/feed` and `/api/user/feed`

---

## Recommendations

### Priority 1: Critical (Security & Performance)

1. **Standardize Rate Limiting**
   ```typescript
   // Apply the same rate limiting to user-feed.routes.ts
   const createPostLimiter = rateLimit({
     windowMs: 60 * 60 * 1000,  // 1 hour
     max: 5,
     message: 'Too many posts created, try again later'
   });

   const interactionLimiter = rateLimit({
     windowMs: 5 * 60 * 1000,   // 5 minutes
     max: 100,
     message: 'Too many interactions, slow down'
   });
   ```

2. **Standardize Multer Configuration**
   ```typescript
   // Extract feedUpload config to shared middleware
   // src/middleware/feed-upload.middleware.ts

   export const feedUpload = multer({
     storage: multer.memoryStorage(),
     limits: {
       fileSize: 10 * 1024 * 1024,  // 10MB
       files: 10,
       fields: 10,
       fieldSize: 1024 * 1024
     },
     fileFilter: (req, file, cb) => {
       const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
       if (allowedMimes.includes(file.mimetype)) {
         cb(null, true);
       } else {
         cb(new Error('Only JPEG, PNG, WebP, and GIF images allowed'));
       }
     }
   });

   export const feedUploadErrorHandler = (req, res, next) => {
     feedUpload.array('images', 10)(req, res, (err) => {
       if (err instanceof multer.MulterError) {
         return res.status(400).json({
           success: false,
           error: 'Upload failed',
           message: `Multer error: ${err.message}`
         });
       }
       if (err) {
         return res.status(400).json({
           success: false,
           error: 'Upload failed',
           message: err.message
         });
       }
       next();
     });
   };

   // Use in both route files
   router.post('/upload-images', feedUploadErrorHandler, feedController.uploadImages);
   ```

### Priority 2: Important (Consistency)

3. **Align Endpoint Features**
   - Decide if admin feed should have comment editing/deletion
   - Consider adding `/my-posts` and `/discover` to admin feed if needed
   - Or document that user feed has extended features

4. **Improve User Feed Documentation**
   - Add comprehensive Swagger documentation
   - Match the quality of admin feed documentation

### Priority 3: Nice-to-Have (Maintainability)

5. **Consider Route Consolidation**
   - Evaluate if two separate route files are necessary
   - Could use RBAC middleware to differentiate permissions
   - Single route file might be easier to maintain

6. **Create Shared Middleware**
   - Extract common rate limiters
   - Extract upload configuration
   - Reduce code duplication

---

## Testing Checklist

- [ ] Test rate limiting on both routes
- [ ] Verify file upload limits match
- [ ] Confirm URL normalization works on both routes
- [ ] Test error handling consistency
- [ ] Verify response format matches
- [ ] Check authentication/authorization rules
- [ ] Test comment editing/deletion on user feed
- [ ] Verify explicit unlike endpoint on user feed

---

## Files to Modify

1. **Priority 1 (Critical):**
   - [ ] `src/routes/user-feed.routes.ts` - Add consistent rate limiting
   - [ ] `src/middleware/feed-upload.middleware.ts` - Create shared upload config
   - [ ] `src/routes/feed.routes.ts` - Use shared upload config
   - [ ] `src/routes/user-feed.routes.ts` - Use shared upload config

2. **Priority 2 (Important):**
   - [ ] `src/routes/user-feed.routes.ts` - Improve Swagger documentation

3. **Priority 3 (Nice-to-Have):**
   - [ ] Consider architecture refactoring for single route file

---

## Conclusion

**Current State:**
- ✅ Controller consistency maintained (same business logic)
- ✅ URL normalization working correctly
- ⚠️ Rate limiting differs significantly
- ⚠️ Upload configuration differs

**Immediate Actions Required:**
1. Apply consistent rate limiting to both routes
2. Standardize multer upload configuration
3. Document intentional differences (if any)

**Long-term Considerations:**
- Evaluate if separate route files provide value
- Consider RBAC-based single route approach
- Maintain documentation parity
