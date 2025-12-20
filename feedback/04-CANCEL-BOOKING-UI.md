# Implementation Plan: Cancel Booking UI

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 3-4 hours |
| **Risk Level** | Very Low |
| **Components Affected** | Frontend only |
| **Dependencies** | Backend API already exists |

## Problem Statement

The Cancel Booking functionality is **90% complete** - all backend APIs and frontend hooks exist, but the UI implementation is missing. Currently in `/home/bitnami/ebeautything-app/src/app/(dashboard)/dashboard/bookings/page.tsx`:

```typescript
// Line 205-211
const handleCancel = async (_bookingId: string) => {
  // This would typically open a confirmation dialog
  const confirmed = window.confirm('?Booking?????');
  if (confirmed) {
    // Implementation would call cancelBooking from the hook
    // TODO: Implement cancel booking functionality
  }
};
```

**Current State:**
- Backend API: `/api/reservations/:id/cancel` - working
- Frontend proxy: `/api/reservations/[id]/cancel/route.ts` - working
- API client: `BookingAPI.cancelBooking()` - working
- React hook: `useBookingManagement().cancelBooking()` - working
- UI Modal: **MISSING**

---

## Implementation Steps

### Step 1: Create Cancel Booking Dialog Component

**File:** `src/components/booking/cancel-booking-dialog.tsx`

```tsx
/**
 * Cancel Booking Dialog Component
 * Mobile-first confirmation dialog for booking cancellation
 */

'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Booking } from '@/lib/api/booking-api';

// Cancellation reason options (Korean)
const CANCELLATION_REASONS = [
  { value: 'schedule_change', label: '일정 변경' },
  { value: 'found_another', label: '다른 매장 예약' },
  { value: 'service_not_needed', label: '서비스 불필요' },
  { value: 'price_issue', label: '가격 문제' },
  { value: 'personal_reason', label: '개인 사정' },
  { value: 'other', label: '기타' },
] as const;

interface CancelBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (bookingId: string, reason: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: CancelBookingDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate refund eligibility
  const getRefundInfo = () => {
    if (!booking) return null;

    const scheduledDate = new Date(booking.scheduledAt);
    const now = new Date();
    const hoursUntilBooking = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Refund policy based on hours until booking
    if (hoursUntilBooking >= 24) {
      return {
        refundPercentage: 100,
        refundAmount: booking.depositAmount,
        message: '전액 환불 가능',
        variant: 'success' as const,
      };
    } else if (hoursUntilBooking >= 12) {
      return {
        refundPercentage: 50,
        refundAmount: Math.floor(booking.depositAmount * 0.5),
        message: '50% 환불 (24시간 이내 취소)',
        variant: 'warning' as const,
      };
    } else if (hoursUntilBooking >= 2) {
      return {
        refundPercentage: 0,
        refundAmount: 0,
        message: '환불 불가 (12시간 이내 취소)',
        variant: 'destructive' as const,
      };
    } else {
      return {
        refundPercentage: 0,
        refundAmount: 0,
        message: '환불 불가 (예약 시간 임박)',
        variant: 'destructive' as const,
      };
    }
  };

  const refundInfo = getRefundInfo();

  const handleSubmit = async () => {
    if (!booking || !selectedReason) return;

    const reason = selectedReason === 'other' ? customReason :
      CANCELLATION_REASONS.find(r => r.value === selectedReason)?.label || '';

    if (selectedReason === 'other' && !customReason.trim()) {
      return; // Require custom reason if "other" is selected
    }

    setIsSubmitting(true);
    try {
      const success = await onConfirm(booking.id, reason);
      if (success) {
        // Reset form on success
        setSelectedReason('');
        setCustomReason('');
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setCustomReason('');
      onOpenChange(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (!booking) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            예약 취소
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              {/* Booking Summary */}
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="font-medium text-foreground">{booking.shop?.name}</p>
                <p className="text-sm">{booking.service?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(booking.scheduledAt)}
                </p>
              </div>

              {/* Refund Information */}
              {refundInfo && (
                <div className={cn(
                  'rounded-lg p-3 border',
                  refundInfo.variant === 'success' && 'bg-green-50 border-green-200',
                  refundInfo.variant === 'warning' && 'bg-yellow-50 border-yellow-200',
                  refundInfo.variant === 'destructive' && 'bg-red-50 border-red-200',
                )}>
                  <p className={cn(
                    'font-medium text-sm',
                    refundInfo.variant === 'success' && 'text-green-700',
                    refundInfo.variant === 'warning' && 'text-yellow-700',
                    refundInfo.variant === 'destructive' && 'text-red-700',
                  )}>
                    {refundInfo.message}
                  </p>
                  {booking.depositAmount > 0 && (
                    <p className="text-sm mt-1">
                      예약금: {formatCurrency(booking.depositAmount)}원
                      {refundInfo.refundAmount > 0 && (
                        <span className="font-medium"> → 환불: {formatCurrency(refundInfo.refundAmount)}원</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Cancellation Reason Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">취소 사유 선택</Label>
                <RadioGroup
                  value={selectedReason}
                  onValueChange={setSelectedReason}
                  className="space-y-2"
                >
                  {CANCELLATION_REASONS.map((reason) => (
                    <div key={reason.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason.value} id={reason.value} />
                      <Label
                        htmlFor={reason.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {reason.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Custom Reason Input */}
              {selectedReason === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="customReason" className="text-sm">
                    취소 사유를 입력해주세요
                  </Label>
                  <Textarea
                    id="customReason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="취소 사유를 입력해주세요..."
                    className="resize-none"
                    rows={3}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <AlertDialogCancel
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            돌아가기
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting || (selectedReason === 'other' && !customReason.trim())}
            className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                취소 중...
              </>
            ) : (
              '예약 취소'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelBookingDialog;
```

### Step 2: Update Bookings Page

**File:** `src/app/(dashboard)/dashboard/bookings/page.tsx`

Update the existing file with the following changes:

```tsx
// Add import at the top
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog';

// Add state inside BookingsPage component
const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);

// Update the hook usage to include cancelBooking
const { bookings, loading, error, stats, refreshBookings, cancelBooking } = useBookingManagement();

// Update handleCancel function
const handleCancel = (bookingId: string) => {
  const booking = bookings.find(b => b.id === bookingId);
  if (booking) {
    setSelectedBookingForCancel(booking);
    setCancelDialogOpen(true);
  }
};

// Add confirmation handler
const handleConfirmCancel = async (bookingId: string, reason: string): Promise<boolean> => {
  const success = await cancelBooking(bookingId, reason);
  return success;
};

// Add dialog component before closing </div> tag (inside the return statement)
<CancelBookingDialog
  booking={selectedBookingForCancel}
  open={cancelDialogOpen}
  onOpenChange={setCancelDialogOpen}
  onConfirm={handleConfirmCancel}
/>
```

### Step 3: Update UpcomingBookings Component

**File:** `src/components/dashboard/upcoming-bookings.tsx`

Add cancel functionality:

```tsx
// Add to imports
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog';
import { useBookingManagement } from '@/hooks/use-booking-management';

// Update interface
interface UpcomingBookingsProps {
  bookings: UpcomingBooking[];
  loading?: boolean;
  onViewAll?: () => void;
}

// Inside the component, add:
const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
const [selectedBooking, setSelectedBooking] = useState<UpcomingBooking | null>(null);
const { cancelBooking } = useBookingManagement();

const handleCancelClick = (booking: UpcomingBooking) => {
  setSelectedBooking(booking);
  setCancelDialogOpen(true);
};

const handleConfirmCancel = async (bookingId: string, reason: string): Promise<boolean> => {
  return await cancelBooking(bookingId, reason);
};

// Add cancel button to each booking card (in the actions area)
<Button
  variant="outline"
  size="sm"
  onClick={() => handleCancelClick(booking)}
  className="text-destructive hover:text-destructive"
>
  취소
</Button>

// Add dialog at the end of the component's return
<CancelBookingDialog
  booking={selectedBooking ? {
    id: selectedBooking.id,
    scheduledAt: selectedBooking.scheduled_at,
    depositAmount: selectedBooking.total_price * 0.3, // Estimate
    shop: { name: selectedBooking.shop.name },
    service: { name: selectedBooking.service.name },
  } as any : null}
  open={cancelDialogOpen}
  onOpenChange={setCancelDialogOpen}
  onConfirm={handleConfirmCancel}
/>
```

### Step 4: Add Cancel Button to Booking Details Page

**File:** `src/app/bookings/[id]/page.tsx`

Add cancel functionality to the booking details view:

```tsx
// Add cancel dialog integration similar to bookings page
// This allows users to cancel from the detailed booking view as well
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/booking/cancel-booking-dialog.tsx` | **CREATE** | Main cancel dialog component |
| `src/app/(dashboard)/dashboard/bookings/page.tsx` | **MODIFY** | Integrate dialog, update handlers |
| `src/components/dashboard/upcoming-bookings.tsx` | **MODIFY** | Add cancel button and dialog |
| `src/app/bookings/[id]/page.tsx` | **MODIFY** | Add cancel button to detail view |

---

## Testing Plan

### Manual Testing Checklist

- [ ] Cancel dialog opens when clicking cancel button
- [ ] Dialog shows correct booking information
- [ ] Refund calculation displays correctly based on time until booking
- [ ] Cancellation reason is required
- [ ] Custom reason field appears when selecting "Other"
- [ ] Submit button is disabled until reason is selected
- [ ] Loading state shows during cancellation
- [ ] Success toast appears after cancellation
- [ ] Booking list refreshes after cancellation
- [ ] Dialog closes after successful cancellation
- [ ] Error handling works correctly

### Test Scenarios

1. **Cancel 24+ hours before**: Full refund message shown
2. **Cancel 12-24 hours before**: 50% refund warning shown
3. **Cancel <12 hours before**: No refund warning shown
4. **Cancel with reason**: Reason is sent to backend
5. **Cancel from different pages**: Works from bookings list and detail view

---

## Error Handling

```typescript
// Handle potential errors in the cancel flow
try {
  const success = await cancelBooking(bookingId, reason);
  if (success) {
    toast({
      title: '예약 취소 완료',
      description: '예약이 성공적으로 취소되었습니다.',
    });
  }
} catch (error) {
  toast({
    variant: 'error',
    title: '취소 실패',
    description: error.message || '예약 취소 중 오류가 발생했습니다.',
  });
}
```

---

## Deployment Checklist

- [ ] Create `cancel-booking-dialog.tsx` component
- [ ] Update bookings page with dialog integration
- [ ] Update upcoming bookings component
- [ ] Update booking details page
- [ ] Test on mobile viewport (375px - 428px)
- [ ] Test loading states
- [ ] Test error handling
- [ ] Verify refund calculations match backend policy
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Dialog opens without errors | 100% |
| Cancellation completes successfully | >95% |
| Refund info displays correctly | 100% |
| Mobile responsiveness | 100% |

---

## Notes

- The backend API and all hooks already exist and work correctly
- This is purely a UI implementation task
- Focus on mobile-first design (375px - 428px viewport)
- Use existing UI components from shadcn/ui
- Refund policy should match backend logic
