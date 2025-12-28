# Shop Admin Feed API Documentation

## Overview
This document provides detailed implementation guidance for integrating the Social Feed API into the Shop Admin dashboard. Shop owners can create, manage, and monitor feed posts to promote their services and engage with customers.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Feed Post Management](#feed-post-management)
3. [Image Upload](#image-upload)
4. [Post Interactions](#post-interactions)
5. [Error Handling](#error-handling)
6. [Rate Limits](#rate-limits)
7. [Best Practices](#best-practices)

---

## Authentication

All API requests require JWT authentication.

### Headers Required
```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

### Getting JWT Token
The JWT token is obtained during shop owner login and should be stored securely in the admin dashboard session.

---

## Feed Post Management

### 1. Create Feed Post

**Endpoint:** `POST /api/feed/posts`

**Purpose:** Create a new promotional post for the shop to showcase services, special offers, or before/after transformations.

**Rate Limit:** 5 posts per hour per shop owner

**Request Body:**
```json
{
  "content": "Amazing nail transformation! ✨ Book your appointment today! 💅",
  "category": "nail",
  "location_tag": "강남구, 서울",
  "tagged_shop_id": "YOUR_SHOP_UUID",
  "hashtags": ["nails", "beauty", "gangnam", "nailart", "transformation"],
  "images": [
    {
      "image_url": "https://storage.supabase.co/v1/object/public/feed-posts/medium/...",
      "alt_text": "Before and after nail art transformation",
      "display_order": 1
    },
    {
      "image_url": "https://storage.supabase.co/v1/object/public/feed-posts/medium/...",
      "alt_text": "Close-up of nail design details",
      "display_order": 2
    }
  ]
}
```

**Field Descriptions:**
- `content` (required): Post text content, max 2000 characters
- `category` (optional): Service category - one of: `nail`, `eyelash`, `waxing`, `eyebrow_tattoo`
- `location_tag` (optional): Location description, max 100 characters
- `tagged_shop_id` (optional): UUID of your shop
- `hashtags` (optional): Array of hashtags (max 10), each max 50 characters, without # symbol
- `images` (optional): Array of image objects (max 10), must be uploaded first using `/api/feed/upload-images`

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "id": "post-uuid-here",
    "author_id": "shop-owner-uuid",
    "content": "Amazing nail transformation! ✨...",
    "category": "nail",
    "location_tag": "강남구, 서울",
    "tagged_shop_id": "shop-uuid",
    "hashtags": ["nails", "beauty", "gangnam"],
    "status": "active",
    "like_count": 0,
    "comment_count": 0,
    "view_count": 0,
    "is_featured": false,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

**Error Responses:**
```json
// 400 - Validation Error
{
  "error": "Validation failed",
  "details": ["Content exceeds maximum length of 2000 characters"]
}

// 401 - Unauthorized
{
  "error": "Authentication required"
}

// 429 - Rate Limit Exceeded
{
  "error": "Rate limit exceeded. Maximum 5 posts per hour allowed."
}
```

**Implementation Example (JavaScript/React):**
```javascript
async function createShopPost(postData) {
  try {
    const response = await fetch('http://localhost:3001/api/feed/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getJWTToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create post');
    }

    const result = await response.json();
    console.log('Post created:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

// Usage
const newPost = await createShopPost({
  content: "Special promotion this week! 30% off all nail services 💅",
  category: "nail",
  tagged_shop_id: "your-shop-uuid",
  hashtags: ["promotion", "nails", "discount"],
  images: uploadedImages // From upload-images endpoint
});
```

---

### 2. Update Feed Post

**Endpoint:** `PUT /api/feed/posts/:postId`

**Purpose:** Edit an existing post to update content, hashtags, or images.

**Authorization:** Only the post author (shop owner) can update their posts.

**Request Body:**
```json
{
  "content": "Updated: Amazing nail transformation! Now with 20% discount! ✨💅",
  "hashtags": ["nails", "beauty", "gangnam", "nailart", "discount"],
  "location_tag": "강남구, 서울",
  "images": [
    {
      "image_url": "https://storage.supabase.co/...",
      "alt_text": "Updated nail design",
      "display_order": 1
    }
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Post updated successfully",
  "data": {
    "id": "post-uuid",
    "content": "Updated: Amazing nail transformation!...",
    "updated_at": "2025-01-15T14:30:00Z",
    // ... other fields
  }
}
```

**Implementation Example:**
```javascript
async function updateShopPost(postId, updates) {
  const response = await fetch(`http://localhost:3001/api/feed/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update post');
  }

  return await response.json();
}
```

---

### 3. Delete Feed Post

**Endpoint:** `DELETE /api/feed/posts/:postId`

**Purpose:** Remove a post from the feed (soft delete).

**Authorization:** Only the post author or admin can delete posts.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

**Implementation Example:**
```javascript
async function deleteShopPost(postId) {
  const confirmed = confirm('Are you sure you want to delete this post?');
  if (!confirmed) return;

  const response = await fetch(`http://localhost:3001/api/feed/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete post');
  }

  return await response.json();
}
```

---

### 4. Get Shop's Posts

**Endpoint:** `GET /api/feed/posts`

**Purpose:** Retrieve all posts created by the shop for management dashboard.

**Query Parameters:**
```
?author_id=YOUR_SHOP_OWNER_UUID
&page=1
&limit=20
&category=nail
```

**Parameters:**
- `author_id` (optional): Filter by author UUID (use your shop owner ID)
- `page` (optional): Page number, default 1
- `limit` (optional): Posts per page, default 20, max 50
- `category` (optional): Filter by service category
- `hashtag` (optional): Filter by hashtag
- `location` (optional): Filter by location

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-uuid",
        "author_id": "shop-owner-uuid",
        "content": "Amazing transformation...",
        "category": "nail",
        "hashtags": ["nails", "beauty"],
        "like_count": 45,
        "comment_count": 12,
        "view_count": 234,
        "created_at": "2025-01-15T10:30:00Z",
        "images": [
          {
            "id": "image-uuid",
            "image_url": "https://storage...",
            "alt_text": "Before and after",
            "display_order": 1
          }
        ],
        "author": {
          "id": "shop-owner-uuid",
          "name": "Kim's Nail Salon",
          "profile_image_url": "https://...",
          "is_influencer": false
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    },
    "hasMore": true
  }
}
```

**Implementation Example:**
```javascript
async function getShopPosts(shopOwnerId, page = 1) {
  const params = new URLSearchParams({
    author_id: shopOwnerId,
    page: page.toString(),
    limit: '20'
  });

  const response = await fetch(
    `http://localhost:3001/api/feed/posts?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${getJWTToken()}`
      }
    }
  );

  return await response.json();
}
```

---

### 5. Get Single Post Details

**Endpoint:** `GET /api/feed/posts/:postId`

**Purpose:** Get detailed information about a specific post.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "post-uuid",
    "content": "Amazing transformation...",
    "like_count": 45,
    "comment_count": 12,
    "images": [...],
    "author": {...},
    "tagged_shop": {
      "id": "shop-uuid",
      "name": "Kim's Nail Salon",
      "address": "123 Gangnam St"
    }
  }
}
```

---

## Image Upload

### Upload Images for Posts

**Endpoint:** `POST /api/feed/upload-images`

**Purpose:** Upload images before creating or updating a post. Images are automatically optimized and resized.

**Content-Type:** `multipart/form-data`

**Rate Limit:** 100 uploads per 5 minutes

**Request (Multipart Form Data):**
```javascript
const formData = new FormData();

// Add image files (max 10 images, 8MB each)
formData.append('images', file1); // File from input
formData.append('images', file2);

// Optional: Add alt text for accessibility
formData.append('altText_0', 'Before nail transformation');
formData.append('altText_1', 'After nail transformation');

// Optional: Add display order
formData.append('displayOrder_0', '1');
formData.append('displayOrder_1', '2');
```

**Accepted Formats:** JPEG, JPG, PNG, WebP
**Max File Size:** 8MB per image
**Max Images:** 10 per upload

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Images uploaded successfully",
  "data": {
    "images": [
      {
        "imageUrl": "https://storage.supabase.co/v1/object/public/feed-posts/medium/user123/...",
        "thumbnailUrl": "https://storage.supabase.co/v1/object/public/feed-posts/thumbnails/user123/...",
        "altText": "Before nail transformation",
        "displayOrder": 1,
        "metadata": {
          "originalSize": 2048576,
          "optimizedSize": 512000,
          "width": 800,
          "height": 600,
          "format": "webp"
        }
      },
      {
        "imageUrl": "https://storage.supabase.co/...",
        "thumbnailUrl": "https://storage.supabase.co/...",
        "altText": "After nail transformation",
        "displayOrder": 2,
        "metadata": {...}
      }
    ]
  }
}
```

**Implementation Example:**
```javascript
async function uploadPostImages(files) {
  const formData = new FormData();

  files.forEach((file, index) => {
    formData.append('images', file);
    formData.append(`altText_${index}`, file.altText || '');
    formData.append(`displayOrder_${index}`, (index + 1).toString());
  });

  const response = await fetch('http://localhost:3001/api/feed/upload-images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`
      // Note: Don't set Content-Type for FormData, browser sets it automatically
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload images');
  }

  const result = await response.json();
  return result.data.images;
}

// Usage with file input
const fileInput = document.getElementById('imageUpload');
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  const uploadedImages = await uploadPostImages(files);

  // Use these URLs when creating the post
  console.log('Uploaded images:', uploadedImages);
});
```

**Complete Post Creation Flow:**
```javascript
async function createPostWithImages(content, imageFiles) {
  try {
    // Step 1: Upload images first
    const uploadedImages = await uploadPostImages(imageFiles);

    // Step 2: Create post with uploaded image URLs
    const post = await createShopPost({
      content: content,
      category: "nail",
      tagged_shop_id: "your-shop-uuid",
      hashtags: ["nails", "beauty"],
      images: uploadedImages.map(img => ({
        image_url: img.imageUrl,
        alt_text: img.altText,
        display_order: img.displayOrder
      }))
    });

    return post;
  } catch (error) {
    console.error('Error in post creation flow:', error);
    throw error;
  }
}
```

---

## Post Interactions

### Get Comments on Post

**Endpoint:** `GET /api/feed/posts/:postId/comments`

**Purpose:** View customer comments on your posts.

**Query Parameters:**
```
?page=1&limit=20
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment-uuid",
        "post_id": "post-uuid",
        "user_id": "user-uuid",
        "content": "Love this design! 💅",
        "like_count": 5,
        "created_at": "2025-01-15T11:00:00Z",
        "author": {
          "id": "user-uuid",
          "name": "Jane Doe",
          "profile_image_url": "https://..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    },
    "hasMore": false
  }
}
```

---

### Report a Post

**Endpoint:** `POST /api/feed/posts/:postId/report`

**Purpose:** Report inappropriate content (if needed for moderation).

**Request Body:**
```json
{
  "reason": "spam",
  "description": "This post contains spam content"
}
```

**Valid Reasons:**
- `spam`
- `harassment`
- `inappropriate_content`
- `fake_information`
- `violence`
- `hate_speech`
- `copyright_violation`
- `impersonation`
- `scam`
- `adult_content`
- `other`

---

## Error Handling

### Common Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid input data or validation failed |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Not authorized to perform this action |
| 404 | Not Found | Post does not exist |
| 413 | Payload Too Large | File size exceeds 8MB limit |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error, contact support |

### Error Response Format
```json
{
  "error": "Error message",
  "details": ["Detailed error 1", "Detailed error 2"]
}
```

### Error Handling Best Practices
```javascript
async function handleApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      switch (status) {
        case 400:
          showValidationError(data.details || data.error);
          break;
        case 401:
          redirectToLogin();
          break;
        case 429:
          showRateLimitError('Too many requests. Please try again later.');
          break;
        default:
          showGenericError(data.error || 'An error occurred');
      }
    } else {
      // Network or other error
      showGenericError('Network error. Please check your connection.');
    }
  }
}
```

---

## Rate Limits

### Rate Limit Details

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /posts | 5 posts | Per hour |
| POST /upload-images | 100 uploads | Per 5 minutes |
| POST /posts/:id/like | 100 interactions | Per 5 minutes |
| POST /posts/:id/comments | 100 interactions | Per 5 minutes |
| GET /posts | 200 requests | Per 15 minutes |

### Rate Limit Headers

Check these response headers to monitor rate limits:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1642251600
```

### Handling Rate Limits
```javascript
function checkRateLimit(response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (remaining && parseInt(remaining) < 2) {
    const resetTime = new Date(parseInt(reset) * 1000);
    showWarning(`Rate limit warning: ${remaining} requests remaining until ${resetTime}`);
  }
}
```

---

## Best Practices

### 1. Content Strategy

**Recommended Post Types:**
- ✅ Before/after transformations
- ✅ New service announcements
- ✅ Special promotions and discounts
- ✅ Customer testimonials (with permission)
- ✅ Behind-the-scenes content
- ✅ Seasonal trends and tips

**Content Tips:**
- Keep content engaging and visually appealing
- Use relevant hashtags (3-7 hashtags optimal)
- Tag your shop for better discoverability
- Post during peak hours (10 AM - 2 PM, 6 PM - 9 PM)
- Maintain consistent posting schedule (2-3 times per week)

### 2. Image Guidelines

**Best Practices:**
- Use high-quality images (min 800x600px)
- Ensure good lighting and clear focus
- Show actual service results
- Include variety (close-ups, full shots, process)
- Compress images before upload to stay under 8MB
- Use descriptive alt text for accessibility

**Image Specifications:**
- Format: JPEG, PNG, or WebP
- Max size: 8MB per image
- Max images per post: 10
- Recommended resolution: 1080x1080px or 1200x800px

### 3. Hashtag Strategy

**Effective Hashtag Use:**
```javascript
const hashtagStrategy = {
  // Location-based (2-3 tags)
  location: ['gangnam', 'seoul', 'koreabeauty'],

  // Service-based (2-3 tags)
  service: ['nails', 'nailart', 'gelnails'],

  // Trending/popular (1-2 tags)
  trending: ['beauty', 'kbeauty', 'transformation'],

  // Brand-specific (1 tag)
  brand: ['yoursalonname']
};

// Combine strategically
const hashtags = [
  ...hashtagStrategy.location,
  ...hashtagStrategy.service,
  ...hashtagStrategy.trending,
  ...hashtagStrategy.brand
].slice(0, 10); // Max 10 hashtags
```

### 4. Performance Monitoring

**Track Key Metrics:**
```javascript
function analyzePostPerformance(post) {
  const metrics = {
    engagement_rate: (post.like_count + post.comment_count) / post.view_count,
    likes_per_view: post.like_count / post.view_count,
    comments_per_view: post.comment_count / post.view_count,
    age_hours: (Date.now() - new Date(post.created_at)) / (1000 * 60 * 60)
  };

  console.log('Post Performance:', metrics);

  if (metrics.engagement_rate > 0.05) {
    console.log('✓ High engagement post!');
  }

  return metrics;
}
```

### 5. Error Recovery

**Implement Retry Logic:**
```javascript
async function apiCallWithRetry(apiFunction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiFunction();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        // Rate limit hit, wait and retry
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}
```

### 6. Admin Dashboard UI Components

**Sample React Component for Post Management:**
```jsx
import React, { useState, useEffect } from 'react';

function ShopPostManager({ shopOwnerId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadPosts();
  }, [page]);

  async function loadPosts() {
    setLoading(true);
    try {
      const result = await getShopPosts(shopOwnerId, page);
      setPosts(result.data.posts);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(postId) {
    if (!confirm('Delete this post?')) return;

    try {
      await deleteShopPost(postId);
      loadPosts(); // Reload list
    } catch (error) {
      alert('Failed to delete post');
    }
  }

  return (
    <div className="post-manager">
      <h2>My Feed Posts</h2>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="posts-grid">
          {posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-images">
                {post.images?.[0] && (
                  <img src={post.images[0].image_url} alt={post.images[0].alt_text} />
                )}
              </div>
              <div className="post-content">
                <p>{post.content}</p>
                <div className="post-stats">
                  <span>❤️ {post.like_count}</span>
                  <span>💬 {post.comment_count}</span>
                  <span>👁️ {post.view_count}</span>
                </div>
                <div className="post-actions">
                  <button onClick={() => handleEdit(post.id)}>Edit</button>
                  <button onClick={() => handleDelete(post.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## API Base URL

**Development:** `http://localhost:3001`
**Production:** `https://api.ebeautything.com` (Update when deployed)

---

## Support

For technical support or API issues:
- Email: dev@ebeautything.com
- Documentation: http://localhost:3001/api-docs

---

## Changelog

### v1.0.0 (2025-01-15)
- Initial release
- Feed post CRUD operations
- Image upload with optimization
- Post interactions (likes, comments)
- Rate limiting and security features
