# Booking Validation Error Response Guide

## Issue Summary
Flutter WebView shows `[object Object]` instead of actual error messages when booking validation fails.

## Backend Response Structure

When booking validation fails, the backend returns HTTP 400 with this structure:

```json
{
  "success": false,
  "message": "Booking validation failed",
  "errors": [
    {
      "code": "ERROR_CODE",
      "field": "fieldName",
      "message": "Human-readable error message",
      "severity": "critical",
      "details": { ... }
    }
  ],
  "warnings": [],
  "metadata": {
    "validationTime": 1763797562360,
    "validationDuration": 623,
    "checksPerformed": ["list", "of", "checks"]
  }
}
```

## Common Validation Error Codes

### Date/Time Errors
- `PAST_DATE` - Cannot book for past dates
- `TOO_FAR_IN_FUTURE` - Cannot book more than 6 months in advance
- `INVALID_TIME_SLOT` - Time slot is invalid or unavailable
- `OUTSIDE_OPERATING_HOURS` - Selected time is outside shop hours

### User/Shop Errors
- `USER_NOT_FOUND` - User ID doesn't exist in database
- `SHOP_NOT_FOUND` - Shop ID doesn't exist
- `SHOP_INACTIVE` - Shop is not currently active/accepting bookings

### Service Errors
- `SERVICE_NOT_FOUND` - Service ID doesn't exist
- `SERVICE_INACTIVE` - Service is not currently offered
- `SERVICE_UNAVAILABLE` - Service not available at selected time

### Booking Limits
- `MAX_BOOKINGS_EXCEEDED` - User has too many active bookings
- `DOUBLE_BOOKING` - User already has booking at this time
- `SLOT_UNAVAILABLE` - Time slot is already fully booked

## Frontend Fix Required

### Current Problem (JavaScript/TypeScript in WebView)
```typescript
// ❌ This logs [object Object]
console.log('API request failed:', error);
console.log('Failed to create reservation:', error);
```

### Solution
```typescript
// ✅ Properly parse and log error details
try {
  const response = await fetch('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });

  if (!response.ok) {
    const errorData = await response.json();

    // Log the full error structure
    console.error('❌ Booking failed:', JSON.stringify(errorData, null, 2));

    // Extract and display specific errors
    if (errorData.errors && errorData.errors.length > 0) {
      errorData.errors.forEach(err => {
        console.error(`[${err.code}] ${err.message}`);
        if (err.details) {
          console.error('Details:', JSON.stringify(err.details, null, 2));
        }
      });
    }

    // Show user-friendly error message
    const firstError = errorData.errors?.[0];
    if (firstError) {
      showErrorToUser(firstError.message); // or errorData.message
    } else {
      showErrorToUser(errorData.message || 'Booking failed');
    }

    throw new Error(errorData.message || 'Booking validation failed');
  }

  const result = await response.json();
  return result;

} catch (error) {
  // If it's a network error or our thrown error
  console.error('Booking error:', error instanceof Error ? error.message : String(error));
  throw error;
}
```

## Example Error Responses

### Past Date Error
```json
{
  "success": false,
  "message": "Booking validation failed",
  "errors": [
    {
      "code": "PAST_DATE",
      "field": "date",
      "message": "Cannot book for past dates",
      "severity": "critical",
      "details": {
        "bookingDate": "2025-11-20",
        "todayDate": "2025-11-22"
      }
    }
  ]
}
```

### User Not Found Error
```json
{
  "success": false,
  "message": "Booking validation failed",
  "errors": [
    {
      "code": "USER_NOT_FOUND",
      "field": "userId",
      "message": "User not found",
      "severity": "critical"
    }
  ]
}
```

### Shop Not Found Error
```json
{
  "success": false,
  "message": "Booking validation failed",
  "errors": [
    {
      "code": "SHOP_NOT_FOUND",
      "field": "shopId",
      "message": "Shop not found or inactive",
      "severity": "critical"
    }
  ]
}
```

### Slot Unavailable Error
```json
{
  "success": false,
  "message": "Booking validation failed",
  "errors": [
    {
      "code": "SLOT_UNAVAILABLE",
      "field": "timeSlot",
      "message": "Selected time slot is no longer available",
      "severity": "critical",
      "details": {
        "requestedTime": "16:30",
        "reason": "slot_fully_booked"
      }
    }
  ]
}
```

## Testing Backend Errors

You can test the backend response by making a direct API call:

```bash
# Test with invalid shop ID
curl -X POST https://api.e-beautything.com/api/reservations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "invalid-shop-id",
    "services": [{
      "serviceId": "ce98e031-b8d2-4050-9594-0015cd87d57f",
      "quantity": 1
    }],
    "reservationDate": "2025-11-27",
    "reservationTime": "16:30",
    "pointsToUse": 0
  }'

# Expected: 400 Bad Request with detailed error
```

## Recommended Frontend Changes

### 1. Update API Client Error Handling
```typescript
// In your API client/service
async function createReservation(data: ReservationData) {
  try {
    const response = await apiClient.post('/reservations', data);
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      const errorData = error.response.data;

      // Log full error for debugging
      console.error('Booking validation failed:', JSON.stringify(errorData, null, 2));

      // Extract user-friendly message
      const errorMessage = errorData.errors?.[0]?.message || errorData.message || 'Booking failed';

      throw new Error(errorMessage);
    } else {
      // Network error
      console.error('Network error:', error.message);
      throw new Error('Network error. Please check your connection.');
    }
  }
}
```

### 2. Display Errors to User
```typescript
try {
  await createReservation(bookingData);
  showSuccess('Booking created successfully!');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Booking failed';

  // Show user-friendly alert
  Alert.alert(
    'Booking Failed',
    message,
    [{ text: 'OK' }]
  );
}
```

### 3. Debug Logging
```typescript
// Add this to your console.log statements
console.log = function(...args) {
  const processedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return JSON.stringify(arg, null, 2); // ✅ Stringify objects
    }
    return arg;
  });
  // Original console.log
  originalConsoleLog(...processedArgs);
};
```

## Summary

**Backend**: ✅ Working correctly, returning detailed error information
**Frontend**: ❌ Not parsing error objects properly, showing `[object Object]`

**Fix**: Update frontend error handling to:
1. Parse JSON error responses
2. Extract error.message from errors array
3. Display user-friendly error messages
4. Log full error details using JSON.stringify() for debugging

---

**Last Updated**: 2025-11-22
**Tested**: ✅ Backend validation confirmed working
**Issue**: Frontend WebView JavaScript error logging
