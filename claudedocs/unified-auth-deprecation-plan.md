# Unified Authentication System - Deprecation Plan

## Status
- **Implementation**: ✅ COMPLETE
- **Testing**: ❌ BLOCKED (See [session-repository-test-blocker.md](session-repository-test-blocker.md))
- **Deprecation**: ⏳ PENDING (Awaiting test validation)

## Overview
This document outlines the deprecation plan for the old authentication tables and code after the unified authentication system becomes fully operational.

## Phase 1: Pre-Deprecation Validation (CURRENT BLOCKER)

### Required Before Proceeding
1. ✅ Unified tables created and migrated
2. ✅ Repository layer implemented
3. ✅ Service layer implemented
4. ✅ Controllers and routes implemented
5. ❌ **BLOCKED**: Integration tests passing
   - **Blocker**: Supabase Auth API 500 error
   - **Impact**: Cannot validate system functionality
   - **Resolution**: Fix Supabase project configuration (requires dashboard access)

### Test Coverage Requirements
Once blocker is resolved, verify:
- SessionRepository (15 integration tests)
- UnifiedAuthService functionality
- API endpoints (login, logout, session management)
- Role-based access control
- Security logging and audit trail

## Phase 2: Deprecation Preparation (READY TO EXECUTE)

### Code to Deprecate

#### 1. Old Repository Files
```
src/repositories/
├── admin-auth.repository.ts          → DELETE after validation
├── admin-session.repository.ts       → DELETE after validation
├── shop-owner-auth.repository.ts     → DELETE after validation
└── shop-owner-session.repository.ts  → DELETE after validation
```

#### 2. Old Service Files
```
src/services/
├── admin-auth.service.ts             → DELETE after validation
├── shop-owner-auth.service.ts        → DELETE after validation
└── shop-owner-session.service.ts     → DELETE after validation
```

#### 3. Old Controller Files
```
src/controllers/
├── admin-auth.controller.ts          → DELETE after validation
└── shop-owner-auth.controller.ts     → DELETE after validation
```

#### 4. Old Route Files
```
src/routes/
├── admin-auth.routes.ts              → DELETE after validation
└── shop-owner-auth.routes.ts         → DELETE after validation
```

#### 5. Old Middleware Files
```
src/middleware/
├── admin-auth.middleware.ts          → DELETE after validation
└── shop-owner-auth.middleware.ts     → DELETE after validation
```

### Database Tables to Drop (After Data Migration Validation)
```sql
-- Old admin authentication tables
DROP TABLE IF EXISTS public.admin_sessions;
DROP TABLE IF EXISTS public.admin_login_attempts;

-- Old shop owner authentication tables
DROP TABLE IF EXISTS public.shop_owner_sessions;
DROP TABLE IF EXISTS public.shop_owner_login_attempts;
DROP TABLE IF EXISTS public.shop_owner_account_security;
DROP TABLE IF EXISTS public.shop_owner_security_logs;
```

## Phase 3: Migration Checklist

### Step 1: Verify Data Migration
```sql
-- Verify all admin sessions migrated
SELECT COUNT(*) FROM public.sessions WHERE user_role = 'admin';
-- Should match original admin_sessions count

-- Verify all shop owner sessions migrated
SELECT COUNT(*) FROM public.sessions WHERE user_role = 'shop_owner';
-- Should match original shop_owner_sessions count

-- Verify login attempts migrated
SELECT COUNT(*) FROM public.login_attempts WHERE user_role = 'admin';
SELECT COUNT(*) FROM public.login_attempts WHERE user_role = 'shop_owner';

-- Verify security data migrated
SELECT COUNT(*) FROM public.account_security WHERE user_role = 'shop_owner';
SELECT COUNT(*) FROM public.security_logs WHERE user_role = 'shop_owner';
```

### Step 2: Update Application Code
- [x] Update app.ts to use unified routes
- [ ] Remove old route imports
- [ ] Remove old middleware imports
- [ ] Update environment.ts if needed
- [ ] Update error handling for unified errors

### Step 3: Update API Documentation
- [ ] Update Swagger/OpenAPI specs
- [ ] Remove old endpoint documentation
- [ ] Add unified endpoint documentation
- [ ] Update authentication flow diagrams

### Step 4: Update Tests
- [ ] Remove old auth service tests
- [ ] Remove old repository tests
- [ ] Verify unified auth tests cover all scenarios
- [ ] Update integration test suite

### Step 5: Code Cleanup
- [ ] Delete old repository files (listed above)
- [ ] Delete old service files (listed above)
- [ ] Delete old controller files (listed above)
- [ ] Delete old route files (listed above)
- [ ] Delete old middleware files (listed above)
- [ ] Clean up unused imports across codebase

### Step 6: Database Cleanup (FINAL STEP - IRREVERSIBLE)
```sql
-- Create backup first
-- pg_dump specific tables before dropping

-- Drop old tables
DROP TABLE IF EXISTS public.admin_sessions CASCADE;
DROP TABLE IF EXISTS public.admin_login_attempts CASCADE;
DROP TABLE IF EXISTS public.shop_owner_sessions CASCADE;
DROP TABLE IF EXISTS public.shop_owner_login_attempts CASCADE;
DROP TABLE IF EXISTS public.shop_owner_account_security CASCADE;
DROP TABLE IF EXISTS public.shop_owner_security_logs CASCADE;
```

## Phase 4: Post-Deprecation Validation

### Functional Tests
- [ ] Admin login/logout workflow
- [ ] Shop owner login/logout workflow
- [ ] Session management (refresh, revoke, list)
- [ ] Account security features (locking, 2FA)
- [ ] Security logging and audit trail
- [ ] Role-based access control

### Performance Tests
- [ ] Session creation performance
- [ ] Token validation performance
- [ ] Database query performance
- [ ] Concurrent session management

### Security Tests
- [ ] Authentication flow security
- [ ] Session token security
- [ ] RLS policy enforcement
- [ ] Security log completeness

## Rollback Plan

If issues are discovered after deprecation:

### Immediate Rollback Steps
1. **DO NOT** drop old tables until 100% confident
2. Re-enable old routes if needed
3. Keep old code in git history for reference
4. Revert application code changes via git

### Data Recovery
```sql
-- If data migration issues found, can re-migrate from old tables
-- Old tables preserved until final validation complete
```

## Risk Assessment

### High Risk Areas
1. ❗ **Active Sessions**: Users currently logged in during migration
   - Mitigation: Plan maintenance window
   - Mitigation: Implement graceful session migration
2. ❗ **Security Logs**: Audit trail completeness
   - Mitigation: Verify all logs migrated before deletion
3. ❗ **Role Permissions**: RLS policies must be correct
   - Mitigation: Extensive testing before production

### Medium Risk Areas
1. ⚠️ **API Clients**: Frontend apps need simultaneous updates
   - Mitigation: Version API endpoints during transition
2. ⚠️ **Third-party Integrations**: External systems using auth
   - Mitigation: Maintain backward compatibility layer temporarily

### Low Risk Areas
1. ✅ **Database Schema**: Well-tested migration SQL
2. ✅ **Code Quality**: Comprehensive type safety with TypeScript
3. ✅ **Repository Pattern**: Clear separation of concerns

## Timeline (After Blocker Resolution)

### Week 1: Testing & Validation
- Day 1-2: Fix Supabase Auth configuration
- Day 3-4: Run all integration tests
- Day 5: Performance and security testing

### Week 2: Deprecation Execution
- Day 1: Update application code
- Day 2: Update documentation
- Day 3: Deploy to staging
- Day 4-5: Staging validation

### Week 3: Production Deployment
- Day 1: Production deployment
- Day 2-3: Monitor production
- Day 4: Begin code cleanup
- Day 5: Final validation

### Week 4: Cleanup
- Day 1-2: Delete old code files
- Day 3: Create database backup
- Day 4: Drop old tables
- Day 5: Final documentation update

## Success Criteria

### Must Have (Blocking)
- ✅ All unified auth tables created
- ✅ All data migrated successfully
- ❌ All integration tests passing (BLOCKED)
- ⏳ No production errors for 48 hours
- ⏳ All old endpoints replaced with unified endpoints

### Should Have
- ⏳ Performance metrics equal or better than old system
- ⏳ Security audit completed
- ⏳ Documentation updated
- ⏳ Team training completed

### Nice to Have
- Monitoring dashboards updated
- Analytics tracking unified auth usage
- Developer experience improvements documented

## Next Steps

### Immediate (After Blocker Resolved)
1. Fix Supabase Auth API configuration
2. Run `npm run test:unified-auth:session`
3. Run `npm run test:unified-auth`
4. Validate all 15+ SessionRepository tests pass
5. Validate complete unified auth test suite

### Short Term
1. Update app.ts to use unified routes exclusively
2. Remove old route imports
3. Update API documentation
4. Deploy to staging environment

### Long Term
1. Complete deprecation checklist
2. Monitor production for issues
3. Delete old code and tables
4. Update team documentation

## Related Documentation
- [Session Repository Test Blocker](session-repository-test-blocker.md) - Current blocker details
- [Unified Auth Migration](../supabase/migrations/20251017_create_unified_auth_tables.sql) - Database migration
- [Unified Auth Types](../src/types/unified-auth.types.ts) - TypeScript type definitions
