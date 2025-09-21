# PRD: Phase 2 - User Management & Authentication

## 📋 Overview
**Phase**: 2 of 6  
**Duration**: 1-2 weeks  
**Priority**: High  
**Dependencies**: Phase 1 (Foundation Setup)  

This phase implements comprehensive user management, authentication flows, and profile management features for the React/Next.js hybrid app.

## 🎯 Objectives

### Primary Goals
1. Implement social login integration (Kakao, Apple, Google)
2. Build user registration and profile management system
3. Create referral system with code generation and tracking
4. Implement user settings and preferences management
5. Build admin user management capabilities

### Success Criteria
- [ ] Social login working for all 3 providers
- [ ] User registration flow complete with phone verification
- [ ] Referral system operational with automatic code generation
- [ ] User profile CRUD operations functional
- [ ] Admin can manage user accounts (suspend, activate, etc.)

## 🔗 API Endpoints to Implement

### 1. Authentication APIs
```
POST /api/auth/social-login
POST /api/auth/register  
POST /api/auth/change-password
POST /api/auth/refresh-token
POST /api/auth/logout
```

### 2. User Profile APIs
```
GET /api/user/profile
PUT /api/user/profile
GET /api/user/settings
PUT /api/user/settings
DELETE /api/user/account
```

### 3. Referral System APIs
```
GET /api/user/referral-code
GET /api/user/referral-earnings
POST /api/user/validate-referral-code
```

### 4. Admin User Management APIs
```
GET /api/admin/users
PUT /api/admin/users/:userId/status
GET /api/admin/users/:userId
PUT /api/admin/users/:userId/role
```

## 📱 Frontend Integration Points

### React/Next.js Considerations
- **Authentication State**: JWT token management with Next.js middleware
- **Social Login**: Client-side SDK integration for Kakao/Apple/Google
- **Form Validation**: Shadcn/UI form components with validation
- **Real-time Updates**: WebSocket integration for profile changes

### Expected Request/Response Formats
All APIs follow standardized format:
```typescript
interface StandardResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorDetails;
  meta?: PaginationMeta;
}
```

## 🔐 Security Requirements

### Authentication Security
- JWT token expiration: 24 hours
- Refresh token rotation
- Multi-device login support (max 5 devices)
- Session invalidation on password change

### Input Validation
- Phone number format validation (Korean format)
- Email format validation
- Password strength requirements
- Referral code format validation (8 characters, alphanumeric)

### Rate Limiting
- Login attempts: 5/15 minutes
- Registration: 3/hour
- Profile updates: 10/hour
- Password changes: 2/day

## 🧪 Testing Requirements

### Unit Tests
- [ ] Social login token validation
- [ ] User registration business logic
- [ ] Referral code generation and validation
- [ ] Profile update validation
- [ ] Admin user management functions

### Integration Tests
- [ ] Complete registration flow
- [ ] Social login end-to-end
- [ ] Referral system workflow
- [ ] Admin user management operations
- [ ] Authentication middleware functionality

### Security Tests
- [ ] SQL injection attempts on user inputs
- [ ] Authentication bypass attempts
- [ ] Rate limiting effectiveness
- [ ] Input validation edge cases

## 💾 Database Operations

### Tables Primarily Used
- `public.users` - Core user data
- `public.user_settings` - User preferences
- `public.point_transactions` - Referral tracking
- `public.admin_actions` - Admin audit logs
- `public.push_tokens` - Device management

### Key Functions to Implement
- `generate_referral_code()` - Unique code generation
- `check_influencer_status()` - Auto-promotion logic
- `validate_point_usage()` - Balance validation
- `cleanup_inactive_users()` - Maintenance

## 📊 Business Logic Requirements

### User Registration Flow
1. Social login authentication
2. Basic profile information collection
3. Phone number verification
4. Referral code processing (optional)
5. Terms and privacy acceptance
6. Account activation

### Referral System Logic
- Automatic unique code generation (8 characters)
- Referral relationship tracking
- Influencer qualification checking (50 referrals + all paid)
- Referral earnings calculation and tracking

### Admin Management Features
- User search and filtering
- Status management (active, suspended, deleted)
- Role assignment
- Activity monitoring
- Bulk operations support

## 🔄 State Management

### User Status Transitions
```
pending → active (email verification)
active → suspended (admin action)
suspended → active (admin action)
active → deleted (user request)
```

### Referral Status Tracking
```
referred_user registers → total_referrals++
referred_user makes first payment → successful_referrals++
successful_referrals >= 50 → check influencer qualification
```

## 📋 Acceptance Criteria

### For User Registration
- [ ] User can register with social login (Kakao/Apple/Google)
- [ ] Phone verification works correctly
- [ ] Referral codes are properly validated and tracked
- [ ] User receives welcome notification
- [ ] All user data is properly stored with correct relationships

### For Profile Management
- [ ] User can view and update their profile
- [ ] Profile image upload works with proper validation
- [ ] Settings changes are persisted correctly
- [ ] Privacy controls are respected

### For Admin Management
- [ ] Admin can search and filter users effectively
- [ ] User status changes work correctly with audit logging
- [ ] Bulk operations are atomic and safe
- [ ] All admin actions are properly logged

## 🚨 Risk Mitigation

### Security Risks
- **Social login token validation**: Implement proper token verification for each provider
- **Phone verification**: Use secure SMS service with rate limiting
- **Referral abuse**: Implement circular reference prevention

### Technical Risks
- **Database performance**: Ensure indexes are properly created
- **Concurrent registration**: Handle duplicate email/phone scenarios
- **Memory leaks**: Proper cleanup of authentication sessions

## 🔧 Implementation Guidelines

### Code Structure
```
src/
├── controllers/
│   ├── auth.controller.ts
│   ├── user-profile.controller.ts
│   └── admin-user-management.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── referral.service.ts
│   └── admin-user.service.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── rbac.middleware.ts
│   └── validation.middleware.ts
└── validators/
    ├── auth.validators.ts
    └── user-profile.validators.ts
```

### Database Migration Order
1. `001_create_extensions.sql` - PostGIS, UUID extensions
2. `002_create_enums.sql` - All ENUM types
3. `003_create_core_tables.sql` - Users, settings, shops
4. `004_create_indexes.sql` - Performance indexes
5. `005_create_rls_policies.sql` - Security policies
6. `006_create_functions.sql` - Business logic functions

## 📈 Monitoring & Metrics

### Key Metrics to Track
- User registration rate (daily/weekly)
- Social login success rate by provider
- Authentication error rate
- Profile update frequency
- Admin action frequency

### Alerting Thresholds
- Authentication failure rate >5%
- Database connection failures >3 consecutive
- Memory usage >80%
- Response time >500ms (95th percentile)

## 🔄 Next Phase Preparation

### Deliverables for Phase 3
- Authenticated user context available in all APIs
- User management system operational
- Referral tracking foundation ready
- Admin management tools functional
- Comprehensive test coverage for user operations

### Integration Points
- User authentication state for shop browsing
- Profile data for reservation system
- Referral tracking for point system
- Admin controls for content moderation

---
*Phase 1 provides the essential foundation that all other phases depend on.*
