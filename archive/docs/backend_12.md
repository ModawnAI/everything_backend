# Backend Implementation Guide: Dashboard Separation Architecture
## Ultra-Comprehensive Backend Modification Specification

**Version**: 2.0
**Last Updated**: 2025-10-12
**Architecture**: Platform/Shop Context Separation
**Priority**: 🔴 CRITICAL - Security & Data Isolation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [URL Scoping Patterns](#url-scoping-patterns)
4. [Authentication & Authorization System](#authentication--authorization-system)
5. [Database Schema Requirements](#database-schema-requirements)
6. [Middleware Implementation](#middleware-implementation)
7. [API Endpoint Specifications](#api-endpoint-specifications)
8. [Data Isolation Patterns](#data-isolation-patterns)
9. [Row-Level Security (PostgreSQL)](#row-level-security-postgresql)
10. [Testing Requirements](#testing-requirements)
11. [Security Audit Checklist](#security-audit-checklist)
12. [Performance Optimization](#performance-optimization)
13. [Error Handling Standards](#error-handling-standards)
14. [Migration Strategy](#migration-strategy)
15. [Monitoring & Logging](#monitoring--logging)
16. [Edge Cases & Solutions](#edge-cases--solutions)

---

## Executive Summary

### Critical Requirements

**MUST HAVE**:
- ✅ Complete data isolation between shops
- ✅ Shop-scoped API endpoints with validation
- ✅ Platform-admin endpoints for cross-shop management
- ✅ Middleware validation on EVERY shop-scoped endpoint
- ✅ Database-level security (RLS) as backup layer
- ✅ Comprehensive audit logging for all operations

**MUST NOT**:
- ❌ Allow shop admins to access other shops' data
- ❌ Skip validation middleware on any endpoint
- ❌ Return cross-shop data without explicit permission
- ❌ Trust client-side filtering alone
- ❌ Use shopId from request body without validation

### Impact Assessment

| Area | Impact | Priority |
|------|--------|----------|
| Security | 🔴 Critical | P0 |
| Data Integrity | 🔴 Critical | P0 |
| Performance | 🟡 Important | P1 |
| User Experience | 🟢 Standard | P2 |

---

## Architecture Overview

### Context-Based Routing

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Request                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ContextualApiService (Frontend)                 │
│  • Detects user context (platform vs shop)                  │
│  • Transforms URLs automatically                             │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│  Platform Context     │       │   Shop Context        │
│  /api/reservations    │       │  /api/reservations    │
│         ↓             │       │         ↓             │
│  /api/admin/          │       │  /api/shops/          │
│  reservations         │       │  {shopId}/            │
│  (all shops)          │       │  reservations         │
└───────────────────────┘       └───────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Router                            │
│  • Route matching and validation                             │
│  • Middleware chain execution                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Authentication Middleware                       │
│  • Verify JWT token                                          │
│  • Extract user info and role                                │
│  • Attach to req.user                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Authorization Middleware                        │
│  • validateShopAccess(): Verify shop ownership               │
│  • Check role-based permissions                              │
│  • Prevent cross-shop access                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Route Handler                              │
│  • ALWAYS filter by shop_id (redundant safety)               │
│  • Never trust path params alone                             │
│  • Apply database RLS policies                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                             │
│  • Row-Level Security policies active                        │
│  • shop_id filtering enforced at DB level                    │
│  • Audit logging enabled                                     │
└─────────────────────────────────────────────────────────────┘
```

### Security Layers (Defense in Depth)

```
Layer 1: JWT Authentication
         ↓
Layer 2: Middleware Validation (validateShopAccess)
         ↓
Layer 3: Route Handler Filtering (ALWAYS filter by shop_id)
         ↓
Layer 4: Database RLS Policies (PostgreSQL)
         ↓
Layer 5: Audit Logging (Track all access)
```

**Each layer MUST independently verify access rights.**

---

## URL Scoping Patterns

### Platform Context (Super Admin / Admin)

**Pattern**: `/api/admin/{resource}`

Platform admins can access ALL shops' data with explicit awareness.

```javascript
// Platform endpoint - access all shops
app.get('/api/admin/reservations', authenticate, requirePlatformAdmin, async (req, res) => {
  const { shopId, page = 1, limit = 20 } = req.query;

  // Optional shop filtering for platform admin
  const query = `
    SELECT * FROM reservations
    ${shopId ? 'WHERE shop_id = $1' : ''}
    ORDER BY created_at DESC
    LIMIT $${shopId ? 2 : 1} OFFSET $${shopId ? 3 : 2}
  `;

  const params = shopId
    ? [shopId, limit, (page - 1) * limit]
    : [limit, (page - 1) * limit];

  const result = await db.query(query, params);

  res.json({
    success: true,
    reservations: result.rows,
    totalCount: result.rowCount,
    page,
    limit,
  });
});
```

### Shop Context (Shop Owner / Manager / Staff)

**Pattern**: `/api/shops/{shopId}/{resource}`

Shop users can ONLY access their own shop's data.

```javascript
// Shop endpoint - single shop only
app.get('/api/shops/:shopId/reservations',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  const { shopId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // CRITICAL: Always filter by shop_id, even though middleware validated
  // This is defense in depth - never rely on middleware alone
  const query = `
    SELECT * FROM reservations
    WHERE shop_id = $1  -- ✅ ALWAYS PRESENT
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await db.query(query, [shopId, limit, (page - 1) * limit]);

  res.json({
    success: true,
    reservations: result.rows,
    shopId,  // Echo back for verification
    totalCount: result.rowCount,
    page,
    limit,
  });
});
```

### URL Transformation Examples

| Frontend Call | User Context | Backend Route |
|--------------|--------------|---------------|
| `/api/reservations` | Platform | `/api/admin/reservations` |
| `/api/reservations` | Shop (shop-123) | `/api/shops/shop-123/reservations` |
| `/api/users` | Platform | `/api/admin/users` |
| `/api/users` | Shop (shop-456) | `/api/shops/shop-456/users` |
| `/api/payments` | Platform | `/api/admin/payments` |
| `/api/payments` | Shop (shop-789) | `/api/shops/shop-789/payments` |

---

## Authentication & Authorization System

### JWT Token Structure

```javascript
// JWT payload structure
{
  userId: 'user-uuid',
  email: 'user@example.com',
  role: 'shop_owner' | 'shop_manager' | 'shop_staff' | 'admin' | 'super_admin',
  shopId: 'shop-uuid' | null,  // Only for shop users
  permissions: ['dashboard.view', 'bookings.view', 'bookings.edit', ...],
  iat: 1234567890,
  exp: 1234571490
}
```

### Authentication Middleware

```javascript
// middleware/authenticate.js

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

/**
 * Authenticate middleware - verifies JWT and extracts user
 * MUST be applied to ALL protected routes
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Validate token structure
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Token',
        message: 'Token payload is malformed',
      });
    }

    // Fetch fresh user data from database
    const userResult = await db.query(
      'SELECT id, email, role, shop_id, permissions FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User Not Found',
        message: 'User account no longer exists',
      });
    }

    const user = userResult.rows[0];

    // Verify role hasn't changed
    if (user.role !== decoded.role) {
      return res.status(401).json({
        success: false,
        error: 'Role Changed',
        message: 'User role has changed, please login again',
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shop_id,
      permissions: user.permissions || [],
    };

    // Log authentication for audit trail
    console.log(`🔐 [Auth] User ${user.id} (${user.role}) authenticated`);

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token Expired',
        message: 'Authentication token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid Token',
        message: 'Authentication token is invalid',
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication Failed',
      message: 'Failed to authenticate request',
    });
  }
}

module.exports = { authenticate };
```

### Shop Access Validation Middleware

```javascript
// middleware/validateShopAccess.js

/**
 * Validate Shop Access Middleware
 *
 * CRITICAL SECURITY: This middleware MUST be applied to ALL shop-scoped endpoints
 *
 * Validates that:
 * 1. User has permission to access the shop in the URL path
 * 2. Shop exists and is not deleted
 * 3. Platform admins can access any shop (with explicit awareness)
 * 4. Shop users can ONLY access their own shop
 *
 * @requires authenticate middleware to run first
 */
async function validateShopAccess(req, res, next) {
  try {
    const { shopId } = req.params;
    const user = req.user;

    // Validate shopId format (prevent injection)
    if (!shopId || typeof shopId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid Shop ID',
        message: 'Shop ID must be provided in URL path',
      });
    }

    // Validate shopId format (UUID or alphanumeric)
    const validShopIdPattern = /^[a-zA-Z0-9-_]+$/;
    if (!validShopIdPattern.test(shopId)) {
      console.warn(`⚠️ [Security] Invalid shop ID format attempted: ${shopId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid Shop ID Format',
        message: 'Shop ID contains invalid characters',
      });
    }

    // Verify shop exists and is not deleted
    const shopResult = await db.query(
      'SELECT id, name, shop_status FROM shops WHERE id = $1 AND deleted_at IS NULL',
      [shopId]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shop Not Found',
        message: 'The requested shop does not exist',
      });
    }

    const shop = shopResult.rows[0];

    // Platform admins can access any shop
    if (user.role === 'super_admin' || user.role === 'admin') {
      console.log(`👑 [Access] Platform admin ${user.id} accessing shop ${shopId}`);
      req.shop = shop;
      return next();
    }

    // Shop users must match the shop in URL
    if (user.shopId !== shopId) {
      console.warn(`🚨 [Security] User ${user.id} (shop: ${user.shopId}) attempted to access shop ${shopId}`);

      // Log security event for audit
      await db.query(
        `INSERT INTO security_events (user_id, event_type, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          user.id,
          'unauthorized_shop_access_attempt',
          JSON.stringify({
            attemptedShopId: shopId,
            userShopId: user.shopId,
            endpoint: req.path,
            method: req.method,
          })
        ]
      );

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to access this shop',
      });
    }

    // Verify shop is active (optional - depends on business rules)
    if (shop.shop_status === 'suspended' || shop.shop_status === 'deleted') {
      return res.status(403).json({
        success: false,
        error: 'Shop Unavailable',
        message: `Shop is currently ${shop.shop_status}`,
      });
    }

    // All validations passed
    console.log(`✅ [Access] User ${user.id} (${user.role}) accessing shop ${shopId}`);
    req.shop = shop;
    next();
  } catch (error) {
    console.error('Shop access validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Validation Failed',
      message: 'Failed to validate shop access',
    });
  }
}

module.exports = { validateShopAccess };
```

### Platform Admin Middleware

```javascript
// middleware/requirePlatformAdmin.js

/**
 * Require Platform Admin Middleware
 * Ensures user has platform-level admin privileges
 */
function requirePlatformAdmin(req, res, next) {
  const user = req.user;

  if (user.role !== 'super_admin' && user.role !== 'admin') {
    console.warn(`🚨 [Security] Non-admin user ${user.id} (${user.role}) attempted platform access`);

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'This endpoint requires platform admin privileges',
    });
  }

  console.log(`👑 [Access] Platform admin ${user.id} accessing admin endpoint`);
  next();
}

module.exports = { requirePlatformAdmin };
```

---

## Database Schema Requirements

### Essential Columns

**Every data table MUST have**:
- `shop_id` column (VARCHAR/UUID, NOT NULL)
- `created_at` timestamp
- `updated_at` timestamp
- `deleted_at` timestamp (for soft deletes)

### Schema Modifications

```sql
-- ============================================================================
-- DATABASE SCHEMA MODIFICATIONS FOR SHOP ISOLATION
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RESERVATIONS TABLE
-- ---------------------------------------------------------------------------

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add foreign key constraint
ALTER TABLE reservations
  ADD CONSTRAINT fk_reservations_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id)
  ON DELETE RESTRICT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id ON reservations(shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_created ON reservations(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_status ON reservations(shop_id, status);

-- ---------------------------------------------------------------------------
-- 2. USERS TABLE (Shop Staff)
-- ---------------------------------------------------------------------------

-- Users table should already have shop_id, but ensure it's properly indexed
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_shop_role ON users(shop_id, role) WHERE shop_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. SERVICES TABLE
-- ---------------------------------------------------------------------------

-- Services might use shop_services join table or direct shop_id
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NULL;

-- If using shop_services join table
CREATE INDEX IF NOT EXISTS idx_shop_services_shop_id ON shop_services(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_services_service_id ON shop_services(service_id);

-- ---------------------------------------------------------------------------
-- 4. PAYMENTS TABLE - 🔴 CRITICAL FINANCIAL DATA
-- ---------------------------------------------------------------------------

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id)
  ON DELETE RESTRICT;

-- Critical indexes for financial data
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_created ON payments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_shop_status ON payments(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_amount ON payments(shop_id, amount);

-- ---------------------------------------------------------------------------
-- 5. POINTS TABLE - 🔴 CRITICAL FINANCIAL DATA
-- ---------------------------------------------------------------------------

ALTER TABLE points
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NULL,  -- NULL for platform-level points
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Shop-specific points have shop_id, platform points are NULL
CREATE INDEX IF NOT EXISTS idx_points_shop_id ON points(shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_points_user_shop ON points(user_id, shop_id);

-- ---------------------------------------------------------------------------
-- 6. REFUNDS TABLE - 🔴 CRITICAL FINANCIAL DATA
-- ---------------------------------------------------------------------------

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE refunds
  ADD CONSTRAINT fk_refunds_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_refunds_shop_id ON refunds(shop_id);
CREATE INDEX IF NOT EXISTS idx_refunds_shop_created ON refunds(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_shop_status ON refunds(shop_id, status);

-- ---------------------------------------------------------------------------
-- 7. CUSTOMERS TABLE
-- ---------------------------------------------------------------------------

-- Customers can be shared across shops OR shop-specific (business logic dependent)
-- If shop-specific:
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id) WHERE shop_id IS NOT NULL;

-- If shared but tracked per shop, use junction table:
CREATE TABLE IF NOT EXISTS shop_customers (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id VARCHAR(255) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  first_visit_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_visit_at TIMESTAMP NULL,
  total_bookings INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_customers_shop ON shop_customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_customers_customer ON shop_customers(customer_id);

-- ---------------------------------------------------------------------------
-- 8. ORDERS TABLE
-- ---------------------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);

-- ---------------------------------------------------------------------------
-- 9. PRODUCTS TABLE
-- ---------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE products
  ADD CONSTRAINT fk_products_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_active ON products(shop_id, is_active);

-- ---------------------------------------------------------------------------
-- 10. TICKETS TABLE (Support Tickets)
-- ---------------------------------------------------------------------------

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255) NULL,  -- NULL for platform tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_shop_id ON tickets(shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_shop_status ON tickets(shop_id, status) WHERE shop_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 11. SECURITY EVENTS TABLE (Audit Log)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  shop_id VARCHAR(255) REFERENCES shops(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_shop ON security_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- 12. AUDIT LOG TABLE (All Operations)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  shop_id VARCHAR(255) REFERENCES shops(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_shop ON audit_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- 13. DATA VALIDATION CHECKS
-- ---------------------------------------------------------------------------

-- Ensure no NULL shop_id values where they shouldn't be
DO $$
BEGIN
  -- Check reservations
  IF EXISTS (SELECT 1 FROM reservations WHERE shop_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'NULL shop_id found in reservations table';
  END IF;

  -- Check payments
  IF EXISTS (SELECT 1 FROM payments WHERE shop_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'NULL shop_id found in payments table';
  END IF;

  -- Check refunds
  IF EXISTS (SELECT 1 FROM refunds WHERE shop_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'NULL shop_id found in refunds table';
  END IF;

  RAISE NOTICE 'Data validation checks passed';
END $$;
```

---

## Row-Level Security (PostgreSQL)

### Enable RLS on Tables

```sql
-- ============================================================================
-- ROW-LEVEL SECURITY POLICIES FOR SHOP DATA ISOLATION
-- ============================================================================

-- Enable RLS on all shop-scoped tables
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Function to get current user's shop_id from JWT claims
CREATE OR REPLACE FUNCTION current_user_shop_id()
RETURNS VARCHAR AS $$
  SELECT current_setting('app.current_user_shop_id', TRUE)::VARCHAR;
$$ LANGUAGE SQL STABLE;

-- Function to check if current user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT current_setting('app.current_user_role', TRUE) IN ('super_admin', 'admin');
$$ LANGUAGE SQL STABLE;

-- ---------------------------------------------------------------------------
-- RLS POLICIES - RESERVATIONS
-- ---------------------------------------------------------------------------

-- Policy: Platform admins see all reservations
CREATE POLICY platform_admin_reservations_all
  ON reservations
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

-- Policy: Shop users see only their shop's reservations
CREATE POLICY shop_user_reservations_own_shop
  ON reservations
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- RLS POLICIES - PAYMENTS 🔴 CRITICAL
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_payments_all
  ON payments
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

CREATE POLICY shop_user_payments_own_shop
  ON payments
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- RLS POLICIES - REFUNDS 🔴 CRITICAL
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_refunds_all
  ON refunds
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

CREATE POLICY shop_user_refunds_own_shop
  ON refunds
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- RLS POLICIES - POINTS 🔴 CRITICAL
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_points_all
  ON points
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

-- Shop users see their shop's points + platform-level points (shop_id IS NULL)
CREATE POLICY shop_user_points_own_shop
  ON points
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id() OR shop_id IS NULL);

-- ---------------------------------------------------------------------------
-- RLS POLICIES - ORDERS
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_orders_all
  ON orders
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

CREATE POLICY shop_user_orders_own_shop
  ON orders
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- RLS POLICIES - PRODUCTS
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_products_all
  ON products
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

CREATE POLICY shop_user_products_own_shop
  ON products
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- RLS POLICIES - SERVICES
-- ---------------------------------------------------------------------------

CREATE POLICY platform_admin_services_all
  ON services
  FOR ALL
  TO PUBLIC
  USING (is_platform_admin());

CREATE POLICY shop_user_services_own_shop
  ON services
  FOR ALL
  TO PUBLIC
  USING (shop_id = current_user_shop_id());

-- ---------------------------------------------------------------------------
-- SET SESSION VARIABLES (Backend Application Layer)
-- ---------------------------------------------------------------------------

-- The backend application MUST set these variables after authentication:
-- SET app.current_user_id = 'user-uuid';
-- SET app.current_user_role = 'shop_owner' | 'super_admin' | etc.
-- SET app.current_user_shop_id = 'shop-uuid';

-- Example in Node.js/Express:
-- await db.query("SET app.current_user_id = $1", [req.user.id]);
-- await db.query("SET app.current_user_role = $1", [req.user.role]);
-- await db.query("SET app.current_user_shop_id = $1", [req.user.shopId]);
```

### Setting Session Variables in Backend

```javascript
// Database connection wrapper that sets RLS context
async function executeWithUserContext(user, queryFn) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Set session variables for RLS policies
    await client.query('SET LOCAL app.current_user_id = $1', [user.id]);
    await client.query('SET LOCAL app.current_user_role = $1', [user.role]);
    if (user.shopId) {
      await client.query('SET LOCAL app.current_user_shop_id = $1', [user.shopId]);
    }

    // Execute queries within this context
    const result = await queryFn(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Usage example
app.get('/api/shops/:shopId/reservations',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;

    const result = await executeWithUserContext(req.user, async (client) => {
      // RLS policies automatically apply - only returns authorized data
      return await client.query(
        'SELECT * FROM reservations WHERE shop_id = $1 ORDER BY created_at DESC',
        [shopId]
      );
    });

    res.json({
      success: true,
      reservations: result.rows,
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

---

## API Endpoint Specifications

### Reservations/Bookings API

#### Platform Admin: Get All Reservations

```javascript
/**
 * GET /api/admin/reservations
 * Get all reservations across all shops (platform admin only)
 */
app.get('/api/admin/reservations',
  authenticate,
  requirePlatformAdmin,
  async (req, res) => {
  try {
    const {
      shopId,         // Optional filter by shop
      status,         // Optional filter by status
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      search          // Search by customer name, booking ID
    } = req.query;

    // Build dynamic query
    let query = `
      SELECT
        r.*,
        s.name as shop_name,
        u.name as customer_name,
        u.email as customer_email
      FROM reservations r
      LEFT JOIN shops s ON r.shop_id = s.id
      LEFT JOIN users u ON r.customer_id = u.id
      WHERE r.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (shopId) {
      query += ` AND r.shop_id = $${paramIndex}`;
      params.push(shopId);
      paramIndex++;
    }

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR r.id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add sorting
    const validSortFields = ['created_at', 'reservation_datetime', 'total_amount', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY r.${sortField} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    // Execute query
    const result = await db.query(query, params);

    res.json({
      success: true,
      reservations: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin reservations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch reservations',
    });
  }
});
```

#### Shop: Get Shop Reservations

```javascript
/**
 * GET /api/shops/:shopId/reservations
 * Get reservations for a specific shop (shop users only see their own shop)
 */
app.get('/api/shops/:shopId/reservations',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = 'reservation_datetime',
      sortOrder = 'DESC',
      search,
      startDate,  // Filter by date range
      endDate
    } = req.query;

    // CRITICAL: ALWAYS filter by shop_id (defense in depth)
    let query = `
      SELECT
        r.*,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM reservations r
      LEFT JOIN users u ON r.customer_id = u.id
      WHERE r.shop_id = $1 AND r.deleted_at IS NULL
    `;

    const params = [shopId];  // Always shop_id first
    let paramIndex = 2;

    // Apply filters
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR r.id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND r.reservation_datetime >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND r.reservation_datetime <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Add sorting
    const validSortFields = ['reservation_datetime', 'created_at', 'total_amount', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'reservation_datetime';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY r.${sortField} ${sortDirection}`;

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    // Execute query
    const result = await db.query(query, params);

    // Audit log
    await logAudit({
      userId: req.user.id,
      shopId,
      action: 'view_reservations',
      resourceType: 'reservations',
      details: { page, limit, status, search },
    });

    res.json({
      success: true,
      reservations: result.rows,
      shopId,  // Echo back for verification
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching reservations for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch reservations',
    });
  }
});
```

#### Shop: Create Reservation

```javascript
/**
 * POST /api/shops/:shopId/reservations
 * Create new reservation for a shop
 */
app.post('/api/shops/:shopId/reservations',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      customerId,
      serviceIds,  // Array of service IDs
      reservationDate,
      reservationTime,
      specialRequests,
      depositAmount,
    } = req.body;

    // Validate required fields
    if (!customerId || !serviceIds || !serviceIds.length || !reservationDate || !reservationTime) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Customer, services, date, and time are required',
      });
    }

    // CRITICAL: Verify all services belong to this shop
    const servicesQuery = `
      SELECT id, name, price_min, price_max, duration_minutes
      FROM shop_services
      WHERE shop_id = $1 AND id = ANY($2) AND is_available = true AND deleted_at IS NULL
    `;
    const servicesResult = await db.query(servicesQuery, [shopId, serviceIds]);

    if (servicesResult.rows.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Services',
        message: 'One or more services do not belong to this shop or are unavailable',
      });
    }

    // Calculate total amount and duration
    const totalAmount = servicesResult.rows.reduce((sum, s) => sum + s.price_min, 0);
    const totalDuration = servicesResult.rows.reduce((sum, s) => sum + s.duration_minutes, 0);

    // Create reservation
    const insertQuery = `
      INSERT INTO reservations (
        id, shop_id, customer_id, reservation_date, reservation_time,
        total_amount, deposit_amount, total_duration_minutes,
        special_requests, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'requested', NOW(), NOW()
      )
      RETURNING *
    `;

    const reservationResult = await db.query(insertQuery, [
      shopId,
      customerId,
      reservationDate,
      reservationTime,
      totalAmount,
      depositAmount || 0,
      totalDuration,
      specialRequests || null,
    ]);

    const reservation = reservationResult.rows[0];

    // Create reservation_services junction records
    const servicesInsertQuery = `
      INSERT INTO reservation_services (reservation_id, service_id, shop_id, price, created_at)
      VALUES ${servicesResult.rows.map((_, i) => `($1, $${i + 2}, $${servicesResult.rows.length + 2}, $${servicesResult.rows.length + i + 3}, NOW())`).join(', ')}
    `;

    await db.query(servicesInsertQuery, [
      reservation.id,
      ...servicesResult.rows.map(s => s.id),
      shopId,
      ...servicesResult.rows.map(s => s.price_min),
    ]);

    // Audit log
    await logAudit({
      userId: req.user.id,
      shopId,
      action: 'create_reservation',
      resourceType: 'reservations',
      resourceId: reservation.id,
      newValues: reservation,
    });

    res.status(201).json({
      success: true,
      reservation: {
        ...reservation,
        services: servicesResult.rows,
      },
    });
  } catch (error) {
    console.error(`Error creating reservation for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create reservation',
    });
  }
});
```

#### Shop: Update Reservation Status

```javascript
/**
 * PATCH /api/shops/:shopId/reservations/:reservationId
 * Update reservation (status, etc.)
 */
app.patch('/api/shops/:shopId/reservations/:reservationId',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId, reservationId } = req.params;
    const { status, cancelReason } = req.body;

    // Validate status
    const validStatuses = ['requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Status',
        message: 'Status must be one of: ' + validStatuses.join(', '),
      });
    }

    // CRITICAL: Verify reservation belongs to this shop
    const checkQuery = `
      SELECT * FROM reservations
      WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
    `;
    const checkResult = await db.query(checkQuery, [reservationId, shopId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reservation not found or does not belong to this shop',
      });
    }

    const oldReservation = checkResult.rows[0];

    // Update reservation
    const updateQuery = `
      UPDATE reservations
      SET status = $1, cancel_reason = $2, updated_at = NOW()
      WHERE id = $3 AND shop_id = $4
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      status,
      cancelReason || null,
      reservationId,
      shopId,
    ]);

    const updatedReservation = result.rows[0];

    // Audit log
    await logAudit({
      userId: req.user.id,
      shopId,
      action: 'update_reservation_status',
      resourceType: 'reservations',
      resourceId: reservationId,
      oldValues: { status: oldReservation.status },
      newValues: { status: updatedReservation.status, cancelReason },
    });

    res.json({
      success: true,
      reservation: updatedReservation,
    });
  } catch (error) {
    console.error(`Error updating reservation ${req.params.reservationId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update reservation',
    });
  }
});
```

### Financial Data API (CRITICAL 🔴)

#### Platform Admin: Get All Payments

```javascript
/**
 * GET /api/admin/payments
 * Get all payments across all shops (platform admin only)
 */
app.get('/api/admin/payments',
  authenticate,
  requirePlatformAdmin,
  async (req, res) => {
  try {
    const {
      shopId,
      status,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    let query = `
      SELECT
        p.*,
        s.name as shop_name,
        r.id as reservation_id,
        u.name as customer_name
      FROM payments p
      LEFT JOIN shops s ON p.shop_id = s.id
      LEFT JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (shopId) {
      query += ` AND p.shop_id = $${paramIndex}`;
      params.push(shopId);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (paymentMethod) {
      query += ` AND p.payment_method = $${paramIndex}`;
      params.push(paymentMethod);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get total count and sum
    const statsQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total, SUM(p.amount) as total_amount FROM');
    const statsResult = await db.query(statsQuery, params);
    const { total: totalCount, total_amount: totalAmount } = statsResult.rows[0];

    // Add sorting and pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    res.json({
      success: true,
      payments: result.rows,
      summary: {
        totalCount: parseInt(totalCount),
        totalAmount: parseFloat(totalAmount) || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin payments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

#### Shop: Get Shop Payments

```javascript
/**
 * GET /api/shops/:shopId/payments
 * Get payments for a specific shop
 */
app.get('/api/shops/:shopId/payments',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      status,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    // CRITICAL: ALWAYS filter by shop_id
    let query = `
      SELECT
        p.*,
        r.id as reservation_id,
        r.reservation_date,
        u.name as customer_name,
        u.email as customer_email
      FROM payments p
      LEFT JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.shop_id = $1 AND p.deleted_at IS NULL
    `;

    const params = [shopId];
    let paramIndex = 2;

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (paymentMethod) {
      query += ` AND p.payment_method = $${paramIndex}`;
      params.push(paymentMethod);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get stats for shop
    const statsQuery = query.replace(/SELECT.*?FROM/, `
      SELECT
        COUNT(*) as total,
        SUM(p.amount) as total_amount,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as completed_amount
      FROM
    `);
    const statsResult = await db.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Add sorting and pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    // Audit log
    await logAudit({
      userId: req.user.id,
      shopId,
      action: 'view_payments',
      resourceType: 'payments',
      details: { page, limit, status, startDate, endDate },
    });

    res.json({
      success: true,
      payments: result.rows,
      shopId,
      summary: {
        totalCount: parseInt(stats.total),
        totalAmount: parseFloat(stats.total_amount) || 0,
        completedAmount: parseFloat(stats.completed_amount) || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(stats.total / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching payments for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

#### Shop: Get Shop Points

```javascript
/**
 * GET /api/shops/:shopId/points
 * Get points transactions for a shop
 */
app.get('/api/shops/:shopId/points',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userId, transactionType, page = 1, limit = 50 } = req.query;

    // CRITICAL: Filter by shop_id OR platform points (shop_id IS NULL)
    let query = `
      SELECT
        p.*,
        u.name as user_name,
        u.email as user_email
      FROM points p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE (p.shop_id = $1 OR p.shop_id IS NULL) AND p.deleted_at IS NULL
    `;

    const params = [shopId];
    let paramIndex = 2;

    if (userId) {
      query += ` AND p.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (transactionType) {
      query += ` AND p.transaction_type = $${paramIndex}`;
      params.push(transactionType);
      paramIndex++;
    }

    // Get stats
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent
      FROM points
      WHERE (shop_id = $1 OR shop_id IS NULL) AND deleted_at IS NULL
    `;
    const statsResult = await db.query(statsQuery, [shopId]);
    const stats = statsResult.rows[0];

    // Add sorting and pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    res.json({
      success: true,
      points: result.rows,
      shopId,
      summary: {
        totalTransactions: parseInt(stats.total),
        totalEarned: parseFloat(stats.total_earned) || 0,
        totalSpent: parseFloat(stats.total_spent) || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(stats.total / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching points for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

#### Shop: Get Shop Refunds

```javascript
/**
 * GET /api/shops/:shopId/refunds
 * Get refunds for a shop
 */
app.get('/api/shops/:shopId/refunds',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;

    // CRITICAL: ALWAYS filter by shop_id
    let query = `
      SELECT
        rf.*,
        p.payment_method,
        r.id as reservation_id,
        u.name as customer_name
      FROM refunds rf
      LEFT JOIN payments p ON rf.payment_id = p.id
      LEFT JOIN reservations r ON rf.reservation_id = r.id
      LEFT JOIN users u ON rf.user_id = u.id
      WHERE rf.shop_id = $1 AND rf.deleted_at IS NULL
    `;

    const params = [shopId];
    let paramIndex = 2;

    if (status) {
      query += ` AND rf.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND rf.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND rf.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get stats
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_amount
      FROM refunds
      WHERE shop_id = $1 AND deleted_at IS NULL
    `;
    const statsResult = await db.query(statsQuery, [shopId]);
    const stats = statsResult.rows[0];

    // Add sorting and pagination
    query += ` ORDER BY rf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    // Audit log
    await logAudit({
      userId: req.user.id,
      shopId,
      action: 'view_refunds',
      resourceType: 'refunds',
      details: { page, limit, status },
    });

    res.json({
      success: true,
      refunds: result.rows,
      shopId,
      summary: {
        totalCount: parseInt(stats.total),
        totalAmount: parseFloat(stats.total_amount) || 0,
        completedAmount: parseFloat(stats.completed_amount) || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(stats.total / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching refunds for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

### Users/Staff Management API

#### Platform Admin: Get All Users

```javascript
/**
 * GET /api/admin/users
 * Get all users (platform admin only)
 */
app.get('/api/admin/users',
  authenticate,
  requirePlatformAdmin,
  async (req, res) => {
  try {
    const { role, shopId, search, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT
        u.*,
        s.name as shop_name
      FROM users u
      LEFT JOIN shops s ON u.shop_id = s.id
      WHERE u.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (shopId) {
      query += ` AND u.shop_id = $${paramIndex}`;
      params.push(shopId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    // Remove sensitive data
    const users = result.rows.map(u => {
      const { password_hash, ...user } = u;
      return user;
    });

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

#### Shop: Get Shop Staff

```javascript
/**
 * GET /api/shops/:shopId/users
 * Get staff/employees for a specific shop
 */
app.get('/api/shops/:shopId/users',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const { role, search, page = 1, limit = 50 } = req.query;

    // CRITICAL: ALWAYS filter by shop_id
    let query = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.permissions,
        u.created_at,
        u.last_login_at
      FROM users u
      WHERE u.shop_id = $1 AND u.deleted_at IS NULL
    `;

    const params = [shopId];
    let paramIndex = 2;

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    res.json({
      success: true,
      users: result.rows,
      shopId,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching users for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

### Services API

#### Shop: Get Shop Services

```javascript
/**
 * GET /api/shops/:shopId/services
 * Get services for a shop
 */
app.get('/api/shops/:shopId/services',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const { category, isAvailable, page = 1, limit = 100 } = req.query;

    // CRITICAL: ALWAYS filter by shop_id
    let query = `
      SELECT
        s.*,
        ss.is_available,
        ss.display_order
      FROM services s
      INNER JOIN shop_services ss ON s.id = ss.service_id
      WHERE ss.shop_id = $1 AND s.deleted_at IS NULL AND ss.deleted_at IS NULL
    `;

    const params = [shopId];
    let paramIndex = 2;

    if (category) {
      query += ` AND s.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (isAvailable !== undefined) {
      query += ` AND ss.is_available = $${paramIndex}`;
      params.push(isAvailable === 'true');
      paramIndex++;
    }

    // Get count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Add sorting and pagination
    query += ` ORDER BY ss.display_order ASC, s.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    res.json({
      success: true,
      services: result.rows,
      shopId,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error(`Error fetching services for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

### Analytics API

#### Shop: Get Shop Analytics

```javascript
/**
 * GET /api/shops/:shopId/analytics
 * Get analytics for a shop
 */
app.get('/api/shops/:shopId/analytics',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  try {
    const { shopId } = req.params;
    const { period = '30d', startDate, endDate } = req.query;

    // Calculate date range
    let dateFilter = '';
    const params = [shopId];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = `AND created_at >= $${paramIndex} AND created_at <= $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else {
      const days = parseInt(period) || 30;
      dateFilter = `AND created_at >= NOW() - INTERVAL '${days} days'`;
    }

    // Get booking stats
    const bookingStatsQuery = `
      SELECT
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN status = 'cancelled_by_user' OR status = 'cancelled_by_shop' THEN 1 END) as cancelled_bookings
      FROM reservations
      WHERE shop_id = $1 ${dateFilter} AND deleted_at IS NULL
    `;
    const bookingStats = await db.query(bookingStatsQuery, params);

    // Get revenue stats
    const revenueStatsQuery = `
      SELECT
        SUM(amount) as total_revenue,
        AVG(amount) as average_booking_value,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_revenue
      FROM payments
      WHERE shop_id = $1 ${dateFilter} AND deleted_at IS NULL
    `;
    const revenueStats = await db.query(revenueStatsQuery, params);

    // Get service performance
    const servicePerformanceQuery = `
      SELECT
        s.id as service_id,
        s.name as service_name,
        COUNT(DISTINCT rs.reservation_id) as bookings,
        SUM(rs.price) as revenue,
        AVG(r.rating) as average_rating
      FROM reservation_services rs
      INNER JOIN services s ON rs.service_id = s.id
      LEFT JOIN reservations r ON rs.reservation_id = r.id
      WHERE rs.shop_id = $1 ${dateFilter} AND rs.deleted_at IS NULL
      GROUP BY s.id, s.name
      ORDER BY bookings DESC
      LIMIT 10
    `;
    const servicePerformance = await db.query(servicePerformanceQuery, params);

    // Get customer metrics
    const customerMetricsQuery = `
      SELECT
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(DISTINCT CASE WHEN (
          SELECT COUNT(*) FROM reservations r2
          WHERE r2.customer_id = r.customer_id AND r2.shop_id = $1
        ) = 1 THEN customer_id END) as new_customers,
        COUNT(DISTINCT CASE WHEN (
          SELECT COUNT(*) FROM reservations r2
          WHERE r2.customer_id = r.customer_id AND r2.shop_id = $1
        ) > 1 THEN customer_id END) as returning_customers
      FROM reservations r
      WHERE r.shop_id = $1 ${dateFilter} AND r.deleted_at IS NULL
    `;
    const customerMetrics = await db.query(customerMetricsQuery, params);

    res.json({
      success: true,
      shopId,
      period,
      overview: {
        totalBookings: parseInt(bookingStats.rows[0].total_bookings),
        completedBookings: parseInt(bookingStats.rows[0].completed_bookings),
        cancelledBookings: parseInt(bookingStats.rows[0].cancelled_bookings),
        totalRevenue: parseFloat(revenueStats.rows[0].total_revenue) || 0,
        completedRevenue: parseFloat(revenueStats.rows[0].completed_revenue) || 0,
        averageBookingValue: parseFloat(revenueStats.rows[0].average_booking_value) || 0,
      },
      servicePerformance: servicePerformance.rows,
      customerMetrics: {
        uniqueCustomers: parseInt(customerMetrics.rows[0].unique_customers),
        newCustomers: parseInt(customerMetrics.rows[0].new_customers),
        returningCustomers: parseInt(customerMetrics.rows[0].returning_customers),
        customerRetentionRate:
          customerMetrics.rows[0].unique_customers > 0
            ? customerMetrics.rows[0].returning_customers / customerMetrics.rows[0].unique_customers
            : 0,
      },
    });
  } catch (error) {
    console.error(`Error fetching analytics for shop ${req.params.shopId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});
```

---

## Testing Requirements

### Unit Tests

```javascript
// tests/middleware/validateShopAccess.test.js

const { validateShopAccess } = require('../../middleware/validateShopAccess');
const { db } = require('../../database');

describe('validateShopAccess middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: { shopId: 'shop-123' },
      user: {},
      path: '/api/shops/shop-123/reservations',
      method: 'GET',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('Platform Admin Access', () => {
    it('should allow super_admin to access any shop', async () => {
      req.user = { id: 'user-1', role: 'super_admin', shopId: null };

      db.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'shop-123', name: 'Test Shop', shop_status: 'active' }],
      });

      await validateShopAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.shop).toEqual({ id: 'shop-123', name: 'Test Shop', shop_status: 'active' });
    });

    it('should allow admin to access any shop', async () => {
      req.user = { id: 'user-2', role: 'admin', shopId: null };

      db.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'shop-123', name: 'Test Shop', shop_status: 'active' }],
      });

      await validateShopAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Shop User Access', () => {
    it('should allow shop_owner to access their own shop', async () => {
      req.user = { id: 'user-3', role: 'shop_owner', shopId: 'shop-123' };

      db.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'shop-123', name: 'Test Shop', shop_status: 'active' }],
      });

      await validateShopAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.shop.id).toBe('shop-123');
    });

    it('should REJECT shop_owner accessing another shop', async () => {
      req.user = { id: 'user-3', role: 'shop_owner', shopId: 'shop-456' };
      req.params.shopId = 'shop-123';

      db.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'shop-123', name: 'Test Shop', shop_status: 'active' }],
      });

      await validateShopAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to access this shop',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should log security event for unauthorized access attempt', async () => {
      req.user = { id: 'user-3', role: 'shop_owner', shopId: 'shop-456' };
      req.params.shopId = 'shop-123';

      const securityLogSpy = jest.spyOn(db, 'query');

      db.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'shop-123' }] })  // Shop exists
        .mockResolvedValueOnce({ rows: [] });  // Security log insert

      await validateShopAccess(req, res, next);

      expect(securityLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_events'),
        expect.arrayContaining([
          'user-3',
          'unauthorized_shop_access_attempt',
          expect.any(String),
        ])
      );
    });
  });

  describe('Shop Validation', () => {
    it('should reject if shop does not exist', async () => {
      req.user = { id: 'user-1', role: 'super_admin', shopId: null };
      req.params.shopId = 'shop-999';

      db.query = jest.fn().mockResolvedValue({ rows: [] });

      await validateShopAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Shop Not Found',
        message: 'The requested shop does not exist',
      });
    });

    it('should reject invalid shopId format', async () => {
      req.user = { id: 'user-1', role: 'super_admin', shopId: null };
      req.params.shopId = 'shop-123; DROP TABLE shops;--';  // SQL injection attempt

      await validateShopAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid Shop ID Format',
        message: 'Shop ID contains invalid characters',
      });
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/shopReservations.test.js

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../database');
const { generateJWT } = require('../../utils/jwt');

describe('Shop Reservations API Integration Tests', () => {
  let platformAdminToken, shopOwner1Token, shopOwner2Token;
  let shop1Id, shop2Id;

  beforeAll(async () => {
    // Setup test data
    const platformAdmin = await db.query(
      `INSERT INTO users (id, email, role, password_hash)
       VALUES ('admin-1', 'admin@example.com', 'super_admin', 'hash')
       RETURNING *`
    );
    platformAdminToken = generateJWT(platformAdmin.rows[0]);

    // Create test shops
    const shop1 = await db.query(
      `INSERT INTO shops (id, name, owner_id)
       VALUES ('shop-1', 'Shop 1', 'owner-1')
       RETURNING *`
    );
    shop1Id = shop1.rows[0].id;

    const shop2 = await db.query(
      `INSERT INTO shops (id, name, owner_id)
       VALUES ('shop-2', 'Shop 2', 'owner-2')
       RETURNING *`
    );
    shop2Id = shop2.rows[0].id;

    // Create shop owners
    const owner1 = await db.query(
      `INSERT INTO users (id, email, role, shop_id, password_hash)
       VALUES ('owner-1', 'owner1@example.com', 'shop_owner', $1, 'hash')
       RETURNING *`,
      [shop1Id]
    );
    shopOwner1Token = generateJWT(owner1.rows[0]);

    const owner2 = await db.query(
      `INSERT INTO users (id, email, role, shop_id, password_hash)
       VALUES ('owner-2', 'owner2@example.com', 'shop_owner', $1, 'hash')
       RETURNING *`,
      [shop2Id]
    );
    shopOwner2Token = generateJWT(owner2.rows[0]);

    // Create test reservations
    await db.query(
      `INSERT INTO reservations (id, shop_id, customer_id, status, total_amount)
       VALUES
       ('res-1-1', $1, 'customer-1', 'confirmed', 10000),
       ('res-1-2', $1, 'customer-2', 'completed', 20000),
       ('res-2-1', $2, 'customer-3', 'confirmed', 15000)`,
      [shop1Id, shop2Id]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await db.query('DELETE FROM reservations WHERE id LIKE $1', ['res-%']);
    await db.query('DELETE FROM users WHERE id LIKE $1', ['owner-%']);
    await db.query('DELETE FROM users WHERE id = $1', ['admin-1']);
    await db.query('DELETE FROM shops WHERE id LIKE $1', ['shop-%']);
  });

  describe('GET /api/shops/:shopId/reservations', () => {
    it('should allow platform admin to view any shop reservations', async () => {
      const response = await request(app)
        .get(`/api/shops/${shop1Id}/reservations`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reservations).toHaveLength(2);
      expect(response.body.shopId).toBe(shop1Id);
    });

    it('should allow shop owner to view their own reservations', async () => {
      const response = await request(app)
        .get(`/api/shops/${shop1Id}/reservations`)
        .set('Authorization', `Bearer ${shopOwner1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reservations).toHaveLength(2);
      expect(response.body.reservations.every(r => r.shop_id === shop1Id)).toBe(true);
    });

    it('should REJECT shop owner viewing another shop reservations', async () => {
      const response = await request(app)
        .get(`/api/shops/${shop2Id}/reservations`)  // Shop 2
        .set('Authorization', `Bearer ${shopOwner1Token}`)  // Owner of Shop 1
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should properly filter by status', async () => {
      const response = await request(app)
        .get(`/api/shops/${shop1Id}/reservations?status=completed`)
        .set('Authorization', `Bearer ${shopOwner1Token}`)
        .expect(200);

      expect(response.body.reservations).toHaveLength(1);
      expect(response.body.reservations[0].status).toBe('completed');
    });
  });

  describe('Cross-Shop Data Isolation', () => {
    it('should ensure shop 1 owner cannot see shop 2 data', async () => {
      // Try to access shop 2 reservations with shop 1 token
      await request(app)
        .get(`/api/shops/${shop2Id}/reservations`)
        .set('Authorization', `Bearer ${shopOwner1Token}`)
        .expect(403);
    });

    it('should ensure shop 2 owner cannot see shop 1 data', async () => {
      // Try to access shop 1 reservations with shop 2 token
      await request(app)
        .get(`/api/shops/${shop1Id}/reservations`)
        .set('Authorization', `Bearer ${shopOwner2Token}`)
        .expect(403);
    });

    it('should log security events for unauthorized access attempts', async () => {
      await request(app)
        .get(`/api/shops/${shop2Id}/reservations`)
        .set('Authorization', `Bearer ${shopOwner1Token}`)
        .expect(403);

      // Verify security event was logged
      const securityEvents = await db.query(
        `SELECT * FROM security_events
         WHERE user_id = $1
         AND event_type = 'unauthorized_shop_access_attempt'
         ORDER BY created_at DESC
         LIMIT 1`,
        ['owner-1']
      );

      expect(securityEvents.rows.length).toBe(1);
      expect(JSON.parse(securityEvents.rows[0].details).attemptedShopId).toBe(shop2Id);
    });
  });
});
```

### E2E Security Tests

```javascript
// tests/e2e/dataIsolation.test.js

describe('Data Isolation E2E Tests', () => {
  it('should completely isolate financial data between shops', async () => {
    // Create payments for both shops
    await db.query(`
      INSERT INTO payments (id, shop_id, amount, status) VALUES
      ('pay-shop1-1', 'shop-1', 50000, 'completed'),
      ('pay-shop1-2', 'shop-1', 30000, 'completed'),
      ('pay-shop2-1', 'shop-2', 40000, 'completed')
    `);

    // Shop 1 owner fetches payments
    const shop1Response = await request(app)
      .get(`/api/shops/shop-1/payments`)
      .set('Authorization', `Bearer ${shopOwner1Token}`)
      .expect(200);

    // Verify only shop 1 payments returned
    expect(shop1Response.body.payments).toHaveLength(2);
    expect(shop1Response.body.payments.every(p => p.shop_id === 'shop-1')).toBe(true);
    expect(shop1Response.body.payments.some(p => p.id === 'pay-shop2-1')).toBe(false);

    // Verify totals only include shop 1 data
    expect(shop1Response.body.summary.totalAmount).toBe(80000);  // 50000 + 30000

    // Shop 2 owner fetches payments
    const shop2Response = await request(app)
      .get(`/api/shops/shop-2/payments`)
      .set('Authorization', `Bearer ${shopOwner2Token}`)
      .expect(200);

    // Verify only shop 2 payments returned
    expect(shop2Response.body.payments).toHaveLength(1);
    expect(shop2Response.body.payments[0].shop_id).toBe('shop-2');
    expect(shop2Response.body.summary.totalAmount).toBe(40000);
  });

  it('should prevent SQL injection attacks on shop_id', async () => {
    const maliciousShopId = "shop-1' OR '1'='1";

    const response = await request(app)
      .get(`/api/shops/${encodeURIComponent(maliciousShopId)}/reservations`)
      .set('Authorization', `Bearer ${shopOwner1Token}`)
      .expect(400);

    expect(response.body.error).toBe('Invalid Shop ID Format');
  });

  it('should prevent path traversal attacks', async () => {
    const maliciousPath = '../../../admin/users';

    const response = await request(app)
      .get(`/api/shops/${encodeURIComponent(maliciousPath)}/reservations`)
      .set('Authorization', `Bearer ${shopOwner1Token}`)
      .expect(400);

    expect(response.body.error).toBe('Invalid Shop ID Format');
  });
});
```

---

## Security Audit Checklist

### Pre-Deployment Checklist

- [ ] **Authentication Middleware**
  - [ ] Applied to ALL protected endpoints
  - [ ] JWT validation working correctly
  - [ ] Token expiry handling implemented
  - [ ] User data refreshed from database on each request

- [ ] **Authorization Middleware**
  - [ ] `validateShopAccess` applied to ALL shop-scoped endpoints
  - [ ] Platform admin bypass working correctly
  - [ ] Shop ownership validation functional
  - [ ] Security events logged for unauthorized attempts

- [ ] **Database Queries**
  - [ ] ALL queries filter by `shop_id` where applicable
  - [ ] No queries rely solely on middleware for filtering
  - [ ] Parameterized queries used (no string concatenation)
  - [ ] SQL injection prevention validated

- [ ] **Row-Level Security (RLS)**
  - [ ] RLS enabled on all shop-scoped tables
  - [ ] Session variables set correctly in application
  - [ ] Policies tested for both platform and shop users
  - [ ] Performance impact measured and acceptable

- [ ] **Input Validation**
  - [ ] shopId format validated (alphanumeric only)
  - [ ] Path traversal prevention implemented
  - [ ] XSS prevention on all inputs
  - [ ] File upload restrictions (if applicable)

- [ ] **Audit Logging**
  - [ ] Security events table created and indexed
  - [ ] All unauthorized access attempts logged
  - [ ] Financial operations logged
  - [ ] Log rotation strategy in place

- [ ] **Testing**
  - [ ] Unit tests for all middleware (>80% coverage)
  - [ ] Integration tests for critical endpoints
  - [ ] E2E security tests passed
  - [ ] Load testing completed
  - [ ] Penetration testing scheduled/completed

- [ ] **Documentation**
  - [ ] API documentation updated
  - [ ] Security procedures documented
  - [ ] Incident response plan created
  - [ ] Team training completed

### Post-Deployment Monitoring

- [ ] Set up alerts for:
  - [ ] Multiple unauthorized access attempts
  - [ ] Abnormal query patterns
  - [ ] Failed authentication attempts
  - [ ] Database RLS policy violations

- [ ] Monitor performance metrics:
  - [ ] Query execution times
  - [ ] API response times
  - [ ] Database connection pool usage
  - [ ] Memory and CPU utilization

- [ ] Regular security audits:
  - [ ] Weekly review of security event logs
  - [ ] Monthly access pattern analysis
  - [ ] Quarterly penetration testing
  - [ ] Annual security architecture review

---

## Error Handling Standards

### Error Response Format

```javascript
// Standard error response structure
{
  success: false,
  error: 'ErrorType',          // Machine-readable error code
  message: 'Human description', // User-friendly message
  details: { },                 // Optional additional context
  requestId: 'uuid',            // For tracking/debugging
}
```

### Common Error Scenarios

```javascript
// middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Log to monitoring service
  logError({
    error: err,
    userId: req.user?.id,
    shopId: req.params?.shopId,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (err.code === '23505') {  // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Resource already exists',
    });
  }

  if (err.code === '23503') {  // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Invalid Reference',
      message: 'Referenced resource does not exist',
    });
  }

  // Default 500 error
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId: req.id,
  });
}

module.exports = { errorHandler };
```

---

## Migration Strategy

### Phase 1: Database Preparation (Week 1)

1. **Add shop_id columns** to all tables
2. **Create indexes** for performance
3. **Backfill shop_id** for existing data
4. **Add foreign key constraints**
5. **Create audit tables**

### Phase 2: Backend Implementation (Week 2-3)

1. **Implement middleware** (authenticate, validateShopAccess)
2. **Implement platform admin endpoints** (/api/admin/*)
3. **Implement shop-scoped endpoints** (/api/shops/:shopId/*)
4. **Add audit logging**
5. **Implement RLS policies**

### Phase 3: Testing (Week 4)

1. **Unit tests** for all middleware and utilities
2. **Integration tests** for critical flows
3. **Security testing** for data isolation
4. **Performance testing** under load
5. **User acceptance testing**

### Phase 4: Deployment (Week 5)

1. **Deploy to staging**
2. **Run full test suite**
3. **Monitor for issues**
4. **Deploy to production** with feature flag
5. **Monitor closely** for first 72 hours

### Phase 5: Legacy Cleanup (Week 6+)

1. **Deprecate old endpoints**
2. **Remove legacy code**
3. **Optimize database**
4. **Update documentation**

---

## Monitoring & Logging

### Application Logging

```javascript
// utils/logger.js

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Audit log function
async function logAudit({ userId, shopId, action, resourceType, resourceId, oldValues, newValues, details }) {
  try {
    await db.query(
      `INSERT INTO audit_log (
        id, user_id, shop_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )`,
      [
        userId,
        shopId,
        action,
        resourceType,
        resourceId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        req.ip,
      ]
    );

    logger.info('Audit log created', {
      userId,
      shopId,
      action,
      resourceType,
      resourceId,
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error, userId, shopId, action });
  }
}

module.exports = { logger, logAudit };
```

### Metrics & Alerts

```javascript
// Setup Prometheus metrics
const prometheus = require('prom-client');

// Custom metrics
const requestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

const shopAccessAttempts = new prometheus.Counter({
  name: 'shop_access_attempts_total',
  help: 'Total number of shop access attempts',
  labelNames: ['result', 'user_role'],
});

const dataIsolationViolations = new prometheus.Counter({
  name: 'data_isolation_violations_total',
  help: 'Total number of data isolation violation attempts',
  labelNames: ['endpoint', 'user_role'],
});

// Middleware to track metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    requestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
  });

  next();
}

module.exports = {
  requestDuration,
  shopAccessAttempts,
  dataIsolationViolations,
  metricsMiddleware,
};
```

---

## Edge Cases & Solutions

### Edge Case 1: User Changes Shops

**Scenario**: A user switches from one shop to another (e.g., employee moves to different location)

**Solution**:
```javascript
// When updating user's shop_id
app.patch('/api/admin/users/:userId/shop',
  authenticate,
  requirePlatformAdmin,
  async (req, res) => {
  const { userId } = req.params;
  const { newShopId, reason } = req.body;

  // Update user's shop
  await db.query(
    'UPDATE users SET shop_id = $1, updated_at = NOW() WHERE id = $2',
    [newShopId, userId]
  );

  // Audit log
  await logAudit({
    userId: req.user.id,
    shopId: newShopId,
    action: 'transfer_user_shop',
    resourceType: 'users',
    resourceId: userId,
    details: { newShopId, reason },
  });

  // Invalidate user's JWT tokens (force re-login)
  await invalidateUserSessions(userId);

  res.json({ success: true });
});
```

### Edge Case 2: Shop Merger

**Scenario**: Two shops merge, need to transfer all data from shop A to shop B

**Solution**:
```javascript
// Platform admin initiates shop merger
app.post('/api/admin/shops/merge',
  authenticate,
  requirePlatformAdmin,
  async (req, res) => {
  const { sourceShopId, targetShopId, archiveSource } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Transfer all resources
    const tables = ['reservations', 'payments', 'refunds', 'points', 'orders', 'products'];

    for (const table of tables) {
      await client.query(
        `UPDATE ${table} SET shop_id = $1, updated_at = NOW()
         WHERE shop_id = $2 AND deleted_at IS NULL`,
        [targetShopId, sourceShopId]
      );
    }

    // Transfer users
    await client.query(
      `UPDATE users SET shop_id = $1, updated_at = NOW()
       WHERE shop_id = $2 AND deleted_at IS NULL`,
      [targetShopId, sourceShopId]
    );

    // Archive or delete source shop
    if (archiveSource) {
      await client.query(
        `UPDATE shops SET shop_status = 'deleted', deleted_at = NOW()
         WHERE id = $1`,
        [sourceShopId]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (id, user_id, action, resource_type, new_values, created_at)
       VALUES (gen_random_uuid(), $1, 'merge_shops', 'shops', $2, NOW())`,
      [req.user.id, JSON.stringify({ sourceShopId, targetShopId })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully merged shop ${sourceShopId} into ${targetShopId}`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
```

### Edge Case 3: Multi-Shop User (Future Feature)

**Scenario**: A user needs access to multiple shops (e.g., consultant, auditor)

**Solution**:
```javascript
// Create user_shops junction table
CREATE TABLE user_shops (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

// Modified validateShopAccess to check user_shops
async function validateShopAccessMultiShop(req, res, next) {
  const { shopId } = req.params;
  const user = req.user;

  // Platform admins bypass
  if (user.role === 'super_admin' || user.role === 'admin') {
    return next();
  }

  // Check user_shops junction table
  const access = await db.query(
    'SELECT * FROM user_shops WHERE user_id = $1 AND shop_id = $2',
    [user.id, shopId]
  );

  if (access.rows.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'You do not have access to this shop',
    });
  }

  req.shopAccess = access.rows[0];
  next();
}
```

### Edge Case 4: Shared Customers Across Shops

**Scenario**: A customer visits multiple shops, need to track per-shop relationship

**Solution**:
```javascript
// Use shop_customers junction table (already defined in schema)
// When customer books at new shop, create relationship
app.post('/api/shops/:shopId/reservations',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  const { shopId } = req.params;
  const { customerId } = req.body;

  // Ensure shop_customer relationship exists
  await db.query(`
    INSERT INTO shop_customers (shop_id, customer_id, first_visit_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (shop_id, customer_id) DO UPDATE
    SET last_visit_at = NOW()
  `, [shopId, customerId]);

  // Create reservation...
  // (rest of reservation creation logic)
});

// Query shop-specific customer list
app.get('/api/shops/:shopId/customers',
  authenticate,
  validateShopAccess,
  async (req, res) => {
  const { shopId } = req.params;

  const result = await db.query(`
    SELECT
      c.*,
      sc.first_visit_at,
      sc.last_visit_at,
      sc.total_bookings,
      sc.total_spent
    FROM customers c
    INNER JOIN shop_customers sc ON c.id = sc.customer_id
    WHERE sc.shop_id = $1
    ORDER BY sc.last_visit_at DESC
  `, [shopId]);

  res.json({
    success: true,
    customers: result.rows,
    shopId,
  });
});
```

---

## Summary

This comprehensive guide covers all aspects of implementing the dashboard separation architecture with complete data isolation between shops and platform administration.

### Key Takeaways

1. **Defense in Depth**: Multiple security layers (middleware, query filtering, RLS)
2. **Always Filter by shop_id**: Never rely on middleware alone
3. **Audit Everything**: Log all access attempts and modifications
4. **Test Thoroughly**: Unit, integration, and E2E security tests
5. **Monitor Continuously**: Set up alerts for security violations

### Critical Files to Implement

1. `middleware/authenticate.js` - JWT authentication
2. `middleware/validateShopAccess.js` - Shop access validation
3. `middleware/requirePlatformAdmin.js` - Platform admin check
4. `routes/admin/*.js` - Platform admin endpoints
5. `routes/shops/*.js` - Shop-scoped endpoints
6. `database/migrations/add-shop-isolation.sql` - Schema changes
7. `database/rls-policies.sql` - Row-level security

### Next Steps

1. Review this guide with backend team
2. Implement database schema changes
3. Develop and test middleware
4. Implement endpoints incrementally
5. Run comprehensive security audit
6. Deploy with monitoring

---

**Document Version**: 2.0
**Last Updated**: 2025-10-12
**Maintained By**: Backend Team
**Review Frequency**: Monthly
