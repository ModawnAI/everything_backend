# Implementation Plan: Reschedule Booking UI

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 6-8 hours |
| **Risk Level** | Low |
| **Components Affected** | Frontend only |
| **Dependencies** | Backend API already exists |

## Problem Statement

The Reschedule Booking functionality is **partially complete** - backend APIs and frontend hooks exist, but the UI implementation is missing. Currently in `/home/bitnami/ebeautything-app/src/app/(dashboard)/dashboard/bookings/page.tsx`:

```typescript
// Line 214-216
const handleReschedule = (_bookingId: string) => {
  // This would typically open a date/time picker dialog
  // TODO: Implement reschedule booking functionality
};
```

**Current State:**
- Backend API: `/api/reservations/:id/reschedule` - working
- Frontend proxy: `/api/reservations/[id]/reschedule/route.ts` - working
- API client: `BookingAPI.rescheduleBooking()` - working
- React hook: `useBookingManagement().rescheduleBooking()` - working
- Available slots API: `BookingAPI.getAvailableSlots()` - working
- UI Dialog with Date/Time Picker: **MISSING**

---

## Implementation Steps

### Step 1: Create Reschedule Booking Dialog Component

**File:** `src/components/booking/reschedule-booking-dialog.tsx`

```tsx
/**
 * Reschedule Booking Dialog Component
 * Mobile-first dialog for rescheduling bookings
 * Includes date selection and time slot picker
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  Clock,
  MapPin,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BookingAPI } from '@/lib/api/booking-api';
import type { Booking, RescheduleBookingRequest } from '@/lib/api/booking-api';
import type { TimeSlot } from '@/types/reservation';

interface RescheduleBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (bookingId: string, data: RescheduleBookingRequest) => Promise<boolean>;
}

type Step = 'date' | 'time' | 'confirm';

export function RescheduleBookingDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
}: RescheduleBookingDialogProps) {
  const [step, setStep] = useState<Step>('date');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep('date');
      setSelectedDate(undefined);
      setSelectedTime(null);
      setAvailableSlots([]);
      setError(null);
    }
  }, [open]);

  // Fetch available slots when date changes
  const fetchAvailableSlots = useCallback(async (date: Date) => {
    if (!booking?.shopId || !booking?.serviceId) return;

    setIsLoadingSlots(true);
    setError(null);

    try {
      const response = await BookingAPI.getAvailableSlots({
        shopId: booking.shopId,
        serviceIds: [booking.serviceId],
        date: format(date, 'yyyy-MM-dd'),
      });

      if (response.success && response.data) {
        setAvailableSlots(response.data.availableSlots || []);
      } else {
        setAvailableSlots([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch available slots:', err);
      setError('사용 가능한 시간을 불러오는데 실패했습니다.');
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [booking?.shopId, booking?.serviceId]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime(null);
      fetchAvailableSlots(date);
      setStep('time');
    }
  };

  // Handle time selection
  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  // Handle back navigation
  const handleBack = () => {
    if (step === 'time') {
      setStep('date');
      setSelectedTime(null);
    } else if (step === 'confirm') {
      setStep('time');
    }
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!booking || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    try {
      const scheduledAt = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`;
      const success = await onConfirm(booking.id, { scheduledAt });

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disable past dates and dates beyond booking advance limit
  const disabledDates = (date: Date) => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 60); // Allow booking up to 60 days ahead
    return isBefore(date, today) || isBefore(maxDate, date);
  };

  // Format helpers
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko }),
      time: format(date, 'HH:mm'),
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (!booking) return null;

  const currentDateTime = formatDateTime(booking.scheduledAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[420px] max-h-[90vh] p-0 overflow-hidden rounded-lg">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            {step !== 'date' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                뒤로
              </Button>
            )}
            <DialogTitle className="text-lg flex-1 text-center">
              예약 변경
            </DialogTitle>
            {step !== 'date' && <div className="w-16" />}
          </div>
          <DialogDescription className="text-center">
            {step === 'date' && '새로운 날짜를 선택해주세요'}
            {step === 'time' && '시간을 선택해주세요'}
            {step === 'confirm' && '변경 내용을 확인해주세요'}
          </DialogDescription>
        </DialogHeader>

        {/* Booking Summary (always visible) */}
        <div className="px-4 py-3 bg-muted/50 border-b">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{booking.shop?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {booking.service?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">현재 예약</p>
              <p className="text-sm font-medium">{currentDateTime.date}</p>
              <p className="text-sm">{currentDateTime.time}</p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          {/* Step 1: Date Selection */}
          {step === 'date' && (
            <div className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={disabledDates}
                locale={ko}
                className="rounded-md border mx-auto"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                  ),
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-9 w-9 text-center text-sm p-0 relative",
                  day: cn(
                    "h-9 w-9 p-0 font-normal",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground"
                  ),
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                }}
              />
            </div>
          )}

          {/* Step 2: Time Selection */}
          {step === 'time' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {selectedDate && format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('date')}
                  className="text-xs"
                >
                  날짜 변경
                </Button>
              </div>

              {isLoadingSlots ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedDate && fetchAvailableSlots(selectedDate)}
                    className="mt-4"
                  >
                    다시 시도
                  </Button>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    선택한 날짜에 예약 가능한 시간이 없습니다.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('date')}
                    className="mt-4"
                  >
                    다른 날짜 선택
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => {
                      const isAvailable = slot.available;
                      const isSelected = selectedTime === slot.time;

                      return (
                        <Button
                          key={slot.time}
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          disabled={!isAvailable}
                          onClick={() => handleTimeSelect(slot.time)}
                          className={cn(
                            'h-12 font-medium',
                            isSelected && 'ring-2 ring-primary ring-offset-2',
                            !isAvailable && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {slot.time}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && selectedDate && selectedTime && (
            <div className="p-4 space-y-4">
              {/* Change Summary */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">변경 내역</div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">기존 예약</p>
                    <p className="font-medium">{currentDateTime.date}</p>
                    <p className="text-sm">{currentDateTime.time}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">변경 후</p>
                    <p className="font-medium text-primary">
                      {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                    </p>
                    <p className="text-sm text-primary">{selectedTime}</p>
                  </div>
                </div>
              </div>

              {/* Service Info */}
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{booking.shop?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {booking.service?.name} • {booking.service?.duration_minutes}분
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">총 금액</span>
                  <span className="font-medium">{formatCurrency(booking.totalPrice)}원</span>
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-yellow-800">
                  예약 변경 시 기존 예약은 자동으로 취소됩니다.
                  변경된 예약은 매장 확인 후 확정됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 'confirm' && (
          <DialogFooter className="p-4 border-t flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              시간 변경
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || !selectedDate || !selectedTime}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  변경 중...
                </>
              ) : (
                '예약 변경 확인'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RescheduleBookingDialog;
```

### Step 2: Update Bookings Page

**File:** `src/app/(dashboard)/dashboard/bookings/page.tsx`

Add the following changes:

```tsx
// Add import at the top
import { RescheduleBookingDialog } from '@/components/booking/reschedule-booking-dialog';

// Add state inside BookingsPage component
const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
const [selectedBookingForReschedule, setSelectedBookingForReschedule] = useState<Booking | null>(null);

// Update the hook usage to include rescheduleBooking
const {
  bookings,
  loading,
  error,
  stats,
  refreshBookings,
  cancelBooking,
  rescheduleBooking,
} = useBookingManagement();

// Update handleReschedule function
const handleReschedule = (bookingId: string) => {
  const booking = bookings.find(b => b.id === bookingId);
  if (booking) {
    setSelectedBookingForReschedule(booking);
    setRescheduleDialogOpen(true);
  }
};

// Add confirmation handler
const handleConfirmReschedule = async (
  bookingId: string,
  data: RescheduleBookingRequest
): Promise<boolean> => {
  const success = await rescheduleBooking(bookingId, data);
  return success;
};

// Add dialog component before closing </div> tag
<RescheduleBookingDialog
  booking={selectedBookingForReschedule}
  open={rescheduleDialogOpen}
  onOpenChange={setRescheduleDialogOpen}
  onConfirm={handleConfirmReschedule}
/>
```

### Step 3: Create TimeSlot Grid Component (Optional Enhancement)

**File:** `src/components/booking/time-slot-grid.tsx`

```tsx
/**
 * Reusable Time Slot Grid Component
 * Used in both booking flow and reschedule dialog
 */

'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TimeSlot } from '@/types/reservation';

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  isLoading?: boolean;
  columns?: number;
  className?: string;
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  onSelect,
  isLoading = false,
  columns = 3,
  className,
}: TimeSlotGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-2', `grid-cols-${columns}`, className)}>
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-md bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        예약 가능한 시간이 없습니다.
      </div>
    );
  }

  // Group slots by time period
  const morningSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 6 && hour < 12;
  });

  const afternoonSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 12 && hour < 18;
  });

  const eveningSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 18 || hour < 6;
  });

  const renderSlotGroup = (title: string, groupSlots: TimeSlot[]) => {
    if (groupSlots.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground px-1">{title}</p>
        <div className={cn('grid gap-2', `grid-cols-${columns}`)}>
          {groupSlots.map((slot) => (
            <Button
              key={slot.time}
              variant={selectedTime === slot.time ? 'default' : 'outline'}
              size="sm"
              disabled={!slot.available}
              onClick={() => onSelect(slot.time)}
              className={cn(
                'h-11 text-sm font-medium',
                selectedTime === slot.time && 'ring-2 ring-primary ring-offset-2',
                !slot.available && 'opacity-40 cursor-not-allowed'
              )}
            >
              {slot.time}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className={cn('max-h-[300px]', className)}>
      <div className="space-y-4 pr-4">
        {renderSlotGroup('오전', morningSlots)}
        {renderSlotGroup('오후', afternoonSlots)}
        {renderSlotGroup('저녁', eveningSlots)}
      </div>
    </ScrollArea>
  );
}

export default TimeSlotGrid;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/booking/reschedule-booking-dialog.tsx` | **CREATE** | Main reschedule dialog with multi-step flow |
| `src/components/booking/time-slot-grid.tsx` | **CREATE** | Reusable time slot selection component |
| `src/app/(dashboard)/dashboard/bookings/page.tsx` | **MODIFY** | Integrate dialog, update handlers |
| `src/components/dashboard/upcoming-bookings.tsx` | **MODIFY** | Add reschedule button |
| `src/app/bookings/[id]/page.tsx` | **MODIFY** | Add reschedule button to detail view |

---

## API Integration

The dialog uses existing API endpoints:

```typescript
// 1. Fetch available time slots
BookingAPI.getAvailableSlots({
  shopId: booking.shopId,
  serviceIds: [booking.serviceId],
  date: '2025-01-15',
});

// Response format:
{
  success: true,
  data: {
    shopId: 'xxx',
    date: '2025-01-15',
    availableSlots: [
      { time: '10:00', available: true },
      { time: '10:30', available: false },
      { time: '11:00', available: true },
      // ...
    ],
    totalSlots: 24,
    availableCount: 15
  }
}

// 2. Reschedule booking
BookingAPI.rescheduleBooking(bookingId, {
  scheduledAt: '2025-01-15T10:00:00'
});
```

---

## Testing Plan

### Manual Testing Checklist

- [ ] Dialog opens when clicking reschedule button
- [ ] Calendar shows current and future dates only
- [ ] Past dates are disabled
- [ ] Selecting a date loads available time slots
- [ ] Loading state shows while fetching slots
- [ ] Error handling for slot fetch failures
- [ ] Empty state when no slots available
- [ ] Time slot selection works correctly
- [ ] Back navigation works between steps
- [ ] Confirmation step shows change summary
- [ ] Submit button disabled during loading
- [ ] Success toast and dialog close on completion
- [ ] Booking list refreshes after rescheduling
- [ ] Mobile responsiveness (375px - 428px)

### Test Scenarios

1. **Normal flow**: Select date → Select time → Confirm → Success
2. **No available slots**: Select date with no availability
3. **API error**: Network failure during slot fetch
4. **Back navigation**: Navigate back from time to date
5. **Cancel dialog**: Close without completing

---

## Error Handling

```typescript
// Handle potential errors
try {
  const success = await rescheduleBooking(bookingId, { scheduledAt });
  if (success) {
    toast({
      title: '예약 변경 완료',
      description: '예약 일정이 성공적으로 변경되었습니다.',
    });
  }
} catch (error) {
  toast({
    variant: 'error',
    title: '예약 변경 실패',
    description: error.message || '예약 변경 중 오류가 발생했습니다.',
  });
}
```

---

## Design Specifications

### Mobile Layout (375px - 428px)

- Dialog max-width: calc(100vw - 32px)
- Calendar: Full width within dialog
- Time slots: 3-column grid
- Touch targets: min 44px height

### Step Indicators

1. **Date Selection**: Calendar with disabled past dates
2. **Time Selection**: Grid of available time slots
3. **Confirmation**: Summary with old vs new comparison

### Visual Feedback

- Selected date: Primary color highlight
- Selected time: Primary background with ring
- Unavailable slots: 40% opacity, not clickable
- Loading: Skeleton placeholders
- Error: Red alert with retry button

---

## Deployment Checklist

- [ ] Create `reschedule-booking-dialog.tsx` component
- [ ] Create `time-slot-grid.tsx` component (optional)
- [ ] Update bookings page with dialog integration
- [ ] Update upcoming bookings component
- [ ] Update booking details page
- [ ] Test date selection and slot fetching
- [ ] Test multi-step navigation
- [ ] Test on mobile viewport
- [ ] Test error handling
- [ ] Verify time slot availability accuracy
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Dialog opens without errors | 100% |
| Slot fetching completes successfully | >95% |
| Rescheduling completes successfully | >95% |
| Mobile responsiveness | 100% |
| Multi-step navigation works | 100% |

---

## Notes

- Backend API already handles slot availability checking
- The dialog reuses existing API endpoints
- Focus on mobile-first design
- Calendar component from shadcn/ui
- Consider adding staff member selection in future iteration
