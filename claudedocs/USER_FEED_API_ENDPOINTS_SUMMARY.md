# User Feed Post API Endpoints - Complete Summary

**Date**: 2025-10-24
**Project**: eBeautything Backend
**Document**: Comprehensive Feed API Endpoint Analysis

---

## Overview

The feed system has **two route structures**:

1. **General Feed Routes** (`/api/feed/*`) - Used by ALL authenticated users including shop owners
2. **User-Specific Feed Routes** (`/api/user/feed/*`) - Simplified user-focused endpoints

**Shop Integration**: Shop owners create posts through the same feed endpoints. Their posts are then displayed on their shop page via `GET /api/admin/shops/:shopId` which includes a `feedPosts` field.

---

## 📋 Complete Endpoint Comparison

### **1. CREATE POST**

#### General Feed (Used by shops & users):
```
POST /api/feed/posts
```
- **Rate Limit**: 5 posts/hour per user
- **Auth**: JWT required
- **Request Body**:
  ```json
  {
    "content": "string (max 2000 chars, required)",
    "category": "beauty|lifestyle|review|promotion|general",
    "location_tag": "string (max 100 chars)",
    "tagged_shop_id": "uuid",
    "hashtags": ["string"] (max 10),
    "images": [{
      "image_url": "string",
      "alt_text": "string (max 200 chars)",
      "display_order": "number"
    }] (max 10)
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "data": { /* post object */ }
  }
  ```

#### User Feed:
```
POST /api/user/feed/posts
```
- **Identical functionality** to general feed
- Same request/response structure
- Same rate limits

**✅ Consistency**: Both endpoints use the same controller and service

---

### **2. GET FEED POSTS (List)**

#### General Feed:
```
GET /api/feed/posts
```
- **Query Parameters**:
  - `page` (default: 1)
  - `limit` (1-50, default: 20)
  - `category` (beauty|lifestyle|review|promotion|general)
  - `hashtag` (string)
  - `location` (string)
  - `author_id` (uuid)
- **Algorithm**: Recency 40%, Engagement 30%, Relevance 20%, Author Influence 10%
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "posts": [],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "totalPages": 8
      },
      "hasMore": true
    }
  }
  ```

#### User Feed:
```
GET /api/user/feed/posts
```
- **Same query parameters** as general feed
- **Same response structure**

**Additional User Feed Endpoints**:

```
GET /api/user/feed/my-posts
```
- Returns **user's own posts** (recent 10)
- No pagination parameters needed

```
GET /api/user/feed/discover
```
- Returns **discover feed** (posts from others, excluding own)
- Recent 10 posts from other users and shops

**✅ Consistency**: General feed is more flexible, user feed adds convenience endpoints

---

### **3. GET SINGLE POST**

#### General Feed:
```
GET /api/feed/posts/:postId
```
- **Response**: Complete post details with:
  - Author information
  - All images with metadata
  - User's like status
  - Tagged shop info
  - Engagement counts

#### User Feed:
```
GET /api/user/feed/posts/:postId
```
- **Identical response structure**

**✅ Consistency**: Fully consistent

---

### **4. UPDATE POST**

#### General Feed:
```
PUT /api/feed/posts/:postId
```
- **Auth Check**: Only author can update
- **Request Body** (all optional):
  ```json
  {
    "content": "string (max 2000)",
    "hashtags": ["string"] (max 10),
    "location_tag": "string (max 100)",
    "images": [/* image objects */] (max 10)
  }
  ```

#### User Feed:
```
PUT /api/user/feed/posts/:postId
```
- **Identical functionality**

**✅ Consistency**: Fully consistent

---

### **5. DELETE POST**

#### General Feed:
```
DELETE /api/feed/posts/:postId
```
- **Soft delete** (sets status to 'deleted')
- **Auth Check**: Only author or admin can delete

#### User Feed:
```
DELETE /api/user/feed/posts/:postId
```
- **Identical functionality**

**✅ Consistency**: Fully consistent

---

### **6. LIKE/UNLIKE POST**

#### General Feed:
```
POST /api/feed/posts/:postId/like
```
- **Toggle behavior**: If already liked, unlikes; if not liked, likes
- **Response**:
  ```json
  {
    "success": true,
    "message": "Post liked successfully",
    "data": {
      "isLiked": true,
      "likeCount": 42
    }
  }
  ```

#### User Feed:
```
POST /api/user/feed/posts/:postId/like
DELETE /api/user/feed/posts/:postId/like
```
- **Separate endpoints** for like and unlike
- Like: POST, Unlike: DELETE

**⚠️ Difference**:
- General feed uses **toggle** (single POST endpoint)
- User feed uses **separate** endpoints (POST to like, DELETE to unlike)

---

### **7. COMMENTS**

#### General Feed:

**Add Comment**:
```
POST /api/feed/posts/:postId/comments
```
- Request: `{ "content": "string (max 500)" }`

**Get Comments**:
```
GET /api/feed/posts/:postId/comments?page=1&limit=20
```

#### User Feed:

**Add Comment**:
```
POST /api/user/feed/posts/:postId/comments
```
- Request: `{ "content": "string (max 1000)", "parentCommentId": "uuid" }`
- **Supports nested replies** via `parentCommentId`

**Get Comments**:
```
GET /api/user/feed/posts/:postId/comments?page=1&limit=20
```

**Update Comment**:
```
PUT /api/user/feed/comments/:commentId
```
- Only in **user feed** routes
- Request: `{ "content": "string (max 1000)" }`

**Delete Comment**:
```
DELETE /api/user/feed/comments/:commentId
```
- Only in **user feed** routes

**Like Comment**:
```
POST /api/user/feed/comments/:commentId/like
```
- Only in **user feed** routes

**⚠️ Differences**:
- User feed has **full comment CRUD** operations
- User feed supports **nested comments** (replies)
- User feed has **comment likes**
- General feed has **basic add/get** only

---

### **8. REPORT POST**

#### General Feed:
```
POST /api/feed/posts/:postId/report
```
- **Request**:
  ```json
  {
    "reason": "spam|harassment|inappropriate_content|fake_information|violence|hate_speech|copyright_violation|impersonation|scam|adult_content|other",
    "description": "string (max 500, optional)"
  }
  ```

#### User Feed:
```
POST /api/user/feed/posts/:postId/report
```
- **Identical functionality**

**✅ Consistency**: Fully consistent

---

### **9. IMAGE UPLOAD**

#### General Feed:
```
POST /api/feed/upload-images
```
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `images`: Array of image files (max 10, 8MB each)
  - `altText_0`, `altText_1`, ... (optional)
  - `displayOrder_0`, `displayOrder_1`, ... (optional)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Images uploaded successfully",
    "data": {
      "images": [{
        "imageUrl": "string",
        "thumbnailUrl": "string",
        "altText": "string",
        "displayOrder": 1,
        "metadata": {
          "originalSize": 2048576,
          "optimizedSize": 512000,
          "width": 800,
          "height": 600,
          "format": "webp"
        }
      }]
    }
  }
  ```

#### User Feed:
```
POST /api/user/feed/upload-images
```
- **File limit**: 10MB per file (vs 8MB in general feed)
- **Otherwise identical**

**⚠️ Minor Difference**: File size limit (8MB vs 10MB)

---

### **10. ADVANCED FEED FEATURES** (General Feed Only)

These endpoints exist **only** in the general feed routes:

#### Personalized Feed:
```
POST /api/feed/personalized
```
- **Request Body**:
  ```json
  {
    "limit": 20,
    "offset": 0,
    "timeWindow": "hour|day|week|month",
    "includeFollowedOnly": false,
    "categoryFilter": ["beauty"],
    "locationFilter": "string",
    "minQualityScore": 0,
    "diversityBoost": true,
    "personalizedWeights": {
      "recency": 0.4,
      "engagement": 0.3,
      "relevance": 0.2,
      "authorInfluence": 0.1
    }
  }
  ```
- **Algorithm ranking** with detailed metrics

#### Trending Content:
```
GET /api/feed/trending?timeframe=day&category=beauty&location=Seoul&limit=20
```
- **Public endpoint** (no auth required)
- Trending calculation based on engagement velocity

#### Record Interaction:
```
POST /api/feed/interactions
```
- **Request**: `{ "type": "like|comment|share|view", "postId": "uuid", "category": "string", "authorId": "uuid" }`
- **Purpose**: Preference learning for personalized feed

#### Feed Analytics:
```
GET /api/feed/analytics?timeframe=week
```
- Total posts, avg engagement, top categories, trends

#### Get/Update Personalized Weights:
```
GET /api/feed/weights
PUT /api/feed/weights
```
- Customize feed algorithm weights

**⚠️ Feature Gap**: User feed lacks these advanced personalization features

---

## 🏪 Shop Feed Integration

Shop owners use the **same feed endpoints** as regular users. Their posts are displayed in two places:

1. **General Feed**: Mixed with user posts
2. **Shop Page**: Via `GET /api/admin/shops/:shopId`
   ```json
   {
     "success": true,
     "data": {
       "shop": { /* shop details */ },
       "feedPosts": [ /* Recent 20 posts by shop owner */ ]
     }
   }
   ```

**Shop Feed Posts Include**:
- All standard post fields
- Author info (shop owner)
- Images
- Engagement metrics (likes, comments, views)
- Hashtags, category, location
- Moderation status

**Implementation Details**:
- Shop page endpoint fetches posts via `FeedService.getFeedPosts()`
- Filters by `author_id` = shop's `owner_id`
- Returns up to 20 most recent posts
- Graceful degradation if feed fetch fails (returns empty array)
- See: `src/controllers/admin-shop.controller.ts:262-284`

---

## 🔒 Security & Rate Limits

### General Feed:
- **General Operations**: 200 requests / 15 min
- **Post Creation**: 5 posts / hour per user
- **Interactions** (likes/comments): 100 / 5 min

### User Feed:
- **All Operations**: Rate limited (same limits)
- **Post Creation**: 5 posts / hour per user

### Common Security:
- JWT authentication required (all endpoints)
- CSRF protection via JWT in Authorization header
- XSS protection (automatic sanitization)
- File validation for uploads
- Owner-only edit/delete enforcement
- Soft deletes (preserves data)

---

## 📊 Key Differences Summary

| Feature | General Feed | User Feed | Shop Integration |
|---------|-------------|-----------|------------------|
| **Basic CRUD** | ✅ Full | ✅ Full | ✅ Via General |
| **Like/Unlike** | Toggle (POST) | Separate (POST/DELETE) | Via General |
| **Comments CRUD** | Add/Get only | Full CRUD + Likes | Via General |
| **Nested Comments** | ❌ No | ✅ Yes | N/A |
| **My Posts** | Via filter | ✅ Dedicated endpoint | ✅ Via Admin API |
| **Discover Feed** | Via filter | ✅ Dedicated endpoint | N/A |
| **Personalization** | ✅ Full | ❌ No | N/A |
| **Trending** | ✅ Yes | ❌ No | N/A |
| **Analytics** | ✅ Yes | ❌ No | N/A |
| **Image Upload** | 8MB limit | 10MB limit | Same as General |
| **Comment Length** | 500 chars | 1000 chars | N/A |

---

## ✅ Consistency Assessment

### Fully Consistent:
- ✅ Post creation (same controller/service)
- ✅ Post retrieval (single)
- ✅ Post update
- ✅ Post delete
- ✅ Post reporting
- ✅ Basic commenting
- ✅ Authentication & authorization

### Minor Differences:
- ⚠️ Like/unlike mechanism (toggle vs separate endpoints)
- ⚠️ Image upload file size (8MB vs 10MB)
- ⚠️ Comment character limit (500 vs 1000)

### Feature Gaps:
- ❌ User feed lacks advanced personalization
- ❌ User feed lacks trending content
- ❌ User feed lacks analytics

### Additional Features (User Feed Only):
- ✅ Full comment management (update, delete, like)
- ✅ Nested comment replies
- ✅ Dedicated "my posts" endpoint
- ✅ Dedicated "discover" endpoint

---

## 🎯 Recommendations

### For Frontend Development:

#### Use General Feed Routes (`/api/feed/*`) for:
- ✅ Shop admin interfaces
- ✅ Advanced feed features
- ✅ Personalization & trending
- ✅ Analytics dashboards
- ✅ Desktop web applications

#### Use User Feed Routes (`/api/user/feed/*`) for:
- ✅ Mobile app (simpler API surface)
- ✅ Comment management (full CRUD)
- ✅ Nested comment threads
- ✅ Convenience endpoints (my-posts, discover)
- ✅ Simplified user experience

#### For Shop Pages:
- ✅ Fetch via `GET /api/admin/shops/:shopId` which includes `feedPosts[]`
- ✅ Uses same feed service underneath
- ✅ Automatically filtered by shop owner
- ✅ Returns recent 20 posts with full metadata

**Both route sets are production-ready and fully implemented**, just optimized for different use cases.

---

## 📁 File Structure

### Route Files:
- `src/routes/feed.routes.ts` - General feed routes
- `src/routes/user-feed.routes.ts` - User-specific feed routes

### Controllers:
- `src/controllers/feed.controller.ts` - Main feed controller (shared)
- `src/controllers/feed-ranking.controller.ts` - Personalization/analytics
- `src/controllers/admin-shop.controller.ts` - Shop page with feed posts

### Services:
- `src/services/feed.service.ts` - Core feed business logic
- `src/services/feed-image.service.ts` - Image processing
- `src/services/feed-logging.service.ts` - Feed analytics logging

---

## 🔗 Related Documentation

- [SHOP_FEED_POSTS_FEATURE.md](./SHOP_FEED_POSTS_FEATURE.md) - Shop feed integration details
- [FEED_ENDPOINTS_E2E_TEST_REPORT.md](./FEED_ENDPOINTS_E2E_TEST_REPORT.md) - E2E testing results
- [FEED_PERMISSIONS_COMPLETE_FIX.md](./FEED_PERMISSIONS_COMPLETE_FIX.md) - RBAC implementation

---

## 📝 API Documentation

Full API documentation available at:
- **Complete API**: http://localhost:3001/api-docs
- **Admin API**: http://localhost:3001/admin-docs
- **Service API**: http://localhost:3001/service-docs

OpenAPI specs:
- `/api/openapi.json`
- `/api/admin/openapi.json`
- `/api/service/openapi.json`

---

**Status**: ✅ **PRODUCTION READY**
**Last Updated**: 2025-10-24
**Maintained By**: eBeautything Backend Team
