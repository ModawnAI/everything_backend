# User Feed API - Frontend Developer Guide

**Base URL**: `http://localhost:3001/api/user/feed`
**Authentication**: Required for all endpoints (JWT Bearer token)
**Content Type**: `application/json` (except image uploads)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
   - [Create Post](#1-create-post)
   - [Get Feed Posts](#2-get-feed-posts)
   - [Get My Posts](#3-get-my-posts)
   - [Get Discover Feed](#4-get-discover-feed)
   - [Get Post by ID](#5-get-post-by-id)
   - [Update Post](#6-update-post)
   - [Delete Post](#7-delete-post)
   - [Like Post](#8-like-post)
   - [Unlike Post](#9-unlike-post)
   - [Add Comment](#10-add-comment)
   - [Get Comments](#11-get-comments)
   - [Update Comment](#12-update-comment)
   - [Delete Comment](#13-delete-comment)
   - [Like Comment](#14-like-comment)
   - [Report Post](#15-report-post)
   - [Upload Images](#16-upload-images)

---

## Authentication

All endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

**Example (JavaScript/Fetch):**
```javascript
const response = await fetch('http://localhost:3001/api/user/feed/posts', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Rate Limiting

The API implements three rate limiting tiers:

| Action Type | Limit | Window | HTTP Status on Exceed |
|-------------|-------|--------|----------------------|
| **Post Creation** | 5 requests | 1 hour | 429 Too Many Requests |
| **Interactions** (like, comment, edit, delete) | 100 requests | 5 minutes | 429 Too Many Requests |
| **Read Operations** (get posts, comments) | 200 requests | 15 minutes | 429 Too Many Requests |

**Rate Limit Headers** (included in all responses):
```http
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 1698765432
```

**Handling Rate Limits in Frontend:**
```javascript
if (response.status === 429) {
  const resetTime = response.headers.get('RateLimit-Reset');
  const waitTime = new Date(parseInt(resetTime) * 1000) - new Date();

  // Show user: "Too many requests. Please wait X minutes."
  showNotification(`Rate limit exceeded. Please try again in ${Math.ceil(waitTime / 60000)} minutes.`);
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### Common HTTP Status Codes

| Status Code | Meaning | When It Happens |
|-------------|---------|-----------------|
| **200 OK** | Success | Request completed successfully |
| **201 Created** | Created | New resource created (post, comment) |
| **400 Bad Request** | Invalid input | Missing required fields, validation failed |
| **401 Unauthorized** | Authentication failed | Missing or invalid JWT token |
| **403 Forbidden** | Not allowed | User doesn't own the resource |
| **404 Not Found** | Resource not found | Post or comment doesn't exist |
| **429 Too Many Requests** | Rate limit exceeded | Too many requests in time window |
| **500 Internal Server Error** | Server error | Something went wrong on server |

---

## Endpoints

### 1. Create Post

Create a new feed post with optional images, hashtags, and location.

**Endpoint:** `POST /api/user/feed/posts`
**Rate Limit:** 5 per hour
**Authentication:** Required

#### Request Body

```json
{
  "content": "Check out my new look! #beauty #makeup",
  "category": "beauty",
  "locationTag": "Seoul, South Korea",
  "taggedShopId": "shop-uuid-here",
  "hashtags": ["beauty", "makeup", "skincare"],
  "images": [
    {
      "imageUrl": "https://storage.url/image1.jpg",
      "altText": "Before and after makeup",
      "displayOrder": 0
    },
    {
      "imageUrl": "https://storage.url/image2.jpg",
      "altText": "Close-up of eye makeup",
      "displayOrder": 1
    }
  ]
}
```

#### Field Validation

| Field | Type | Required | Max Length | Notes |
|-------|------|----------|------------|-------|
| `content` | string | ✅ Yes | 2000 chars | Post text content |
| `category` | string | ❌ No | - | Category identifier |
| `locationTag` | string | ❌ No | - | Location name |
| `taggedShopId` | string | ❌ No | - | UUID of tagged shop |
| `hashtags` | array | ❌ No | 10 items | Array of strings |
| `images` | array | ❌ No | 10 items | Array of image objects |
| `images[].imageUrl` | string | ✅ Yes | - | Full image URL |
| `images[].altText` | string | ❌ No | - | Accessibility text |
| `images[].displayOrder` | number | ❌ No | - | Display order (0-9) |

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "post": {
      "id": "post-uuid",
      "content": "Check out my new look! #beauty #makeup",
      "category": "beauty",
      "locationTag": "Seoul, South Korea",
      "taggedShopId": "shop-uuid-here",
      "hashtags": ["beauty", "makeup", "skincare"],
      "authorId": "user-uuid",
      "author": {
        "id": "user-uuid",
        "username": "beautylover123",
        "displayName": "Beauty Lover",
        "profileImageUrl": "https://storage.url/profile.jpg"
      },
      "images": [
        {
          "id": "image-uuid-1",
          "imageUrl": "https://storage.url/image1.webp",
          "thumbnailUrl": "https://storage.url/thumb1.webp",
          "altText": "Before and after makeup",
          "displayOrder": 0
        }
      ],
      "likesCount": 0,
      "commentsCount": 0,
      "isLiked": false,
      "createdAt": "2025-10-25T10:30:00.000Z",
      "updatedAt": "2025-10-25T10:30:00.000Z"
    }
  },
  "message": "Post created successfully"
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Content is required and cannot exceed 2000 characters"
}
```

#### Example Code

```javascript
async function createPost(content, images = []) {
  try {
    const response = await fetch('http://localhost:3001/api/user/feed/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        hashtags: extractHashtags(content),
        images
      })
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. You can only create 5 posts per hour.');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data.post;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
}
```

---

### 2. Get Feed Posts

Get paginated feed posts with optional filtering.

**Endpoint:** `GET /api/user/feed/posts`
**Rate Limit:** 200 per 15 minutes
**Authentication:** Required

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number (min: 1) |
| `limit` | integer | ❌ No | 20 | Items per page (min: 1, max: 50) |
| `category` | string | ❌ No | - | Filter by category |
| `hashtag` | string | ❌ No | - | Filter by hashtag |
| `location` | string | ❌ No | - | Filter by location |
| `authorId` | string | ❌ No | - | Filter by author ID |
| `sort` | string | ❌ No | recent | Sort order: `recent`, `popular`, `trending` |

#### Request Example

```javascript
const params = new URLSearchParams({
  page: '1',
  limit: '20',
  category: 'beauty',
  sort: 'recent'
});

const response = await fetch(`http://localhost:3001/api/user/feed/posts?${params}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "content": "Amazing transformation! #beauty",
        "category": "beauty",
        "locationTag": "Seoul",
        "hashtags": ["beauty", "makeup"],
        "authorId": "user-uuid-1",
        "author": {
          "id": "user-uuid-1",
          "username": "beautyguru",
          "displayName": "Beauty Guru",
          "profileImageUrl": "https://storage.url/profile1.jpg"
        },
        "images": [
          {
            "id": "image-uuid-1",
            "imageUrl": "https://storage.url/image1.webp",
            "thumbnailUrl": "https://storage.url/thumb1.webp",
            "altText": "Beauty transformation",
            "displayOrder": 0
          }
        ],
        "likesCount": 24,
        "commentsCount": 5,
        "isLiked": true,
        "createdAt": "2025-10-25T10:00:00.000Z",
        "updatedAt": "2025-10-25T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

---

### 3. Get My Posts

Get the current user's own posts (most recent 10).

**Endpoint:** `GET /api/user/feed/my-posts`
**Rate Limit:** 200 per 15 minutes
**Authentication:** Required

#### Request Example

```javascript
const response = await fetch('http://localhost:3001/api/user/feed/my-posts', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-uuid",
        "content": "My latest post",
        "category": "beauty",
        "authorId": "current-user-uuid",
        "author": {
          "id": "current-user-uuid",
          "username": "myusername",
          "displayName": "My Name",
          "profileImageUrl": "https://storage.url/myprofile.jpg"
        },
        "images": [],
        "likesCount": 10,
        "commentsCount": 2,
        "isLiked": false,
        "createdAt": "2025-10-25T09:00:00.000Z",
        "updatedAt": "2025-10-25T09:00:00.000Z"
      }
    ]
  }
}
```

---

### 4. Get Discover Feed

Get discover feed (recent posts from other users and shops, excluding own posts).

**Endpoint:** `GET /api/user/feed/discover`
**Rate Limit:** 200 per 15 minutes
**Authentication:** Required

#### Request Example

```javascript
const response = await fetch('http://localhost:3001/api/user/feed/discover', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

Same format as "Get Feed Posts" but excludes current user's posts.

---

### 5. Get Post by ID

Get detailed information about a specific post.

**Endpoint:** `GET /api/user/feed/posts/:postId`
**Rate Limit:** 200 per 15 minutes
**Authentication:** Required

#### Request Example

```javascript
const postId = 'post-uuid-here';
const response = await fetch(`http://localhost:3001/api/user/feed/posts/${postId}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "post": {
      "id": "post-uuid",
      "content": "Post content",
      "category": "beauty",
      "author": { "..." },
      "images": [],
      "likesCount": 15,
      "commentsCount": 3,
      "isLiked": false,
      "createdAt": "2025-10-25T08:00:00.000Z",
      "updatedAt": "2025-10-25T08:00:00.000Z"
    }
  }
}
```

#### Error Response (404 Not Found)

```json
{
  "success": false,
  "error": "POST_NOT_FOUND",
  "message": "Post not found"
}
```

---

### 6. Update Post

Update own feed post.

**Endpoint:** `PUT /api/user/feed/posts/:postId`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Body

```json
{
  "content": "Updated content with new hashtags #updated",
  "category": "skincare",
  "locationTag": "Busan",
  "hashtags": ["updated", "skincare"]
}
```

**Note:** Only include fields you want to update. You cannot update `images` - delete the post and create a new one if you need to change images.

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "post": {
      "id": "post-uuid",
      "content": "Updated content with new hashtags #updated",
      "category": "skincare",
      "updatedAt": "2025-10-25T11:00:00.000Z"
    }
  },
  "message": "Post updated successfully"
}
```

#### Error Response (403 Forbidden)

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "You can only update your own posts"
}
```

---

### 7. Delete Post

Delete own feed post (soft delete).

**Endpoint:** `DELETE /api/user/feed/posts/:postId`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Example

```javascript
const response = await fetch(`http://localhost:3001/api/user/feed/posts/${postId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

---

### 8. Like Post

Like a feed post.

**Endpoint:** `POST /api/user/feed/posts/:postId/like`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Example

```javascript
const response = await fetch(`http://localhost:3001/api/user/feed/posts/${postId}/like`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "liked": true,
    "likesCount": 25
  },
  "message": "Post liked successfully"
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "ALREADY_LIKED",
  "message": "You have already liked this post"
}
```

---

### 9. Unlike Post

Remove like from a feed post.

**Endpoint:** `DELETE /api/user/feed/posts/:postId/like`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Example

```javascript
const response = await fetch(`http://localhost:3001/api/user/feed/posts/${postId}/like`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "liked": false,
    "likesCount": 24
  },
  "message": "Post unliked successfully"
}
```

---

### 10. Add Comment

Add a comment to a post (supports nested replies).

**Endpoint:** `POST /api/user/feed/posts/:postId/comments`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Body

```json
{
  "content": "Great post! Love your style 💕",
  "parentCommentId": "comment-uuid-if-replying"
}
```

#### Field Validation

| Field | Type | Required | Max Length | Notes |
|-------|------|----------|------------|-------|
| `content` | string | ✅ Yes | 1000 chars | Comment text |
| `parentCommentId` | string | ❌ No | - | UUID for nested replies |

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "comment": {
      "id": "comment-uuid",
      "postId": "post-uuid",
      "content": "Great post! Love your style 💕",
      "authorId": "user-uuid",
      "author": {
        "id": "user-uuid",
        "username": "commentor123",
        "displayName": "Commentor",
        "profileImageUrl": "https://storage.url/profile.jpg"
      },
      "parentCommentId": null,
      "likesCount": 0,
      "repliesCount": 0,
      "isLiked": false,
      "createdAt": "2025-10-25T11:30:00.000Z",
      "updatedAt": "2025-10-25T11:30:00.000Z"
    }
  },
  "message": "Comment added successfully"
}
```

---

### 11. Get Comments

Get paginated comments for a post.

**Endpoint:** `GET /api/user/feed/posts/:postId/comments`
**Rate Limit:** 200 per 15 minutes
**Authentication:** Required

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `limit` | integer | ❌ No | 20 | Items per page (max: 50) |

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment-uuid-1",
        "postId": "post-uuid",
        "content": "Amazing work!",
        "author": {
          "id": "user-uuid-1",
          "username": "user1",
          "displayName": "User One",
          "profileImageUrl": "https://storage.url/user1.jpg"
        },
        "parentCommentId": null,
        "likesCount": 5,
        "repliesCount": 2,
        "isLiked": false,
        "createdAt": "2025-10-25T10:00:00.000Z",
        "replies": [
          {
            "id": "comment-uuid-2",
            "postId": "post-uuid",
            "content": "Thanks!",
            "author": { "..." },
            "parentCommentId": "comment-uuid-1",
            "likesCount": 1,
            "repliesCount": 0,
            "isLiked": false,
            "createdAt": "2025-10-25T10:05:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

---

### 12. Update Comment

Update own comment.

**Endpoint:** `PUT /api/user/feed/comments/:commentId`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Body

```json
{
  "content": "Updated comment text"
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "comment": {
      "id": "comment-uuid",
      "content": "Updated comment text",
      "updatedAt": "2025-10-25T12:00:00.000Z"
    }
  },
  "message": "Comment updated successfully"
}
```

---

### 13. Delete Comment

Delete own comment.

**Endpoint:** `DELETE /api/user/feed/comments/:commentId`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

---

### 14. Like Comment

Like a comment.

**Endpoint:** `POST /api/user/feed/comments/:commentId/like`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "liked": true,
    "likesCount": 6
  },
  "message": "Comment liked successfully"
}
```

---

### 15. Report Post

Report a post for moderation.

**Endpoint:** `POST /api/user/feed/posts/:postId/report`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required

#### Request Body

```json
{
  "reason": "spam",
  "description": "This post contains promotional spam content"
}
```

#### Field Validation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `reason` | string | ✅ Yes | Reason code: `spam`, `inappropriate`, `harassment`, `misleading`, `other` |
| `description` | string | ❌ No | Additional details |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Post reported successfully. Our team will review it."
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "ALREADY_REPORTED",
  "message": "You have already reported this post"
}
```

---

### 16. Upload Images

Upload images to be used in feed posts. **Use this before creating a post with images.**

**Endpoint:** `POST /api/user/feed/upload-images`
**Rate Limit:** 100 per 5 minutes
**Authentication:** Required
**Content Type:** `multipart/form-data`

#### Image Requirements

- **Max file size:** 10MB per image
- **Max files:** 10 images per request
- **Allowed formats:** JPEG, PNG, WebP, GIF
- **Automatic optimization:** Images are converted to WebP format
- **Thumbnails:** Automatically generated

#### Request Body (multipart/form-data)

```javascript
const formData = new FormData();

// Add image files
images.forEach((file, index) => {
  formData.append('images', file);
  formData.append(`altText_${index}`, file.altText || '');
  formData.append(`displayOrder_${index}`, index);
});

const response = await fetch('http://localhost:3001/api/user/feed/upload-images', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`
    // Don't set Content-Type - browser will set it automatically with boundary
  },
  body: formData
});
```

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "images": [
      {
        "imageUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/feed-images/uuid1.webp",
        "thumbnailUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/feed-images/uuid1_thumb.webp",
        "altText": "Beautiful makeup",
        "displayOrder": 0
      },
      {
        "imageUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/feed-images/uuid2.webp",
        "thumbnailUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/feed-images/uuid2_thumb.webp",
        "altText": "Eye close-up",
        "displayOrder": 1
      }
    ]
  },
  "message": "Images uploaded successfully"
}
```

**Use these URLs in the `images` array when creating a post.**

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Upload failed",
  "message": "File upload error: File too large",
  "code": "LIMIT_FILE_SIZE"
}
```

#### Complete Example: Upload Images → Create Post

```javascript
async function createPostWithImages(content, imageFiles) {
  try {
    // Step 1: Upload images
    const formData = new FormData();
    imageFiles.forEach((file, index) => {
      formData.append('images', file);
      formData.append(`altText_${index}`, file.name);
      formData.append(`displayOrder_${index}`, index);
    });

    const uploadResponse = await fetch('http://localhost:3001/api/user/feed/upload-images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: formData
    });

    const uploadResult = await uploadResponse.json();
    if (!uploadResult.success) {
      throw new Error(uploadResult.message);
    }

    // Step 2: Create post with uploaded image URLs
    const createResponse = await fetch('http://localhost:3001/api/user/feed/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        images: uploadResult.data.images
      })
    });

    const createResult = await createResponse.json();
    if (!createResult.success) {
      throw new Error(createResult.message);
    }

    return createResult.data.post;
  } catch (error) {
    console.error('Failed to create post with images:', error);
    throw error;
  }
}
```

---

## Common Frontend Patterns

### 1. Infinite Scroll Feed

```javascript
class FeedLoader {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.currentPage = 1;
    this.hasMore = true;
    this.loading = false;
  }

  async loadMore() {
    if (!this.hasMore || this.loading) return [];

    this.loading = true;
    try {
      const response = await fetch(
        `${this.apiUrl}?page=${this.currentPage}&limit=20`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` }
        }
      );

      const result = await response.json();
      if (result.success) {
        this.currentPage++;
        this.hasMore = result.data.pagination.hasMore;
        return result.data.posts;
      }
      return [];
    } finally {
      this.loading = false;
    }
  }

  reset() {
    this.currentPage = 1;
    this.hasMore = true;
  }
}

// Usage
const feedLoader = new FeedLoader('http://localhost:3001/api/user/feed/posts', userToken);
const posts = await feedLoader.loadMore();
```

### 2. Optimistic UI Updates (Like Button)

```javascript
async function toggleLike(postId, currentlyLiked) {
  // Optimistic update
  updateUIImmediately(postId, !currentlyLiked);

  try {
    const endpoint = currentlyLiked
      ? `http://localhost:3001/api/user/feed/posts/${postId}/like`
      : `http://localhost:3001/api/user/feed/posts/${postId}/like`;

    const response = await fetch(endpoint, {
      method: currentlyLiked ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });

    const result = await response.json();
    if (!result.success) {
      // Revert optimistic update on error
      updateUIImmediately(postId, currentlyLiked);
      throw new Error(result.message);
    }

    // Update with actual server data
    updateUIWithServerData(postId, result.data);
  } catch (error) {
    console.error('Failed to toggle like:', error);
    showErrorNotification(error.message);
  }
}
```

### 3. Rate Limit Handling

```javascript
class RateLimitHandler {
  constructor() {
    this.limitedUntil = {};
  }

  isLimited(endpoint) {
    const until = this.limitedUntil[endpoint];
    if (!until) return false;

    if (Date.now() < until) {
      return true;
    }

    delete this.limitedUntil[endpoint];
    return false;
  }

  setLimited(endpoint, resetTime) {
    this.limitedUntil[endpoint] = resetTime * 1000;
  }

  async fetchWithRateLimit(url, options = {}) {
    if (this.isLimited(url)) {
      const waitMs = this.limitedUntil[url] - Date.now();
      throw new Error(`Rate limited. Please wait ${Math.ceil(waitMs / 60000)} minutes.`);
    }

    const response = await fetch(url, options);

    if (response.status === 429) {
      const resetTime = response.headers.get('RateLimit-Reset');
      if (resetTime) {
        this.setLimited(url, parseInt(resetTime));
      }
      throw new Error('Rate limit exceeded');
    }

    return response;
  }
}
```

### 4. Image Upload with Progress

```javascript
async function uploadImagesWithProgress(files, onProgress) {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append('images', file);
    formData.append(`altText_${index}`, file.name);
    formData.append(`displayOrder_${index}`, index);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        const result = JSON.parse(xhr.responseText);
        resolve(result.data.images);
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', 'http://localhost:3001/api/user/feed/upload-images');
    xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
    xhr.send(formData);
  });
}

// Usage
const images = await uploadImagesWithProgress(files, (progress) => {
  console.log(`Upload progress: ${progress.toFixed(0)}%`);
  updateProgressBar(progress);
});
```

---

## Testing the API

### Using cURL

```bash
# Get feed posts
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/user/feed/posts?page=1&limit=10"

# Create a post
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test post #beauty"}' \
  http://localhost:3001/api/user/feed/posts

# Like a post
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/user/feed/posts/POST_ID_HERE/like

# Upload images
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "altText_0=First image" \
  -F "altText_1=Second image" \
  http://localhost:3001/api/user/feed/upload-images
```

### Using Postman

1. **Set Authorization:**
   - Type: Bearer Token
   - Token: `<your_jwt_token>`

2. **For JSON requests:**
   - Headers: `Content-Type: application/json`
   - Body: Select "raw" and choose "JSON"

3. **For image uploads:**
   - Body: Select "form-data"
   - Add files with key "images"
   - Add text fields for `altText_0`, `displayOrder_0`, etc.

---

## Important Notes

1. **All URLs are normalized**: Image URLs from the API are guaranteed to be properly formatted and accessible.

2. **Rate limits are per user**: Each authenticated user has their own rate limit counters.

3. **Images are optimized**: Uploaded images are automatically converted to WebP format for optimal performance.

4. **Soft deletes**: Deleted posts/comments may still exist in the database but won't appear in API responses.

5. **Hashtags are extracted**: Hashtags starting with # in content are automatically extracted, but you can also specify them explicitly.

6. **Case sensitivity**: Hashtag and category filters are case-insensitive.

7. **Pagination**: Maximum `limit` is 50 items per page for performance reasons.

---

## Support

For issues or questions about the API:
- Check the Swagger documentation: `http://localhost:3001/api-docs`
- Review error messages carefully - they provide specific guidance
- Ensure JWT tokens are valid and not expired
- Verify rate limit headers to avoid hitting limits

**Last Updated:** 2025-10-25
