# 🚀 Everything Backend Implementation Guide

## 📋 Overview

This guide integrates the comprehensive Korean backend design document (`에뷰리띵_백엔드_상세_설계서.md`) with our systematic development roadmap managed through Taskmaster. It provides a complete implementation strategy for the Everything backend v3.2.

**Key Integration Points:**
- ✅ **Design Document**: `에뷰리띵_백엔드_상세_설계서.md` (3,160 lines) - Complete API specifications, business logic, and technical requirements
- ✅ **Phase-based PRDs**: 6 focused development phases with specific deliverables
- ✅ **Task Management**: Taskmaster system for tracking progress and dependencies

---

## 🎯 Development Phases & Backend Design Document Mapping

### **Phase 1: Foundation & Infrastructure Setup** 
**Duration**: 1-2 weeks | **Priority**: High | **Dependencies**: None

**Backend Design Sections:**
- **Section 1**: 아키텍처 개요 (Lines 15-66)
- **Section 2**: 인증 및 보안 시스템 (Lines 69-123)
- **Section 10**: 에러 처리 및 로깅 (Lines 2000-2314)
- **Section 11**: 배포 및 운영 (Lines 2543-3086)

**Key Implementation Areas:**
```typescript
// Core infrastructure from design document
- Express.js 4.18+ with TypeScript 5.0+
- Supabase PostgreSQL with PostGIS
- JWT authentication middleware
- Rate limiting and security headers
- Winston logging with structured format
- Environment configuration management
```

**Critical Reference Points:**
- **Lines 17-28**: Complete technology stack specification
- **Lines 74-93**: JWT token validation middleware implementation
- **Lines 108-122**: Rate limiting and security configuration
- **Lines 2002-2136**: Standardized API response format and error codes

### **Phase 2: User Management & Authentication**
**Duration**: 1-2 weeks | **Priority**: High | **Dependencies**: Phase 1

**Backend Design Sections:**
- **Section 3.1**: 사용자 인증 관련 API (Lines 127-224)
- **Section 11.5-11.7**: User profile and password management (Lines 1411-1463)

**Key Implementation Areas:**
```typescript
// Social login implementation (Lines 129-175)
POST /api/auth/social-login
- Kakao, Apple, Google provider integration
- Supabase Auth connection
- FCM token registration
- Device information tracking

// User registration (Lines 176-224)
POST /api/auth/register
- Phone verification system
- Referral code processing
- Terms and privacy consent
```

**Critical Reference Points:**
- **Lines 144-161**: Database interaction patterns for user creation
- **Lines 194-212**: Referral system implementation with point rewards
- **Lines 164-174**: Business logic for social token validation

### **Phase 3: Shop Management & Discovery**
**Duration**: 2-3 weeks | **Priority**: High | **Dependencies**: Phase 2

**Backend Design Sections:**
- **Section 3.2**: 홈 화면 관련 API (Lines 225-290)
- **Section 3.3**: 샵 상세 정보 API (Lines 291-346)
- **Section 9**: 웹 관리자 API - 샵 관리 (Lines 1614-1672)
- **Section 10.1**: 샵 다이렉트 메시지 API (Lines 1312-1349)

**Key Implementation Areas:**
```typescript
// Location-based shop discovery (Lines 227-271)
GET /api/shops/nearby
- PostGIS spatial queries with ST_DWithin
- Partnership priority algorithm
- Performance optimization with spatial indexes

// Shop registration and verification (Lines 1616-1672)
- Business license validation with checksum
- Image upload with security verification
- Admin approval workflow
```

**Critical Reference Points:**
- **Lines 234-255**: Complex PostGIS query for location-based discovery
- **Lines 258-270**: Priority algorithm for partnered shops
- **Lines 1642-1662**: Shop approval process with commission rate setting

### **Phase 4: Reservation & Booking System**
**Duration**: 2-3 weeks | **Priority**: High | **Dependencies**: Phase 3

**Backend Design Sections:**
- **Section 4**: 예약 시스템 API (Lines 347-462)
- **Section 9.1**: 샵 예약 관리 API (Lines 1138-1311)
- **Section 8**: 예약 취소 및 환불 API (Lines 1054-1137)

**Key Implementation Areas:**
```typescript
// Time slot availability (Lines 349-396)
GET /api/shops/:shopId/available-slots
- Dynamic slot generation with business hours
- Conflict detection with existing reservations
- Service duration consideration

// Reservation request workflow v3.1 (Lines 447-461)
POST /api/reservations
- 'requested' status instead of immediate confirmation
- Shop owner manual confirmation required
- Payment processing with deposit system
```

**Critical Reference Points:**
- **Lines 358-386**: Complex SQL for available time slot calculation
- **Lines 457-461**: v3.1 reservation request workflow changes
- **Lines 1164-1196**: Shop owner confirmation process implementation

### **Phase 5: Payment Processing & Point System**
**Duration**: 2-3 weeks | **Priority**: High | **Dependencies**: Phase 4

**Backend Design Sections:**
- **Section 5**: 결제 시스템 API (Lines 463-548)
- **Section 6**: 포인트 시스템 API (Lines 550-855)
- **Section 6.4**: 추천인 수익 조회 (Lines 716-800)

**Key Implementation Areas:**
```typescript
// Toss Payments integration (Lines 477-526)
POST /api/payments/toss/prepare
POST /api/payments/toss/confirm
- Secure API key management
- Order ID generation patterns
- Payment status tracking

// Point system v3.2 policies (Lines 600-611)
- 2.5% earning rate with 30만원 cap
- 7-day usage delay implementation
- Influencer 2x bonus calculation
- FIFO point consumption logic
```

**Critical Reference Points:**
- **Lines 479-494**: Toss Payments API integration code
- **Lines 614-657**: Complex FIFO point usage SQL implementation
- **Lines 760-789**: Referral earnings calculation with privacy masking

### **Phase 6: Social Feed & Advanced Features**
**Duration**: 2-3 weeks | **Priority**: Medium | **Dependencies**: Phase 5

**Backend Design Sections:**
- **Section 7**: 소셜 피드 시스템 API (Lines 857-1053)
- **Section 11**: 알림 관리 API (Lines 1351-1507)
- **Section 12**: 분석 및 통계 API (Lines 1839-1949)
- **Section 13**: 웹 관리자 API (Lines 1510-1775)

**Key Implementation Areas:**
```typescript
// Social feed system v3.2 (Lines 859-1053)
GET /api/feed/posts
POST /api/feed/posts
- Location and category filtering
- Content moderation with auto-hiding
- Hashtag system implementation
- Image management with validation

// Analytics dashboard (Lines 1843-1949)
GET /api/admin/analytics/dashboard
- Real-time metrics collection
- User growth rate calculations
- Revenue and engagement analytics
```

**Critical Reference Points:**
- **Lines 866-885**: Complex feed post query with engagement metrics
- **Lines 1040-1053**: Content reporting and moderation system
- **Lines 1867-1887**: Dashboard analytics SQL implementation

---

## 🔧 Implementation Workflow Using Taskmaster

### **Getting Started**

1. **Switch to Phase Context**:
```bash
# Work on specific phase
task-master use-tag phase-1-foundation

# View phase-specific tasks
task-master list

# Get next task in phase
task-master next
```

2. **Expand Tasks with Backend Design Context**:
```bash
# Break down complex tasks with research
task-master expand --id=11 --research --force

# View detailed implementation requirements
task-master show 11.1
```

3. **Track Implementation Progress**:
```bash
# Log implementation findings
task-master update-subtask --id=11.1 --prompt="Implemented JWT middleware following lines 74-93 of design document. Added rate limiting per lines 108-122."

# Mark completion
task-master set-status --id=11.1 --status=done
```

### **Cross-Reference Strategy**

When implementing any feature, always reference:

1. **Design Document Section**: Find the specific lines in `에뷰리띵_백엔드_상세_설계서.md`
2. **API Specifications**: Use exact request/response formats from the document
3. **Database Patterns**: Follow SQL examples and table relationships
4. **Business Logic**: Implement exact rules and validation patterns
5. **Error Handling**: Use standardized error codes from lines 2053-2086

### **Code Quality Integration**

Each task completion should include:
- ✅ Implementation following design document specifications
- ✅ Error handling with standardized response format
- ✅ Database queries optimized per design document examples
- ✅ Security measures as specified in sections 2 and 10
- ✅ Testing coverage for critical business logic

---

## 📊 Progress Tracking

### **Master Roadmap Status**
```
Phase 1: Foundation & Infrastructure    [○ pending] 
Phase 2: User Management & Auth         [○ pending] (depends: Phase 1)
Phase 3: Shop Management & Discovery    [○ pending] (depends: Phase 2)  
Phase 4: Reservation & Booking System   [○ pending] (depends: Phase 3)
Phase 5: Payment Processing & Points    [○ pending] (depends: Phase 4)
Phase 6: Social Feed & Advanced         [○ pending] (depends: Phase 5)
```

### **Key Metrics to Track**
- **API Coverage**: % of endpoints from design document implemented
- **Test Coverage**: >85% for each phase as specified in PRDs
- **Performance Benchmarks**: Response times per design document requirements
- **Security Compliance**: All security measures from sections 2 and 10

---

## 🚨 Critical Success Factors

### **1. Design Document Adherence**
- Every API endpoint must match the specifications in `에뷰리띵_백엔드_상세_설계서.md`
- Database schemas must follow the exact patterns shown
- Business logic must implement all rules and edge cases documented

### **2. Version Compatibility**
- Implement v3.1 reservation workflow (request → confirmation)
- Include all v3.2 features (social feed, enhanced points, etc.)
- Ensure React/Next.js hybrid app compatibility

### **3. Korean Market Requirements**
- Phone number validation for Korean format (Lines 2163-2166)
- Business license validation with checksum (Lines 2229-2251)
- Korean address format validation (Lines 2173-2178)

### **4. Production Readiness**
- Security headers and rate limiting (Lines 108-122)
- Comprehensive error handling (Lines 2002-2136)
- Monitoring and alerting (Lines 2706-2769)
- Performance optimization with caching (Lines 2772-2806)

---

## 📚 Reference Quick Links

- **Backend Design Document**: `에뷰리띵_백엔드_상세_설계서.md` (3,160 lines)
- **Phase PRDs**: `docs/prds/phase-*-*.md` (6 focused documents)
- **Taskmaster Commands**: Use `task-master` CLI or MCP tools
- **Database Schema**: `SUPABASE SCHEMA.sql` (existing structure)

---

## 🎯 Next Steps

1. **Start Phase 1**: `task-master use-tag phase-1-foundation && task-master next`
2. **Reference Design Document**: Always cross-reference specific line numbers
3. **Track Progress**: Use Taskmaster to log implementation details
4. **Quality Gates**: Ensure each phase meets the acceptance criteria before proceeding

This implementation guide ensures systematic development while maintaining strict adherence to the comprehensive backend design specifications. Each phase builds upon the previous one, creating a robust and scalable backend system for the Everything v3.2 platform.
