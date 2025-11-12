# Reservation Availability API Guide

## Overview

This guide explains how to use the existing availability endpoints for both **Mobile App** and **Shop Admin** interfaces.

## Test Data Available

### Test Shop
- **Shop ID**: `22222222-2222-2222-2222-222222222222`
- **Shop Name**: 엘레강스 헤어살롱 (Elegance Hair Salon)
- **Address**: 서울 서초구 강남대로 456
- **Status**: Active

#### Operating Hours
```json
{
  "monday": { "open": "10:00", "close": "20:00", "break_start": "13:00", "break_end": "14:00" },
  "tuesday": { "open": "10:00", "close": "20:00", "break_start": "13:00", "break_end": "14:00" },
  "wednesday": { "open": "10:00", "close": "20:00", "break_start": "13:00", "break_end": "14:00" },
  "thursday": { "open": "10:00", "close": "20:00", "break_start": "13:00", "break_end": "14:00" },
  "friday": { "open": "10:00", "close": "21:00", "break_start": "13:00", "break_end": "14:00" },
  "saturday": { "open": "09:00", "close": "21:00" },
  "sunday": { "closed": true }
}
```

### Test User
- **User ID**: `909b2a8d-d8b0-40fa-beb9-010673035613`
- **Email**: testadmin@test.com

---

## 📱 Mobile App - How to Get Available Time Slots

### Endpoint
```
GET /api/shops/:shopId/available-slots
```

### Use Case
Mobile users browsing shops need to see available time slots before making a reservation.

### Request Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `shopId` | UUID (path) | ✅ Yes | Shop ID | `22222222-2222-2222-2222-222222222222` |
| `date` | string (query) | ✅ Yes | Date in YYYY-MM-DD format | `2025-11-15` |
| `serviceIds` | array (query) | ✅ Yes | Array of service UUIDs | `["service-id-1", "service-id-2"]` |
| `startTime` | string (query) | ❌ No | Filter from this time (HH:MM) | `10:00` |
| `endTime` | string (query) | ❌ No | Filter until this time (HH:MM) | `18:00` |
| `interval` | integer (query) | ❌ No | Time slot interval in minutes (default: 30) | `30` |

### Mobile App Example Request

```bash
# Get available slots for November 15, 2025
curl -X GET "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/available-slots?date=2025-11-15&serviceIds[]=<SERVICE_ID_1>&serviceIds[]=<SERVICE_ID_2>&interval=30"
```

### Mobile App Example Response

```json
{
  "success": true,
  "data": {
    "shopId": "22222222-2222-2222-2222-222222222222",
    "date": "2025-11-15",
    "serviceIds": ["service-id-1", "service-id-2"],
    "availableSlots": [
      {
        "startTime": "10:00",
        "endTime": "10:30",
        "duration": 30
      },
      {
        "startTime": "10:30",
        "endTime": "11:00",
        "duration": 30
      },
      {
        "startTime": "11:00",
        "endTime": "11:30",
        "duration": 30
      }
    ],
    "totalSlots": 20,
    "availableCount": 15
  }
}
```

### Mobile App Workflow

1. **User selects a shop** → Get shop ID
2. **User selects services** → Get service IDs
3. **User selects a date** → Call availability endpoint
4. **Display available time slots** → Show in UI as clickable buttons
5. **User selects a time slot** → Proceed to reservation creation

### Mobile App Error Handling

```json
// Shop closed on selected date
{
  "success": true,
  "data": {
    "availableSlots": [],
    "totalSlots": 0,
    "availableCount": 0
  }
}

// Invalid parameters
{
  "error": {
    "code": "MISSING_REQUIRED_PARAMETERS",
    "message": "필수 파라미터가 누락되었습니다.",
    "details": "date와 serviceIds는 필수입니다."
  }
}
```

---

## 🏪 Shop Admin - How to Check Availability

### Endpoint
Same endpoint, but typically used with broader time ranges to see shop capacity.

```
GET /api/shops/:shopId/available-slots
```

### Use Case
Shop owners need to:
- Check capacity for specific dates
- See peak hours and availability patterns
- Plan staff schedules based on demand

### Shop Admin Example Request

```bash
# Check full day availability for staffing decisions
curl -X GET "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/available-slots?date=2025-11-15&serviceIds[]=<SERVICE_ID>&interval=60" \
  -H "Authorization: Bearer <SHOP_OWNER_JWT_TOKEN>"
```

### Shop Admin Use Cases

#### 1. View Daily Capacity
```bash
# Get all slots for the day to see booking density
GET /api/shops/:shopId/available-slots?date=2025-11-15&serviceIds[]=all&interval=30
```

#### 2. Check Specific Time Range
```bash
# Check lunch hour availability
GET /api/shops/:shopId/available-slots?date=2025-11-15&serviceIds[]=all&startTime=12:00&endTime=14:00
```

#### 3. Monitor Popular Services
```bash
# Check availability for high-demand services
GET /api/shops/:shopId/available-slots?date=2025-11-15&serviceIds[]=<POPULAR_SERVICE_ID>&interval=15
```

---

## 🔄 Reservation Rescheduling - Available Slots

### Endpoint
```
GET /api/reservations/:reservationId/reschedule/available-slots
```

### Use Case
When customers want to reschedule an existing reservation.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reservationId` | UUID (path) | ✅ Yes | Existing reservation ID |
| `date` | string (query) | ❌ No | Target date for reschedule |

### Mobile App Reschedule Example

```bash
# Get available slots for rescheduling
curl -X GET "http://localhost:3001/api/reservations/<RESERVATION_ID>/reschedule/available-slots?date=2025-11-16" \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"
```

### Response
```json
{
  "success": true,
  "data": {
    "reservationId": "existing-reservation-id",
    "currentDateTime": "2025-11-15T14:00:00Z",
    "availableSlots": [
      {
        "startTime": "10:00",
        "endTime": "11:00",
        "duration": 60,
        "isAvailable": true
      }
    ]
  }
}
```

---

## 🗓️ Getting Available Dates (Date Range)

### Implementation Needed
Currently, there's **no dedicated endpoint** for getting available dates in a range. The mobile app should:

### Recommended Approach

#### Option 1: Check Multiple Days Client-Side
```javascript
// Mobile app logic
async function getAvailableDates(shopId, serviceIds, startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const response = await fetch(
        `/api/shops/${shopId}/available-slots?date=${dateStr}&serviceIds[]=${serviceIds.join('&serviceIds[]=')}`
      );
      const data = await response.json();

      if (data.success && data.data.availableCount > 0) {
        dates.push({
          date: dateStr,
          availableSlots: data.data.availableCount
        });
      }
    } catch (error) {
      console.error(`Error checking ${dateStr}:`, error);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}
```

#### Option 2: Backend Batch Endpoint (Future Enhancement)
```bash
# Proposed endpoint for multiple dates
POST /api/shops/:shopId/available-dates
Content-Type: application/json

{
  "startDate": "2025-11-15",
  "endDate": "2025-11-30",
  "serviceIds": ["service-id-1", "service-id-2"]
}

# Response
{
  "success": true,
  "data": {
    "availableDates": [
      { "date": "2025-11-15", "availableSlots": 12 },
      { "date": "2025-11-16", "availableSlots": 8 },
      { "date": "2025-11-17", "availableSlots": 0 }
    ]
  }
}
```

---

## 🧪 Testing with Real Data

### Step 1: Get Service IDs for Test Shop

```bash
# Get services for the test shop
curl -X GET "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/services"
```

### Step 2: Test Availability Endpoint

```bash
# Replace <SERVICE_ID> with actual ID from Step 1
curl -X GET "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/available-slots?date=2025-11-15&serviceIds[]=<SERVICE_ID>&interval=30"
```

### Step 3: Create Test Reservation

```bash
curl -X POST "http://localhost:3001/api/reservations" \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "22222222-2222-2222-2222-222222222222",
    "services": [
      {
        "serviceId": "<SERVICE_ID>",
        "quantity": 1
      }
    ],
    "reservationDate": "2025-11-15",
    "reservationTime": "14:00",
    "specialRequests": "Test booking via API"
  }'
```

### Step 4: Verify Slot is Now Unavailable

```bash
# Re-check availability - the 14:00 slot should now be unavailable
curl -X GET "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/available-slots?date=2025-11-15&serviceIds[]=<SERVICE_ID>&interval=30"
```

---

## 🔒 Authentication Requirements

### Mobile App (User)
- **Endpoint**: `/api/shops/:shopId/available-slots`
- **Auth Required**: ❌ No (public endpoint for browsing)
- **Rate Limit**: 100 requests per 15 minutes

### Shop Admin
- **Endpoint**: `/api/shops/:shopId/available-slots`
- **Auth Required**: ✅ Yes (Bearer JWT token)
- **Permissions**: Shop owner must own the shop OR admin role

### Rescheduling
- **Endpoint**: `/api/reservations/:id/reschedule/available-slots`
- **Auth Required**: ✅ Yes (Bearer JWT token)
- **Permissions**: User must own the reservation OR shop owner OR admin

---

## 📊 Response Fields Explained

### Available Slot Object
```typescript
interface AvailableSlot {
  startTime: string;      // "HH:MM" format, e.g., "14:00"
  endTime: string;        // "HH:MM" format, e.g., "15:00"
  duration: number;       // Duration in minutes, e.g., 60
}
```

### Full Response
```typescript
interface AvailabilityResponse {
  success: boolean;
  data: {
    shopId: string;                    // UUID of the shop
    date: string;                      // "YYYY-MM-DD" format
    serviceIds: string[];              // Array of service UUIDs
    availableSlots: AvailableSlot[];  // Only available slots
    totalSlots: number;                // Total slots generated
    availableCount: number;            // Number of available slots
  }
}
```

---

## ⚠️ Important Notes

### 1. Operating Hours
- Slots are only generated within shop operating hours
- Break times are excluded from available slots
- Shop closed days return empty array

### 2. Service Duration
- Total slot duration = max(service durations) + buffer time (15 min)
- Multiple services are calculated sequentially

### 3. Concurrent Bookings
- System prevents double-booking same time slot
- Uses database row-level locking for race condition prevention

### 4. Cache Behavior
- Availability cache TTL: 30 seconds
- Real-time validation on reservation creation
- Cache invalidated on new bookings

---

## 🛠️ Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `MISSING_REQUIRED_PARAMETERS` | 400 | Missing date or serviceIds | Include all required parameters |
| `INVALID_DATE_FORMAT` | 400 | Date not in YYYY-MM-DD format | Use correct date format |
| `INVALID_TIME_FORMAT` | 400 | Time not in HH:MM format | Use correct time format |
| `INVALID_INTERVAL` | 400 | Interval not between 15-120 | Use valid interval range |
| `SHOP_NOT_FOUND` | 404 | Shop doesn't exist | Verify shop ID |
| `INTERNAL_SERVER_ERROR` | 500 | Server error | Retry after delay |

---

## 📝 Summary

### ✅ Current Implementation Status

| Feature | Status | Endpoint |
|---------|--------|----------|
| Get available time slots | ✅ Implemented | `GET /api/shops/:shopId/available-slots` |
| Reschedule available slots | ✅ Implemented | `GET /api/reservations/:id/reschedule/available-slots` |
| Get available dates range | ❌ Not implemented | Client-side workaround available |

### 🎯 Mobile App Action Items

1. ✅ Use existing `/api/shops/:shopId/available-slots` endpoint
2. ✅ Pass service IDs from shop detail page
3. ✅ Display slots as interactive time picker
4. ⚠️ Implement client-side date range checking for calendar view
5. ✅ Handle empty results gracefully (shop closed/fully booked)

### 🎯 Shop Admin Action Items

1. ✅ Use same endpoint with broader queries
2. ✅ Add JWT authentication for shop owner access
3. ✅ Implement capacity visualization dashboard
4. ✅ Monitor peak hours using slot availability data

---

## 🚀 Quick Start

```bash
# 1. Get shop services
curl http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/services

# 2. Check availability (replace <SERVICE_ID>)
curl "http://localhost:3001/api/shops/22222222-2222-2222-2222-222222222222/available-slots?date=2025-11-15&serviceIds[]=<SERVICE_ID>"

# 3. Create reservation with available slot
curl -X POST http://localhost:3001/api/reservations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"shopId":"22222222-2222-2222-2222-222222222222","services":[{"serviceId":"<SERVICE_ID>","quantity":1}],"reservationDate":"2025-11-15","reservationTime":"14:00"}'
```

**🎉 The backend is ready! No new endpoints needed. Mobile app just needs to use the correct existing paths.**
