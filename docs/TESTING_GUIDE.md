# Supabase API Testing Guide

This guide provides comprehensive instructions for testing all Supabase APIs in the 에뷰리띵 backend system.

## Overview

The testing suite includes:
- **Comprehensive API Tests**: Full integration testing of all endpoints
- **Database Function Tests**: Testing of custom database functions and triggers
- **Performance Tests**: Load testing and performance benchmarking
- **Security Tests**: Authentication, authorization, and security validation
- **Concurrent Tests**: Testing concurrent operations and race conditions

## Prerequisites

### Environment Setup

1. **Required Environment Variables**:
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret_key
   ```

2. **Optional Environment Variables**:
   ```bash
   TOSS_PAYMENTS_SECRET_KEY=your_toss_payments_secret_key
   TOSS_PAYMENTS_CLIENT_KEY=your_toss_payments_client_key
   FCM_SERVER_KEY=your_firebase_server_key
   FCM_PROJECT_ID=your_firebase_project_id
   REDIS_URL=redis://localhost:6379
   ```

3. **Database Setup**:
   - Ensure your Supabase database is running
   - Run migrations: `npm run migrate`
   - Seed test data: `npm run seed`

### Test Data

The tests automatically create and clean up test data. No manual data preparation is required.

## Running Tests

### Quick Start

```bash
# Run all comprehensive tests
npm run test:all

# Run specific test categories
npm run test:supabase:comprehensive  # All Supabase API tests
npm run test:supabase:load          # Performance/load tests
npm run test:supabase:database      # Database functions tests
npm run test:api                    # Integration tests
```

### Individual Test Categories

#### 1. Comprehensive API Tests
```bash
npm run test:supabase:comprehensive
```
- Tests all API endpoints
- Authentication and authorization
- CRUD operations
- Error handling
- Performance validation

#### 2. Database Functions Tests
```bash
npm run test:supabase:database
```
- Custom database functions (`create_reservation_with_lock`, `reschedule_reservation`)
- Database triggers
- Concurrent operations
- Data integrity validation

#### 3. Performance/Load Tests
```bash
npm run test:supabase:load
```
- Concurrent user creation
- Shop creation under load
- Reservation system stress testing
- Point transaction performance
- Complex query performance

#### 4. Integration Tests
```bash
npm run test:api
```
- End-to-end user workflows
- Payment integration
- Social authentication
- Time slot management
- Concurrent booking scenarios

#### 5. Security Tests
```bash
npm run test:security
```
- Authentication security
- Authorization (RBAC)
- Rate limiting
- SQL injection prevention
- XSS/CSRF protection

## Test Structure

### Test Files Organization

```
tests/
├── integration/
│   ├── supabase-api-comprehensive.test.ts    # Main API test suite
│   ├── database-functions.test.ts            # Database function tests
│   ├── concurrent-booking.test.ts            # Concurrent operations
│   ├── time-slot-integration.test.ts         # Time slot management
│   ├── user-management.test.ts               # User operations
│   └── social-auth.test.ts                   # Social authentication
├── performance/
│   └── supabase-load-test.ts                 # Load and performance tests
├── security/
│   ├── auth-security.test.ts                 # Authentication security
│   ├── integration-security.test.ts          # Integration security
│   ├── rate-limit-security.test.ts           # Rate limiting
│   └── rbac-security.test.ts                 # Role-based access control
└── unit/
    └── [various unit tests]
```

### Test Configuration

Tests are configured with:
- **Timeout**: 30-60 seconds per test suite
- **Retries**: 2-3 retry attempts for flaky tests
- **Cleanup**: Automatic test data cleanup
- **Isolation**: Each test runs in isolation

## Test Categories

### 1. Authentication APIs
- User registration
- Login/logout
- Token refresh
- Password validation
- Email verification

### 2. User Profile APIs
- Profile retrieval
- Profile updates
- Settings management
- Session management

### 3. Shop APIs
- Shop registration
- Shop listing and search
- Shop details
- Shop management
- Category filtering
- Location-based search

### 4. Reservation APIs
- Reservation creation
- Reservation listing
- Reservation updates
- Cancellation
- Status management
- Time slot validation

### 5. Payment APIs
- Payment creation
- Payment confirmation
- Payment status
- Refund processing
- Split payments

### 6. Point System APIs
- Point balance retrieval
- Point earning
- Point spending
- Point transactions
- Point expiry

### 7. Admin APIs
- User management
- Shop approval
- Analytics
- Moderation
- System monitoring

### 8. Database Functions
- `create_reservation_with_lock`: Atomic reservation creation
- `reschedule_reservation`: Reservation rescheduling
- Point balance triggers
- Status log triggers
- User profile triggers

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Target Response Time | Concurrent Users |
|-----------|---------------------|------------------|
| User Registration | < 500ms | 100 |
| Shop Search | < 200ms | 200 |
| Reservation Creation | < 300ms | 50 |
| Payment Processing | < 1000ms | 30 |
| Point Transactions | < 150ms | 100 |

### Load Testing Scenarios

1. **User Registration Load**: 100 concurrent user registrations
2. **Shop Creation Load**: 50 concurrent shop registrations
3. **Search Load**: 200 concurrent search requests
4. **Reservation Load**: 100 concurrent reservations
5. **Point Transaction Load**: 150 concurrent point transactions

## Debugging Tests

### Common Issues

1. **Database Connection Errors**:
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database is running

2. **Timeout Errors**:
   - Increase timeout values
   - Check database performance
   - Verify test data size

3. **Authentication Errors**:
   - Verify JWT secret
   - Check token expiration
   - Validate user permissions

### Debug Mode

Run tests with verbose output:
```bash
npm run test:supabase:comprehensive -- --verbose
```

### Test Data Inspection

Tests automatically clean up data, but you can inspect test data during execution by adding debug logs or pausing execution.

## Continuous Integration

### GitHub Actions

The tests are designed to run in CI environments. Ensure:
- Environment variables are set in CI secrets
- Database is accessible from CI environment
- Sufficient timeout for CI execution

### Local CI Simulation

```bash
# Simulate CI environment
NODE_ENV=test npm run test:all
```

## Best Practices

### Test Development

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Realistic Data**: Use realistic test data
4. **Error Cases**: Test both success and failure scenarios
5. **Performance**: Monitor test execution time

### Test Maintenance

1. **Regular Updates**: Update tests when APIs change
2. **Performance Monitoring**: Track test performance over time
3. **Coverage**: Maintain high test coverage
4. **Documentation**: Keep test documentation updated

## Troubleshooting

### Common Error Messages

1. **"Database connection failed"**:
   - Check Supabase URL and keys
   - Verify network connectivity
   - Check database status

2. **"Test timeout"**:
   - Increase timeout values
   - Check database performance
   - Reduce test data size

3. **"Authentication failed"**:
   - Verify JWT secret
   - Check token format
   - Validate user permissions

### Getting Help

1. Check test logs for detailed error messages
2. Verify environment configuration
3. Review database schema and migrations
4. Check API documentation for expected behavior

## Test Reports

### Report Generation

Tests generate detailed reports including:
- Test execution summary
- Performance metrics
- Error analysis
- Recommendations

### Report Location

Reports are generated in:
- Console output (detailed)
- Test result files (JSON format)
- Performance metrics (timing data)

## Security Considerations

### Test Data Security

- Test data is automatically cleaned up
- No production data is used in tests
- Sensitive information is masked in logs

### Environment Security

- Use separate test environment
- Secure test credentials
- Monitor test execution logs

## Conclusion

This comprehensive testing suite ensures the reliability, performance, and security of all Supabase APIs in the 에뷰리띵 system. Regular execution of these tests helps maintain code quality and system stability.
