# Implementation Plan: UI Quick Fixes

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High (Quick Wins) |
| **Estimated Effort** | 3-5 hours |
| **Risk Level** | Low |
| **Components Affected** | Frontend + Backend (minimal) + Admin |
| **Dependencies** | None |

## Feedback Items Covered

This plan addresses 6 quick win UI adjustments from Phase 1:

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 하단에 '찜'은 마이페이지로 이동 | Frontend |
| 2 | 홈 화면에 '헤어'를 누르면 '서비스 준비중' 메세지 | Frontend |
| 3 | 필터에서 헤어/네일/속눈썹/왁싱만, 지역도 '서울'만 | Frontend |
| 4 | 마이페이지에 '내가 올린 피드' 삭제 | Frontend |
| 5 | 마이페이지 최상단에 추천코드/링크복사/공유하기 | Frontend |
| 6 | 확정/거절 외 노쇼버튼 추가 | Backend + Admin |

---

## 1. Move '찜' (Favorites) to MyPage

**Feedback:** 하단에 '찜'은 마이페이지로 이동

### Frontend Changes

**File:** `src/components/layout/BottomNav.tsx`

```tsx
// BEFORE: 5 tabs
// Home | Feed | Favorites | Bookings | Profile

// AFTER: 4 tabs
// Home | Feed | Bookings | Profile

const navItems = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/feed', icon: Newspaper, label: '피드' },
  // REMOVED: { href: '/favorites', icon: Heart, label: '찜' },
  { href: '/bookings', icon: Calendar, label: '예약' },
  { href: '/profile', icon: User, label: '마이' },
];
```

**File:** `src/app/profile/page.tsx`

```tsx
// Add Favorites link in MyPage menu

<Link href="/favorites" className="flex items-center justify-between p-4 border-b">
  <div className="flex items-center gap-3">
    <Heart className="h-5 w-5 text-red-500" />
    <span>내 찜 목록</span>
  </div>
  <div className="flex items-center gap-2">
    <Badge variant="secondary">{favoriteCount}</Badge>
    <ChevronRight className="h-5 w-5 text-gray-400" />
  </div>
</Link>
```

---

## 2. '헤어' Service Unavailable Message

**Feedback:** 홈 화면에 '헤어'를 누르면 하단에 '서비스 준비중입니다' 메세지

### Frontend Changes

**File:** `src/components/home/CategoryList.tsx` (or equivalent)

```tsx
'use client';

import { useToast } from '@/hooks/use-toast';

const categories = [
  { id: 'nail', name: '네일', icon: '💅', enabled: true },
  { id: 'eyelash', name: '속눈썹', icon: '👁️', enabled: true },
  { id: 'waxing', name: '왁싱/눈썹', icon: '✨', enabled: true },
  { id: 'hair', name: '헤어', icon: '💇', enabled: false }, // DISABLED
];

export function CategoryList() {
  const router = useRouter();
  const { toast } = useToast();

  const handleCategoryClick = (category: typeof categories[0]) => {
    if (!category.enabled) {
      toast({
        title: '서비스 준비중',
        description: '서비스 준비중입니다. 곧 만나요!',
        duration: 2000,
      });
      return;
    }
    router.push(`/search?category=${category.id}`);
  };

  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category)}
          className={cn(
            'flex flex-col items-center gap-2 p-3 rounded-xl transition-colors',
            category.enabled
              ? 'bg-gray-50 hover:bg-gray-100'
              : 'bg-gray-100 opacity-50 cursor-not-allowed'
          )}
        >
          <span className="text-2xl">{category.icon}</span>
          <span className={cn(
            'text-xs font-medium',
            !category.enabled && 'text-gray-400'
          )}>
            {category.name}
          </span>
        </button>
      ))}
    </div>
  );
}
```

---

## 3. Search Filter Restrictions

**Feedback:** 필터에서 헤어, 네일, 속눈썹, 왁싱/눈썹문신 만. 지역도 '서울'만 클릭 가능

### Frontend Changes

**File:** `src/components/search/FilterModal.tsx` (or equivalent)

```tsx
// Category options - limited to 4, hair disabled
const categoryOptions = [
  { value: 'nail', label: '네일', enabled: true },
  { value: 'eyelash', label: '속눈썹', enabled: true },
  { value: 'waxing', label: '왁싱/눈썹문신', enabled: true },
  { value: 'hair', label: '헤어', enabled: false },
];

// Region options - only Seoul enabled
const regionOptions = [
  { value: 'seoul', label: '서울', enabled: true },
  { value: 'gyeonggi', label: '경기', enabled: false },
  { value: 'incheon', label: '인천', enabled: false },
  { value: 'busan', label: '부산', enabled: false },
  // ... other regions disabled
];

// In the filter component
{categoryOptions.map((option) => (
  <button
    key={option.value}
    disabled={!option.enabled}
    onClick={() => option.enabled && setCategory(option.value)}
    className={cn(
      'px-4 py-2 rounded-full text-sm',
      option.enabled
        ? category === option.value
          ? 'bg-primary text-white'
          : 'bg-gray-100 hover:bg-gray-200'
        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
    )}
  >
    {option.label}
    {!option.enabled && ' (준비중)'}
  </button>
))}

// Same pattern for regions
{regionOptions.map((option) => (
  <button
    key={option.value}
    disabled={!option.enabled}
    onClick={() => {
      if (!option.enabled) {
        toast({
          title: '서비스 준비중',
          description: '해당 지역은 서비스 준비중입니다.',
        });
        return;
      }
      setRegion(option.value);
    }}
    className={cn(
      'px-4 py-2 rounded-full text-sm',
      option.enabled
        ? region === option.value
          ? 'bg-primary text-white'
          : 'bg-gray-100 hover:bg-gray-200'
        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
    )}
  >
    {option.label}
  </button>
))}
```

---

## 4. Remove '내가 올린 피드' from MyPage

**Feedback:** 마이페이지에 '내가 올린 피드' 삭제

### Frontend Changes

**File:** `src/app/profile/page.tsx`

```tsx
// REMOVE this section:
// <Link href="/profile/posts">
//   <div className="flex items-center justify-between p-4">
//     <span>내가 올린 피드</span>
//     <ChevronRight />
//   </div>
// </Link>

// Keep the page /profile/posts but remove navigation to it
// Users can still access via direct URL if needed
```

---

## 5. Reorganize MyPage Referral Section

**Feedback:** 마이페이지 최상단에 닉네임/이메일 수정 바로 밑에 내추천코드와 링크복사/공유하기

### Frontend Changes

**File:** `src/app/profile/page.tsx`

```tsx
export default function ProfilePage() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    // Fetch referral code
    fetchReferralCode();
  }, []);

  const copyReferralLink = async () => {
    const link = `https://app.e-beautything.com/invite?code=${referralCode}`;
    await navigator.clipboard.writeText(link);
    toast({ title: '링크가 복사되었습니다!' });
  };

  const shareReferral = async () => {
    const shareData = {
      title: '에뷰리띵 초대',
      text: `${user?.nickname}님이 에뷰리띵에 초대했습니다!`,
      url: `https://app.e-beautything.com/invite?code=${referralCode}`,
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      copyReferralLink();
    }
  };

  return (
    <div>
      {/* Profile Header */}
      <section className="p-4 bg-white">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16" />
          <div>
            <h2 className="font-semibold">{user?.nickname}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <Link href="/profile/edit" className="ml-auto">
            <Button variant="outline" size="sm">수정</Button>
          </Link>
        </div>
      </section>

      {/* NEW: Referral Code Section - Right after profile */}
      <section className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">내 추천 코드</p>
            <p className="text-lg font-bold text-primary">{referralCode}</p>
          </div>
          <Badge variant="outline">친구 초대</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={copyReferralLink}
          >
            <Copy className="h-4 w-4 mr-1" />
            링크 복사
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={shareReferral}
          >
            <Share2 className="h-4 w-4 mr-1" />
            공유하기
          </Button>
        </div>
      </section>

      {/* Rest of profile menu items */}
      {/* ... */}
    </div>
  );
}
```

---

## 6. Add No-Show Button

**Feedback:** 확정 / 거절 외 노쇼버튼 추가

### Backend Changes

**File:** `src/types/reservation.types.ts`

```typescript
// Add 'no_show' to ReservationStatus enum
export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show' // NEW
  | 'refunded';
```

**File:** `src/services/reservation.service.ts`

```typescript
/**
 * Mark reservation as no-show
 */
async markAsNoShow(reservationId: string, shopOwnerId: string): Promise<void> {
  // Verify shop ownership
  const reservation = await this.getReservationById(reservationId);

  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  // Verify this is the shop owner
  const shop = await shopService.getShopByOwnerId(shopOwnerId);
  if (shop?.id !== reservation.shop_id) {
    throw new AppError('Unauthorized', 403);
  }

  // Can only mark as no-show if confirmed and past the appointment time
  if (reservation.status !== 'confirmed') {
    throw new AppError('Can only mark confirmed reservations as no-show', 400);
  }

  const appointmentTime = new Date(reservation.reservation_date);
  if (appointmentTime > new Date()) {
    throw new AppError('Cannot mark as no-show before appointment time', 400);
  }

  // Update status
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'no_show',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId);

  if (error) {
    throw new AppError(`Failed to update reservation: ${error.message}`, 500);
  }

  // TODO: Handle deposit (may need refund policy decision)
  // TODO: Send notification to user
}
```

**File:** `src/controllers/shop-owner/reservation.controller.ts`

```typescript
/**
 * PATCH /shop-owner/reservations/:id/no-show
 * Mark reservation as no-show
 */
async markNoShow(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const shopOwnerId = req.user!.id;

  await reservationService.markAsNoShow(id, shopOwnerId);

  res.json({
    success: true,
    message: '노쇼 처리되었습니다.',
  });
}
```

**File:** `src/routes/shop-owner/reservation.routes.ts`

```typescript
// Add route
router.patch(
  '/:id/no-show',
  authenticate,
  requireShopOwner,
  asyncHandler((req, res) => reservationController.markNoShow(req, res))
);
```

### Admin Changes

**File:** `src/app/dashboard/my-shop/operations/page.tsx`

```tsx
// Add No-Show button to reservation actions

const ReservationActions = ({ reservation, onAction }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleNoShow = async () => {
    if (!confirm('정말 노쇼 처리하시겠습니까?')) return;

    setIsLoading(true);
    try {
      await api.patch(`/shop-owner/reservations/${reservation.id}/no-show`);
      toast.success('노쇼 처리되었습니다.');
      onAction();
    } catch (error) {
      toast.error('처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Only show no-show button for confirmed reservations past their time
  const canMarkNoShow =
    reservation.status === 'confirmed' &&
    new Date(reservation.reservation_date) < new Date();

  return (
    <div className="flex gap-2">
      {reservation.status === 'pending' && (
        <>
          <Button onClick={() => onAction('confirm')} variant="default">
            확정
          </Button>
          <Button onClick={() => onAction('reject')} variant="destructive">
            거절
          </Button>
        </>
      )}

      {canMarkNoShow && (
        <Button
          onClick={handleNoShow}
          variant="outline"
          className="text-orange-600 border-orange-600 hover:bg-orange-50"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '노쇼'}
        </Button>
      )}

      {reservation.status === 'confirmed' && !canMarkNoShow && (
        <Button onClick={() => onAction('complete')} variant="default">
          방문 완료
        </Button>
      )}
    </div>
  );
};
```

---

## Files to Modify Summary

### Frontend (Mobile App)

| File | Change |
|------|--------|
| `src/components/layout/BottomNav.tsx` | Remove Favorites tab |
| `src/app/profile/page.tsx` | Add favorites link, referral section, remove posts link |
| `src/components/home/CategoryList.tsx` | Disable hair category |
| `src/components/search/FilterModal.tsx` | Limit categories, restrict regions |

### Backend

| File | Change |
|------|--------|
| `src/types/reservation.types.ts` | Add 'no_show' status |
| `src/services/reservation.service.ts` | Add markAsNoShow method |
| `src/controllers/shop-owner/reservation.controller.ts` | Add markNoShow endpoint |
| `src/routes/shop-owner/reservation.routes.ts` | Add no-show route |

### Admin

| File | Change |
|------|--------|
| `src/app/dashboard/my-shop/operations/page.tsx` | Add no-show button |

---

## Testing Checklist

- [ ] Bottom nav shows 4 tabs (not 5)
- [ ] Favorites accessible from MyPage
- [ ] Hair category shows "서비스 준비중" toast
- [ ] Search filters limited to 4 categories
- [ ] Only Seoul region is selectable
- [ ] "내가 올린 피드" removed from MyPage
- [ ] Referral code displayed at top of MyPage
- [ ] Copy link and share buttons work
- [ ] No-show button appears for confirmed past reservations
- [ ] No-show API works correctly
