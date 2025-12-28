# Feed System Setup Guide

## Overview
Complete setup guide for the Social Feed system in the eBeautything backend. This document covers database schema verification, API endpoints, and integration guidelines.

---

## Quick Start

### 1. Verify Database Schema

Run the schema verification script in Supabase SQL Editor:

```bash
# File location
sql/ensure_feed_schema.sql
```

This script will:
- ✅ Create all required feed tables if they don't exist
- ✅ Set up indexes for optimal performance
- ✅ Enable Row Level Security (RLS)
- ✅ Configure RLS policies
- ✅ Verify the setup is complete

**Expected Output:**
```sql
✓ Feed schema verification complete!
✓ Tables: feed_posts, post_images, post_likes, post_comments, comment_likes
✓ Indexes created for optimal performance
✓ Row Level Security (RLS) enabled
✓ RLS policies configured
```

---

## Database Schema

### Tables Created

1. **feed_posts** - Main feed post table
   - Stores post content, metadata, and engagement metrics
   - Author reference to users table
   - Optional shop tagging
   - Hashtag support via TEXT[]

2. **post_images** - Post images with metadata
   - Multiple images per post (max 10)
   - Display order control
   - Accessibility alt text

3. **post_likes** - Post like tracking
   - Prevents duplicate likes (UNIQUE constraint)
   - User and post references

4. **post_comments** - Comments on posts
   - Supports nested comments (parent_comment_id)
   - Comment moderation status

5. **comment_likes** - Comment like tracking
   - Prevents duplicate likes
   - Engagement metrics

### ENUM Types

```sql
-- Post status
post_status: 'active', 'hidden', 'reported', 'deleted'

-- Comment status
comment_status: 'active', 'hidden', 'deleted'

-- Service category (for categorization)
service_category: 'nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'
```

### Key Indexes

Performance-optimized indexes for:
- Author lookups
- Timeline queries
- Location-based search
- Category filtering
- Engagement metrics

---

## API Endpoints Summary

### For Shop Owners (Admin Dashboard)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/feed/posts` | Create new post |
| GET | `/api/feed/posts` | List posts (filterable) |
| GET | `/api/feed/posts/:id` | Get single post |
| PUT | `/api/feed/posts/:id` | Update post |
| DELETE | `/api/feed/posts/:id` | Delete post |
| POST | `/api/feed/upload-images` | Upload images |
| GET | `/api/feed/posts/:id/comments` | Get comments |
| POST | `/api/feed/posts/:id/report` | Report post |

**Detailed Documentation:** See `docs/SHOP_ADMIN_FEED_API.md`

### For Users (Mobile App)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/feed/posts` | Browse feed |
| POST | `/api/feed/posts/:id/like` | Like/unlike post |
| POST | `/api/feed/posts/:id/comments` | Add comment |
| POST | `/api/feed/personalized` | Get personalized feed |
| GET | `/api/feed/trending` | Get trending posts |

---

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**feed_posts:**
- ✅ Public can read active posts
- ✅ Users can manage their own posts
- ✅ Admins can manage all posts

**post_images:**
- ✅ Post owners can manage images
- ✅ Public can view images of active posts

**post_likes:**
- ✅ Users can like active posts
- ✅ Users can unlike their own likes

**post_comments:**
- ✅ Users can comment on active posts
- ✅ Users can manage their own comments
- ✅ Public can read active comments
- ✅ Admins can moderate all comments

### Rate Limiting

| Operation | Limit | Window |
|-----------|-------|--------|
| Create post | 5 posts | 1 hour |
| Upload images | 100 uploads | 5 minutes |
| Like/comment | 100 interactions | 5 minutes |
| Browse feed | 200 requests | 15 minutes |

### Input Validation

- Content: Max 2000 characters
- Hashtags: Max 10, each max 50 characters
- Images: Max 10, 8MB each, JPEG/PNG/WebP only
- Location tag: Max 100 characters

---

## File Storage

### Supabase Storage Buckets

Images are stored in Supabase Storage with automatic optimization:

**Bucket:** `feed-posts`

**Directory Structure:**
```
feed-posts/
├── thumbnails/
│   └── {userId}/
│       └── {timestamp}-{uuid}.webp
├── medium/
│   └── {userId}/
│       └── {timestamp}-{uuid}.webp
└── large/
    └── {userId}/
        └── {timestamp}-{uuid}.webp
```

**Image Processing:**
- Automatic WebP conversion
- Multiple sizes generated (thumbnail, medium, large)
- Optimization for bandwidth reduction
- Alt text for accessibility

---

## Integration Checklist

### Backend Setup
- [ ] Run `sql/ensure_feed_schema.sql` in Supabase
- [ ] Verify all tables created successfully
- [ ] Check RLS policies are enabled
- [ ] Test feed endpoints with Postman/curl
- [ ] Review API documentation at `/api-docs`

### Shop Admin Dashboard
- [ ] Read `docs/SHOP_ADMIN_FEED_API.md`
- [ ] Implement post creation UI
- [ ] Implement image upload flow
- [ ] Add post management (edit/delete)
- [ ] Display engagement metrics
- [ ] Handle rate limits gracefully
- [ ] Implement error handling

### Mobile App Integration
- [ ] Implement feed browsing
- [ ] Add like/unlike functionality
- [ ] Enable comment system
- [ ] Show post details view
- [ ] Implement image galleries
- [ ] Add pull-to-refresh
- [ ] Handle offline mode

---

## Testing

### Test the Schema

```sql
-- Check if all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'feed_posts', 'post_images', 'post_likes',
    'post_comments', 'comment_likes'
);

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%feed%' OR tablename LIKE '%post%';

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND (tablename LIKE '%feed%' OR tablename LIKE '%post%');
```

### Test API Endpoints

```bash
# Test post creation (requires JWT token)
curl -X POST http://localhost:3001/api/feed/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test post from shop",
    "category": "nail",
    "hashtags": ["test", "nails"]
  }'

# Test get posts
curl http://localhost:3001/api/feed/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test image upload
curl -X POST http://localhost:3001/api/feed/upload-images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image.jpg" \
  -F "altText_0=Test image"
```

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Post Performance**
   - Like count
   - Comment count
   - View count
   - Engagement rate = (likes + comments) / views

2. **User Engagement**
   - Daily active users
   - Posts per user
   - Average engagement per post
   - Peak activity times

3. **Shop Performance**
   - Posts created per shop
   - Average engagement per shop
   - Top performing shops
   - Post frequency

### Database Queries for Analytics

```sql
-- Top performing posts
SELECT
  fp.id,
  fp.content,
  fp.like_count,
  fp.comment_count,
  fp.view_count,
  (fp.like_count + fp.comment_count)::float / NULLIF(fp.view_count, 0) as engagement_rate
FROM feed_posts fp
WHERE fp.status = 'active'
ORDER BY engagement_rate DESC
LIMIT 10;

-- Posts by shop
SELECT
  s.name as shop_name,
  COUNT(fp.id) as post_count,
  AVG(fp.like_count) as avg_likes,
  AVG(fp.comment_count) as avg_comments
FROM feed_posts fp
JOIN users u ON fp.author_id = u.id
JOIN shops s ON fp.tagged_shop_id = s.id
WHERE fp.status = 'active'
GROUP BY s.name
ORDER BY post_count DESC;

-- Daily post activity
SELECT
  DATE(created_at) as date,
  COUNT(*) as posts_created,
  SUM(like_count) as total_likes,
  SUM(comment_count) as total_comments
FROM feed_posts
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Troubleshooting

### Common Issues

**1. RLS Policy Errors**
```
Error: new row violates row-level security policy
```
**Solution:** Ensure JWT token is valid and user has proper permissions

**2. Rate Limit Exceeded**
```
429 Too Many Requests
```
**Solution:** Implement exponential backoff, check rate limit headers

**3. Image Upload Fails**
```
413 Payload Too Large
```
**Solution:** Compress images before upload, stay under 8MB limit

**4. Post Not Appearing**
```
Post created but not visible
```
**Solution:** Check post status is 'active', verify RLS policies

### Debug Mode

Enable detailed logging in development:

```javascript
// In .env file
LOG_LEVEL=debug
FEED_DEBUG=true
```

View logs in `logs/combined.log` and `logs/error.log`

---

## Performance Optimization

### Caching Strategy

**Recommended caching for production:**

1. **Feed Timeline**
   - Cache: 5 minutes
   - Invalidate on: New post creation

2. **Post Details**
   - Cache: 10 minutes
   - Invalidate on: Post update/delete

3. **Engagement Metrics**
   - Cache: 1 minute
   - Real-time for critical actions

### Database Optimization

- Use covering indexes for common queries
- Implement pagination (LIMIT/OFFSET)
- Consider materialized views for analytics
- Regular VACUUM ANALYZE on tables

---

## Migration Path

### From v1.0 to Future Versions

When schema updates are needed:

1. Create migration file in `supabase/migrations/`
2. Test migration on staging database
3. Backup production database
4. Apply migration during low-traffic window
5. Verify data integrity
6. Update API documentation

---

## Related Documentation

- [Shop Admin Feed API Guide](./SHOP_ADMIN_FEED_API.md) - Complete API reference for shop owners
- [API Documentation](http://localhost:3001/api-docs) - Interactive API docs (Swagger)
- [Backend README](../CLAUDE.md) - Main backend documentation
- [PRD Phase 6](./prds/phase-6-social-feed-system.md) - Social feed system requirements

---

## Support & Resources

### Development
- **Local API Docs:** http://localhost:3001/api-docs
- **Supabase Dashboard:** https://app.supabase.com

### Contact
- **Technical Issues:** dev@ebeautything.com
- **Documentation Updates:** Update this file in `docs/`

---

## Version History

### v1.0.0 (2025-01-15)
- Initial feed system implementation
- Complete CRUD operations for posts
- Image upload with optimization
- RLS policies and security features
- Rate limiting and validation
- Admin dashboard API documentation
