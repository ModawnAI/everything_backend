# Claude Documentation Directory

This directory contains comprehensive documentation for backend development work, particularly focusing on the unified authentication system implementation.

## 📋 Document Index

### Current Status Documents

#### 🔴 [Session Repository Test Blocker](session-repository-test-blocker.md)
**Priority**: CRITICAL | **Status**: ACTIVE BLOCKER

The most urgent issue preventing integration test validation. Read this first if you're experiencing test failures or Auth API errors.

**Key Information**:
- Error: `AuthApiError: status 500, code: unexpected_failure`
- Impact: All 15 SessionRepository integration tests blocked
- Cause: Supabase Auth API configuration issue
- Required: Dashboard access to fix

#### 🔧 [Supabase Auth Fix Guide](supabase-auth-fix-guide.md)
**Priority**: CRITICAL | **Type**: Step-by-Step Instructions

Detailed instructions for resolving the Supabase Auth API blocker. Follow this guide to unblock integration tests.

**Contains**:
- 10-step fix procedure
- Common solutions and workarounds
- Verification steps
- Emergency workarounds
- Monitoring guidance

#### ✅ [Unified Auth Implementation Summary](unified-auth-implementation-summary.md)
**Priority**: HIGH | **Type**: Technical Overview

Complete summary of the unified authentication system implementation, including architecture, code metrics, and current status.

**Sections**:
- Implementation status (what's done)
- Architecture highlights
- Code quality metrics
- Current blockers
- Next steps
- Success criteria

#### 🗓️ [Unified Auth Deprecation Plan](unified-auth-deprecation-plan.md)
**Priority**: MEDIUM | **Type**: Action Plan

Detailed plan for deprecating old authentication code and tables after the unified system is validated.

**Includes**:
- Pre-deprecation validation checklist
- Code files to delete
- Database cleanup steps
- Migration timeline
- Risk assessment
- Rollback plan

## 🎯 Quick Start Guide

### For New Team Members
1. Start with [Unified Auth Implementation Summary](unified-auth-implementation-summary.md) to understand what has been built
2. Review [Session Repository Test Blocker](session-repository-test-blocker.md) to understand the current blocker
3. If you have dashboard access, follow [Supabase Auth Fix Guide](supabase-auth-fix-guide.md)

### For Fixing the Blocker
1. Read [Session Repository Test Blocker](session-repository-test-blocker.md) for problem context
2. Follow [Supabase Auth Fix Guide](supabase-auth-fix-guide.md) step-by-step
3. After fix, verify with tests: `npm run test:unified-auth:session`
4. Update status in all documents

### For Continuing Development
1. Review [Unified Auth Implementation Summary](unified-auth-implementation-summary.md) - what's complete
2. Check [Unified Auth Deprecation Plan](unified-auth-deprecation-plan.md) - what's next
3. Verify blocker status in [Session Repository Test Blocker](session-repository-test-blocker.md)
4. If blocker resolved, proceed with deprecation checklist

## 📊 Project Status Dashboard

### Implementation Phase ✅
- [x] Database schema created
- [x] Repository layer implemented
- [x] Service layer implemented
- [x] Controller layer implemented
- [x] Middleware implemented
- [x] Routes configured
- [x] Type definitions complete
- [x] Data migration successful
- [x] Unit tests written

### Testing Phase ❌ (BLOCKED)
- [ ] Integration tests passing (BLOCKED by Supabase Auth)
- [ ] Performance tests
- [ ] Security tests
- [ ] E2E tests

### Deployment Phase ⏳
- [x] Code integrated into app.ts
- [ ] Staging deployment validated
- [ ] Production deployment
- [ ] Old code deprecated

## 🔑 Key Files Reference

### Production Code
```
src/
├── types/unified-auth.types.ts           # TypeScript type definitions
├── repositories/
│   ├── base.repository.ts                # Base repository class
│   ├── session.repository.ts             # Session management
│   ├── login-attempt.repository.ts       # Login tracking
│   ├── account-security.repository.ts    # Security settings
│   └── security-log.repository.ts        # Audit logging
├── services/
│   └── unified-auth.service.ts           # Main authentication service
├── controllers/
│   └── unified-auth.controller.ts        # HTTP request handlers
├── middleware/
│   └── unified-auth.middleware.ts        # Auth middleware
└── routes/
    └── unified-auth.routes.ts            # API route definitions
```

### Test Files
```
tests/
├── unit/
│   └── unified-auth.service.test.ts      # Service unit tests (85% coverage)
└── integration/
    ├── session.repository.test.ts        # 15 repository tests (BLOCKED)
    └── unified-auth.test.ts              # Full system tests (BLOCKED)
```

### Database Files
```
supabase/
└── migrations/
    └── 20251017_create_unified_auth_tables.sql  # Schema + data migration
```

### Documentation Files (This Directory)
```
claudedocs/
├── README.md                                    # This file
├── session-repository-test-blocker.md           # Current blocker analysis
├── supabase-auth-fix-guide.md                   # Fix instructions
├── unified-auth-implementation-summary.md       # Technical overview
└── unified-auth-deprecation-plan.md             # Deprecation roadmap
```

## 🎓 Understanding the System

### Architecture Overview
```
┌─────────────┐
│   Client    │
│   (API)     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Routes             │
│  /api/auth/*        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Controller         │
│  Request Validation │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Middleware         │
│  Auth Validation    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Service            │
│  Business Logic     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Repository         │
│  Data Access        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Supabase           │
│  PostgreSQL + Auth  │
└─────────────────────┘
```

### Data Flow Example: Login
1. **Client**: POST /api/auth/login with {email, password, role}
2. **Route**: Validates request format
3. **Controller**: Parses request, calls service
4. **Service**:
   - Validates credentials
   - Creates session
   - Generates JWT tokens
   - Logs security event
5. **Repository**: Persists session data
6. **Response**: Returns tokens and session info

### Key Concepts

#### Role-Based Authentication
- **admin**: Full system access
- **shop_owner**: Shop-specific access (requires shop_id)
- **customer**: End-user access

#### Session Management
- Access tokens: 24-hour expiration
- Refresh tokens: 7-day expiration
- Device tracking: IP, user agent, device ID
- Automatic cleanup: Expired sessions marked inactive

#### Security Features
- Password hashing: bcrypt
- Token generation: JWT
- Failed login tracking: Automatic account locking
- Audit logging: All security events logged
- 2FA support: TOTP with backup codes

## 🚨 Common Issues & Solutions

### Issue 1: Tests Failing with Auth Error
**Symptom**: `AuthApiError: status 500, code: unexpected_failure`
**Solution**: See [Session Repository Test Blocker](session-repository-test-blocker.md)
**Quick Fix**: Follow [Supabase Auth Fix Guide](supabase-auth-fix-guide.md)

### Issue 2: Foreign Key Constraint Violation
**Symptom**: `users_id_fkey` constraint violation
**Cause**: Attempting to create user without auth.users entry
**Solution**: Must use Supabase Auth API to create users first

### Issue 3: Old vs New Endpoints Confusion
**Status**: Both systems currently active
**Old**: `/api/admin/auth/*` and `/api/shop-owner/auth/*`
**New**: `/api/auth/*` (unified)
**Migration**: See [Unified Auth Deprecation Plan](unified-auth-deprecation-plan.md)

### Issue 4: Session Not Found
**Possible Causes**:
1. Token expired (check expires_at)
2. Session revoked (check is_active)
3. User logged out
4. Database connection issue

**Debug**: Check `sessions` table and `security_logs`

## 📞 Getting Help

### For Technical Issues
1. Check relevant documentation in this directory
2. Review error logs: `logs/` directory
3. Check database: Supabase Dashboard
4. Review code: See file references above

### For Blocker Issues
1. Read [Session Repository Test Blocker](session-repository-test-blocker.md)
2. Follow [Supabase Auth Fix Guide](supabase-auth-fix-guide.md)
3. If still blocked, escalate to team lead

### For Implementation Questions
1. Review [Unified Auth Implementation Summary](unified-auth-implementation-summary.md)
2. Check code comments in source files
3. Review test files for usage examples
4. Check Supabase documentation

## 🔄 Update Procedure

When updating these documents:

1. **Status Changes**: Update all documents with new status
2. **Blocker Resolution**: Mark blocker as resolved in all docs
3. **New Issues**: Create new documentation following existing patterns
4. **Test Results**: Update test status in implementation summary
5. **Deployment**: Update deprecation plan with actual dates

## 📈 Metrics to Track

### Development Metrics
- [ ] Code coverage: Target 80%+ (currently ~80%)
- [ ] Test pass rate: Target 100% (currently 0% due to blocker)
- [ ] Lines of code: ~5,000 total
- [ ] Documentation: 4 comprehensive documents ✅

### Quality Metrics
- [ ] Type safety: 100% ✅
- [ ] Security audit: Pending
- [ ] Performance benchmarks: Pending
- [ ] Code review: Pending

### Operational Metrics (Post-Deployment)
- [ ] API response time: Target <200ms
- [ ] Error rate: Target <0.1%
- [ ] Uptime: Target 99.9%
- [ ] Session creation rate: Monitor

## 🎯 Success Criteria

### Phase 1: Implementation ✅
- [x] All code written
- [x] All types defined
- [x] Database migrated
- [x] Unit tests written

### Phase 2: Validation ⏳ (Current Phase)
- [ ] Blocker resolved
- [ ] Integration tests passing
- [ ] Performance validated
- [ ] Security audited

### Phase 3: Deployment ⏳
- [ ] Staging deployed
- [ ] Production deployed
- [ ] Monitoring active
- [ ] Old code deprecated

## 📚 Additional Resources

### Internal Documentation
- Main README: `../README.md`
- API Documentation: http://localhost:3001/api-docs
- Database Schema: `../supabase/migrations/`

### External Resources
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- JWT Best Practices: https://jwt.io/introduction
- Node.js Security: https://nodejs.org/en/docs/guides/security/

### Team Resources
- Project Board: [Link to project management tool]
- Team Chat: [Link to Slack/Discord]
- Weekly Sync: [Meeting schedule]

---

**Last Updated**: 2025-10-17
**Maintained By**: Backend Development Team
**Next Review**: After blocker resolution
