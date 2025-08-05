# Time Slot Availability Calculation Engine

## Overview

The Time Slot Availability Calculation Engine is a sophisticated system that generates available booking slots for shops based on their operating hours, service durations, and existing reservations. This engine is a core component of the reservation system and ensures accurate availability calculations while preventing double-bookings.

## Features

### Core Functionality
- **Intelligent Time Slot Generation**: Creates available booking slots based on shop operating hours
- **Service Duration Integration**: Considers service duration and buffer times between appointments
- **Conflict Detection**: Prevents overlapping reservations
- **Flexible Intervals**: Supports configurable time intervals (15-120 minutes)
- **Time Constraints**: Allows filtering by start and end times
- **Multi-Service Support**: Handles bookings with multiple services

### Advanced Features
- **Buffer Time Management**: Automatically includes buffer times between appointments
- **Operating Hours Integration**: Respects shop-specific operating hours
- **Timezone Support**: Handles different time zones and daylight saving time
- **Reservation Status Awareness**: Only considers confirmed reservations for conflict detection

## API Endpoint

### GET /api/shops/:shopId/available-slots

Retrieves available time slots for a specific shop on a given date.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | string (UUID) | Yes | Shop identifier |
| `date` | string (YYYY-MM-DD) | Yes | Date for availability check |
| `serviceIds[]` | string[] (UUID) | Yes | Array of service IDs |
| `startTime` | string (HH:MM) | No | Optional start time filter |
| `endTime` | string (HH:MM) | No | Optional end time filter |
| `interval` | number | No | Time interval in minutes (default: 30) |

#### Example Request

```bash
GET /api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots?date=2024-03-15&serviceIds[]=service-1&serviceIds[]=service-2&interval=30
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "shopId": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-03-15",
    "serviceIds": ["service-1", "service-2"],
    "availableSlots": [
      {
        "startTime": "09:00",
        "endTime": "09:30",
        "duration": 30
      },
      {
        "startTime": "09:30",
        "endTime": "10:00",
        "duration": 30
      }
    ],
    "totalSlots": 16,
    "availableCount": 2
  }
}
```

#### Error Responses

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `MISSING_REQUIRED_PARAMETERS` | Missing date or serviceIds | 400 |
| `INVALID_DATE_FORMAT` | Date format is not YYYY-MM-DD | 400 |
| `MISSING_SERVICE_IDS` | No service IDs provided | 400 |
| `INVALID_INTERVAL` | Interval is not between 15-120 minutes | 400 |
| `INVALID_START_TIME` | Start time format is not HH:MM | 400 |
| `INVALID_END_TIME` | End time format is not HH:MM | 400 |
| `INTERNAL_SERVER_ERROR` | Server error during processing | 500 |

## Architecture

### Components

#### 1. ReservationController
- **Location**: `src/controllers/reservation.controller.ts`
- **Purpose**: Handles HTTP requests and responses
- **Features**:
  - Parameter validation
  - Error handling
  - Response formatting
  - Logging

#### 2. TimeSlotService
- **Location**: `src/services/time-slot.service.ts`
- **Purpose**: Core business logic for time slot calculations
- **Features**:
  - Operating hours retrieval
  - Service duration management
  - Conflict detection
  - Time slot generation

#### 3. Database Integration
- **Tables**: `shops`, `services`, `reservations`, `shop_operating_hours`
- **Features**:
  - Row Level Security (RLS)
  - Real-time data access
  - Transaction support

### Data Flow

1. **Request Validation**: Controller validates all input parameters
2. **Operating Hours Check**: Service retrieves shop operating hours for the date
3. **Service Duration Calculation**: Determines total duration including buffer times
4. **Existing Reservations**: Fetches confirmed reservations for conflict detection
5. **Time Slot Generation**: Creates slots based on operating hours and interval
6. **Availability Check**: Marks slots as available/unavailable based on conflicts
7. **Response Formatting**: Returns filtered available slots with metadata

## Configuration

### Default Settings

```typescript
// Default operating hours
DEFAULT_OPERATING_HOURS = {
  openTime: '09:00',
  closeTime: '18:00',
  interval: 30
}

// Buffer time between appointments
BUFFER_TIME = 15 // minutes
```

### Customization Options

- **Operating Hours**: Per-shop customizable hours
- **Service Durations**: Individual service duration and buffer times
- **Time Intervals**: Configurable slot intervals (15-120 minutes)
- **Buffer Times**: Adjustable buffer times between appointments

## Business Logic

### Time Slot Generation Algorithm

1. **Parse Operating Hours**: Extract open/close times for the date
2. **Calculate Max Duration**: Determine longest service duration + buffer
3. **Generate Slots**: Create slots at specified intervals
4. **Apply Constraints**: Filter by optional start/end time constraints
5. **Check Availability**: Mark slots based on existing reservations

### Conflict Detection

```typescript
// Overlap detection logic
timesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && start2 < end1;
}
```

### Service Duration Calculation

```typescript
// Total duration calculation
let totalDuration = 0;
for (const service of services) {
  const serviceDuration = serviceDurations.find(s => s.serviceId === service.serviceId);
  if (serviceDuration) {
    totalDuration += serviceDuration.durationMinutes * service.quantity;
  }
}
totalDuration += bufferTime;
```

## Testing

### Test Coverage

The Time Slot Engine includes comprehensive test coverage:

#### Unit Tests
- **ReservationController**: `tests/unit/reservation.controller.test.ts`
  - Parameter validation
  - Error handling
  - Response formatting

- **TimeSlotService**: `tests/unit/time-slot.service.test.ts`
  - Time slot generation
  - Conflict detection
  - Utility functions
  - Edge cases

#### Integration Tests
- **End-to-End**: `tests/integration/time-slot-integration.test.ts`
  - API endpoint testing
  - Request/response validation
  - Error scenarios
  - Feature completeness

### Test Scenarios

1. **Valid Requests**: Normal operation with various parameters
2. **Invalid Inputs**: Parameter validation and error handling
3. **Edge Cases**: Empty arrays, invalid formats, boundary conditions
4. **Error Handling**: Database errors, service failures
5. **Business Logic**: Conflict detection, availability calculations

## Performance Considerations

### Optimization Strategies

1. **Database Queries**: Optimized queries with proper indexing
2. **Caching**: Service duration and operating hours caching
3. **Batch Processing**: Efficient handling of multiple services
4. **Memory Management**: Minimal object creation and garbage collection

### Scalability

- **Horizontal Scaling**: Stateless service design
- **Database Scaling**: Supabase's built-in scaling capabilities
- **Caching**: Redis integration for frequently accessed data
- **Load Balancing**: API gateway support for high traffic

## Security

### Input Validation

- **Parameter Sanitization**: All inputs are validated and sanitized
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input encoding and validation
- **Rate Limiting**: API rate limiting to prevent abuse

### Access Control

- **Row Level Security**: Database-level access control
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Audit Logging**: Comprehensive logging for security monitoring

## Monitoring and Logging

### Logging Strategy

```typescript
// Success logging
logger.info('Available slots retrieved successfully', {
  shopId,
  date,
  serviceIds,
  availableSlotsCount
});

// Error logging
logger.error('Error in getAvailableSlots', {
  error: error.message,
  shopId,
  query
});
```

### Metrics

- **Response Times**: API endpoint performance
- **Error Rates**: Failed requests and error types
- **Usage Patterns**: Most common parameters and time ranges
- **Availability**: Service uptime and reliability

## Future Enhancements

### Planned Features

1. **Advanced Scheduling**: AI-powered optimal slot recommendations
2. **Dynamic Pricing**: Time-based pricing for premium slots
3. **Staff Availability**: Individual staff member availability tracking
4. **Recurring Bookings**: Support for recurring appointment patterns
5. **Mobile Optimization**: Enhanced mobile experience

### Technical Improvements

1. **Real-time Updates**: WebSocket support for live availability
2. **Offline Support**: Local caching for offline functionality
3. **Multi-language**: Internationalization support
4. **Analytics**: Advanced booking analytics and insights

## Troubleshooting

### Common Issues

1. **No Available Slots**: Check operating hours and existing reservations
2. **Invalid Time Format**: Ensure HH:MM format for time parameters
3. **Database Errors**: Check connection and table permissions
4. **Performance Issues**: Monitor query performance and indexing

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
// Debug logging
logger.debug('Time slot calculation details', {
  operatingHours,
  serviceDurations,
  existingReservations,
  generatedSlots
});
```

## Conclusion

The Time Slot Availability Calculation Engine provides a robust, scalable solution for managing appointment availability. With comprehensive testing, security measures, and monitoring, it ensures reliable operation in production environments while maintaining flexibility for future enhancements. 