# Comprehensive Testing Suite

This directory contains a comprehensive testing suite for the reservation system, covering unit tests, integration tests, performance tests, and end-to-end user simulation tests.

## 📁 Directory Structure

```
tests/
├── README.md                           # This file
├── setup.ts                           # Global test setup and teardown
├── config/                            # Test configuration files
│   ├── reservation-test-config.ts     # Reservation-specific test configuration
│   └── ...
├── utils/                             # Test utilities and helpers
│   ├── reservation-test-utils.ts      # Reservation test utilities
│   └── ...
├── setup/                             # Test setup and teardown utilities
│   ├── reservation-database-setup.ts  # Database setup for reservation tests
│   └── ...
├── unit/                              # Unit tests
│   ├── reservation-service-comprehensive.test.ts
│   ├── reservation-state-machine-comprehensive.test.ts
│   ├── time-slot-service-comprehensive.test.ts
│   ├── conflict-resolution-service-comprehensive.test.ts
│   ├── monitoring-service-comprehensive.test.ts
│   └── ...
├── integration/                       # Integration tests
│   ├── reservation-workflow-integration.test.ts
│   ├── payment-workflow-integration.test.ts
│   ├── notification-workflow-integration.test.ts
│   └── ...
├── performance/                       # Performance and load tests
│   ├── reservation-load-performance.test.ts
│   ├── database-performance.test.ts
│   ├── api-performance.test.ts
│   └── ...
├── e2e/                               # End-to-end tests
│   ├── user-journey-e2e.test.ts
│   ├── automated-user-simulation.test.ts
│   └── ...
└── security/                          # Security tests
    ├── auth-security.test.ts
    ├── rbac-security.test.ts
    ├── rate-limit-security.test.ts
    └── ...
```

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:comprehensive
```

### Run Specific Test Types
```bash
# Unit tests only
npm run test:comprehensive:unit

# Integration tests only
npm run test:comprehensive:integration

# Performance tests only
npm run test:comprehensive:performance

# End-to-end tests only
npm run test:comprehensive:e2e

# Security tests only
npm run test:comprehensive:security
```

### Quick Test Run (Skip Heavy Tests)
```bash
npm run test:comprehensive:quick
```

### CI/CD Mode
```bash
npm run test:comprehensive:ci
```

## 📊 Test Categories

### 1. Unit Tests (`tests/unit/`)

**Purpose**: Test individual components in isolation with >90% coverage target.

**Key Features**:
- Comprehensive service testing
- Mock dependencies
- Edge case coverage
- Business rule validation

**Coverage Targets**:
- **Critical Services**: 95% (ReservationService, TimeSlotService, StateMachine)
- **Core Services**: 90% (PaymentService, NotificationService)
- **Support Services**: 85% (MonitoringService, ConflictResolutionService)

**Run Unit Tests**:
```bash
npm run test:unit
npm run test:coverage:reservation
```

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test complete workflows and service interactions.

**Key Features**:
- End-to-end workflow testing
- Service integration validation
- Database transaction testing
- External service mocking

**Test Categories**:
- **Reservation Workflows**: Booking, cancellation, rescheduling
- **Payment Workflows**: Processing, refunds, reconciliation
- **Notification Workflows**: Multi-channel delivery, preferences

**Run Integration Tests**:
```bash
npm run test:integration
npm run test:reservation:integration
```

### 3. Performance Tests (`tests/performance/`)

**Purpose**: Validate system performance under various load conditions.

**Key Features**:
- Load testing with concurrent users
- Database query optimization
- API response time benchmarks
- Memory usage monitoring
- Connection pool testing

**Performance Thresholds**:
- **Reservation Creation**: <1000ms per request
- **Time Slot Queries**: <500ms per query
- **Payment Processing**: <2000ms per transaction
- **Concurrent Users**: Support 1000+ simultaneous users
- **Memory Usage**: <100MB increase under load

**Run Performance Tests**:
```bash
npm run test:performance:all
npm run test:performance:load
npm run test:performance:database
npm run test:performance:api
```

### 4. End-to-End Tests (`tests/e2e/`)

**Purpose**: Simulate real user interactions and complete user journeys.

**Key Features**:
- Complete user booking flows
- Cross-browser compatibility
- Mobile app simulation
- Error handling and recovery
- Automated user behavior simulation

**Test Scenarios**:
- **Complete Booking Journey**: Search → Select → Book → Pay → Complete
- **Cancellation and Refund Flow**: Book → Cancel → Refund
- **No-Show Scenarios**: Automatic detection and processing
- **User Authentication**: Registration, login, session management
- **Shop Owner Management**: Dashboard, reservations, analytics

**Run E2E Tests**:
```bash
npm run test:e2e:all
npm run test:e2e:user-journey
npm run test:e2e:automated-simulation
```

### 5. Security Tests (`tests/security/`)

**Purpose**: Validate security measures and compliance requirements.

**Key Features**:
- Authentication and authorization testing
- Role-based access control validation
- Rate limiting and throttling
- Input validation and sanitization
- SQL injection prevention

**Run Security Tests**:
```bash
npm run test:security
npm run test:security:auth
npm run test:security:rbac
npm run test:security:rate-limit
```

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/migrations/**',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Higher thresholds for critical components
    './src/services/reservation.service.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

### Test Configuration (`tests/config/reservation-test-config.ts`)

```typescript
export interface TestConfig {
  performance: {
    thresholds: {
      reservationCreation: number;
      timeSlotQuery: number;
      paymentProcessing: number;
    };
  };
  load: {
    maxConcurrentUsers: number;
    maxExecutionTime: number;
    minSuccessRate: number;
  };
  database: {
    testDatabaseUrl: string;
    isolationLevel: string;
  };
}
```

## 🛠️ Test Utilities

### Reservation Test Utils (`tests/utils/reservation-test-utils.ts`)

```typescript
export class ReservationTestUtils {
  // Create mock users, shops, services, reservations
  createMockUser(overrides?: Partial<User>): User;
  createMockShop(overrides?: Partial<Shop>): Shop;
  createMockReservation(overrides?: Partial<Reservation>): Reservation;
  
  // Database helpers
  setupTestDatabase(): Promise<void>;
  cleanupTestDatabase(): Promise<void>;
  
  // Performance testing helpers
  measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }>;
  generateLoadTestData(count: number): any[];
}
```

### Database Setup (`tests/setup/reservation-database-setup.ts`)

```typescript
export class GlobalTestSetup {
  static async setup(): Promise<void> {
    // Initialize test database
    // Seed test data
    // Configure test environment
  }
  
  static async teardown(): Promise<void> {
    // Cleanup test data
    // Close database connections
    // Reset test environment
  }
}
```

## 📈 Coverage Reports

### Generate Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage:reservation

# Generate LCOV report for CI/CD
npm run test:coverage:report

# View coverage in browser
open coverage/lcov-report/index.html
```

### Coverage Targets

| Component | Branches | Functions | Lines | Statements |
|-----------|----------|-----------|-------|------------|
| **Global** | 80% | 85% | 85% | 85% |
| **ReservationService** | 90% | 95% | 95% | 95% |
| **TimeSlotService** | 90% | 95% | 95% | 95% |
| **StateMachine** | 90% | 95% | 95% | 95% |
| **PaymentService** | 85% | 90% | 90% | 90% |
| **NotificationService** | 85% | 90% | 90% | 90% |

## 🚦 Continuous Integration

### GitHub Actions Workflow

```yaml
name: Comprehensive Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run comprehensive tests
        run: npm run test:comprehensive:ci
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
# Install husky for git hooks
npm install --save-dev husky lint-staged

# Add to package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": [
      "npm run test:comprehensive:quick",
      "npm run lint"
    ]
  }
}
```

## 🔍 Debugging Tests

### Run Tests in Debug Mode

```bash
# Run with verbose output
npm run test:comprehensive -- --verbose

# Run specific test file
npm run test:unit -- reservation-service-comprehensive.test.ts

# Run tests matching pattern
npm run test:integration -- --testNamePattern="payment workflow"

# Run tests in watch mode
npm run test:unit -- --watch
```

### Common Debug Commands

```bash
# Check test database connection
npm run test:setup

# Validate test configuration
npm run test:config:validate

# Run tests with memory profiling
npm run test:performance -- --detectLeaks

# Generate test report
npm run test:comprehensive -- --coverage --reporters=json
```

## 📝 Writing Tests

### Unit Test Example

```typescript
describe('ReservationService', () => {
  let service: ReservationService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReservationService();
    mockSupabase = createMockSupabase();
  });

  it('should create reservation successfully', async () => {
    // Arrange
    const request = createMockReservationRequest();
    mockSupabase.rpc.mockResolvedValue({
      data: { id: 'reservation-123', status: 'requested' },
      error: null
    });

    // Act
    const result = await service.createReservation(request);

    // Assert
    expect(result.id).toBe('reservation-123');
    expect(result.status).toBe('requested');
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'create_reservation_with_lock',
      expect.any(Object)
    );
  });
});
```

### Integration Test Example

```typescript
describe('Reservation Workflow Integration', () => {
  it('should complete full booking workflow', async () => {
    // Step 1: Search for shops
    const shops = await shopService.searchShops({
      location: 'Seoul',
      serviceType: 'hair_salon'
    });
    expect(shops.shops).toHaveLength(5);

    // Step 2: Create reservation
    const reservation = await reservationService.createReservation({
      shopId: shops.shops[0].id,
      userId: 'user-123',
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: '10:00'
    });
    expect(reservation.status).toBe('requested');

    // Step 3: Process payment
    const payment = await paymentService.processPayment({
      reservationId: reservation.id,
      amount: 50000,
      paymentMethod: 'card'
    });
    expect(payment.success).toBe(true);

    // Step 4: Confirm reservation
    const confirmation = await reservationService.confirmReservation(
      reservation.id,
      'shop-owner-123'
    );
    expect(confirmation.reservation.status).toBe('confirmed');
  });
});
```

### Performance Test Example

```typescript
describe('Load Performance Tests', () => {
  it('should handle 1000 concurrent requests', async () => {
    const requests = Array(1000).fill(0).map((_, index) => ({
      shopId: 'shop-123',
      userId: `user-${index}`,
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: `${9 + (index % 8)}:00`
    }));

    const startTime = performance.now();
    const results = await Promise.allSettled(
      requests.map(request => reservationService.createReservation(request))
    );
    const endTime = performance.now();

    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThan(800); // 80% success rate
    expect(endTime - startTime).toBeLessThan(60000); // Under 1 minute
  });
});
```

## 🎯 Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### 2. Mocking Strategy
- Mock external dependencies
- Use realistic mock data
- Verify mock interactions
- Clean up mocks between tests

### 3. Performance Testing
- Set realistic performance thresholds
- Test under various load conditions
- Monitor memory usage
- Validate concurrent user handling

### 4. E2E Testing
- Test complete user journeys
- Simulate realistic user behavior
- Handle async operations properly
- Clean up test data

### 5. Maintenance
- Keep tests up to date with code changes
- Regularly review and update test coverage
- Remove obsolete tests
- Document complex test scenarios

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database configuration
   npm run test:setup
   
   # Reset test database
   npm run test:db:reset
   ```

2. **Memory Leaks in Tests**
   ```bash
   # Run with leak detection
   npm run test:unit -- --detectLeaks
   
   # Check memory usage
   npm run test:performance -- --logHeapUsage
   ```

3. **Slow Test Execution**
   ```bash
   # Run tests in parallel
   npm run test:unit -- --runInBand=false
   
   # Skip slow tests
   npm run test:comprehensive:quick
   ```

4. **Coverage Issues**
   ```bash
   # Generate detailed coverage report
   npm run test:coverage:reservation
   
   # Check uncovered lines
   open coverage/lcov-report/index.html
   ```

### Getting Help

- Check test logs for detailed error messages
- Review test configuration files
- Consult individual test file documentation
- Check CI/CD pipeline logs for integration issues

---

For more information, see the individual test files and configuration documentation.
