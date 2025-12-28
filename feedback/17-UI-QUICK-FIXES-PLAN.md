# 17-UI-QUICK-FIXES Implementation Plan

## Overview
This document outlines the detailed implementation plan for UI quick fixes based on feedback items 3, 5, 10, 15, 18, and 30.

**Created**: December 17, 2025
**Status**: Ready for Implementation

---

## Summary of Feedback Items

| Line | Description (Korean) | Description (English) | Scope |
|------|---------------------|----------------------|-------|
| 3 | 하단에 '찜'은 마이페이지로 이동 | Move favorites tab from bottom nav to MyPage | Frontend Only |
| 5 | 홈 화면에 '헤어' 누르면 '서비스 준비중입니다' | Show "Service coming soon" when clicking Hair category | Frontend Only |
| 10 | 필터에서 헤어/네일/속눈썹/왁싱만, 서울만 선택가능 | Restrict filters to specific categories and Seoul only | Frontend Only |
| 15 | 마이페이지에 '내가 올린 피드' 삭제 | Delete my feed posts from MyPage | Frontend + Backend (exists) |
| 18 | 마이페이지 상단에 내추천코드, 링크복사, 공유하기 | Add referral code section at top of MyPage | Frontend + Backend (exists) |
| 30 | 확정/거절 외 노쇼버튼 추가 | Add no-show button to admin reservation management | Frontend + Backend (exists) |

---

## Item 3: Move Favorites to MyPage

### Current State
- **BottomNav.tsx** (`ebeautything-app/src/components/layout/BottomNav.tsx:9-15`)
  - Contains 5 nav items: 홈, 피드, 예약, 찜, 마이
  - `{ href: '/favorites', label: '찜', icon: Heart }`
- **Profile Page** (`ebeautything-app/src/app/profile/page.tsx`)
  - Does not include favorites section in "내 활동" card

### Implementation Plan

#### Step 1: Update BottomNav.tsx
**File**: `/home/bitnami/ebeautything-app/src/components/layout/BottomNav.tsx`

```typescript
// REMOVE this from navItems array:
{ href: '/favorites', label: '찜', icon: Heart },

// Final navItems should be:
const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/feed', label: '피드', icon: Rss },
  { href: '/bookings', label: '예약', icon: Calendar },
  { href: '/profile', label: '마이', icon: User },
];
```

#### Step 2: Add Favorites to Profile Page
**File**: `/home/bitnami/ebeautything-app/src/app/profile/page.tsx`

Add to "내 활동" Card (around line 429):
```typescript
<MenuItem
  icon={Heart}
  title="내 즐겨찾기"
  subtitle={`${favoritesCount}개`}
  onClick={() => router.push('/favorites')}
/>
```

Also need to import the hook:
```typescript
import { useFavoritesCount } from '@/hooks/use-favorites-unified';
// In component:
const favoritesCount = useFavoritesCount();
```

### Test Plan

#### Test 3.1: Verify BottomNav Change
```bash
# Visual Test
1. Open app at http://localhost:5003
2. Verify bottom nav shows only 4 items: 홈, 피드, 예약, 마이
3. Verify no '찜' tab exists in bottom nav
```

#### Test 3.2: Verify Favorites in Profile
```bash
# Visual Test
1. Log in with test user: testuser@example.com / TestUser123!
2. Navigate to /profile
3. Verify "내 활동" section shows "내 즐겨찾기" menu item
4. Click "내 즐겨찾기"
5. Verify navigation to /favorites page
```

#### Test 3.3: Verify Favorites Count
```bash
# API Test
curl -H "Authorization: Bearer <token>" http://localhost:4001/api/user/favorites/ids
# Should return list of favorite shop IDs

# Visual Test
1. Add a shop to favorites
2. Navigate to profile
3. Verify count updates next to "내 즐겨찾기"
```

---

## Item 5: Hair Category Shows "Coming Soon"

### Current State
- **page.tsx** (`ebeautything-app/src/app/page.tsx:42-47`)
  - Hair category already has `enabled: false`
  - Currently just doesn't navigate (does nothing visually)

### Implementation Plan

#### Step 1: Add Toast Notification
**File**: `/home/bitnami/ebeautything-app/src/app/page.tsx`

Update the onClick handler (around line 417-421):
```typescript
onClick={(e) => {
  if (!category.enabled) {
    e.preventDefault();
    toast({
      title: '서비스 준비중',
      description: `${category.label} 서비스는 곧 오픈 예정입니다.`,
    });
  }
}}
```

Import toast at top:
```typescript
import { toast } from '@/hooks/use-toast';
```

### Test Plan

#### Test 5.1: Verify Disabled Category Behavior
```bash
# Visual Test
1. Open app at http://localhost:5003
2. Scroll to categories section
3. Verify '헤어' category appears with disabled styling (opacity-50)
4. Click on '헤어' category
5. Verify toast appears with "서비스 준비중" title
6. Verify toast shows "헤어 서비스는 곧 오픈 예정입니다." description
```

#### Test 5.2: Verify Other Categories Still Work
```bash
# Visual Test
1. Click on '네일' category
2. Verify navigation to /shops?category=nail
3. Click on '속눈썹' category
4. Verify navigation to /shops?category=eyelash
5. Click on '왁싱/눈썹문신' category
6. Verify navigation to /shops?category=waxing
```

---

## Item 10: Restrict Filters to Specific Categories and Seoul Only

### Current State (INVESTIGATED)
- **Category Filter**: `ebeautything-app/src/components/search/filters/category-filter.tsx`
  - Currently shows 10 categories: HAIR, NAIL, SKINCARE, MAKEUP, MASSAGE, SPA, EYEBROW, EYELASH, WAXING, TATTOO
  - Uses `CATEGORY_OPTIONS` array (lines 26-92)

- **District Filter**: `ebeautything-app/src/components/search/filters/district-filter.tsx`
  - Currently shows 17 cities (서울, 부산, 대구, 인천, etc.) in `MAJOR_CITIES` array (lines 45-63)
  - Seoul districts in `SEOUL_DISTRICTS` array (lines 16-42)

### Implementation Plan

#### Step 1: Restrict Category Filter
**File**: `/home/bitnami/ebeautything-app/src/components/search/filters/category-filter.tsx`

Modify `CATEGORY_OPTIONS` array to only include allowed categories:

```typescript
// BEFORE: 10 categories
// AFTER: Only 3 categories (matching home page enabled categories)

const CATEGORY_OPTIONS: Array<{
  value: ShopCategory;
  label: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    value: ShopCategory.NAIL,
    label: '네일',
    icon: Palette,
    description: '네일아트, 매니큐어',
  },
  {
    value: ShopCategory.EYELASH,
    label: '속눈썹',
    icon: EyeIcon,
    description: '속눈썹연장, 펌',
  },
  {
    value: ShopCategory.WAXING,
    label: '왁싱/눈썹문신',
    icon: Waxing,
    description: '제모, 왁싱, 눈썹문신',
  },
];
```

**REMOVED categories**: HAIR, SKINCARE, MAKEUP, MASSAGE, SPA, EYEBROW, TATTOO

#### Step 2: Restrict Location to Seoul Only
**File**: `/home/bitnami/ebeautything-app/src/components/search/filters/district-filter.tsx`

Modify `MAJOR_CITIES` array to only show Seoul:

```typescript
// BEFORE: 17 cities
const MAJOR_CITIES = ['서울', '부산', '대구', '인천', ...];

// AFTER: Only Seoul
const MAJOR_CITIES = ['서울'];
```

Or optionally, remove city selection entirely and default to Seoul with districts.

### Test Plan

#### Test 10.1: Verify Category Filter Restriction
```bash
# Visual Test
1. Navigate to search page or use filter panel
2. Open category filter dropdown
3. Verify only these categories appear:
   - 네일
   - 속눈썹
   - 왁싱/눈썹문신
4. Verify these do NOT appear: 헤어, 피부관리, 메이크업, 마사지, 스파, 눈썹, 타투
```

#### Test 10.2: Verify Location Filter Restriction
```bash
# Visual Test
1. Navigate to search page or use filter panel
2. Open location/city filter
3. Verify only '서울' appears in city options
4. Verify other cities (부산, 대구, 인천, etc.) do NOT appear
5. When Seoul is selected, verify all 25 Seoul districts appear
```

---

## Item 15: Delete My Feed Posts from MyPage

### Current State
- **Profile Page** (`ebeautything-app/src/app/profile/page.tsx:436-439`)
  - Already has "내가 올린 피드" menu item pointing to `/profile/posts`
- **My Posts Page** (`ebeautything-app/src/app/profile/posts/page.tsx`)
  - Already has delete functionality with `useDeletePost` hook
  - Uses `FeedPostCard` component with delete handler

### Backend API Status
**Route**: DELETE `/api/user/posts/:postId`
- Need to verify endpoint exists

### Implementation Plan

#### Step 1: Verify Backend API Exists
Check for feed post delete endpoint in backend routes.

**Files to check**:
- `/home/bitnami/everything_backend/src/routes/user-feed.routes.ts`
- `/home/bitnami/everything_backend/src/routes/feed.routes.ts`

#### Step 2: Test Current Implementation
The frontend implementation may already be complete. Test to verify.

### Test Plan

#### Test 15.1: Verify Backend API
```bash
# API Test - First get a post ID
curl -H "Authorization: Bearer <token>" http://localhost:4001/api/user/posts?limit=1

# Then test delete (replace <postId> with actual ID)
curl -X DELETE -H "Authorization: Bearer <token>" http://localhost:4001/api/user/posts/<postId>
# Should return success response
```

#### Test 15.2: Verify Frontend Delete Flow
```bash
# Visual Test
1. Log in with test user
2. Navigate to /profile
3. Click "내가 올린 피드"
4. Verify posts page loads with user's posts
5. Click delete button on a post
6. Verify confirmation dialog appears
7. Confirm delete
8. Verify toast shows "삭제 완료"
9. Verify post is removed from list
```

#### Test 15.3: Verify Error Handling
```bash
# Visual Test
1. Attempt to delete a post while offline
2. Verify error toast appears
3. Verify post is NOT removed from list
```

---

## Item 18: Add Referral Code to Top of MyPage

### Current State
- **ReferralCodeShare Component** (`ebeautything-app/src/components/referrals/referral-code-share.tsx`)
  - Already exists with copy/share functionality
  - Uses `navigator.share` API for native sharing
- **Profile Page** - Does not include referral code section at top
- **Backend API**: GET `/referrals/stats` returns referral code in `stats.referralCode`

### Implementation Plan

#### Step 1: Add Referral Section to Profile Page
**File**: `/home/bitnami/ebeautything-app/src/app/profile/page.tsx`

Add after Profile Header Card (around line 346):
```typescript
import ReferralCodeShare from '@/components/referrals/referral-code-share';
import { ReferralAPI } from '@/lib/api/referral-api';

// Add to queries (around line 117):
const { data: referralStats, isLoading: referralLoading } = useQuery({
  queryKey: ['referrals', 'stats'],
  queryFn: ReferralAPI.getMyReferralStats,
  enabled: isAuthenticated && !authLoading,
  ...CACHE_TIMES.LONG,
});

// Add after Profile Header Card (around line 346):
{user && referralStats?.data?.stats?.referralCode && (
  <ReferralCodeShare
    referralCode={referralStats.data.stats.referralCode}
  />
)}
```

### Test Plan

#### Test 18.1: Verify Backend API Returns Referral Code
```bash
# API Test
curl -H "Authorization: Bearer <token>" http://localhost:4001/api/referrals/stats
# Should return response with stats.referralCode
```

#### Test 18.2: Verify Referral Section Appears in Profile
```bash
# Visual Test
1. Log in with test user
2. Navigate to /profile
3. Verify referral code section appears after profile card
4. Verify referral code is displayed
```

#### Test 18.3: Verify Copy Functionality
```bash
# Visual Test
1. Click "코드 복사" button next to referral code
2. Verify checkmark icon appears briefly
3. Verify toast shows "추천 코드가 복사되었습니다!"
4. Paste in another app to verify clipboard contents
```

#### Test 18.4: Verify Link Copy
```bash
# Visual Test
1. Click "링크 복사" button
2. Verify toast shows "추천 링크가 복사되었습니다!"
3. Paste to verify URL format: https://[domain]/register?ref=<CODE>
```

#### Test 18.5: Verify Share Functionality (Mobile)
```bash
# Mobile Visual Test
1. Open profile page on mobile device
2. Click "공유하기" button
3. Verify native share sheet opens
4. Verify shared content includes referral link
```

---

## Item 30: Add No-Show Button to Admin

### Current State
- **Admin Reservation Detail** (`ebeautything-admin/src/app/dashboard/my-shop/reservations/[id]/page.tsx`)
  - Has confirm, reject, and complete buttons
  - Status map already includes `no_show: { label: '노쇼', variant: 'destructive' }` (line 192-199)
  - Missing no-show action button

### Backend API Status
- **Endpoint**: PATCH `/api/shops/:shopId/reservations/:reservationId`
- **Supports**: `status: 'no_show'` (confirmed in shop-reservations.routes.ts line 178)
- **ShopOwnerService**: `updateReservationStatus` supports `no_show` status (line 906-926)

### Implementation Plan

#### Step 1: Add No-Show Button and Dialog
**File**: `/home/bitnami/ebeautything-admin/src/app/dashboard/my-shop/reservations/[id]/page.tsx`

Add state for no-show dialog (around line 78):
```typescript
// No-show dialog state
const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
const [noShowReason, setNoShowReason] = useState('');
const [markingNoShow, setMarkingNoShow] = useState(false);
```

Add canMarkNoShow condition (around line 237):
```typescript
const canMarkNoShow = reservation.status === 'confirmed';
```

Add no-show handler (around line 189):
```typescript
// Mark as no-show
const handleNoShow = async () => {
  if (!user?.shopId) {
    toast.error('Shop ID not found. Please login again.');
    return;
  }

  setMarkingNoShow(true);
  try {
    const response = await ShopOwnerService.updateReservationStatus(
      user.shopId,
      id,
      {
        status: 'no_show',
        notes: noShowReason || '고객 노쇼',
        notifyCustomer: true
      }
    );
    toast.success('노쇼 처리되었습니다');
    setNoShowDialogOpen(false);
    setNoShowReason('');
    // Update reservation state and sessionStorage
    const updatedReservation = response.reservation;
    setReservation(updatedReservation);
    sessionStorage.setItem(`reservation_${id}`, JSON.stringify(updatedReservation));
  } catch (error) {
    console.error('Failed to mark no-show:', error);
    toast.error('노쇼 처리에 실패했습니다');
  } finally {
    setMarkingNoShow(false);
  }
};
```

Add no-show button (around line 530):
```typescript
{canMarkNoShow && (
  <Button
    variant="outline"
    onClick={() => setNoShowDialogOpen(true)}
    className="flex items-center gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
  >
    <AlertCircle className="h-4 w-4" />
    노쇼 처리
  </Button>
)}
```

Add no-show dialog (after Complete Dialog, around line 644):
```typescript
{/* No-Show Dialog */}
<Dialog open={noShowDialogOpen} onOpenChange={setNoShowDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>노쇼 처리</DialogTitle>
      <DialogDescription>
        고객이 예약 시간에 방문하지 않았습니까? 노쇼로 처리하면 고객에게 알림이 전송됩니다.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="noshow-reason">노쇼 사유 (선택사항)</Label>
        <Input
          id="noshow-reason"
          placeholder="노쇼 사유를 입력하세요"
          value={noShowReason}
          onChange={(e) => setNoShowReason(e.target.value)}
        />
      </div>
    </div>
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setNoShowDialogOpen(false)}
        disabled={markingNoShow}
      >
        취소
      </Button>
      <Button
        variant="destructive"
        onClick={handleNoShow}
        disabled={markingNoShow}
        className="bg-orange-600 hover:bg-orange-700"
      >
        {markingNoShow ? '처리중...' : '노쇼 처리'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Test Plan

#### Test 30.1: Verify Backend API Supports No-Show
```bash
# API Test - Update reservation to no_show
curl -X PATCH \
  -H "Authorization: Bearer <shop_owner_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "no_show", "notes": "고객 노쇼"}' \
  http://localhost:4001/api/shops/<shopId>/reservations/<reservationId>

# Should return updated reservation with status: 'no_show'
```

#### Test 30.2: Verify No-Show Button Visibility
```bash
# Visual Test
1. Log in to admin panel with shop owner credentials
2. Navigate to /dashboard/my-shop/reservations
3. Click on a reservation with "확정" status
4. Verify "노쇼 처리" button appears in action buttons
5. Verify button has orange styling
```

#### Test 30.3: Verify No-Show Button NOT Shown for Other Statuses
```bash
# Visual Test
1. View a reservation with "대기중" status
2. Verify "노쇼 처리" button does NOT appear
3. View a reservation with "완료" status
4. Verify "노쇼 처리" button does NOT appear
5. View a reservation with "취소" status
6. Verify "노쇼 처리" button does NOT appear
```

#### Test 30.4: Verify No-Show Flow
```bash
# Visual Test
1. View a confirmed reservation
2. Click "노쇼 처리" button
3. Verify dialog opens with:
   - Title: "노쇼 처리"
   - Optional reason input field
   - Cancel and Submit buttons
4. Enter reason (optional): "연락 불가"
5. Click "노쇼 처리" button in dialog
6. Verify toast shows "노쇼 처리되었습니다"
7. Verify reservation status badge changes to "노쇼" (red)
8. Verify button is no longer visible
```

#### Test 30.5: Verify No-Show Persists After Page Reload
```bash
# Visual Test
1. After marking no-show, refresh the page
2. Navigate back to the same reservation
3. Verify status is still "노쇼"
4. Verify no action buttons are available
```

---

## Implementation Order

Recommended implementation order based on complexity and dependencies:

1. **Item 5** (Lowest complexity) - Add toast to disabled category
2. **Item 3** (Low complexity) - Move favorites to profile
3. **Item 18** (Medium complexity) - Add referral section to profile
4. **Item 15** (Medium complexity) - Verify/fix feed delete
5. **Item 30** (Medium complexity) - Add no-show button to admin
6. **Item 10** (Medium complexity) - Restrict filters (requires more investigation)

---

## Files to Modify

### Frontend App (ebeautything-app)
| File | Items |
|------|-------|
| `src/components/layout/BottomNav.tsx` | 3 |
| `src/app/page.tsx` | 5 |
| `src/app/profile/page.tsx` | 3, 18 |
| `src/components/search/filters/category-filter.tsx` | 10 |
| `src/components/search/filters/district-filter.tsx` | 10 |

### Admin Panel (ebeautything-admin)
| File | Items |
|------|-------|
| `src/app/dashboard/my-shop/reservations/[id]/page.tsx` | 30 |

### Backend (everything_backend)
| File | Items |
|------|-------|
| None (all APIs already exist) | - |

---

## Risk Assessment

| Item | Risk | Mitigation |
|------|------|------------|
| 3 | Users may look for favorites in old location | Add navigation hint in first use |
| 5 | Hair category visibility still shows disabled | Consider hiding completely |
| 10 | May affect existing saved filters | Clear saved filters on update |
| 15 | Delete may fail if post has comments | Handle cascade delete in backend |
| 18 | Referral code generation may fail for new users | Add fallback UI state |
| 30 | No-show may be clicked accidentally | Require confirmation dialog |

---

## Rollback Plan

Each change can be independently rolled back by:
1. Reverting the specific file changes
2. Redeploying the affected service

No database migrations are required for these changes.

---

## Validation Test Results (December 17, 2025)

### Backend API Verification

| API | Endpoint | Status | Response |
|-----|----------|--------|----------|
| Feed Delete (Item 15) | `DELETE /api/user/feed/posts/:postId` | ✅ EXISTS | 401 (auth required) |
| Referral Stats (Item 18) | `GET /api/referrals/stats` | ✅ EXISTS | 401 (auth required) |
| No-Show Status (Item 30) | `PATCH /api/shops/:shopId/reservations/:reservationId` | ✅ EXISTS | 401 (auth required) |

### Backend Code Verification

| Item | File | Line | Verified |
|------|------|------|----------|
| 15 | `user-feed.routes.ts` | 316 | ✅ `router.delete('/posts/:postId'` |
| 18 | `referral.routes.ts` | 124-128 | ✅ `router.get('/stats'` |
| 18 | `referral.service.ts` | 317 | ✅ Returns `referralCode` in stats |
| 30 | `shop-reservations.routes.ts` | 177 | ✅ `no_show` in enum |
| 30 | `shop-owner.ts` (admin) | 910 | ✅ `no_show` status supported |

### Frontend Component Verification

| Item | Component/Hook | File | Status |
|------|----------------|------|--------|
| 3 | `useFavoritesCount` | `hooks/use-favorites-unified.ts:163` | ✅ EXISTS |
| 5 | Toast component | Already in use across app | ✅ EXISTS |
| 15 | `useDeletePost` | `hooks/use-feed.ts:276` | ✅ EXISTS |
| 15 | `FeedAPI.deletePost` | `lib/api/feed-api.ts:374` | ✅ EXISTS |
| 18 | `ReferralCodeShare` | `components/referrals/referral-code-share.tsx` | ✅ EXISTS |
| 30 | Dialog, Button, etc. | Already imported in admin page | ✅ EXISTS |
| 30 | `ShopOwnerService` | `services/shop-owner.ts:906-913` | ✅ EXISTS |

### Summary

All required backend APIs and frontend components exist. Implementation requires:
- **0 new backend endpoints** (all APIs already support required functionality)
- **0 database migrations** (no schema changes needed)
- **Frontend-only changes** for Items 3, 5, 10, 15, 18
- **Admin panel changes** for Item 30

### Implementation Readiness

| Item | Backend Ready | Frontend Ready | Complexity | Est. Changes |
|------|---------------|----------------|------------|--------------|
| 3 | N/A | ✅ | Low | 2 files |
| 5 | N/A | ✅ | Low | 1 file |
| 10 | N/A | ✅ | Low | 2 files |
| 15 | ✅ | ✅ | Low | Already Done |
| 18 | ✅ | ✅ | Low | 1 file |
| 30 | ✅ | ✅ | Medium | 1 file |

### Note on Item 10 (Filter Restrictions) - RESOLVED

**Investigation Complete:**
- **Category Filter**: `src/components/search/filters/category-filter.tsx`
  - Modify `CATEGORY_OPTIONS` array to remove non-allowed categories
  - Keep only: NAIL, EYELASH, WAXING

- **District Filter**: `src/components/search/filters/district-filter.tsx`
  - Modify `MAJOR_CITIES` array to only include '서울'
  - All Seoul districts already defined in `SEOUL_DISTRICTS`

### Note on Item 15 (Feed Delete)

Item 15 appears to already be implemented:
- `useDeletePost` hook exists and is used in `profile/posts/page.tsx`
- Delete confirmation dialog is already present
- Just needs verification that it works correctly
