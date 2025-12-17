# eBeautything Feedback Implementation Plan

> **Generated**: 2025-12-08
> **Status**: Planning Phase
> **Total Items**: 29 feedback items (21 Mobile App + 8 Shop Admin)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Environment Requirements](#environment-requirements)
3. [Phase Overview](#phase-overview)
4. [Phase 1: Quick Wins & UI Adjustments](#phase-1-quick-wins--ui-adjustments)
5. [Phase 2: Points & Financial Features](#phase-2-points--financial-features)
6. [Phase 3: Feed & Social Enhancements](#phase-3-feed--social-enhancements)
7. [Phase 4: Home Page & Discovery](#phase-4-home-page--discovery)
8. [Phase 5: Shop Admin Enhancements](#phase-5-shop-admin-enhancements)
9. [Phase 6: Advanced Features](#phase-6-advanced-features)
10. [Database Schema Changes](#database-schema-changes)
11. [API Endpoints Required](#api-endpoints-required)
12. [Testing Strategy](#testing-strategy)
13. [Rollout Plan](#rollout-plan)

---

## Executive Summary

This document outlines the systematic implementation plan for 29 feedback items across the eBeautything platform. The feedback is categorized into:

| Category | Count | Complexity |
|----------|-------|------------|
| UI/Navigation Changes | 6 | Low |
| Points System Enhancements | 4 | Medium |
| Feed/Social Features | 5 | Medium-High |
| Home Page Features | 5 | High |
| Shop Admin Features | 8 | Medium-High |
| New Integrations | 1 | High |

### Key Architectural Decisions

1. **Backend-First Approach**: All new features require backend API support before frontend implementation
2. **Database Migrations**: 8 new tables/columns required
3. **Notification System**: Leverage existing FCM infrastructure
4. **Admin Panel**: Significant new pages for popup management, review management, and settlement tracking

---

## Environment Requirements

### Backend (.env additions)

```bash
# ============================================
# NEW ENVIRONMENT VARIABLES REQUIRED
# ============================================

# Naver OAuth Integration (Feedback #21)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NAVER_CALLBACK_URL=https://api.e-beautything.com/api/auth/naver/callback

# Map/Location Services (Feedback #3)
KAKAO_REST_API_KEY=your_kakao_rest_api_key          # Already exists, verify
KAKAO_JAVASCRIPT_KEY=your_kakao_javascript_key      # For frontend map

# Push Notification Enhancement (Feedback #20)
# (Already configured - FCM_SERVER_KEY, FCM_PROJECT_ID)
# No new variables needed, but verify:
FCM_SERVER_KEY=your_fcm_server_key
FCM_PROJECT_ID=your_fcm_project_id

# Popup/Banner CDN (Feedback #8)
POPUP_IMAGE_BUCKET=popup-images                      # Supabase storage bucket
MAX_POPUP_IMAGE_SIZE=5242880                         # 5MB limit

# Settlement/Financial (Feedback #35)
SETTLEMENT_CALCULATION_DAY=15                        # Day of month for settlement calc
SETTLEMENT_PAYOUT_DELAY_DAYS=7                       # Days after calculation
```

### Mobile App (.env additions)

```bash
# ============================================
# MOBILE APP NEW ENVIRONMENT VARIABLES
# ============================================

# Naver OAuth
NEXT_PUBLIC_NAVER_CLIENT_ID=your_naver_client_id

# Map Configuration
NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_javascript_key
NEXT_PUBLIC_DEFAULT_LATITUDE=37.5665                 # Seoul default
NEXT_PUBLIC_DEFAULT_LONGITUDE=126.9780

# Feature Flags (for gradual rollout)
NEXT_PUBLIC_FEATURE_NEARBY_MAP=true
NEXT_PUBLIC_FEATURE_HAIR_SERVICE=false               # Disabled - "서비스 준비중"
NEXT_PUBLIC_FEATURE_POPUP_ENABLED=true
```

### Admin Panel (.env additions)

```bash
# ============================================
# ADMIN PANEL NEW ENVIRONMENT VARIABLES
# ============================================

# Popup Management
NEXT_PUBLIC_POPUP_PREVIEW_URL=https://app.e-beautything.com/popup-preview

# Settlement Configuration
NEXT_PUBLIC_SETTLEMENT_SUPPORT_EMAIL=settlement@e-beautything.com
```

### Supabase Storage Buckets Required

```
1. popup-images          # For app popup images (public read)
2. feed-templates        # For shop owner feed templates (authenticated)
3. shop-profile-images   # Additional shop images (public read) - may already exist
```

### Database Migrations Required

```
migrations/
├── 001_add_popup_tables.sql
├── 002_add_saved_feeds_table.sql
├── 003_add_customer_memos_table.sql
├── 004_add_feed_templates_table.sql
├── 005_add_shop_tags_table.sql
├── 006_add_review_replies_table.sql
├── 007_add_shop_entry_requests_table.sql
├── 008_add_settlement_schedule_table.sql
└── 009_update_point_transactions_referrer.sql
```

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Quick Wins & UI (Est: 3-5 days)                                   │
│  ├─ Move '찜' to MyPage                                                     │
│  ├─ '헤어' service unavailable message                                      │
│  ├─ Search filter restrictions (Seoul only, limited categories)            │
│  ├─ Remove '내가 올린 피드' from MyPage                                      │
│  ├─ Reorganize MyPage referral section                                      │
│  └─ Add '노쇼' button to reservations                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: Points & Financial (Est: 5-7 days)                                │
│  ├─ Home screen point summary widget                                        │
│  ├─ Point history with date filtering                                       │
│  ├─ Friend contribution tracking                                            │
│  ├─ Payment history in MyPage                                               │
│  ├─ Real-time point earning notifications                                   │
│  ├─ Shop Admin: Payment point usage display                                 │
│  └─ Shop Admin: Settlement schedule view                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: Feed & Social (Est: 7-10 days)                                    │
│  ├─ Remove '발견', add profile in feed header                               │
│  ├─ Saved feeds collection                                                  │
│  ├─ Review → Auto feed post                                                 │
│  ├─ User profile page with bio & posts                                      │
│  └─ Shop Admin: Feed template system                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: Home & Discovery (Est: 10-14 days)                                │
│  ├─ Nearby shops map (Kakao Map integration)                                │
│  ├─ 'Nearby Nail Shops' section                                             │
│  ├─ 'Frequently Visited' section                                            │
│  ├─ 'Best Recommended' section                                              │
│  ├─ 'Editor's Pick' section + Admin management                              │
│  ├─ App popup system + Admin management                                     │
│  └─ Shop entry request feature                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 5: Shop Admin (Est: 7-10 days)                                       │
│  ├─ Dashboard: New customers with calendar                                  │
│  ├─ Customer memo feature                                                   │
│  ├─ Revenue by service/staff                                                │
│  ├─ Review management with replies                                          │
│  ├─ Shop tags feature                                                       │
│  ├─ Multi-image shop profiles (5 images)                                    │
│  └─ Calendar for sales/reservations                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 6: Advanced Features (Est: 10-14 days)                               │
│  ├─ Naver OAuth integration                                                 │
│  ├─ Shop-only notification system                                           │
│  └─ Staff management system (basic)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Quick Wins & UI Adjustments

### 1.1 Move '찜' (Favorites) to MyPage

**Feedback**: 하단에 '찜'은 마이페이지로 이동

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Update bottom navigation, remove Favorites tab |
| Mobile App | Add Favorites section/link in MyPage |
| Backend | None |
| Admin | None |

**Implementation Steps**:

1. **Mobile App** (`/home/bitnami/ebeautything-app`)
   ```
   src/components/layout/BottomNav.tsx
   - Remove Favorites (찜) from bottom navigation tabs
   - Update tab count from 5 to 4
   - Reorder: Home → Feed → Bookings → Profile

   src/app/profile/page.tsx
   - Add "내 찜 목록" section with link to /favorites
   - Show favorite count badge

   src/app/favorites/page.tsx
   - Keep existing page, just change navigation entry point
   ```

**Files to Modify**:
- `ebeautything-app/src/components/layout/BottomNav.tsx`
- `ebeautything-app/src/app/profile/page.tsx`

---

### 1.2 '헤어' Service Unavailable Message

**Feedback**: 홈 화면에 '헤어'를 누르면 하단에 '서비스 준비중 입니다' 메세지 나오기

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Add toast/snackbar when Hair category clicked |
| Mobile App | Dim Hair category icon |
| Backend | None |
| Admin | None |

**Implementation Steps**:

1. **Mobile App**
   ```
   src/app/page.tsx (Home)
   - Add disabled state for Hair category
   - Show toast: "서비스 준비중입니다" on click
   - Apply grayscale/opacity to Hair icon

   src/components/ui/toast.tsx (if not exists)
   - Create reusable toast component
   ```

**Files to Modify**:
- `ebeautything-app/src/app/page.tsx`
- `ebeautything-app/src/components/home/CategoryList.tsx` (or similar)

---

### 1.3 Search Filter Restrictions

**Feedback**: 돋보기에서 '필터' 부분 헤어, 네일, 속눈썹, 왁싱/눈썹문신 만 있게끔 하기. 지역도 '서울'만 클릭 가능

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Limit category filters to 4 types |
| Mobile App | Disable non-Seoul regions with message |
| Backend | Optional: Add feature flag for regions |
| Admin | None |

**Implementation Steps**:

1. **Mobile App**
   ```
   src/app/search/page.tsx
   - Filter categories to: 네일, 속눈썹, 왁싱/눈썹문신, 헤어(disabled)
   - Remove: 스파, 메이크업, etc.
   - Hair category: grayed out with "서비스 준비중입니다" on tap

   - Region filter: Only 서울 selectable
   - Other regions: grayed out with "서비스 준비중입니다" on tap
   ```

**Files to Modify**:
- `ebeautything-app/src/app/search/page.tsx`
- `ebeautything-app/src/components/search/FilterModal.tsx` (or similar)

---

### 1.4 Remove '내가 올린 피드' from MyPage

**Feedback**: 마이페이지에 '내가 올린 피드' 삭제

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Remove "My Posts" link/section from profile |
| Backend | None |
| Admin | None |

**Implementation Steps**:

1. **Mobile App**
   ```
   src/app/profile/page.tsx
   - Remove "내가 올린 피드" / "My Posts" menu item
   - Keep the /profile/posts page but remove navigation to it
   ```

**Files to Modify**:
- `ebeautything-app/src/app/profile/page.tsx`

---

### 1.5 Reorganize MyPage Referral Section

**Feedback**: 마이페이지 탭에서 최상단에 '닉네임 및 이메일 수정' 부분 바로 밑에 친구추천탭에 있는 내추천코드와 링크복사 및 공유하기

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Move referral code UI to top of MyPage |
| Backend | None |
| Admin | None |

**Implementation Steps**:

1. **Mobile App**
   ```
   src/app/profile/page.tsx
   - After profile edit section, add:
     ┌─────────────────────────────────────┐
     │ 내 추천 코드: ABC123                │
     │ [링크 복사] [공유하기]              │
     └─────────────────────────────────────┘
   - Move from /profile/referrals inline
   - Keep detailed referral page for history
   ```

**Files to Modify**:
- `ebeautything-app/src/app/profile/page.tsx`
- `ebeautything-app/src/components/profile/ReferralCodeWidget.tsx` (new)

---

### 1.6 Add No-Show Button (Shop Admin)

**Feedback**: 확정 / 거절 외 노쇼버튼 추가

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Add `no_show` status to reservation status enum |
| Admin | Add No-Show button to reservation actions |

**Implementation Steps**:

1. **Backend** (`/home/bitnami/everything_backend`)
   ```
   src/types/reservation.types.ts
   - Add 'no_show' to ReservationStatus enum

   src/services/reservation.service.ts
   - Add markAsNoShow() method
   - Update status transition rules

   src/controllers/shop-owner/reservation.controller.ts
   - Add endpoint: PATCH /shop-owner/reservations/:id/no-show
   ```

2. **Admin** (`/home/bitnami/ebeautything-admin`)
   ```
   src/app/dashboard/my-shop/operations/page.tsx
   - Add "노쇼" button alongside Confirm/Reject
   - Show only for confirmed reservations past their time
   ```

**Files to Modify**:
- `everything_backend/src/types/reservation.types.ts`
- `everything_backend/src/services/reservation.service.ts`
- `everything_backend/src/controllers/shop-owner/reservation.controller.ts`
- `everything_backend/src/routes/shop-owner/reservation.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/operations/page.tsx`

---

## Phase 2: Points & Financial Features

### 2.1 Home Screen Point Summary Widget

**Feedback**: 홈 화면 제일 상단에 포인트내역 (보유포인트, 총 적립, 총 사용, 오늘 쌓인 포인트)

| Component | Change Required |
|-----------|-----------------|
| Mobile App | New PointSummaryWidget component on home |
| Backend | New API endpoint for point summary |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/point.service.ts
   - Add getPointSummary(userId):
     {
       currentBalance: number,
       totalEarned: number,
       totalUsed: number,
       todayEarned: number
     }

   src/controllers/point.controller.ts
   - GET /api/points/summary

   src/routes/point.routes.ts
   - Add route
   ```

2. **Mobile App**
   ```
   src/components/home/PointSummaryWidget.tsx (new)
   - 4 colored cards/badges:
     - 보유 포인트: Blue
     - 총 적립: Green
     - 총 사용: Red
     - 오늘 적립: Yellow/Gold

   src/app/page.tsx
   - Add PointSummaryWidget at top (only for logged-in users)

   src/lib/api/points-api.ts
   - Add getPointSummary() function
   ```

**API Specification**:
```typescript
// GET /api/points/summary
// Response:
{
  success: true,
  data: {
    currentBalance: 15000,
    totalEarned: 25000,
    totalUsed: 10000,
    todayEarned: 500
  }
}
```

**Files to Modify**:
- `everything_backend/src/services/point.service.ts`
- `everything_backend/src/controllers/point.controller.ts`
- `everything_backend/src/routes/point.routes.ts`
- `ebeautything-app/src/components/home/PointSummaryWidget.tsx` (new)
- `ebeautything-app/src/app/page.tsx`
- `ebeautything-app/src/lib/api/points-api.ts`

---

### 2.2 Point History with Date Filtering & Friend Attribution

**Feedback**: 날짜별(캘린더 선택) 쌓인 포인트 볼 수 있게 + 친구가 결제해서 나에게 포인트가 쌓였다면 '유현호짱 님 덕분에 +125 point 적립!'

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Enhanced point history with date picker |
| Backend | Add date range filter + referrer info to point history |
| Admin | None |

**Database Schema Change**:
```sql
-- Migration: 009_update_point_transactions_referrer.sql
ALTER TABLE point_transactions
ADD COLUMN referrer_user_id UUID REFERENCES users(id),
ADD COLUMN referrer_nickname VARCHAR(100);

-- Index for date range queries
CREATE INDEX idx_point_transactions_user_date
ON point_transactions(user_id, created_at DESC);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/point-transaction.service.ts
   - Update getTransactionHistory() to support:
     - startDate, endDate filters
     - Include referrer_nickname when type = 'earned_referral'

   src/controllers/point.controller.ts
   - GET /api/points/history?startDate=&endDate=&period=daily|weekly|custom
   ```

2. **Mobile App**
   ```
   src/app/points/page.tsx
   - Add date range picker (calendar UI)
   - Period quick selects: 오늘, 이번주, 이번달, 직접선택
   - Show referrer attribution: "유현호짱 님 덕분에 +125P 적립!"

   src/components/points/PointHistoryItem.tsx
   - Display referrer info when applicable
   - Different styling for referral earnings
   ```

**API Specification**:
```typescript
// GET /api/points/history?startDate=2024-01-01&endDate=2024-01-31
// Response:
{
  success: true,
  data: {
    transactions: [
      {
        id: "txn_123",
        type: "earned_referral",
        amount: 125,
        description: "친구 추천 적립",
        referrerNickname: "유현호짱",
        createdAt: "2024-01-15T10:30:00Z"
      }
    ],
    summary: {
      totalEarned: 500,
      totalUsed: 0,
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31"
    }
  }
}
```

**Files to Modify**:
- `everything_backend/src/migrations/009_update_point_transactions_referrer.sql` (new)
- `everything_backend/src/services/point-transaction.service.ts`
- `everything_backend/src/controllers/point.controller.ts`
- `ebeautything-app/src/app/points/page.tsx`
- `ebeautything-app/src/components/points/DateRangePicker.tsx` (new)
- `ebeautything-app/src/components/points/PointHistoryItem.tsx`

---

### 2.3 Payment History in MyPage

**Feedback**: 마이페이지에 결제내역 추가, 결제당 쌓인 포인트 옆에 따로 적혀있기

| Component | Change Required |
|-----------|-----------------|
| Mobile App | New payment history page/section |
| Backend | Enhance payment history with earned points |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/payment.service.ts
   - getPaymentHistory() - include earned_points per payment
   - Join with point_transactions where source = payment_id

   src/controllers/payment.controller.ts
   - GET /api/payments/history (user's payments)
   ```

2. **Mobile App**
   ```
   src/app/profile/payments/page.tsx (new)
   - List of payments with:
     - Shop name, date, amount
     - Earned points badge: "+125P 적립"

   src/app/profile/page.tsx
   - Add "결제내역" menu item
   ```

**Files to Modify**:
- `everything_backend/src/services/payment.service.ts`
- `everything_backend/src/controllers/payment.controller.ts`
- `ebeautything-app/src/app/profile/payments/page.tsx` (new)
- `ebeautything-app/src/app/profile/page.tsx`

---

### 2.4 Real-time Point Earning Notification

**Feedback**: 친구가 결제 후 나에게 포인트가 쌓일 때 즉시 '친구 덕분에 용돈 받았어요!' 알림

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Handle push notification for referral points |
| Backend | Trigger push notification on referral point earning |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/point.service.ts
   - In earnReferralPoints():
     - After crediting points, trigger push notification
     - Call notificationService.sendPointEarnedNotification()

   src/services/notification.service.ts
   - Add sendReferralPointNotification(userId, referrerName, points)
   - Template: "🎉 {referrerName}님 덕분에 용돈 받았어요! +{points}P"

   src/constants/notification-templates.ts
   - Add REFERRAL_POINT_EARNED template
   ```

2. **Mobile App**
   ```
   src/hooks/useFCMToken.ts
   - Handle 'referral_point_earned' notification type
   - Show in-app toast + navigate to points page on tap
   ```

**Files to Modify**:
- `everything_backend/src/services/point.service.ts`
- `everything_backend/src/services/notification.service.ts`
- `everything_backend/src/constants/notification-templates.ts`
- `ebeautything-app/src/hooks/useFCMToken.ts`

---

### 2.5 Shop Admin: Payment Point Usage Display

**Feedback**: 고객 결제시 결제 화면에서 고객 명당 결제시마다 포인트 사용액이 얼마 활용됐는지 확인

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Include point usage in payment details |
| Admin | Display point usage in payment/reservation details |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-owner/payment.service.ts
   - getPaymentDetails() include:
     - pointsUsed: number
     - actualPaidAmount: number (total - pointsUsed)
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/operations/page.tsx
   - In payment details section show:
     - 결제 금액: ₩50,000
     - 포인트 사용: -₩5,000
     - 실결제액: ₩45,000
   ```

**Files to Modify**:
- `everything_backend/src/services/shop-owner/payment.service.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/operations/page.tsx`

---

### 2.6 Shop Admin: Settlement Schedule

**Feedback**: '재무관리'에서 정산 예정. 0월 0일 000 금액 정산 예정

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Settlement schedule calculation API |
| Admin | Settlement schedule display in financial page |

**Database Schema Change**:
```sql
-- Migration: 008_add_settlement_schedule_table.sql
CREATE TABLE settlement_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_settlement_shop_date ON settlement_schedules(shop_id, scheduled_date);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/settlement.service.ts (new)
   - calculateUpcomingSettlement(shopId)
   - getSettlementHistory(shopId)

   src/controllers/shop-owner/financial.controller.ts
   - GET /shop-owner/settlements/upcoming
   - GET /shop-owner/settlements/history
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/financial/page.tsx
   - Add "정산 예정" section:
     ┌─────────────────────────────────────┐
     │ 다음 정산 예정                       │
     │ 정산일: 2024년 1월 15일              │
     │ 예상 금액: ₩1,250,000               │
     │ (12/1 ~ 12/31 매출 기준)            │
     └─────────────────────────────────────┘
   ```

**Files to Modify**:
- `everything_backend/src/migrations/008_add_settlement_schedule_table.sql` (new)
- `everything_backend/src/services/settlement.service.ts` (new)
- `everything_backend/src/controllers/shop-owner/financial.controller.ts`
- `everything_backend/src/routes/shop-owner/financial.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/financial/page.tsx`

---

## Phase 3: Feed & Social Enhancements

### 3.1 Feed Header: Remove '발견', Add Profile

**Feedback**: 피드 부분, '발견' 부분을 없애고 피드 + 옆 부분에 같은 사이즈로 내 프로필 보이기

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Redesign feed header with profile avatar |
| Backend | None |
| Admin | None |

**Implementation Steps**:

1. **Mobile App**
   ```
   src/app/feed/page.tsx
   - Remove "발견" (Discover) tab
   - Keep single "피드" feed
   - Add profile avatar next to "피드" text (same size)
   - Avatar click → navigate to /profile or /feed/my-profile

   src/components/feed/FeedHeader.tsx (new or modify)
   - Layout: [피드 Text] [Profile Avatar]
   - Avatar: User's profile image or default silhouette
   ```

**Files to Modify**:
- `ebeautything-app/src/app/feed/page.tsx`
- `ebeautything-app/src/components/feed/FeedHeader.tsx`

---

### 3.2 User Profile Page in Feed Context

**Feedback**: 사진을 눌러 프로필로 이동하게되면 '설명(내프로필 편집을 통해 작성가능)' 과 내가 쓴 피드들이 나오길 희망

| Component | Change Required |
|-----------|-----------------|
| Mobile App | New feed profile page with bio + user posts |
| Backend | Add bio field to user profile if not exists |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/user-profile.service.ts
   - Ensure 'bio' field exists in user profile
   - getUserFeedProfile(userId): { profile, posts }

   src/controllers/user.controller.ts
   - GET /api/users/:id/feed-profile
   ```

2. **Mobile App**
   ```
   src/app/feed/profile/page.tsx (new)
   - Show: Avatar, Nickname, Bio
   - List of user's feed posts
   - Edit button → /profile/edit

   src/app/profile/edit/page.tsx
   - Add bio/description field (if not exists)
   ```

**Files to Modify**:
- `everything_backend/src/services/user-profile.service.ts`
- `everything_backend/src/controllers/user.controller.ts`
- `ebeautything-app/src/app/feed/profile/page.tsx` (new)
- `ebeautything-app/src/app/profile/edit/page.tsx`

---

### 3.3 Saved Feeds Collection

**Feedback**: 피드 부분에 내가 저장한 피드 모음 볼 수 있으면 희망

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Save button on posts, saved feeds page |
| Backend | New saved_feeds table and APIs |
| Admin | None |

**Database Schema Change**:
```sql
-- Migration: 002_add_saved_feeds_table.sql
CREATE TABLE saved_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_saved_feeds_user ON saved_feeds(user_id, created_at DESC);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/feed.service.ts
   - savePost(userId, postId)
   - unsavePost(userId, postId)
   - getSavedPosts(userId, pagination)
   - isPostSaved(userId, postId)

   src/controllers/feed.controller.ts
   - POST /api/feed/posts/:postId/save
   - DELETE /api/feed/posts/:postId/save
   - GET /api/feed/saved
   ```

2. **Mobile App**
   ```
   src/components/feed/FeedPostCard.tsx
   - Add bookmark/save icon (alongside like)
   - Toggle saved state

   src/app/feed/saved/page.tsx (new)
   - List of saved posts
   - Access from feed profile or settings
   ```

**Files to Modify**:
- `everything_backend/src/migrations/002_add_saved_feeds_table.sql` (new)
- `everything_backend/src/services/feed.service.ts`
- `everything_backend/src/controllers/feed.controller.ts`
- `everything_backend/src/routes/feed.routes.ts`
- `ebeautything-app/src/components/feed/FeedPostCard.tsx`
- `ebeautything-app/src/app/feed/saved/page.tsx` (new)
- `ebeautything-app/src/lib/api/feed-api.ts`

---

### 3.4 Review → Auto Feed Post

**Feedback**: 리뷰를 남길 때, 아래에 '피드 업로드'가 있고 체크되어 있으면 리뷰 내용이 본인의 피드에도 자동 업로드

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Checkbox in review form for auto-post |
| Backend | Create feed post when review submitted with flag |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/review.service.ts
   - createReview(data, { autoPostToFeed: boolean })
   - If autoPostToFeed:
     - Create feed_post with review content
     - Link to shop
     - Include review images

   src/controllers/review.controller.ts
   - POST /api/reviews { ...reviewData, autoPostToFeed: true }
   ```

2. **Mobile App**
   ```
   src/components/reviews/ReviewForm.tsx
   - Add checkbox: "피드에 자동 업로드" (default: checked)
   - Pass autoPostToFeed to API
   ```

**Files to Modify**:
- `everything_backend/src/services/review.service.ts`
- `everything_backend/src/controllers/review.controller.ts`
- `ebeautything-app/src/components/reviews/ReviewForm.tsx`

---

### 3.5 Shop Admin: Feed Templates

**Feedback**: 피드 글을 예시에 있는 글들의 폼을 저장해놓고 불러오기로 바로 불러와서 글을 편하게 작성

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Feed template CRUD APIs |
| Admin | Template management in feed creation |

**Database Schema Change**:
```sql
-- Migration: 004_add_feed_templates_table.sql
CREATE TABLE feed_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50), -- event, promotion, daily, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feed_templates_shop ON feed_templates(shop_id);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/feed-template.service.ts (new)
   - createTemplate(shopId, { name, content, category })
   - getTemplates(shopId)
   - updateTemplate(templateId, data)
   - deleteTemplate(templateId)

   src/controllers/shop-owner/feed.controller.ts
   - CRUD endpoints for templates
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/feed/page.tsx
   - "템플릿 불러오기" button in post creation
   - Template management section
   - Save current post as template
   ```

**Files to Modify**:
- `everything_backend/src/migrations/004_add_feed_templates_table.sql` (new)
- `everything_backend/src/services/feed-template.service.ts` (new)
- `everything_backend/src/controllers/shop-owner/feed.controller.ts`
- `everything_backend/src/routes/shop-owner/feed.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/feed/page.tsx`
- `ebeautything-admin/src/components/feed/TemplateSelector.tsx` (new)

---

## Phase 4: Home Page & Discovery

### 4.1 Nearby Shops Map

**Feedback**: 홈 하단에 '내주변(지도)' 들어가기 - 핑프 및 캐치테이블 카피

| Component | Change Required |
|-----------|-----------------|
| Mobile App | New map page with nearby shops |
| Backend | Geospatial query for nearby shops |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-search.service.ts
   - getNearbyShops(lat, lng, radiusKm, category?)
   - Return shops with distance calculated

   src/controllers/shop.controller.ts
   - GET /api/shops/nearby?lat=&lng=&radius=5&category=nail
   ```

2. **Mobile App**
   ```
   src/app/nearby/page.tsx (new)
   - Kakao Map integration
   - Shop markers on map
   - List view toggle
   - Category filter

   src/components/map/ShopMap.tsx (new)
   - Kakao Map component
   - Custom markers for shops
   - Info window on marker click

   src/app/page.tsx
   - Add "내주변" button/section linking to /nearby
   ```

**Files to Modify**:
- `everything_backend/src/services/shop-search.service.ts`
- `everything_backend/src/controllers/shop.controller.ts`
- `everything_backend/src/routes/shop.routes.ts`
- `ebeautything-app/src/app/nearby/page.tsx` (new)
- `ebeautything-app/src/components/map/ShopMap.tsx` (new)
- `ebeautything-app/src/hooks/use-kakao-map.ts`
- `ebeautything-app/src/app/page.tsx`

---

### 4.2-4.5 Home Page Sections

**Feedback**:
- 가까운 네일샵
- 자주 방문한 샵
- Best 추천 샵
- 에디터 추천 pick!

| Component | Change Required |
|-----------|-----------------|
| Mobile App | New sections on home page |
| Backend | APIs for each section |
| Admin | Editor's pick management |

**Database Schema Change**:
```sql
-- For Editor's Pick (if not using existing system)
CREATE TABLE editor_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  title VARCHAR(200),
  description TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/home.service.ts (new or extend)
   - getNearbyNailShops(lat, lng, limit)
   - getFrequentlyVisited(userId, limit)
   - getBestRecommended(limit) -- by rating/reviews
   - getEditorPicks(limit)

   src/controllers/home.controller.ts
   - GET /api/home/sections
     Returns all sections in one call for efficiency
   ```

2. **Mobile App**
   ```
   src/app/page.tsx
   - Add sections:
     1. PointSummaryWidget (from Phase 2)
     2. Categories
     3. 가까운 네일샵 (horizontal scroll)
     4. 자주 방문한 샵 (horizontal scroll, logged-in only)
     5. Best 추천 샵 (horizontal scroll)
     6. 에디터 추천 pick! (featured cards)

   src/components/home/ShopSection.tsx (new)
   - Reusable horizontal scroll section
   ```

3. **Admin**
   ```
   src/app/dashboard/system/editor-picks/page.tsx (new)
   - Manage editor's picks
   - Add/remove shops
   - Set display order
   - Schedule picks (start/end date)
   ```

**Files to Modify**:
- `everything_backend/src/services/home.service.ts` (new)
- `everything_backend/src/controllers/home.controller.ts` (new)
- `everything_backend/src/routes/home.routes.ts` (new)
- `ebeautything-app/src/app/page.tsx`
- `ebeautything-app/src/components/home/ShopSection.tsx` (new)
- `ebeautything-app/src/components/home/EditorPickCard.tsx` (new)
- `ebeautything-admin/src/app/dashboard/system/editor-picks/page.tsx` (new)

---

### 4.6 App Popup System

**Feedback**: 팝업 (어플 키자마자 나오는 이미지 파일로 팝업 나오게끔, 어드민에서 쉽게 관리, '닫음' '다시보지않기' 선택)

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Popup display on app load |
| Backend | Popup management APIs |
| Admin | Popup CRUD interface |

**Database Schema Change**:
```sql
-- Migration: 001_add_popup_tables.sql
CREATE TABLE app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_type VARCHAR(20) DEFAULT 'none', -- none, internal, external
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  target_audience VARCHAR(20) DEFAULT 'all', -- all, new_users, returning
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE popup_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(100), -- for non-logged in users
  popup_id UUID NOT NULL REFERENCES app_popups(id) ON DELETE CASCADE,
  dismiss_type VARCHAR(20) NOT NULL, -- close, never_show
  dismissed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, popup_id),
  UNIQUE(device_id, popup_id)
);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/popup.service.ts (new)
   - getActivePopups(userId?, deviceId?)
   - dismissPopup(popupId, userId?, deviceId?, type)
   - createPopup(data) -- admin
   - updatePopup(id, data) -- admin
   - deletePopup(id) -- admin

   src/controllers/popup.controller.ts (new)
   - GET /api/popups/active
   - POST /api/popups/:id/dismiss
   - Admin CRUD endpoints
   ```

2. **Mobile App**
   ```
   src/components/popup/AppPopup.tsx (new)
   - Modal with image
   - "닫기" button
   - "다시 보지 않기" checkbox
   - Store dismissal in localStorage + API

   src/app/layout.tsx or page.tsx
   - Check for active popups on mount
   - Show popup if not dismissed
   ```

3. **Admin**
   ```
   src/app/dashboard/system/popups/page.tsx (new)
   - List all popups
   - Create/Edit popup
   - Image upload
   - Schedule (start/end date)
   - Preview
   - Analytics (views, dismissals)
   ```

**Files to Modify**:
- `everything_backend/src/migrations/001_add_popup_tables.sql` (new)
- `everything_backend/src/services/popup.service.ts` (new)
- `everything_backend/src/controllers/popup.controller.ts` (new)
- `everything_backend/src/routes/popup.routes.ts` (new)
- `everything_backend/src/routes/admin/popup.routes.ts` (new)
- `ebeautything-app/src/components/popup/AppPopup.tsx` (new)
- `ebeautything-app/src/hooks/use-popup.ts` (new)
- `ebeautything-app/src/app/layout.tsx`
- `ebeautything-admin/src/app/dashboard/system/popups/page.tsx` (new)
- `ebeautything-admin/src/components/popups/PopupForm.tsx` (new)

---

### 4.7 Shop Entry Request

**Feedback**: 홈에 '입점 요청, 우리동네샾 입점 요청하기' 추가

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Entry request button/page |
| Backend | Entry request submission API |
| Admin | Entry request management |

**Database Schema Change**:
```sql
-- Migration: 007_add_shop_entry_requests_table.sql
CREATE TABLE shop_entry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES users(id),
  shop_name VARCHAR(200) NOT NULL,
  shop_address TEXT,
  shop_phone VARCHAR(20),
  shop_category VARCHAR(50),
  additional_info TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, contacted, registered, rejected
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-entry-request.service.ts (new)
   - submitRequest(data)
   - getRequests(filters) -- admin
   - updateRequestStatus(id, status, notes) -- admin

   src/controllers/shop-entry-request.controller.ts (new)
   - POST /api/shop-entry-requests
   - GET /api/admin/shop-entry-requests
   - PATCH /api/admin/shop-entry-requests/:id
   ```

2. **Mobile App**
   ```
   src/app/shop-request/page.tsx (new)
   - Form: shop name, address, phone, category
   - Submit button

   src/app/page.tsx
   - Add "우리동네샵 입점 요청하기" button
   ```

3. **Admin**
   ```
   src/app/dashboard/system/shop-requests/page.tsx (new)
   - List of entry requests
   - Status management
   - Contact info display
   ```

**Files to Modify**:
- `everything_backend/src/migrations/007_add_shop_entry_requests_table.sql` (new)
- `everything_backend/src/services/shop-entry-request.service.ts` (new)
- `everything_backend/src/controllers/shop-entry-request.controller.ts` (new)
- `everything_backend/src/routes/shop-entry-request.routes.ts` (new)
- `ebeautything-app/src/app/shop-request/page.tsx` (new)
- `ebeautything-app/src/app/page.tsx`
- `ebeautything-admin/src/app/dashboard/system/shop-requests/page.tsx` (new)

---

## Phase 5: Shop Admin Enhancements

### 5.1 Dashboard: New Customers with Calendar

**Feedback**: 대시보드에 '이번달 신규고객' 추가. 달력기능 추가

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | New customers analytics API |
| Admin | Calendar widget + new customer stats |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-owner/analytics.service.ts
   - getNewCustomers(shopId, startDate, endDate)
   - getNewCustomerTrend(shopId, period)

   src/controllers/shop-owner/dashboard.controller.ts
   - GET /shop-owner/analytics/new-customers?start=&end=
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/page.tsx
   - Add "이번달 신규고객" card
   - Calendar date picker for range selection
   - Trend chart
   ```

**Files to Modify**:
- `everything_backend/src/services/shop-owner/analytics.service.ts`
- `everything_backend/src/controllers/shop-owner/dashboard.controller.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/page.tsx`
- `ebeautything-admin/src/components/dashboard/NewCustomersWidget.tsx` (new)

---

### 5.2 Customer Memo Feature

**Feedback**: 고객관리 고객별로 메모값 입력하기 기능

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Customer memo CRUD |
| Admin | Memo input in customer details |

**Database Schema Change**:
```sql
-- Migration: 003_add_customer_memos_table.sql
CREATE TABLE customer_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memo TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, customer_user_id)
);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-owner/customer.service.ts
   - getCustomerMemo(shopId, customerId)
   - saveCustomerMemo(shopId, customerId, memo)

   src/controllers/shop-owner/customer.controller.ts
   - GET /shop-owner/customers/:id/memo
   - PUT /shop-owner/customers/:id/memo
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/customers/page.tsx
   - Add memo field in customer detail view
   - Auto-save on blur
   - Show memo preview in customer list
   ```

**Files to Modify**:
- `everything_backend/src/migrations/003_add_customer_memos_table.sql` (new)
- `everything_backend/src/services/shop-owner/customer.service.ts`
- `everything_backend/src/controllers/shop-owner/customer.controller.ts`
- `everything_backend/src/routes/shop-owner/customer.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/customers/page.tsx`

---

### 5.3 Review Management with Replies

**Feedback**: '리뷰관리' 탭 - 점주가 고객들이 단 리뷰에 답글 달 수 있어야 함, 악성리뷰는 '블라인드 처리 요청'

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Display owner replies on reviews |
| Backend | Review reply API, blind request API |
| Admin | Review management page |

**Database Schema Change**:
```sql
-- Migration: 006_add_review_replies_table.sql
CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id),
  reply_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE review_blind_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  shop_id UUID NOT NULL REFERENCES shops(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-owner/review.service.ts
   - getShopReviews(shopId, filters)
   - replyToReview(reviewId, shopId, replyText)
   - requestBlind(reviewId, shopId, reason)

   src/controllers/shop-owner/review.controller.ts
   - GET /shop-owner/reviews
   - POST /shop-owner/reviews/:id/reply
   - POST /shop-owner/reviews/:id/blind-request
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/reviews/page.tsx (new)
   - List all reviews for shop
   - Reply input for each review
   - "블라인드 요청" button
   - Status indicators
   ```

3. **Super Admin**
   ```
   src/app/dashboard/moderation/blind-requests/page.tsx (new)
   - List blind requests
   - Approve/reject with notes
   ```

**Files to Modify**:
- `everything_backend/src/migrations/006_add_review_replies_table.sql` (new)
- `everything_backend/src/services/shop-owner/review.service.ts` (new)
- `everything_backend/src/controllers/shop-owner/review.controller.ts` (new)
- `everything_backend/src/routes/shop-owner/review.routes.ts` (new)
- `ebeautything-admin/src/app/dashboard/my-shop/reviews/page.tsx` (new)
- `ebeautything-admin/src/app/dashboard/moderation/blind-requests/page.tsx` (new)

---

### 5.4 Shop Tags Feature

**Feedback**: '샵 설정'에서 #내성발톱 #웨딩네일 #강남네일 등 태그 기능 추가

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Display tags on shop page, search by tags |
| Backend | Shop tags CRUD |
| Admin | Tag management in shop settings |

**Database Schema Change**:
```sql
-- Migration: 005_add_shop_tags_table.sql
CREATE TABLE shop_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shop_tags_shop ON shop_tags(shop_id);
CREATE INDEX idx_shop_tags_tag ON shop_tags(tag);
```

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop.service.ts
   - updateShopTags(shopId, tags[])
   - getPopularTags(limit)
   - searchByTag(tag)

   src/controllers/shop-owner/settings.controller.ts
   - PUT /shop-owner/settings/tags
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/settings/page.tsx
   - Tag input with autocomplete
   - Display existing tags as chips
   - Limit: 10 tags max
   ```

3. **Mobile App**
   ```
   src/app/shop/[id]/page.tsx
   - Display tags below shop name
   - Clickable → search by tag
   ```

**Files to Modify**:
- `everything_backend/src/migrations/005_add_shop_tags_table.sql` (new)
- `everything_backend/src/services/shop.service.ts`
- `everything_backend/src/controllers/shop-owner/settings.controller.ts`
- `everything_backend/src/routes/shop-owner/settings.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/settings/page.tsx`
- `ebeautything-app/src/app/shop/[id]/page.tsx`

---

### 5.5 Multi-Image Shop Profile

**Feedback**: '샵 설정'에서 입점된 대표 프로필 사진 5장까지 설정 가능하게끔

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Display multiple shop images (carousel) |
| Backend | Multiple image upload for shop profile |
| Admin | Multi-image uploader in shop settings |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop.service.ts
   - updateShopImages(shopId, images[]) -- max 5
   - Existing shop_images table should support this

   src/controllers/shop-owner/settings.controller.ts
   - PUT /shop-owner/settings/images
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/settings/page.tsx
   - Multi-image uploader (drag & drop)
   - Reorder images
   - Set primary image
   - Max 5 images indicator
   ```

3. **Mobile App**
   ```
   src/app/shop/[id]/page.tsx
   - Image carousel at top
   - Swipeable gallery
   ```

**Files to Modify**:
- `everything_backend/src/services/shop.service.ts`
- `everything_backend/src/controllers/shop-owner/settings.controller.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/settings/page.tsx`
- `ebeautything-admin/src/components/shops/MultiImageUploader.tsx` (new)
- `ebeautything-app/src/app/shop/[id]/page.tsx`
- `ebeautything-app/src/components/shop/ImageCarousel.tsx` (new)

---

### 5.6 Revenue by Service/Staff

**Feedback**: 시술별 매출 확인 및 관리, 직원별 매출 관리

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Revenue breakdown APIs |
| Admin | Revenue analytics pages |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/shop-owner/analytics.service.ts
   - getRevenueByService(shopId, startDate, endDate)
   - getRevenueByStaff(shopId, startDate, endDate)

   src/controllers/shop-owner/analytics.controller.ts
   - GET /shop-owner/analytics/revenue-by-service
   - GET /shop-owner/analytics/revenue-by-staff
   ```

2. **Admin**
   ```
   src/app/dashboard/my-shop/analytics/page.tsx
   - Add tabs: 전체 | 시술별 | 직원별
   - Charts for each breakdown
   - Date range picker
   ```

**Files to Modify**:
- `everything_backend/src/services/shop-owner/analytics.service.ts`
- `everything_backend/src/controllers/shop-owner/analytics.controller.ts`
- `everything_backend/src/routes/shop-owner/analytics.routes.ts`
- `ebeautything-admin/src/app/dashboard/my-shop/analytics/page.tsx`

---

## Phase 6: Advanced Features

### 6.1 Naver OAuth Integration

**Feedback**: 회원가입할 때 네이버 로그인 추가

| Component | Change Required |
|-----------|-----------------|
| Mobile App | Naver login button + OAuth flow |
| Backend | Naver OAuth provider integration |
| Admin | None |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/social-auth.service.ts
   - Add Naver OAuth handler
   - naverLogin(code, state)
   - naverCallback(code, state)

   src/controllers/auth.controller.ts
   - GET /api/auth/naver
   - GET /api/auth/naver/callback

   src/config/oauth.config.ts
   - Add Naver OAuth configuration
   ```

2. **Mobile App**
   ```
   src/app/(auth)/login/page.tsx
   - Add Naver login button
   - Naver brand styling (green)

   src/lib/auth/social-auth.ts
   - Add naverSignIn() function
   ```

**Naver Developer Setup Required**:
1. Register app at https://developers.naver.com
2. Configure OAuth redirect URL
3. Get Client ID and Secret
4. Add to .env files

**Files to Modify**:
- `everything_backend/src/services/social-auth.service.ts`
- `everything_backend/src/controllers/auth.controller.ts`
- `everything_backend/src/routes/auth.routes.ts`
- `everything_backend/src/config/oauth.config.ts`
- `ebeautything-app/src/app/(auth)/login/page.tsx`
- `ebeautything-app/src/lib/auth/social-auth.ts`

---

### 6.2 Shop-Only Notification System

**Feedback**: 입점된 샵들에게만 공지 및 알림 기능

| Component | Change Required |
|-----------|-----------------|
| Mobile App | None |
| Backend | Shop broadcast notification API |
| Admin | Shop broadcast UI |

**Implementation Steps**:

1. **Backend**
   ```
   src/services/notification.service.ts
   - sendToAllShops(message, type)
   - sendToShopsByCategory(category, message)

   src/controllers/admin/notification.controller.ts
   - POST /admin/notifications/shop-broadcast
   ```

2. **Admin**
   ```
   src/app/dashboard/system/shop-broadcast/page.tsx
   - Already exists - enhance with:
     - Category filter
     - Schedule sending
     - Template selection
   ```

**Files to Modify**:
- `everything_backend/src/services/notification.service.ts`
- `everything_backend/src/controllers/admin/notification.controller.ts`
- `ebeautything-admin/src/app/dashboard/system/shop-broadcast/page.tsx`

---

## Database Schema Changes

### Summary of All Migrations

| # | Migration File | Tables Added/Modified |
|---|----------------|----------------------|
| 1 | `001_add_popup_tables.sql` | `app_popups`, `popup_dismissals` |
| 2 | `002_add_saved_feeds_table.sql` | `saved_feeds` |
| 3 | `003_add_customer_memos_table.sql` | `customer_memos` |
| 4 | `004_add_feed_templates_table.sql` | `feed_templates` |
| 5 | `005_add_shop_tags_table.sql` | `shop_tags` |
| 6 | `006_add_review_replies_table.sql` | `review_replies`, `review_blind_requests` |
| 7 | `007_add_shop_entry_requests_table.sql` | `shop_entry_requests` |
| 8 | `008_add_settlement_schedule_table.sql` | `settlement_schedules` |
| 9 | `009_update_point_transactions_referrer.sql` | Alter `point_transactions` |

### Migration Execution Order

```bash
# Run migrations in order
npm run migrate
# Or manually:
npx drizzle-kit push:pg
```

---

## API Endpoints Required

### New Endpoints Summary

| Method | Endpoint | Phase | Purpose |
|--------|----------|-------|---------|
| GET | `/api/points/summary` | 2 | Point summary for home widget |
| GET | `/api/points/history` | 2 | Enhanced with date filters |
| GET | `/api/payments/history` | 2 | User payment history |
| POST | `/api/feed/posts/:id/save` | 3 | Save post |
| DELETE | `/api/feed/posts/:id/save` | 3 | Unsave post |
| GET | `/api/feed/saved` | 3 | Get saved posts |
| GET | `/api/users/:id/feed-profile` | 3 | User feed profile |
| GET | `/api/shops/nearby` | 4 | Nearby shops with geo |
| GET | `/api/home/sections` | 4 | All home sections |
| GET | `/api/popups/active` | 4 | Active popups |
| POST | `/api/popups/:id/dismiss` | 4 | Dismiss popup |
| POST | `/api/shop-entry-requests` | 4 | Submit entry request |
| PATCH | `/shop-owner/reservations/:id/no-show` | 1 | Mark no-show |
| GET | `/shop-owner/analytics/new-customers` | 5 | New customer stats |
| GET/PUT | `/shop-owner/customers/:id/memo` | 5 | Customer memo |
| GET | `/shop-owner/reviews` | 5 | Shop reviews |
| POST | `/shop-owner/reviews/:id/reply` | 5 | Reply to review |
| POST | `/shop-owner/reviews/:id/blind-request` | 5 | Request blind |
| PUT | `/shop-owner/settings/tags` | 5 | Update shop tags |
| PUT | `/shop-owner/settings/images` | 5 | Update shop images |
| GET | `/shop-owner/settlements/upcoming` | 2 | Upcoming settlement |
| CRUD | `/shop-owner/feed-templates` | 3 | Feed templates |
| GET | `/shop-owner/analytics/revenue-by-service` | 5 | Revenue breakdown |
| GET | `/shop-owner/analytics/revenue-by-staff` | 5 | Staff revenue |
| GET/POST | `/api/auth/naver/*` | 6 | Naver OAuth |
| CRUD | `/admin/popups` | 4 | Popup management |
| GET/PATCH | `/admin/shop-entry-requests` | 4 | Entry requests |
| CRUD | `/admin/editor-picks` | 4 | Editor picks |
| GET/PATCH | `/admin/blind-requests` | 5 | Blind request moderation |
| POST | `/admin/notifications/shop-broadcast` | 6 | Shop notifications |

---

## Testing Strategy

### Unit Tests Required

```
tests/unit/
├── services/
│   ├── popup.service.test.ts
│   ├── settlement.service.test.ts
│   ├── feed-template.service.test.ts
│   └── shop-entry-request.service.test.ts
├── controllers/
│   └── [corresponding controller tests]
└── utils/
    └── geo-utils.test.ts
```

### Integration Tests Required

```
tests/integration/
├── popup-flow.test.ts
├── saved-feeds.test.ts
├── review-reply.test.ts
├── customer-memo.test.ts
└── naver-oauth.test.ts
```

### E2E Tests Required

```
tests/e2e/
├── home-sections.test.ts
├── point-summary.test.ts
├── shop-admin-reviews.test.ts
└── popup-dismiss.test.ts
```

---

## Rollout Plan

### Pre-Deployment Checklist

- [ ] All migrations tested on staging
- [ ] Environment variables configured
- [ ] Supabase storage buckets created
- [ ] Naver OAuth app registered (Phase 6)
- [ ] Kakao Map API key verified
- [ ] FCM templates updated

### Deployment Order

1. **Backend First**
   - Run database migrations
   - Deploy backend with new APIs
   - Verify API health

2. **Admin Panel**
   - Deploy admin panel updates
   - Verify shop owner features

3. **Mobile App**
   - Deploy mobile app updates
   - Monitor for errors

### Feature Flags Recommended

```typescript
// Feature flags for gradual rollout
FEATURE_NEARBY_MAP: boolean
FEATURE_POPUP_SYSTEM: boolean
FEATURE_SAVED_FEEDS: boolean
FEATURE_NAVER_LOGIN: boolean
FEATURE_EDITOR_PICKS: boolean
```

### Monitoring Points

- [ ] Point summary API response times
- [ ] Popup image load performance
- [ ] Map initialization success rate
- [ ] OAuth success/failure rates
- [ ] Push notification delivery rates

---

## Appendix A: File Change Summary

### Backend Files (New)

```
src/services/popup.service.ts
src/services/settlement.service.ts
src/services/feed-template.service.ts
src/services/shop-entry-request.service.ts
src/services/home.service.ts
src/services/shop-owner/review.service.ts
src/controllers/popup.controller.ts
src/controllers/home.controller.ts
src/controllers/shop-entry-request.controller.ts
src/controllers/shop-owner/review.controller.ts
src/routes/popup.routes.ts
src/routes/home.routes.ts
src/routes/shop-entry-request.routes.ts
src/routes/shop-owner/review.routes.ts
src/routes/admin/popup.routes.ts
src/migrations/001-009 (9 migration files)
```

### Mobile App Files (New)

```
src/app/nearby/page.tsx
src/app/feed/profile/page.tsx
src/app/feed/saved/page.tsx
src/app/shop-request/page.tsx
src/app/profile/payments/page.tsx
src/components/home/PointSummaryWidget.tsx
src/components/home/ShopSection.tsx
src/components/home/EditorPickCard.tsx
src/components/map/ShopMap.tsx
src/components/popup/AppPopup.tsx
src/components/points/DateRangePicker.tsx
src/components/profile/ReferralCodeWidget.tsx
src/components/shop/ImageCarousel.tsx
src/hooks/use-popup.ts
```

### Admin Panel Files (New)

```
src/app/dashboard/system/popups/page.tsx
src/app/dashboard/system/editor-picks/page.tsx
src/app/dashboard/system/shop-requests/page.tsx
src/app/dashboard/my-shop/reviews/page.tsx
src/app/dashboard/moderation/blind-requests/page.tsx
src/components/popups/PopupForm.tsx
src/components/feed/TemplateSelector.tsx
src/components/shops/MultiImageUploader.tsx
src/components/dashboard/NewCustomersWidget.tsx
```

---

## Appendix B: Estimated Effort by Role

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Total |
|------|---------|---------|---------|---------|---------|---------|-------|
| Backend Dev | 1d | 3d | 3d | 5d | 4d | 3d | 19d |
| Mobile Dev | 2d | 2d | 3d | 4d | 1d | 1d | 13d |
| Admin Dev | 0.5d | 2d | 1d | 2d | 4d | 0.5d | 10d |
| QA | 1d | 1d | 1d | 2d | 2d | 1d | 8d |

**Total Estimated Effort**: ~50 person-days

---

*Document Version: 1.0*
*Last Updated: 2025-12-08*
