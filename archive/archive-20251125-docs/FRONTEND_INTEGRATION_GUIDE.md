# Frontend Integration Guide: Real-Time Slot Availability

## Problem Statement

Previously, the frontend generated time slots client-side based only on shop operating hours. This approach had critical flaws:

❌ **Before**:
- Time slots generated on frontend without checking actual availability
- All slots shown as "available" even if already booked
- Double bookings possible due to race conditions
- Stale data leading to booking failures

✅ **After**:
- Real-time availability fetched from backend API
- Only truly available slots are shown
- Double bookings prevented at database level
- Graceful error handling with alternatives

## Architecture Change

### Before (Client-Side Generation) ❌

```typescript
// booking-context.tsx (OLD - DON'T USE)
const generateTimeSlotsFromShop = (shop, date, services) => {
  const slots = [];

  // Generate slots based on operating hours
  for (let time = openTime; time < closeTime; time += 30) {
    slots.push({
      id: `${date}-${time}`,
      startTime: formatTime(time),
      endTime: formatTime(time + serviceDuration),
      available: true,  // ❌ WRONG: Assumes all slots are available
      capacity: 1,
      bookedCount: 0
    });
  }

  return slots;
};
```

**Problems**:
1. No check against actual reservations
2. No protection against concurrent bookings
3. Misleading "available" status

### After (Backend API) ✅

```typescript
// booking-context.tsx (NEW - USE THIS)
const fetchAvailableSlots = async (shopId: string, date: string, serviceIds: string[]) => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/shops/${shopId}/available-slots?` +
      `date=${date}&` +
      serviceIds.map(id => `serviceIds[]=${id}`).join('&')
    );

    if (!response.ok) {
      throw new Error('Failed to fetch available slots');
    }

    const data = await response.json();
    return data.data.availableSlots;  // ✅ Real availability from backend

  } catch (error) {
    console.error('Error fetching available slots:', error);
    throw error;
  }
};
```

## API Endpoints

### 1. Get Available Slots

**Endpoint**: `GET /api/shops/{shopId}/available-slots`

**Query Parameters**:
- `date` (required): Date in YYYY-MM-DD format (e.g., "2024-03-15")
- `serviceIds` (required): Array of service UUIDs (e.g., `serviceIds[]=uuid1&serviceIds[]=uuid2`)
- `startTime` (optional): Start time filter in HH:MM format
- `endTime` (optional): End time filter in HH:MM format
- `interval` (optional): Slot interval in minutes (default: 30)

**Example Request**:
```typescript
const shopId = '123e4567-e89b-12d3-a456-426614174000';
const date = '2024-03-15';
const serviceIds = ['service-uuid-1', 'service-uuid-2'];

const url = `${BACKEND_URL}/shops/${shopId}/available-slots?` +
  `date=${date}&` +
  serviceIds.map(id => `serviceIds[]=${id}`).join('&');

const response = await fetch(url);
const data = await response.json();
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shopId": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-03-15",
    "availableSlots": [
      {
        "startTime": "10:00",
        "endTime": "11:30",
        "available": true,
        "capacity": 1,
        "booked": 0
      },
      {
        "startTime": "10:30",
        "endTime": "12:00",
        "available": false,
        "capacity": 1,
        "booked": 1
      },
      {
        "startTime": "11:00",
        "endTime": "12:30",
        "available": true,
        "capacity": 1,
        "booked": 0
      }
    ],
    "totalSlots": 16,
    "availableCount": 12
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": {
    "code": "MISSING_REQUIRED_PARAMETERS",
    "message": "필수 파라미터가 누락되었습니다.",
    "details": "date와 serviceIds는 필수입니다."
  }
}
```

### 2. Create Reservation

**Endpoint**: `POST /api/reservations`

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "shopId": "123e4567-e89b-12d3-a456-426614174000",
  "services": [
    {
      "serviceId": "service-uuid-1",
      "quantity": 1
    },
    {
      "serviceId": "service-uuid-2",
      "quantity": 1
    }
  ],
  "reservationDate": "2024-03-15",
  "reservationTime": "10:00",
  "specialRequests": "Please prepare a quiet room",
  "pointsToUse": 5000
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "reservationId": "reservation-uuid",
    "status": "requested",
    "totalAmount": 50000,
    "depositAmount": 10000,
    "remainingAmount": 40000,
    "reservationDate": "2024-03-15",
    "reservationTime": "10:00"
  },
  "message": "예약이 성공적으로 생성되었습니다."
}
```

**Error Response** (409 Conflict):
```json
{
  "error": {
    "code": "TIME_SLOT_CONFLICT",
    "message": "Selected time slot is no longer available: Overlaps with existing reservation",
    "details": "Booking from 10:00 would overlap with existing reservation (ends at 11:15)",
    "suggestedAlternatives": [
      {
        "startTime": "11:30",
        "endTime": "13:00",
        "available": true
      },
      {
        "startTime": "14:00",
        "endTime": "15:30",
        "available": true
      }
    ]
  }
}
```

## Frontend Implementation Guide

### Step 1: Update Booking Context

Replace client-side slot generation with API calls:

```typescript
// booking-context.tsx

import { useState, useEffect } from 'react';

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  capacity: number;
  booked: number;
}

export function BookingProvider({ children }) {
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlots Error] = useState<string | null>(null);

  // Fetch available slots whenever shop, date, or services change
  useEffect(() => {
    if (!selectedShop || !selectedDate || selectedServices.length === 0) {
      setAvailableSlots([]);
      return;
    }

    fetchAvailableSlots();
  }, [selectedShop, selectedDate, selectedServices]);

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    setSlotsError(null);

    try {
      const serviceIdsParam = selectedServices.map(id => `serviceIds[]=${id}`).join('&');
      const url = `${BACKEND_URL}/shops/${selectedShop.id}/available-slots?date=${selectedDate}&${serviceIdsParam}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }

      const data = await response.json();

      // Filter to only show available slots
      const slots = data.data.availableSlots.filter(slot => slot.available);
      setAvailableSlots(slots);

    } catch (error) {
      console.error('Error fetching available slots:', error);
      setSlotsError('Failed to load available time slots. Please try again.');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const createReservation = async (selectedSlot: TimeSlot) => {
    try {
      const token = getAuthToken(); // Your auth token getter

      const response = await fetch(`${BACKEND_URL}/reservations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shopId: selectedShop.id,
          services: selectedServices.map(serviceId => ({
            serviceId,
            quantity: 1
          })),
          reservationDate: selectedDate,
          reservationTime: selectedSlot.startTime,
          specialRequests: '', // Add UI for this
          pointsToUse: 0 // Add UI for this
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle double booking error
        if (response.status === 409 || response.status === 400) {
          throw new Error(data.error?.message || 'Time slot no longer available');
        }
        throw new Error('Failed to create reservation');
      }

      // Success!
      return data.data;

    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  };

  return (
    <BookingContext.Provider
      value={{
        selectedShop,
        setSelectedShop,
        selectedDate,
        setSelectedDate,
        selectedServices,
        setSelectedServices,
        availableSlots,
        loadingSlots,
        slotsError,
        fetchAvailableSlots,
        createReservation
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
```

### Step 2: Update Time Slot Selection UI

```typescript
// time-slot-selector.tsx

import { useBooking } from '@/contexts/booking-context';

export function TimeSlotSelector() {
  const {
    availableSlots,
    loadingSlots,
    slotsError,
    fetchAvailableSlots
  } = useBooking();

  if (loadingSlots) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading available times...</span>
      </div>
    );
  }

  if (slotsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{slotsError}</p>
        <button
          onClick={fetchAvailableSlots}
          className="mt-2 text-red-600 hover:text-red-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          No available time slots for the selected date and services.
          Please try a different date or services.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {availableSlots.map((slot) => (
        <button
          key={`${slot.startTime}-${slot.endTime}`}
          onClick={() => handleSlotSelection(slot)}
          className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-500"
        >
          <div className="font-medium">{slot.startTime}</div>
          <div className="text-sm text-gray-500">
            ~ {slot.endTime}
          </div>
        </button>
      ))}
    </div>
  );
}
```

### Step 3: Handle Booking Errors Gracefully

```typescript
// booking-confirmation.tsx

import { useState } from 'react';
import { useBooking } from '@/contexts/booking-context';
import { useRouter } from 'next/navigation';

export function BookingConfirmation({ selectedSlot }) {
  const router = useRouter();
  const { createReservation } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedAlternatives, setSuggestedAlternatives] = useState([]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    setSuggestedAlternatives([]);

    try {
      const reservation = await createReservation(selectedSlot);

      // Success! Redirect to confirmation page
      router.push(`/reservations/${reservation.reservationId}`);

    } catch (error: any) {
      // Handle double booking error
      const errorMessage = error.message || 'Failed to create reservation';
      setError(errorMessage);

      // Check if backend provided alternative slots
      if (error.suggestedAlternatives) {
        setSuggestedAlternatives(error.suggestedAlternatives);
      }

      // Log for debugging
      console.error('Booking error:', error);

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Confirm Your Booking</h2>

      {/* Booking details */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <p><strong>Date:</strong> {selectedDate}</p>
        <p><strong>Time:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}</p>
        <p><strong>Services:</strong> {selectedServices.join(', ')}</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-red-800 mb-2">Booking Failed</h3>
          <p className="text-red-700">{error}</p>

          {/* Show alternative slots if available */}
          {suggestedAlternatives.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-red-800 mb-2">
                Try these alternative time slots:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {suggestedAlternatives.map((alt, index) => (
                  <button
                    key={index}
                    onClick={() => handleAlternativeSelection(alt)}
                    className="p-2 bg-white border border-red-300 rounded hover:bg-red-50"
                  >
                    {alt.startTime} - {alt.endTime}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {submitting ? 'Processing...' : 'Confirm Booking'}
      </button>
    </div>
  );
}
```

### Step 4: Implement Automatic Refresh

```typescript
// auto-refresh-slots.tsx

import { useEffect, useRef } from 'react';
import { useBooking } from '@/contexts/booking-context';

export function useAutoRefreshSlots() {
  const { fetchAvailableSlots, selectedShop, selectedDate, selectedServices } = useBooking();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Only refresh if we have all required data
    if (!selectedShop || !selectedDate || selectedServices.length === 0) {
      return;
    }

    // Refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchAvailableSlots();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [selectedShop, selectedDate, selectedServices]);
}
```

## Best Practices

### 1. Always Fetch Real-Time Availability ✅

```typescript
// ✅ GOOD: Fetch from backend
const slots = await fetchAvailableSlots(shopId, date, serviceIds);

// ❌ BAD: Generate on frontend
const slots = generateTimeSlotsFromOperatingHours(shop);
```

### 2. Handle Errors Gracefully ✅

```typescript
try {
  const reservation = await createReservation(slot);
  // Success
} catch (error) {
  if (error.code === 'TIME_SLOT_CONFLICT') {
    // Show alternative slots
    showAlternatives(error.suggestedAlternatives);
  } else {
    // Generic error
    showError('Please try again');
  }
}
```

### 3. Prevent Duplicate Submissions ✅

```typescript
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  if (submitting) return;  // ✅ Prevent double-click

  setSubmitting(true);
  try {
    await createReservation();
  } finally {
    setSubmitting(false);
  }
};
```

### 4. Refresh Slots Periodically ✅

```typescript
// Refresh every 30 seconds while user is on the page
useEffect(() => {
  const interval = setInterval(() => {
    fetchAvailableSlots();
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

### 5. Show Loading States ✅

```typescript
{loadingSlots && <Spinner />}
{!loadingSlots && slots.length === 0 && <EmptyState />}
{!loadingSlots && slots.length > 0 && <SlotList />}
```

## Testing Checklist

- [ ] Slots only shown as available when actually available
- [ ] Double booking prevented (shows error message)
- [ ] Concurrent users cannot book same slot
- [ ] Error messages are user-friendly
- [ ] Alternative slots suggested on conflict
- [ ] Loading states shown during API calls
- [ ] Stale data refreshed automatically
- [ ] Duplicate submissions prevented
- [ ] Auth tokens included in reservation requests
- [ ] Error boundaries catch API failures

## Migration Path

### Phase 1: Backend First
1. ✅ Run database migration (076)
2. ✅ Verify backend endpoints work
3. ✅ Test with Postman/curl

### Phase 2: Frontend Integration
1. Update `booking-context.tsx` to use API
2. Replace client-side generation with `fetchAvailableSlots()`
3. Add error handling for conflicts
4. Test double booking prevention

### Phase 3: Gradual Rollout
1. Deploy backend changes
2. Deploy frontend changes
3. Monitor for errors
4. Roll back if needed

### Phase 4: Cleanup
1. Remove old client-side generation code
2. Remove unused utility functions
3. Update documentation

## API Response Types

```typescript
// Type definitions for frontend

interface TimeSlot {
  startTime: string;  // "HH:MM" format
  endTime: string;    // "HH:MM" format
  available: boolean;
  capacity: number;
  booked: number;
}

interface AvailableSlotsResponse {
  success: boolean;
  data: {
    shopId: string;
    date: string;
    availableSlots: TimeSlot[];
    totalSlots: number;
    availableCount: number;
  };
}

interface CreateReservationRequest {
  shopId: string;
  services: Array<{
    serviceId: string;
    quantity: number;
  }>;
  reservationDate: string;  // "YYYY-MM-DD"
  reservationTime: string;  // "HH:MM"
  specialRequests?: string;
  pointsToUse?: number;
}

interface CreateReservationResponse {
  success: boolean;
  data: {
    reservationId: string;
    status: string;
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    reservationDate: string;
    reservationTime: string;
  };
  message: string;
}

interface BookingError {
  error: {
    code: string;
    message: string;
    details?: string;
    suggestedAlternatives?: TimeSlot[];
  };
}
```

## Summary

### Old Approach ❌
- Client-side slot generation
- No real availability check
- Double bookings possible
- Poor user experience

### New Approach ✅
- Backend API for real-time availability
- Database-level double booking prevention
- Graceful error handling
- Better user experience

### Key Changes
1. Use `GET /api/shops/{shopId}/available-slots` API
2. Handle `409 Conflict` errors gracefully
3. Show suggested alternatives on conflicts
4. Refresh slots automatically every 30 seconds
5. Prevent duplicate form submissions

### Developer Responsibilities
- **Backend**: Already implemented ✅
- **Frontend**: Update booking flow to use API
- **Testing**: Verify double booking prevention works
- **Monitoring**: Check for booking errors in logs

---

**Version**: 1.0.0
**Last Updated**: 2024-03-15
**Related Docs**:
- `DOUBLE_BOOKING_PREVENTION.md` - Backend implementation details
- `MIGRATION_076_INSTRUCTIONS.md` - Database migration guide
