# CDN Integration Guide

## Overview

This guide covers the CDN (Content Delivery Network) integration with Supabase Storage for optimized image delivery. The CDN integration provides on-demand image transformations, caching, and performance optimizations.

## Features

### Core CDN Features
- **URL Generation**: Generate CDN URLs with transformation parameters
- **Image Transformations**: On-demand resizing, quality adjustment, format conversion
- **WebP Support**: Automatic WebP generation with fallback URLs
- **Responsive Images**: Generate srcset and sizes attributes for responsive images
- **Cache Optimization**: Configurable cache headers for optimal performance
- **Fallback Support**: Graceful fallback to Supabase Storage when CDN is unavailable

### Image Transformation Options
- **Dimensions**: Width, height with various fit modes (cover, contain, fill, inside, outside)
- **Quality**: Adjustable compression quality (1-100)
- **Format**: WebP, JPEG, PNG with automatic format selection
- **Effects**: Blur, sharpen, brightness, contrast, saturation, hue, gamma
- **Optimization**: Progressive loading, metadata stripping
- **Positioning**: Custom crop positions and background colors

## Configuration

### Environment Variables

```bash
# CDN Configuration
CDN_ENABLED=true
CDN_BASE_URL=https://your-cdn-domain.com
CDN_CACHE_MAX_AGE=31536000
CDN_CACHE_S_MAX_AGE=86400
CDN_STALE_WHILE_REVALIDATE=604800

# Image Transformation
CDN_IMAGE_TRANSFORMATION=true
CDN_IMAGE_QUALITY=85
CDN_IMAGE_FORMAT=auto
CDN_IMAGE_PROGRESSIVE=true

# On-Demand Resizing
CDN_ON_DEMAND_RESIZING=true
CDN_MAX_WIDTH=2048
CDN_MAX_HEIGHT=2048
CDN_RESIZE_QUALITY=80
```

### CDN Service Configuration

```typescript
const cdnConfig = {
  enabled: true,
  baseUrl: 'https://your-cdn-domain.com',
  fallbackUrl: 'https://your-supabase-url.com',
  cacheHeaders: {
    maxAge: 31536000,        // 1 year
    sMaxAge: 86400,          // 1 day
    staleWhileRevalidate: 604800  // 1 week
  },
  imageTransformation: {
    enabled: true,
    quality: 85,
    format: 'auto',
    progressive: true
  },
  onDemandResizing: {
    enabled: true,
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 80
  }
};
```

## API Endpoints

### 1. Get CDN Configuration
```http
GET /api/cdn/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config": { /* CDN configuration */ },
    "validation": {
      "valid": true,
      "errors": []
    }
  }
}
```

### 2. Generate CDN URL for Image
```http
GET /api/cdn/images/{imageId}/urls?width=800&height=600&quality=85&format=webp
Authorization: Bearer <token>
```

**Query Parameters:**
- `width` (optional): Desired width (1-4000)
- `height` (optional): Desired height (1-4000)
- `quality` (optional): Image quality (1-100)
- `format` (optional): Output format (webp, jpeg, png, auto)
- `fit` (optional): Resize mode (cover, contain, fill, inside, outside)
- `progressive` (optional): Use progressive JPEG (boolean)
- `stripMetadata` (optional): Remove EXIF data (boolean)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://supabase-url.com/storage/v1/object/public/shop-images/large/image.jpg",
    "cdnUrl": "https://cdn-url.com/shop-images/large/image.jpg?width=800&height=600&quality=85&format=webp",
    "transformations": {
      "width": 800,
      "height": 600,
      "quality": 85,
      "format": "webp"
    },
    "cacheHeaders": {
      "Cache-Control": "public, max-age=31536000, s-maxage=86400, stale-while-revalidate=604800",
      "Expires": "Wed, 21 Oct 2025 07:28:00 GMT"
    },
    "expiresAt": "2025-10-21T07:28:00.000Z"
  }
}
```

### 3. Get Optimized CDN URLs
```http
GET /api/cdn/images/{imageId}/optimized
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": { /* CDNResult for original size */ },
    "thumbnail": { /* CDNResult for thumbnail (300x300) */ },
    "medium": { /* CDNResult for medium (800x600) */ },
    "large": { /* CDNResult for large (1200x900) */ },
    "webp": {
      "original": { /* WebP CDNResult for original */ },
      "thumbnail": { /* WebP CDNResult for thumbnail */ },
      "medium": { /* WebP CDNResult for medium */ },
      "large": { /* WebP CDNResult for large */ }
    },
    "responsive": {
      "srcSet": "https://cdn-url.com/image-320w.webp 320w, https://cdn-url.com/image-640w.webp 640w, ...",
      "sizes": "(max-width: 320px) 100vw, (max-width: 640px) 640px, ...",
      "urls": {
        "320": { /* CDNResult for 320px */ },
        "640": { /* CDNResult for 640px */ }
      }
    }
  }
}
```

### 4. Generate Responsive Image URLs
```http
POST /api/cdn/images/{imageId}/responsive
Authorization: Bearer <token>
Content-Type: application/json

{
  "breakpoints": [320, 640, 768, 1024, 1280],
  "transformations": {
    "quality": 85,
    "format": "webp",
    "progressive": true
  }
}
```

### 5. Generate WebP URLs
```http
GET /api/cdn/images/{imageId}/webp?width=800&height=600&quality=90
Authorization: Bearer <token>
```

### 6. Transform Image URL
```http
POST /api/cdn/transform
Authorization: Bearer <token>
Content-Type: application/json

{
  "filePath": "large/image.jpg",
  "bucket": "shop-images",
  "transformations": {
    "width": 1200,
    "height": 800,
    "quality": 95,
    "format": "webp",
    "fit": "cover",
    "progressive": true,
    "stripMetadata": true
  },
  "options": {
    "cacheBust": true
  }
}
```

## Usage Examples

### Basic CDN URL Generation
```javascript
// Generate a simple CDN URL
const response = await fetch('/api/cdn/images/123e4567-e89b-12d3-a456-426614174000/urls', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();
console.log('CDN URL:', data.cdnUrl);
```

### Responsive Image Implementation
```javascript
// Get responsive URLs
const response = await fetch('/api/cdn/images/123e4567-e89b-12d3-a456-426614174000/optimized', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();

// Use in HTML
const img = document.createElement('img');
img.src = data.webp.medium.cdnUrl;
img.srcset = data.responsive.srcSet;
img.sizes = data.responsive.sizes;
img.alt = 'Shop image';
```

### Custom Transformations
```javascript
// Generate custom transformation
const params = new URLSearchParams({
  width: 800,
  height: 600,
  quality: 90,
  format: 'webp',
  fit: 'cover',
  progressive: 'true',
  stripMetadata: 'true'
});

const response = await fetch(`/api/cdn/images/123e4567-e89b-12d3-a456-426614174000/urls?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Integration with Image Service

The CDN service is automatically integrated with the Image Service:

```typescript
// When uploading images, CDN URLs are automatically generated
const uploadResult = await imageService.uploadShopImage(file, shopId, mimeType);

// CDN URLs are included in the result
console.log('CDN URLs:', uploadResult.cdnUrls);
console.log('WebP URLs:', uploadResult.cdnUrls.webp);
console.log('Responsive URLs:', uploadResult.cdnUrls.responsive);
```

## Performance Optimization

### Cache Headers
The CDN integration uses optimized cache headers:
- **max-age**: 1 year for static images
- **s-maxage**: 1 day for shared caches
- **stale-while-revalidate**: 1 week for background updates

### Image Optimization
- **WebP Conversion**: Automatic WebP generation with JPEG fallback
- **Progressive Loading**: Progressive JPEG for better perceived performance
- **Metadata Stripping**: Remove EXIF data to reduce file size
- **Quality Optimization**: Intelligent quality settings based on image size

### Responsive Images
- **Multiple Sizes**: Generate thumbnails, medium, and large variants
- **Breakpoint Optimization**: Custom breakpoints for different screen sizes
- **Format Selection**: WebP for modern browsers, JPEG for older browsers

## Error Handling

### Common Error Scenarios
1. **CDN Unavailable**: Falls back to Supabase Storage URLs
2. **Invalid Image ID**: Returns 404 with proper error message
3. **Invalid Parameters**: Returns 400 with validation errors
4. **Rate Limiting**: Returns 429 with retry information

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "CDN_UNAVAILABLE",
    "message": "CDN service is currently unavailable",
    "details": "Falling back to Supabase Storage URLs"
  }
}
```

## Monitoring and Analytics

### CDN Metrics
- **Hit Rate**: Percentage of requests served from CDN
- **Latency**: Average response time for CDN requests
- **Error Rate**: Percentage of failed CDN requests
- **Cache Performance**: Cache hit/miss ratios

### Logging
All CDN operations are logged with:
- Request details (image ID, transformations)
- Performance metrics (response time, cache status)
- Error information (if any)
- User context (IP, user agent)

## Security Considerations

### Access Control
- **Authentication Required**: All CDN endpoints require valid JWT tokens
- **Shop Ownership**: Users can only access images from their own shops
- **Rate Limiting**: Prevents abuse with configurable rate limits

### Input Validation
- **Parameter Validation**: All transformation parameters are validated
- **Size Limits**: Maximum dimensions and file sizes are enforced
- **Format Restrictions**: Only allowed image formats are processed

### Content Security
- **URL Signing**: CDN URLs can be signed for additional security
- **Referrer Restrictions**: CDN can be configured to check referrer headers
- **HTTPS Only**: All CDN URLs use HTTPS for secure delivery

## Troubleshooting

### Common Issues

1. **CDN URLs Not Working**
   - Check CDN configuration in environment variables
   - Verify CDN_BASE_URL is correctly set
   - Ensure CDN service is accessible

2. **Images Not Loading**
   - Check if image exists in Supabase Storage
   - Verify image ID is correct
   - Check network connectivity to CDN

3. **Transformations Not Applied**
   - Verify transformation parameters are valid
   - Check if image transformation is enabled
   - Ensure parameters are within allowed ranges

4. **Performance Issues**
   - Check CDN cache hit rates
   - Verify cache headers are properly set
   - Consider adjusting cache TTL values

### Debug Mode
Enable debug logging by setting:
```bash
TASKMASTER_LOG_LEVEL=debug
```

This will provide detailed information about CDN operations, including:
- URL generation process
- Transformation parameters
- Cache header generation
- Fallback behavior

## Best Practices

### Image Optimization
1. **Use WebP Format**: Enable WebP for better compression
2. **Progressive Loading**: Use progressive JPEG for large images
3. **Strip Metadata**: Remove EXIF data to reduce file size
4. **Quality Settings**: Use appropriate quality based on image size

### Caching Strategy
1. **Long Cache Times**: Use long cache times for static images
2. **Versioning**: Use cache busting for updated images
3. **CDN Headers**: Set appropriate cache headers
4. **Fallback Strategy**: Always have Supabase Storage as fallback

### Performance
1. **Responsive Images**: Use srcset for different screen sizes
2. **Lazy Loading**: Implement lazy loading for better performance
3. **Preloading**: Preload critical images
4. **Monitoring**: Monitor CDN performance and adjust as needed

## Migration Guide

### From Direct Supabase URLs
1. Update image URL generation to use CDN service
2. Replace direct Supabase URLs with CDN URLs
3. Update image upload process to generate CDN URLs
4. Test fallback behavior when CDN is unavailable

### Configuration Updates
1. Add CDN environment variables
2. Update image service to use CDN service
3. Configure CDN endpoints in your application
4. Test CDN functionality with existing images

## Support

For issues related to CDN integration:
1. Check the troubleshooting section above
2. Review CDN service logs
3. Verify configuration settings
4. Test with different image types and sizes

For additional support, refer to the main project documentation or contact the development team.

