# Implementation Plan: Remove Debug Code from Production

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 - Critical |
| **Estimated Effort** | 4-6 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend only |
| **Dependencies** | None |

## Problem Statement

Debug logging statements (`console.log`, `console.error`, `[DEBUG]` markers) are present in production code, specifically in:
- `src/middleware/auth.middleware.ts` (30+ instances)
- `src/routes/shop-operating-hours.routes.ts`
- Various other route and middleware files

These debug statements:
1. Expose sensitive information in production logs
2. Degrade performance
3. Clutter production log files
4. May leak JWT tokens and session data

---

## Files Requiring Changes

### 1. Primary Target: `src/middleware/auth.middleware.ts`

**Current Debug Statements Found:**

```typescript
// Lines with console.log in auth.middleware.ts:
console.log('[REFRESH-DEBUG] No Supabase auth token found in cookie');
console.log('[REFRESH-DEBUG] Found Supabase project:', projectRef);
console.log('[REFRESH-DEBUG] No cookie parts found');
console.log(`[REFRESH-DEBUG] Found ${cookieParts.length} cookie parts`);
console.log('[REFRESH-DEBUG] Decoded cookie value length:', decodedValue.length);
console.log('[REFRESH-DEBUG] ✅ Found refresh token:', sessionData.refresh_token);
console.log('[REFRESH-DEBUG] No refresh_token field in session data');
console.log('[REFRESH-DEBUG] Session data keys:', Object.keys(sessionData));
console.log('[REFRESH-DEBUG] Error extracting refresh token:', error);
console.log('[COOKIE-DEBUG] No Supabase auth token found in cookie');
console.log('[COOKIE-DEBUG] Found Supabase project:', projectRef);
console.log('[COOKIE-DEBUG] No cookie parts found');
console.log(`[COOKIE-DEBUG] Found ${cookieParts.length} cookie parts`);
console.log('[COOKIE-DEBUG] Successfully extracted token from cookie');
console.log('[COOKIE-DEBUG] No access_token found in parsed cookie data');
console.log('[COOKIE-DEBUG] Error extracting token from cookie:', error);
console.log('[LOCAL-VERIFY-1] Starting local verification');
console.log('[LOCAL-VERIFY-2] JWT Secret available:', !!jwtSecret);
console.log('[LOCAL-VERIFY-ERROR] JWT secret not configured');
console.log('[LOCAL-VERIFY-3] Trying with issuer/audience');
console.log('[LOCAL-VERIFY-4] Success with issuer/audience');
console.log('[LOCAL-VERIFY-5] Issuer/audience failed, trying without');
console.log('[LOCAL-VERIFY-6] First error:', firstError);
console.log('[LOCAL-VERIFY-7] Success without issuer/audience');
console.log('[LOCAL-VERIFY-8] Token decoded successfully');
console.log('[LOCAL-VERIFY-9] Token payload:', JSON.stringify(decoded, null, 2));
console.log('[LOCAL-VERIFY-10] Validating required fields');
console.log('[LOCAL-VERIFY-11] Token.sub:', decoded.sub);
console.log('[LOCAL-VERIFY-12] Token.exp:', decoded.exp, 'Current time:', Date.now() / 1000);
console.log('[LOCAL-VERIFY-ERROR] Token missing user ID');
```

### 2. Secondary Targets

```bash
# Find all debug statements in the codebase
grep -r "console.log\|console.error\|\[DEBUG\]\|\[ROUTE-DEBUG\]" src/ --include="*.ts"
```

---

## Implementation Steps

### Step 1: Create Debug Utility Module

**File:** `src/utils/debug.ts`

```typescript
/**
 * Debug utility module for conditional debug logging
 * Only logs when DEBUG_MODE=true in environment
 */

import { config } from '../config/environment';
import { logger } from './logger';

/**
 * Debug logger that only outputs in debug mode
 * Uses Winston logger with debug level for proper log management
 */
export const debug = {
  /**
   * Log debug message (only in debug mode)
   */
  log: (tag: string, message: string, data?: Record<string, unknown>): void => {
    if (config.debugMode) {
      logger.debug(`[${tag}] ${message}`, data);
    }
  },

  /**
   * Log auth-related debug message
   */
  auth: (step: string, message: string, data?: Record<string, unknown>): void => {
    if (config.debugMode) {
      // Sanitize sensitive data before logging
      const sanitizedData = data ? sanitizeAuthData(data) : undefined;
      logger.debug(`[AUTH-DEBUG] [${step}] ${message}`, sanitizedData);
    }
  },

  /**
   * Log cookie-related debug message
   */
  cookie: (step: string, message: string, data?: Record<string, unknown>): void => {
    if (config.debugMode) {
      const sanitizedData = data ? sanitizeCookieData(data) : undefined;
      logger.debug(`[COOKIE-DEBUG] [${step}] ${message}`, sanitizedData);
    }
  },

  /**
   * Log route-related debug message
   */
  route: (method: string, path: string, data?: Record<string, unknown>): void => {
    if (config.debugMode) {
      logger.debug(`[ROUTE-DEBUG] ${method} ${path}`, data);
    }
  },

  /**
   * Log error in debug mode with full stack trace
   */
  error: (tag: string, message: string, error?: Error | unknown): void => {
    if (config.debugMode) {
      const errorInfo = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { error: String(error) };
      logger.debug(`[${tag}] ERROR: ${message}`, errorInfo);
    }
  },
};

/**
 * Sanitize authentication data to prevent token leakage
 */
function sanitizeAuthData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };

  const sensitiveKeys = [
    'token', 'access_token', 'refresh_token', 'jwt',
    'password', 'secret', 'api_key', 'apiKey',
    'authorization', 'auth_token', 'session_token'
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      const value = sanitized[key];
      if (typeof value === 'string' && value.length > 10) {
        sanitized[key] = `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize cookie data to prevent sensitive data leakage
 */
function sanitizeCookieData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };

  // Redact cookie values but keep structure visible
  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    if (typeof value === 'string' && value.length > 20) {
      sanitized[key] = `[${value.length} chars]`;
    }
  }

  return sanitized;
}

export default debug;
```

### Step 2: Verify Environment Configuration

**File:** `src/config/environment.ts`

`DEBUG_MODE` is already defined:

```typescript
// Already in schema:
DEBUG_MODE: Joi.boolean().default(false),

// Already in config export:
debugMode: envVars.DEBUG_MODE,
```

### Step 3: Create Audit Script

**File:** `scripts/audit-debug-code.sh`

```bash
#!/bin/bash
# Script to find and report all debug statements

echo "=== Debug Code Audit Report ==="
echo "Date: $(date)"
echo ""

echo "### console.log statements ###"
COUNT_LOG=$(grep -rn "console\.log" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "Count: $COUNT_LOG"
if [ "$COUNT_LOG" -gt 0 ]; then
  echo "Files affected:"
  grep -rl "console\.log" src/ --include="*.ts" 2>/dev/null
fi
echo ""

echo "### console.error statements ###"
COUNT_ERR=$(grep -rn "console\.error" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "Count: $COUNT_ERR"
echo ""

echo "### console.warn statements ###"
COUNT_WARN=$(grep -rn "console\.warn" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "Count: $COUNT_WARN"
echo ""

echo "### [DEBUG] markers ###"
COUNT_DEBUG=$(grep -rn "\[DEBUG\]" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "Count: $COUNT_DEBUG"
echo ""

echo "### [ROUTE-DEBUG] markers ###"
COUNT_ROUTE=$(grep -rn "\[ROUTE-DEBUG\]" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "Count: $COUNT_ROUTE"
echo ""

TOTAL=$((COUNT_LOG + COUNT_ERR + COUNT_WARN + COUNT_DEBUG + COUNT_ROUTE))
echo "=== TOTAL DEBUG STATEMENTS: $TOTAL ==="
echo ""

if [ "$TOTAL" -gt 0 ]; then
  echo "=== Detailed Line-by-Line Report ==="
  grep -rn "console\.\(log\|error\|warn\)" src/ --include="*.ts" 2>/dev/null
fi
```

### Step 4: Update Auth Middleware

**File:** `src/middleware/auth.middleware.ts`

Replace all console.log statements with debug utility calls:

```diff
+ import debug from '../utils/debug';

  // In extractRefreshToken function:
- console.log('[REFRESH-DEBUG] No Supabase auth token found in cookie');
+ debug.auth('REFRESH-1', 'No Supabase auth token found in cookie');

- console.log('[REFRESH-DEBUG] Found Supabase project:', projectRef);
+ debug.auth('REFRESH-2', 'Found Supabase project', { projectRef: projectRef?.substring(0, 8) + '...' });

- console.log('[REFRESH-DEBUG] No cookie parts found');
+ debug.auth('REFRESH-3', 'No cookie parts found');

- console.log(`[REFRESH-DEBUG] Found ${cookieParts.length} cookie parts`);
+ debug.auth('REFRESH-4', 'Found cookie parts', { count: cookieParts.length });

- console.log('[REFRESH-DEBUG] Decoded cookie value length:', decodedValue.length);
+ debug.auth('REFRESH-5', 'Decoded cookie value', { length: decodedValue.length });

- console.log('[REFRESH-DEBUG] ✅ Found refresh token:', sessionData.refresh_token);
+ debug.auth('REFRESH-6', 'Found refresh token', { hasToken: !!sessionData.refresh_token });

- console.log('[REFRESH-DEBUG] No refresh_token field in session data');
+ debug.auth('REFRESH-7', 'No refresh_token field in session data');

- console.log('[REFRESH-DEBUG] Session data keys:', Object.keys(sessionData));
+ debug.auth('REFRESH-8', 'Session data structure', { keys: Object.keys(sessionData) });

- console.log('[REFRESH-DEBUG] Error extracting refresh token:', error);
+ debug.error('REFRESH', 'Error extracting refresh token', error);

  // In extractTokenFromCookie function:
- console.log('[COOKIE-DEBUG] No Supabase auth token found in cookie');
+ debug.cookie('1', 'No Supabase auth token found');

- console.log('[COOKIE-DEBUG] Found Supabase project:', projectRef);
+ debug.cookie('2', 'Found Supabase project', { projectRef: projectRef?.substring(0, 8) + '...' });

- console.log('[COOKIE-DEBUG] No cookie parts found');
+ debug.cookie('3', 'No cookie parts found');

- console.log(`[COOKIE-DEBUG] Found ${cookieParts.length} cookie parts`);
+ debug.cookie('4', 'Found cookie parts', { count: cookieParts.length });

- console.log('[COOKIE-DEBUG] Successfully extracted token from cookie');
+ debug.cookie('5', 'Successfully extracted token');

- console.log('[COOKIE-DEBUG] No access_token found in parsed cookie data');
+ debug.cookie('6', 'No access_token found in parsed cookie data');

- console.log('[COOKIE-DEBUG] Error extracting token from cookie:', error);
+ debug.error('COOKIE', 'Error extracting token from cookie', error);

  // In verifyTokenLocally function:
- console.log('[LOCAL-VERIFY-1] Starting local verification');
+ debug.auth('VERIFY-1', 'Starting local verification');

- console.log('[LOCAL-VERIFY-2] JWT Secret available:', !!jwtSecret);
+ debug.auth('VERIFY-2', 'JWT Secret check', { available: !!jwtSecret });

- console.log('[LOCAL-VERIFY-ERROR] JWT secret not configured');
+ debug.error('VERIFY', 'JWT secret not configured');

- console.log('[LOCAL-VERIFY-3] Trying with issuer/audience');
+ debug.auth('VERIFY-3', 'Trying with issuer/audience');

- console.log('[LOCAL-VERIFY-4] Success with issuer/audience');
+ debug.auth('VERIFY-4', 'Success with issuer/audience');

- console.log('[LOCAL-VERIFY-5] Issuer/audience failed, trying without');
+ debug.auth('VERIFY-5', 'Issuer/audience failed, trying without');

- console.log('[LOCAL-VERIFY-6] First error:', firstError);
+ debug.error('VERIFY', 'First verification attempt failed', firstError);

- console.log('[LOCAL-VERIFY-7] Success without issuer/audience');
+ debug.auth('VERIFY-7', 'Success without issuer/audience');

- console.log('[LOCAL-VERIFY-8] Token decoded successfully');
+ debug.auth('VERIFY-8', 'Token decoded successfully');

- console.log('[LOCAL-VERIFY-9] Token payload:', JSON.stringify(decoded, null, 2));
+ debug.auth('VERIFY-9', 'Token payload', { sub: decoded.sub, exp: decoded.exp });

- console.log('[LOCAL-VERIFY-10] Validating required fields');
+ debug.auth('VERIFY-10', 'Validating required fields');

- console.log('[LOCAL-VERIFY-11] Token.sub:', decoded.sub);
+ debug.auth('VERIFY-11', 'Token subject', { sub: decoded.sub?.substring(0, 8) + '...' });

- console.log('[LOCAL-VERIFY-12] Token.exp:', decoded.exp, 'Current time:', Date.now() / 1000);
+ debug.auth('VERIFY-12', 'Token expiry', { exp: decoded.exp, now: Math.floor(Date.now() / 1000) });

- console.log('[LOCAL-VERIFY-ERROR] Token missing user ID');
+ debug.error('VERIFY', 'Token missing user ID');
```

---

## Testing Plan

### 1. Unit Tests

**File:** `tests/unit/utils/debug.test.ts`

```typescript
import debug from '../../../src/utils/debug';
import { config } from '../../../src/config/environment';
import { logger } from '../../../src/utils/logger';

jest.mock('../../../src/config/environment', () => ({
  config: {
    debugMode: false,
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe('Debug Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when DEBUG_MODE is false', () => {
    it('should not log anything', () => {
      debug.log('TEST', 'Test message');
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should not log auth messages', () => {
      debug.auth('STEP', 'Auth message');
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('when DEBUG_MODE is true', () => {
    beforeAll(() => {
      (config as any).debugMode = true;
    });

    it('should log messages via logger', () => {
      debug.log('TEST', 'Test message');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
        undefined
      );
    });

    it('should sanitize sensitive auth data', () => {
      debug.auth('TEST', 'Auth test', {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        user_id: '12345',
      });

      expect(logger.debug).toHaveBeenCalled();
      const callArgs = (logger.debug as jest.Mock).mock.calls[0];
      expect(callArgs[1].access_token).not.toContain('eyJhbGci');
    });
  });
});
```

### 2. Verification Commands

```bash
# Step 1: Run audit before changes
chmod +x scripts/audit-debug-code.sh
./scripts/audit-debug-code.sh > audit-before.txt

# Step 2: Make changes...

# Step 3: Run audit after changes
./scripts/audit-debug-code.sh > audit-after.txt

# Step 4: Verify reduction
diff audit-before.txt audit-after.txt
```

---

## Deployment Checklist

- [ ] Create `src/utils/debug.ts` utility module
- [ ] Create `scripts/audit-debug-code.sh` script
- [ ] Run pre-change audit
- [ ] Update `src/middleware/auth.middleware.ts` (30+ replacements)
- [ ] Search and update all route files with debug statements
- [ ] Run post-change audit (should show 0 console statements)
- [ ] Run unit tests for debug utility
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Verify no sensitive data in staging logs
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Console statements in src/ | 0 | `grep -c "console\." src/**/*.ts` |
| Sensitive data in logs | 0 | Manual log audit |
| Test coverage | No decrease | Jest coverage report |

---

## Rollback Plan

1. **Git Revert**: `git revert HEAD`
2. **Environment Override**: Set `DEBUG_MODE=true` to re-enable logging

---

## Timeline

| Task | Duration |
|------|----------|
| Create debug utility | 30 min |
| Update auth.middleware.ts | 1 hour |
| Update remaining files | 1 hour |
| Testing | 1 hour |
| **Total** | **4-5 hours** |
