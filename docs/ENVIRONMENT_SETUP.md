# 에뷰리띵 Backend Environment Setup Guide

## Overview
This document provides detailed instructions for setting up environment variables for the 에뷰리띵 backend server.

## Environment Files
Create a `.env` file in the project root with the following variables:

## Required Environment Variables

### Server Configuration
```bash
NODE_ENV=development                    # Environment: development, staging, production
PORT=3000                              # Server port
API_VERSION=v1                         # API version prefix
```

### Database Configuration (Supabase)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Authentication & Security
```bash
JWT_SECRET=your-jwt-secret-key-here     # Must be at least 32 characters
JWT_EXPIRES_IN=7d                      # JWT token expiration
JWT_REFRESH_EXPIRES_IN=30d             # Refresh token expiration
BCRYPT_SALT_ROUNDS=12                  # BCrypt salt rounds
```

### Redis Configuration
```bash
REDIS_URL=redis://localhost:6379       # Redis connection URL
REDIS_PASSWORD=                        # Redis password (if required)
REDIS_DB=0                            # Redis database number
```

### Payment Integration (TossPayments)
```bash
TOSS_PAYMENTS_SECRET_KEY=your-toss-payments-secret-key
TOSS_PAYMENTS_CLIENT_KEY=your-toss-payments-client-key
TOSS_PAYMENTS_BASE_URL=https://api.tosspayments.com
```

### Push Notifications (Firebase FCM)
```bash
FCM_SERVER_KEY=your-fcm-server-key
FCM_PROJECT_ID=your-firebase-project-id
FIREBASE_ADMIN_SDK_PATH=./config/firebase-admin-sdk.json
```

### Social Login Configuration

#### Kakao
```bash
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

#### Apple
```bash
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=./config/apple-private-key.p8
```

#### Google
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### File Storage & CDN
```bash
SUPABASE_STORAGE_BUCKET=shop-images    # Supabase storage bucket name
MAX_FILE_SIZE=5242880                  # Maximum file size (5MB)
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp  # Allowed file types
```

### Email & SMS Configuration
```bash
SMTP_HOST=smtp.gmail.com               # SMTP server host
SMTP_PORT=587                          # SMTP server port
SMTP_USER=your-email@domain.com        # SMTP username
SMTP_PASS=your-email-password          # SMTP password
SMS_API_KEY=your-sms-api-key          # SMS service API key
SMS_SENDER_NUMBER=01012345678          # SMS sender number
```

### Logging Configuration
```bash
LOG_LEVEL=info                         # Log level: error, warn, info, debug
LOG_FILE_PATH=./logs                   # Log file directory
MAX_LOG_SIZE=20m                       # Maximum log file size
MAX_LOG_FILES=14d                      # Log file retention period
```

### Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=900000           # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=100           # Max requests per window
RATE_LIMIT_LOGIN_MAX=5                # Max login attempts per window
```

### Development & Testing
```bash
DEBUG_MODE=false                       # Enable debug mode
SWAGGER_ENABLED=true                   # Enable Swagger documentation
MOCK_PAYMENTS=false                    # Use mock payment system
MOCK_SMS=false                         # Use mock SMS system
```

### Business Logic Configuration
```bash
POINT_EXPIRY_DAYS=365                 # Point expiration period
POINT_PENDING_DAYS=7                  # Point pending period
DEFAULT_COMMISSION_RATE=10.0          # Default commission rate (%)
RESERVATION_TIMEOUT_MINUTES=30        # Reservation timeout
MAX_CONCURRENT_BOOKINGS=1             # Max concurrent bookings per user
```

### Security Configuration
```bash
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com  # CORS allowed origins
TRUSTED_PROXIES=127.0.0.1,::1        # Trusted proxy IPs
SESSION_SECRET=your-session-secret     # Session secret key
ENCRYPTION_KEY=your-encryption-key     # Encryption key for sensitive data
```

## Environment-Specific Configuration

### Development (.env.development)
```bash
NODE_ENV=development
DEBUG_MODE=true
SWAGGER_ENABLED=true
MOCK_PAYMENTS=true
MOCK_SMS=true
LOG_LEVEL=debug
```

### Staging (.env.staging)
```bash
NODE_ENV=staging
DEBUG_MODE=false
SWAGGER_ENABLED=true
MOCK_PAYMENTS=false
MOCK_SMS=false
LOG_LEVEL=info
```

### Production (.env.production)
```bash
NODE_ENV=production
DEBUG_MODE=false
SWAGGER_ENABLED=false
MOCK_PAYMENTS=false
MOCK_SMS=false
LOG_LEVEL=error
```

## Setup Instructions

1. **Copy Environment Template**
   ```bash
   # If using the provided template
   cp .env.example .env
   ```

2. **Fill in Required Values**
   - Replace all placeholder values with actual credentials
   - Ensure JWT_SECRET is at least 32 characters long
   - Configure Supabase credentials from your project dashboard
   - Set up TossPayments API keys from your merchant account

3. **Validate Configuration**
   ```bash
   npm run build
   npm start
   ```

4. **Security Notes**
   - Never commit `.env` files to version control
   - Use different keys for different environments
   - Rotate secrets regularly
   - Use strong, unique passwords and keys

## Configuration Validation

The application will validate all environment variables on startup using Joi schema validation. Missing required variables or invalid formats will cause the application to fail startup with descriptive error messages.

## PRD Compliance

This environment configuration aligns with all requirements specified in the PRD:
- ✅ Node.js 18+ LTS runtime support
- ✅ Express.js 4.18+ framework configuration
- ✅ TypeScript 5.0+ with strict mode
- ✅ Supabase PostgreSQL with PostGIS
- ✅ JWT token authentication
- ✅ TossPayments integration
- ✅ Firebase Cloud Messaging (FCM)
- ✅ Winston + Morgan logging
- ✅ dotenv + config pattern

## Troubleshooting

### Common Issues

1. **JWT_SECRET too short**
   - Error: JWT_SECRET must be at least 32 characters
   - Solution: Generate a longer secret key

2. **Invalid Supabase URL**
   - Error: SUPABASE_URL must be a valid URI
   - Solution: Check your Supabase project URL format

3. **Missing required variables**
   - Error: Environment validation error
   - Solution: Ensure all required variables are set

### Support
For additional support, refer to the main project documentation or contact the development team. 