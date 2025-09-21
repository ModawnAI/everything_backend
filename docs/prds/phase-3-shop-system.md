# PRD: Phase 3 - Shop Management & Discovery System

## 📋 Overview
**Phase**: 3 of 6  
**Duration**: 2-3 weeks  
**Priority**: High  
**Dependencies**: Phase 1 (Foundation), Phase 2 (User Management)  

This phase implements the shop discovery system, shop management features, and location-based services that form the core of the beauty service marketplace.

## 🎯 Objectives

### Primary Goals
1. Build location-based shop discovery with PostGIS optimization
2. Implement shop registration and approval workflow
3. Create shop profile management for shop owners
4. Build shop search and filtering system
5. Implement shop contact and messaging features (v3.2)

### Success Criteria
- [ ] Users can find shops within specified radius with proper sorting
- [ ] Shop owners can register and manage their shop profiles
- [ ] Admin approval workflow for new shops is functional
- [ ] Shop search with filters works efficiently
- [ ] Shop contact integration (KakaoTalk channels) operational

## 🔗 API Endpoints to Implement

### 1. Shop Discovery APIs
```
GET /api/shops/nearby
GET /api/shops/search
GET /api/shops/categories
GET /api/shops/:shopId
POST /api/shops/:shopId/favorite
DELETE /api/shops/:shopId/favorite
GET /api/user/favorites
```

### 2. Shop Management APIs (Shop Owner)
```
POST /api/shop/register
GET /api/shop/profile
PUT /api/shop/profile
POST /api/shop/services
PUT /api/shop/services/:serviceId
DELETE /api/shop/services/:serviceId
POST /api/shop/images
DELETE /api/shop/images/:imageId
```

### 3. Shop Contact APIs (v3.2)
```
GET /api/shops/:shopId/contact-info
PUT /api/shop/contact-methods
POST /api/shops/:shopId/report
```

### 4. Admin Shop Management APIs
```
GET /api/admin/shops/pending
PUT /api/admin/shops/:shopId/approve
GET /api/admin/shops
PUT /api/admin/shops/:shopId/status
GET /api/admin/shops/:shopId/analytics
```

## 🗺️ Location-Based Features

### PostGIS Implementation
- **Spatial Indexes**: Optimized for radius-based queries
- **Distance Calculation**: Accurate geographic distance
- **Geofencing**: Seoul city boundary validation
- **Performance**: Sub-100ms response for nearby shops

### Shop Sorting Algorithm (PRD 2.1)
```sql
ORDER BY 
  CASE WHEN s.shop_type = 'partnered' THEN 0 ELSE 1 END,  -- 입점샵 우선
  s.partnership_started_at DESC,                           -- 최신 입점순
  distance ASC                                             -- 거리순
```

## 🏪 Shop Registration Workflow

### Shop Owner Registration Process
1. **Basic Information**: Name, address, phone, email
2. **Business Verification**: License number, document upload
3. **Service Setup**: Categories, services, pricing
4. **Image Upload**: Shop photos, service images
5. **Contact Methods**: KakaoTalk channel, social media
6. **Admin Review**: Verification and approval process

### Approval Workflow
```
pending_approval → (admin review) → verified/rejected
verified → active (shop goes live)
rejected → inactive (with feedback)
```

## 📊 Business Logic Requirements

### Shop Discovery Logic
- **Location Filtering**: Within specified radius (default 10km)
- **Category Filtering**: By service type (nail, eyelash, etc.)
- **Status Filtering**: Only active, verified shops
- **Availability Filtering**: Shops accepting reservations

### Shop Profile Management
- **Image Management**: Multiple images per shop with ordering
- **Service Catalog**: Flexible pricing (min/max), duration
- **Operating Hours**: JSON-based weekly schedule
- **Contact Integration**: Multiple contact methods support

### Admin Approval System
- **Document Verification**: Business license validation
- **Manual Review**: Admin approval with notes
- **Automated Checks**: Basic information completeness
- **Notification System**: Status updates to shop owners

## 🔐 Security & Validation

### Input Validation
- **Business License**: Korean format validation with checksum
- **Address**: Korean address format validation
- **Phone Numbers**: Korean mobile/landline format
- **Image Uploads**: File type, size, and security validation

### Authorization Rules
- **Shop Owners**: Can only manage their own shops
- **Admins**: Can manage all shops with audit logging
- **Users**: Can view active shops and add to favorites

### Data Protection
- **Sensitive Data**: Business documents stored securely
- **Privacy**: Contact information access controls
- **Audit Trail**: All admin actions logged

## 🧪 Testing Requirements

### Unit Tests
- [ ] Location-based search algorithms
- [ ] Shop registration validation logic
- [ ] Image upload and processing
- [ ] Contact method validation
- [ ] Admin approval workflows

### Integration Tests
- [ ] Complete shop registration flow
- [ ] Shop discovery with various filters
- [ ] Image upload to Supabase Storage
- [ ] Admin approval process
- [ ] Shop owner profile management

### Performance Tests
- [ ] Location queries with large datasets
- [ ] Image upload/download performance
- [ ] Search response times
- [ ] Concurrent shop registrations

## 📱 Frontend Integration

### React/Next.js Components Expected
- **ShopCard**: Display shop information in lists
- **ShopDetail**: Full shop profile view
- **ShopSearch**: Search and filter interface
- **ShopRegistration**: Multi-step registration form
- **ShopDashboard**: Shop owner management interface

### State Management
- Shop search results caching
- User favorites synchronization
- Shop owner profile state
- Real-time availability updates

## 💾 Database Focus Areas

### Primary Tables
- `shops` - Core shop information
- `shop_services` - Service catalog
- `shop_images` - Photo management
- `shop_contacts` - Contact methods (v3.2)
- `user_favorites` - User preferences

### Key Indexes for Performance
```sql
-- Location-based queries (most critical)
CREATE INDEX idx_shops_location ON shops USING GIST(location);

-- Search and filtering
CREATE INDEX idx_shops_category_location ON shops(main_category, location) 
WHERE shop_status = 'active';

-- Shop owner management
CREATE INDEX idx_shops_owner_status ON shops(owner_id, shop_status);
```

## 🔧 Technical Implementation

### Image Processing Pipeline
1. **Upload Validation**: File type, size, dimensions
2. **Optimization**: Compression, resizing, format conversion
3. **Storage**: Supabase Storage with CDN
4. **Metadata**: Alt text, display order, categorization

### Contact Method Integration
```json
{
  "contact_methods": [
    {
      "type": "kakao",
      "label": "카카오톡 채널",
      "value": "https://pf.kakao.com/_abc123",
      "is_primary": true
    },
    {
      "type": "phone", 
      "label": "전화 문의",
      "value": "02-123-4567",
      "is_primary": false
    }
  ]
}
```

## 📈 Business Metrics

### Shop Performance Tracking
- Registration completion rate
- Approval time (target: <24 hours)
- Shop profile completeness score
- Image upload success rate
- Contact method usage statistics

### User Engagement Metrics
- Shop discovery usage patterns
- Favorite shop trends
- Search query analytics
- Location-based usage patterns

## 🚨 Risk Management

### Technical Risks
- **PostGIS Performance**: Large datasets may slow location queries
- **Image Storage Costs**: Unlimited uploads could be expensive
- **Third-party Dependencies**: KakaoTalk API availability

### Business Risks
- **Fake Shop Registration**: Need robust verification process
- **Inappropriate Content**: Shop images and descriptions
- **Contact Spam**: Abuse of direct messaging features

### Mitigation Strategies
- Implement shop verification checklist
- Add content moderation for shop profiles
- Rate limit contact method usage
- Monitor and alert on unusual registration patterns

## 📋 Acceptance Criteria

### Shop Discovery
- [ ] Location-based search returns results within 200ms
- [ ] Filters work correctly (category, distance, rating)
- [ ] Sorting follows PRD 2.1 algorithm (partnered shops first)
- [ ] Pagination works smoothly with 30 shops per page

### Shop Management
- [ ] Shop owners can complete registration process
- [ ] Image uploads work reliably with proper validation
- [ ] Service catalog management is intuitive
- [ ] Contact methods integration functions correctly

### Admin Approval
- [ ] Admins can review pending shops efficiently
- [ ] Approval/rejection process includes proper notifications
- [ ] Business document verification workflow is clear
- [ ] Audit trail captures all admin actions

## 🔄 Integration with Other Phases

### Prepares for Phase 4 (Reservations)
- Shop availability data structure
- Service catalog for booking
- Operating hours for time slots
- Shop owner notification system

### Utilizes from Previous Phases
- User authentication for shop favorites
- Admin user management for shop approval
- Notification system for status updates

## 📋 Definition of Done

### Phase 3 is complete when:
1. ✅ All shop discovery APIs are functional and performant
2. ✅ Shop registration and approval workflow is operational
3. ✅ Shop owner management interface is complete
4. ✅ Location-based search performs within targets (<200ms)
5. ✅ Image upload and management system works reliably
6. ✅ Contact method integration is functional
7. ✅ Admin shop management tools are operational
8. ✅ Test coverage >85% for all shop-related functionality

## 🔄 Next Phase
**Phase 4**: Reservation & Booking System
- Time slot management and availability
- Reservation request and confirmation flow
- Calendar integration and scheduling
- Conflict resolution and overbooking prevention

---
*This phase establishes the marketplace foundation for connecting users with beauty shops.*
