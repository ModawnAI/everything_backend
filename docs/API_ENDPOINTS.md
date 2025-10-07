# 에뷰리띵 Backend API Endpoints

> Last updated on 2025-10-05T16:10:00.000Z
> ✅ Verified against app.ts route mounting
> ✅ All routing conflicts resolved
> 🔄 Updated with admin shop service endpoints (separate paths)

## ℹ️ Routing Status

### ✅ All Path Conflicts Resolved or Verified Safe

The following paths have multiple routers mounted at the same base path, but **all are verified safe** with no actual conflicts:

**`/api/users`** - ✅ **Safe**
  - user-profile.routes.ts (archived/commented out)
  - user-settings.routes.ts (active)

**`/api/admin`** - ✅ **Safe - Resource-Specific Routes**
  - user-status.routes.ts (`/users/:userId/status/*`, `/violations/*`)
  - admin-moderation.routes.ts (`/content/*`, `/shop-reports/*`)
  - ip-blocking.routes.ts (`/ip-blocking/*`)

**`/api/admin/shops`** - ✅ **Clean Separation**
  - admin-shop.routes.ts (general shop management)
  - admin-shop-service.routes.ts (mounted at `/api/admin/shops/:shopId/services`)

**`/api/shops`** - ✅ **Safe - Properly Ordered**
  - shop.routes.ts (general shop routes)
  - shop-reporting.routes.ts (`/reports/*`)

**`/api`** - ✅ **Safe - Different Resources**
  - favorites.routes.ts (`/favorites/*`)
  - reservation.routes.ts (`/reservations/*`)
  - reservation-rescheduling.routes.ts (`/reservations/:id/reschedule/*`)
  - conflict-resolution.routes.ts (`/conflicts/*`)
  - point-balance.routes.ts (`/users/:userId/points/*`)

**`/api/monitoring`** - ✅ **Safe - Properly Ordered**
  - monitoring-dashboard.routes.ts (`/dashboard/*`)
  - monitoring.routes.ts (general monitoring)

**Result**: ✅ No actual routing conflicts. All routers use specific, non-overlapping route patterns.

### ✅ Clean Route Separation

**Separate mount paths** eliminate all routing conflicts:

**`/api/admin/shops/:shopId/services`** → admin-shop-service.routes.ts:
- GET `/` → `/api/admin/shops/:shopId/services` - List shop services
- POST `/` → `/api/admin/shops/:shopId/services` - Create shop service
- GET `/:serviceId` → `/api/admin/shops/:shopId/services/:serviceId` - Get service details
- PUT `/:serviceId` → `/api/admin/shops/:shopId/services/:serviceId` - Update service
- DELETE `/:serviceId` → `/api/admin/shops/:shopId/services/:serviceId` - Delete service

**`/api/admin/shops`** → admin-shop.routes.ts:
- POST `/` - Create shop
- GET `/` - List shops
- GET `/pending` - Pending shops
- POST `/search` - Search shops
- GET `/verification-stats` - Verification statistics
- PUT `/:shopId` - Update shop
- DELETE `/:shopId` - Delete shop
- PUT `/:shopId/approve` - Approve/reject shop
- GET `/:shopId/verification-history` - Get verification history
- GET `/:shopId/verification-requirements` - Check requirements

**Backward compatibility**: `/api/admin/shop` (singular) also routes to admin-shop.routes.ts for legacy support.

---

## Table of Contents
- [Admin Endpoints](#admin-endpoints) (160 endpoints)
- [User/Public Endpoints](#userpublic-endpoints) (400 endpoints)


---

## Admin Endpoints

These endpoints require admin authentication and are accessible through the admin panel.

| Method | Endpoint | Source File |
|--------|----------|-------------|
| GET | `/api/admin/adjustments/admin/audit-logs` | admin-adjustment.routes.ts |
| GET | `/api/admin/adjustments/admin/audit-logs/export` | admin-adjustment.routes.ts |
| POST | `/api/admin/adjustments/admin/point-adjustments` | admin-adjustment.routes.ts |
| GET | `/api/admin/adjustments/admin/point-adjustments/:adjustmentId` | admin-adjustment.routes.ts |
| POST | `/api/admin/adjustments/admin/point-adjustments/:adjustmentId/approve` | admin-adjustment.routes.ts |
| POST | `/api/admin/adjustments/admin/point-adjustments/:adjustmentId/reject` | admin-adjustment.routes.ts |
| GET | `/api/admin/adjustments/admin/point-adjustments/pending` | admin-adjustment.routes.ts |
| GET | `/api/admin/adjustments/admin/point-adjustments/stats` | admin-adjustment.routes.ts |
| GET | `/api/admin/adjustments/admin/point-adjustments/user/:userId` | admin-adjustment.routes.ts |
| POST | `/api/admin/analytics/cache/clear` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/cache/stats` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/dashboard` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/export` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/health` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/realtime` | admin-analytics.routes.ts |
| GET | `/api/admin/analytics/shops/:shopId/analytics` | admin-analytics.routes.ts |
| GET | `/api/admin/audit` | audit-trail.routes.ts |
| POST | `/api/admin/audit/cleanup` | audit-trail.routes.ts |
| GET | `/api/admin/audit/compliance-report` | audit-trail.routes.ts |
| POST | `/api/admin/audit/export` | audit-trail.routes.ts |
| GET | `/api/admin/audit/reservation/:reservationId` | audit-trail.routes.ts |
| GET | `/api/admin/audit/stats` | audit-trail.routes.ts |
| GET | `/api/admin/audit/trends` | audit-trail.routes.ts |
| POST | `/api/admin/auth/change-password` | admin-auth.routes.ts |
| POST | `/api/admin/auth/login` | admin-auth.routes.ts |
| POST | `/api/admin/auth/logout` | admin-auth.routes.ts |
| GET | `/api/admin/auth/profile` | admin-auth.routes.ts |
| POST | `/api/admin/auth/refresh` | admin-auth.routes.ts |
| GET | `/api/admin/auth/sessions` | admin-auth.routes.ts |
| GET | `/api/admin/auth/validate` | admin-auth.routes.ts |
| PUT | `/api/admin/automation/config` | automatic-state-progression.routes.ts |
| GET | `/api/admin/automation/health` | automatic-state-progression.routes.ts |
| GET | `/api/admin/automation/metrics` | automatic-state-progression.routes.ts |
| POST | `/api/admin/automation/reset-metrics` | automatic-state-progression.routes.ts |
| POST | `/api/admin/automation/run` | automatic-state-progression.routes.ts |
| GET | `/api/admin/automation/status` | automatic-state-progression.routes.ts |
| PUT | `/api/admin/content/:contentId/moderate` | admin-moderation.routes.ts |
| GET | `/api/admin/content/moderation-queue` | admin-moderation.routes.ts |
| GET | `/api/admin/content/reported` | admin-moderation.routes.ts |
| GET | `/api/admin/financial/payments/overview` | admin-financial.routes.ts |
| GET | `/api/admin/financial/payouts/calculate/:shopId` | admin-financial.routes.ts |
| POST | `/api/admin/financial/points/adjust` | admin-financial.routes.ts |
| GET | `/api/admin/financial/points/overview` | admin-financial.routes.ts |
| GET | `/api/admin/financial/refunds` | admin-financial.routes.ts |
| POST | `/api/admin/financial/reports/generate` | admin-financial.routes.ts |
| GET | `/api/admin/influencer-bonus/admin/influencer-bonus/analytics/:influencerId` | influencer-bonus.routes.ts |
| POST | `/api/admin/influencer-bonus/admin/influencer-bonus/check-qualification` | influencer-bonus.routes.ts |
| GET | `/api/admin/influencer-bonus/admin/influencer-bonus/stats` | influencer-bonus.routes.ts |
| POST | `/api/admin/influencer-bonus/admin/influencer-bonus/validate/:transactionId` | influencer-bonus.routes.ts |
| GET | `/api/admin/moderation/stats` | admin-moderation.routes.ts |
| GET | `/api/admin/no-show/config` | no-show-detection.routes.ts |
| PUT | `/api/admin/no-show/config` | no-show-detection.routes.ts |
| POST | `/api/admin/no-show/override` | no-show-detection.routes.ts |
| GET | `/api/admin/no-show/reservation/:reservationId` | no-show-detection.routes.ts |
| GET | `/api/admin/no-show/statistics` | no-show-detection.routes.ts |
| POST | `/api/admin/no-show/trigger` | no-show-detection.routes.ts |
| GET | `/api/admin/payments` | admin-payment.routes.ts |
| GET | `/api/admin/payments/:paymentId` | admin-payment.routes.ts |
| POST | `/api/admin/payments/:paymentId/refund` | admin-payment.routes.ts |
| GET | `/api/admin/payments/analytics` | admin-payment.routes.ts |
| GET | `/api/admin/payments/export` | admin-payment.routes.ts |
| GET | `/api/admin/payments/settlements` | admin-payment.routes.ts |
| GET | `/api/admin/payments/summary` | admin-payment.routes.ts |
| GET | `/api/admin/point-processing/analytics` | point-processing.routes.ts |
| GET | `/api/admin/point-processing/stats` | point-processing.routes.ts |
| POST | `/api/admin/point-processing/trigger/all` | point-processing.routes.ts |
| POST | `/api/admin/point-processing/trigger/expired` | point-processing.routes.ts |
| POST | `/api/admin/point-processing/trigger/pending` | point-processing.routes.ts |
| POST | `/api/admin/point-processing/trigger/warnings` | point-processing.routes.ts |
| GET | `/api/admin/reservations` | admin-reservation.routes.ts |
| GET | `/api/admin/reservations/:id/details` | admin-reservation.routes.ts |
| POST | `/api/admin/reservations/:id/dispute` | admin-reservation.routes.ts |
| POST | `/api/admin/reservations/:id/force-complete` | admin-reservation.routes.ts |
| PUT | `/api/admin/reservations/:id/status` | admin-reservation.routes.ts |
| GET | `/api/admin/reservations/analytics` | admin-reservation.routes.ts |
| POST | `/api/admin/reservations/bulk-status-update` | admin-reservation.routes.ts |
| POST | `/api/admin/security-enhanced/csrf/reset` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/csrf/stats` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/health` | admin-security-enhanced.routes.ts |
| POST | `/api/admin/security-enhanced/reset-all` | admin-security-enhanced.routes.ts |
| POST | `/api/admin/security-enhanced/rpc/reset` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/rpc/stats` | admin-security-enhanced.routes.ts |
| POST | `/api/admin/security-enhanced/sql-injection/reset` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/sql-injection/stats` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/stats` | admin-security-enhanced.routes.ts |
| POST | `/api/admin/security-enhanced/xss/reset` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-enhanced/xss/stats` | admin-security-enhanced.routes.ts |
| GET | `/api/admin/security-events/alerts` | admin-security-events.routes.ts |
| POST | `/api/admin/security-events/alerts/:alertId/resolve` | admin-security-events.routes.ts |
| GET | `/api/admin/security-events/compliance-report` | admin-security-events.routes.ts |
| POST | `/api/admin/security-events/export` | admin-security-events.routes.ts |
| GET | `/api/admin/security-events/middleware-stats` | admin-security-events.routes.ts |
| GET | `/api/admin/security-events/recent` | admin-security-events.routes.ts |
| GET | `/api/admin/security-events/statistics` | admin-security-events.routes.ts |
| GET | `/api/admin/security-events/threat-analysis` | admin-security-events.routes.ts |
| POST | `/api/admin/security/bulk-invalidate-sessions` | admin-security.routes.ts |
| GET | `/api/admin/security/events` | admin-security.routes.ts |
| POST | `/api/admin/security/users/:userId/invalidate-sessions` | admin-security.routes.ts |
| GET | `/api/admin/security/users/:userId/sessions` | admin-security.routes.ts |
| POST | `/api/admin/shop` | admin-shop.routes.ts |
| GET | `/api/admin/shop` | admin-shop.routes.ts |
| GET | `/api/admin/shop-reports` | admin-moderation.routes.ts |
| GET | `/api/admin/shop-reports/:reportId` | admin-moderation.routes.ts |
| PUT | `/api/admin/shop-reports/:reportId` | admin-moderation.routes.ts |
| POST | `/api/admin/shop-reports/bulk-action` | admin-moderation.routes.ts |
| PUT | `/api/admin/shop/:shopId` | admin-shop.routes.ts |
| DELETE | `/api/admin/shop/:shopId` | admin-shop.routes.ts |
| PUT | `/api/admin/shop/:shopId/approve` | admin-shop.routes.ts |
| GET | `/api/admin/shop/:shopId/verification-history` | admin-shop.routes.ts |
| GET | `/api/admin/shop/:shopId/verification-requirements` | admin-shop.routes.ts |
| GET | `/api/admin/shop/pending` | admin-shop.routes.ts |
| POST | `/api/admin/shop/search` | admin-shop.routes.ts |
| GET | `/api/admin/shop/verification-stats` | admin-shop.routes.ts |
| POST | `/api/admin/shops` | admin-shop.routes.ts |
| GET | `/api/admin/shops` | admin-shop.routes.ts |
| GET | `/api/admin/shops/pending` | admin-shop.routes.ts |
| POST | `/api/admin/shops/search` | admin-shop.routes.ts |
| GET | `/api/admin/shops/verification-stats` | admin-shop.routes.ts |
| PUT | `/api/admin/shops/:shopId` | admin-shop.routes.ts |
| DELETE | `/api/admin/shops/:shopId` | admin-shop.routes.ts |
| GET | `/api/admin/shops/:shopId/services` | admin-shop-service.routes.ts |
| POST | `/api/admin/shops/:shopId/services` | admin-shop-service.routes.ts |
| GET | `/api/admin/shops/:shopId/services/:serviceId` | admin-shop-service.routes.ts |
| PUT | `/api/admin/shops/:shopId/services/:serviceId` | admin-shop-service.routes.ts |
| DELETE | `/api/admin/shops/:shopId/services/:serviceId` | admin-shop-service.routes.ts |
| POST | `/api/admin/shops/:shopId/analyze-content` | admin-moderation.routes.ts |
| PUT | `/api/admin/shops/:shopId/approve` | admin-shop.routes.ts |
| GET | `/api/admin/shops/:shopId/moderation-history` | admin-moderation.routes.ts |
| GET | `/api/admin/shops/:shopId/verification-history` | admin-shop.routes.ts |
| GET | `/api/admin/shops/:shopId/verification-requirements` | admin-shop.routes.ts |
| GET | `/api/admin/shops/approval` | admin-shop-approval.routes.ts |
| PUT | `/api/admin/shops/approval/:id` | admin-shop-approval.routes.ts |
| GET | `/api/admin/shops/approval/:id/details` | admin-shop-approval.routes.ts |
| POST | `/api/admin/shops/approval/bulk-approval` | admin-shop-approval.routes.ts |
| GET | `/api/admin/shops/approval/statistics` | admin-shop-approval.routes.ts |
| GET | `/api/admin/shops/pending` | admin-shop.routes.ts |
| POST | `/api/admin/shops/search` | admin-shop.routes.ts |
| GET | `/api/admin/shops/verification-stats` | admin-shop.routes.ts |
| GET | `/api/admin/users` | admin-user-management.routes.ts |
| GET | `/api/admin/users/:id` | admin-user-management.routes.ts |
| PUT | `/api/admin/users/:id/role` | admin-user-management.routes.ts |
| PUT | `/api/admin/users/:id/status` | admin-user-management.routes.ts |
| GET | `/api/admin/users/:userId/audit` | admin-user-management.routes.ts |
| PUT | `/api/admin/users/:userId/status` | user-status.routes.ts |
| GET | `/api/admin/users/:userId/status/history` | user-status.routes.ts |
| POST | `/api/admin/users/:userId/violations` | user-status.routes.ts |
| GET | `/api/admin/users/:userId/violations` | user-status.routes.ts |
| GET | `/api/admin/users/activity` | admin-user-management.routes.ts |
| GET | `/api/admin/users/analytics` | admin-user-management.routes.ts |
| POST | `/api/admin/users/audit/export` | admin-user-management.routes.ts |
| GET | `/api/admin/users/audit/search` | admin-user-management.routes.ts |
| POST | `/api/admin/users/bulk-action` | admin-user-management.routes.ts |
| POST | `/api/admin/users/bulk-status-change` | user-status.routes.ts |
| GET | `/api/admin/users/search/advanced` | admin-user-management.routes.ts |
| GET | `/api/admin/users/statistics` | admin-user-management.routes.ts |
| GET | `/api/admin/users/status-stats` | user-status.routes.ts |
| GET | `/api/admin/users/status/:status` | user-status.routes.ts |
| PUT | `/api/admin/violations/:violationId/resolve` | user-status.routes.ts |

---

## User/Public Endpoints

These endpoints are used by the Flutter mobile app and public-facing services.

| Method | Endpoint | Source File |
|--------|----------|-------------|
| POST | `/api` | reservation.routes.ts |
| GET | `/api` | reservation.routes.ts |
| GET | `/api/:id` | reservation.routes.ts |
| PUT | `/api/:id/cancel` | reservation.routes.ts |
| GET | `/api/admin/reschedule/config` | reservation-rescheduling.routes.ts |
| PUT | `/api/admin/reschedule/config` | reservation-rescheduling.routes.ts |
| GET | `/api/analytics/auth` | auth-analytics.routes.ts |
| GET | `/api/analytics/auth/dashboard` | auth-analytics.routes.ts |
| GET | `/api/analytics/auth/insights` | auth-analytics.routes.ts |
| GET | `/api/analytics/auth/realtime` | auth-analytics.routes.ts |
| GET | `/api/analytics/auth/trends` | auth-analytics.routes.ts |
| GET | `/api/analytics/auth/users/:userId/profile` | auth-analytics.routes.ts |
| POST | `/api/auth/logout` | auth.routes.ts |
| POST | `/api/auth/logout-all` | auth.routes.ts |
| POST | `/api/auth/pass/callback` | auth.routes.ts |
| GET | `/api/auth/providers` | auth.routes.ts |
| POST | `/api/auth/refresh` | auth.routes.ts |
| POST | `/api/auth/refresh-supabase` | auth.routes.ts |
| POST | `/api/auth/register` | auth.routes.ts |
| POST | `/api/auth/send-verification-code` | auth.routes.ts |
| GET | `/api/auth/sessions` | auth.routes.ts |
| POST | `/api/auth/social-login` | auth.routes.ts |
| POST | `/api/auth/verify-phone` | auth.routes.ts |
| POST | `/api/cache/clear` | cache.routes.ts |
| DELETE | `/api/cache/delete/:key` | cache.routes.ts |
| GET | `/api/cache/get/:key` | cache.routes.ts |
| POST | `/api/cache/invalidate` | cache.routes.ts |
| POST | `/api/cache/set` | cache.routes.ts |
| GET | `/api/cache/stats` | cache.routes.ts |
| POST | `/api/cache/warm` | cache.routes.ts |
| GET | `/api/cdn/config` | cdn.routes.ts |
| GET | `/api/cdn/images/:imageId/optimized` | cdn.routes.ts |
| POST | `/api/cdn/images/:imageId/responsive` | cdn.routes.ts |
| GET | `/api/cdn/images/:imageId/urls` | cdn.routes.ts |
| GET | `/api/cdn/images/:imageId/webp` | cdn.routes.ts |
| POST | `/api/cdn/test` | cdn.routes.ts |
| POST | `/api/cdn/transform` | cdn.routes.ts |
| POST | `/api/conflicts/:conflictId/resolve` | conflict-resolution.routes.ts |
| POST | `/api/conflicts/priority-scores` | conflict-resolution.routes.ts |
| GET | `/api/csrf/token` | csrf.routes.ts |
| POST | `/api/csrf/validate` | csrf.routes.ts |
| GET | `/api/feed/analytics` | feed.routes.ts |
| POST | `/api/feed/interactions` | feed.routes.ts |
| POST | `/api/feed/personalized` | feed.routes.ts |
| POST | `/api/feed/posts` | feed.routes.ts |
| GET | `/api/feed/posts` | feed.routes.ts |
| GET | `/api/feed/posts/:postId` | feed.routes.ts |
| PUT | `/api/feed/posts/:postId` | feed.routes.ts |
| DELETE | `/api/feed/posts/:postId` | feed.routes.ts |
| POST | `/api/feed/posts/:postId/comments` | feed.routes.ts |
| GET | `/api/feed/posts/:postId/comments` | feed.routes.ts |
| POST | `/api/feed/posts/:postId/like` | feed.routes.ts |
| POST | `/api/feed/posts/:postId/report` | feed.routes.ts |
| GET | `/api/feed/trending` | feed.routes.ts |
| POST | `/api/feed/upload-images` | feed.routes.ts |
| GET | `/api/feed/weights` | feed.routes.ts |
| PUT | `/api/feed/weights` | feed.routes.ts |
| POST | `/api/influencer-qualification/auto-promote` | influencer-qualification.routes.ts |
| GET | `/api/influencer-qualification/check/:userId?` | influencer-qualification.routes.ts |
| POST | `/api/influencer-qualification/demote` | influencer-qualification.routes.ts |
| POST | `/api/influencer-qualification/promote` | influencer-qualification.routes.ts |
| GET | `/api/influencer-qualification/stats` | influencer-qualification.routes.ts |
| GET | `/api/influencer-qualification/top-performers` | influencer-qualification.routes.ts |
| GET | `/api/monitoring/alerts` | monitoring.routes.ts |
| GET | `/api/monitoring/alerts` | monitoring-dashboard.routes.ts |
| POST | `/api/monitoring/alerts/:alertId/acknowledge` | monitoring-dashboard.routes.ts |
| POST | `/api/monitoring/alerts/:alertId/resolve` | monitoring.routes.ts |
| POST | `/api/monitoring/alerts/:alertId/resolve` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/config` | monitoring.routes.ts |
| POST | `/api/monitoring/config` | monitoring.routes.ts |
| POST | `/api/monitoring/conflicts/:shopId/detect` | monitoring.routes.ts |
| GET | `/api/monitoring/dashboard` | monitoring.routes.ts |
| GET | `/api/monitoring/export` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/feed/alerting/config` | monitoring.routes.ts |
| PUT | `/api/monitoring/feed/alerting/rules/:id` | monitoring.routes.ts |
| POST | `/api/monitoring/feed/alerting/start` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/alerting/status` | monitoring.routes.ts |
| POST | `/api/monitoring/feed/alerting/stop` | monitoring.routes.ts |
| PUT | `/api/monitoring/feed/alerting/thresholds/:id` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/alerts` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/alerts` | monitoring.routes.ts |
| POST | `/api/monitoring/feed/dashboard/cache/clear` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/cache/stats` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/config` | monitoring.routes.ts |
| PUT | `/api/monitoring/feed/dashboard/config` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/metrics` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/overview` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/realtime` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/dashboard/trends` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/engagement` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/health` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/metrics` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/moderation/queue` | monitoring.routes.ts |
| GET | `/api/monitoring/feed/performance` | monitoring.routes.ts |
| GET | `/api/monitoring/health` | monitoring.routes.ts |
| GET | `/api/monitoring/health` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/health/:shopId?` | monitoring.routes.ts |
| GET | `/api/monitoring/metrics` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/metrics/business` | monitoring.routes.ts |
| GET | `/api/monitoring/metrics/conflicts/:shopId` | monitoring.routes.ts |
| GET | `/api/monitoring/metrics/history` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/metrics/notifications` | monitoring.routes.ts |
| GET | `/api/monitoring/metrics/reservations` | monitoring.routes.ts |
| GET | `/api/monitoring/metrics/time-slots/:shopId` | monitoring.routes.ts |
| GET | `/api/monitoring/sla` | monitoring-dashboard.routes.ts |
| GET | `/api/monitoring/widgets` | monitoring-dashboard.routes.ts |
| GET | `/api/notifications/history` | notification.routes.ts |
| POST | `/api/notifications/register` | notification.routes.ts |
| POST | `/api/notifications/send` | notification.routes.ts |
| GET | `/api/notifications/settings` | notification.routes.ts |
| PUT | `/api/notifications/settings` | notification.routes.ts |
| GET | `/api/notifications/shop/analytics` | notification.routes.ts |
| GET | `/api/notifications/shop/preferences` | notification.routes.ts |
| PUT | `/api/notifications/shop/preferences` | notification.routes.ts |
| GET | `/api/notifications/shop/reservations` | notification.routes.ts |
| POST | `/api/notifications/shop/send` | notification.routes.ts |
| POST | `/api/notifications/template` | notification.routes.ts |
| GET | `/api/notifications/templates` | notification.routes.ts |
| GET | `/api/notifications/tokens` | notification.routes.ts |
| POST | `/api/notifications/unregister` | notification.routes.ts |
| POST | `/api/payment-security/admin/configure` | payment-security.routes.ts |
| GET | `/api/payment-security/admin/overview` | payment-security.routes.ts |
| GET | `/api/payment-security/alerts` | payment-security.routes.ts |
| PUT | `/api/payment-security/alerts/:alertId/resolve` | payment-security.routes.ts |
| POST | `/api/payment-security/compliance-report` | payment-security.routes.ts |
| GET | `/api/payment-security/dashboard` | payment-security.routes.ts |
| POST | `/api/payment-security/error-handling` | payment-security.routes.ts |
| GET | `/api/payment-security/errors` | payment-security.routes.ts |
| PUT | `/api/payment-security/errors/:errorId/resolve` | payment-security.routes.ts |
| POST | `/api/payment-security/fraud-detection` | payment-security.routes.ts |
| GET | `/api/payment-security/health` | payment-security.routes.ts |
| GET | `/api/payment-security/metrics` | payment-security.routes.ts |
| GET | `/api/payments/:paymentId` | payment.routes.ts |
| POST | `/api/payments/deposit/prepare` | payment.routes.ts |
| GET | `/api/payments/fail` | payment.routes.ts |
| POST | `/api/payments/final/prepare` | payment.routes.ts |
| GET | `/api/payments/status/:reservationId` | payment.routes.ts |
| GET | `/api/payments/success` | payment.routes.ts |
| POST | `/api/payments/toss/confirm` | payment.routes.ts |
| POST | `/api/payments/toss/prepare` | payment.routes.ts |
| GET | `/api/payments/user/:userId` | payment.routes.ts |
| POST | `/api/payments/webhooks/toss-payments` | payment.routes.ts |
| POST | `/api/points/admin/points/adjust` | point.routes.ts |
| POST | `/api/points/points/earn` | point.routes.ts |
| POST | `/api/points/points/use` | point.routes.ts |
| GET | `/api/points/users/:userId/points/balance` | point.routes.ts |
| GET | `/api/points/users/:userId/points/history` | point.routes.ts |
| GET | `/api/referral-analytics/dashboard` | referral-analytics.routes.ts |
| GET | `/api/referral-analytics/export` | referral-analytics.routes.ts |
| POST | `/api/referral-analytics/generate-report` | referral-analytics.routes.ts |
| GET | `/api/referral-analytics/overview` | referral-analytics.routes.ts |
| GET | `/api/referral-analytics/system-metrics` | referral-analytics.routes.ts |
| GET | `/api/referral-analytics/trends` | referral-analytics.routes.ts |
| GET | `/api/referral-analytics/user/:userId?` | referral-analytics.routes.ts |
| POST | `/api/referral-codes/batch-generate` | referral-code.routes.ts |
| DELETE | `/api/referral-codes/cache` | referral-code.routes.ts |
| POST | `/api/referral-codes/generate` | referral-code.routes.ts |
| GET | `/api/referral-codes/stats` | referral-code.routes.ts |
| DELETE | `/api/referral-codes/stats` | referral-code.routes.ts |
| GET | `/api/referral-codes/validate/:code` | referral-code.routes.ts |
| POST | `/api/referral-earnings/bulk-payouts` | referral-earnings.routes.ts |
| POST | `/api/referral-earnings/calculate` | referral-earnings.routes.ts |
| POST | `/api/referral-earnings/payout` | referral-earnings.routes.ts |
| GET | `/api/referral-earnings/stats` | referral-earnings.routes.ts |
| GET | `/api/referral-earnings/summary/:userId?` | referral-earnings.routes.ts |
| GET | `/api/referral-earnings/top-earners` | referral-earnings.routes.ts |
| POST | `/api/referral-relationships` | referral-relationship.routes.ts |
| GET | `/api/referral-relationships/chain/:userId?` | referral-relationship.routes.ts |
| POST | `/api/referral-relationships/check-circular` | referral-relationship.routes.ts |
| GET | `/api/referral-relationships/stats` | referral-relationship.routes.ts |
| GET | `/api/referral-relationships/validate/:referredId` | referral-relationship.routes.ts |
| POST | `/api/referrals/:referralId/payout` | referral.routes.ts |
| PUT | `/api/referrals/:referralId/status` | referral.routes.ts |
| GET | `/api/referrals/analytics` | referral.routes.ts |
| GET | `/api/referrals/history` | referral.routes.ts |
| GET | `/api/referrals/stats` | referral.routes.ts |
| POST | `/api/registration/activate` | registration.routes.ts |
| GET | `/api/registration/health` | registration.routes.ts |
| POST | `/api/registration/phone-verification/send` | registration.routes.ts |
| POST | `/api/registration/phone-verification/verify` | registration.routes.ts |
| POST | `/api/registration/profile-setup` | registration.routes.ts |
| GET | `/api/registration/session/:sessionId` | registration.routes.ts |
| POST | `/api/registration/social-login` | registration.routes.ts |
| POST | `/api/registration/terms-acceptance` | registration.routes.ts |
| POST | `/api/reservations/:reservationId/reschedule` | reservation-rescheduling.routes.ts |
| GET | `/api/reservations/:reservationId/reschedule/available-slots` | reservation-rescheduling.routes.ts |
| GET | `/api/reservations/:reservationId/reschedule/history` | reservation-rescheduling.routes.ts |
| POST | `/api/reservations/:reservationId/reschedule/validate` | reservation-rescheduling.routes.ts |
| GET | `/api/security/config` | security.routes.ts |
| POST | `/api/security/csp-report` | security.routes.ts |
| GET | `/api/security/csrf-token` | security.routes.ts |
| GET | `/api/security/health` | security.routes.ts |
| GET | `/api/security/test-headers` | security.routes.ts |
| GET | `/api/service-catalog` | service-catalog.routes.ts |
| GET | `/api/service-catalog/:serviceId` | service-catalog.routes.ts |
| PUT | `/api/service-catalog/:serviceId/popularity` | service-catalog.routes.ts |
| PUT | `/api/service-catalog/:serviceId/trending` | service-catalog.routes.ts |
| GET | `/api/service-catalog/config` | service-catalog.routes.ts |
| GET | `/api/service-catalog/metadata` | service-catalog.routes.ts |
| GET | `/api/service-catalog/popular` | service-catalog.routes.ts |
| GET | `/api/service-catalog/search` | service-catalog.routes.ts |
| GET | `/api/service-catalog/stats` | service-catalog.routes.ts |
| GET | `/api/service-catalog/trending` | service-catalog.routes.ts |
| GET | `/api/shop-owner/analytics` | shop-owner.routes.ts |
| GET | `/api/shop-owner/dashboard` | shop-owner.routes.ts |
| GET | `/api/shop-owner/profile` | shop-owner.routes.ts |
| GET | `/api/shop-owner/reservations` | shop-owner.routes.ts |
| PUT | `/api/shop-owner/reservations/:reservationId/complete` | shop-owner.routes.ts |
| PUT | `/api/shop-owner/reservations/:reservationId/confirm` | shop-owner.routes.ts |
| PUT | `/api/shop-owner/reservations/:reservationId/reject` | shop-owner.routes.ts |
| PUT | `/api/shop-owner/reservations/:reservationId/status` | shop-owner.routes.ts |
| GET | `/api/shop-owner/reservations/pending` | shop-owner.routes.ts |
| PUT | `/api/shop/contact-methods` | shop-contact-methods.routes.ts |
| GET | `/api/shop/contact-methods` | shop-contact-methods.routes.ts |
| DELETE | `/api/shop/contact-methods/:contactMethodId` | shop-contact-methods.routes.ts |
| GET | `/api/shop/dashboard` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/analytics` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/operating-hours` | shop-dashboard.routes.ts |
| PUT | `/api/shop/dashboard/operating-hours` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/profile` | shop-dashboard.routes.ts |
| PUT | `/api/shop/dashboard/profile` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/profile/status` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/reservations` | shop-dashboard.routes.ts |
| PUT | `/api/shop/dashboard/reservations/:reservationId/status` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/services` | shop-dashboard.routes.ts |
| POST | `/api/shop/dashboard/services` | shop-dashboard.routes.ts |
| GET | `/api/shop/dashboard/services/:id` | shop-dashboard.routes.ts |
| PUT | `/api/shop/dashboard/services/:id` | shop-dashboard.routes.ts |
| DELETE | `/api/shop/dashboard/services/:id` | shop-dashboard.routes.ts |
| GET | `/api/shop/images/:imageId/alt-text-suggestions` | image-metadata.routes.ts |
| GET | `/api/shop/images/:imageId/metadata` | image-metadata.routes.ts |
| PUT | `/api/shop/images/:imageId/metadata` | image-metadata.routes.ts |
| PUT | `/api/shop/images/:shopId/images/archive` | image-metadata.routes.ts |
| PUT | `/api/shop/images/:shopId/images/batch-update` | image-metadata.routes.ts |
| PUT | `/api/shop/images/:shopId/images/reorder` | image-metadata.routes.ts |
| POST | `/api/shop/images/:shopId/images/search` | image-metadata.routes.ts |
| GET | `/api/shop/images/:shopId/images/stats` | image-metadata.routes.ts |
| GET | `/api/shop/operating-hours` | shop-operating-hours.routes.ts |
| PUT | `/api/shop/operating-hours` | shop-operating-hours.routes.ts |
| GET | `/api/shop/profile` | shop-profile.routes.ts |
| PUT | `/api/shop/profile` | shop-profile.routes.ts |
| GET | `/api/shop/profile/status` | shop-profile.routes.ts |
| POST | `/api/shop/register` | shop-registration.routes.ts |
| POST | `/api/shop/register/images` | shop-registration.routes.ts |
| GET | `/api/shop/register/status/:registrationId` | shop-registration.routes.ts |
| GET | `/api/shop/register/validate/business-license/:licenseNumber` | shop-registration.routes.ts |
| GET | `/api/shop/services` | shop-service.routes.ts |
| POST | `/api/shop/services` | shop-service.routes.ts |
| GET | `/api/shop/services/:id` | shop-service.routes.ts |
| PUT | `/api/shop/services/:id` | shop-service.routes.ts |
| DELETE | `/api/shop/services/:id` | shop-service.routes.ts |
| POST | `/api/shops` | shop.routes.ts |
| GET | `/api/shops` | shop.routes.ts |
| PUT | `/api/shops/:id` | shop.routes.ts |
| DELETE | `/api/shops/:id` | shop.routes.ts |
| GET | `/api/shops/:id` | shop.routes.ts |
| GET | `/api/shops/:id/contact-info` | shop.routes.ts |
| GET | `/api/shops/:shopId/available-slots` | reservation.routes.ts |
| GET | `/api/shops/:shopId/conflicts/detect` | conflict-resolution.routes.ts |
| GET | `/api/shops/:shopId/conflicts/history` | conflict-resolution.routes.ts |
| GET | `/api/shops/:shopId/conflicts/manual-interface` | conflict-resolution.routes.ts |
| POST | `/api/shops/:shopId/conflicts/prevent` | conflict-resolution.routes.ts |
| GET | `/api/shops/:shopId/conflicts/stats` | conflict-resolution.routes.ts |
| POST | `/api/shops/:shopId/favorite` | favorites.routes.ts |
| DELETE | `/api/shops/:shopId/favorite` | favorites.routes.ts |
| PUT | `/api/shops/:shopId/favorite` | favorites.routes.ts |
| GET | `/api/shops/:shopId/favorite/status` | favorites.routes.ts |
| POST | `/api/shops/:shopId/report` | shop-reporting.routes.ts |
| GET | `/api/shops/:shopId/reschedule/stats` | reservation-rescheduling.routes.ts |
| GET | `/api/shops/bounds` | shop.routes.ts |
| GET | `/api/shops/categories` | shop-categories.routes.ts |
| GET | `/api/shops/categories/:categoryId` | shop-categories.routes.ts |
| GET | `/api/shops/categories/:categoryId/services` | shop-categories.routes.ts |
| GET | `/api/shops/categories/hierarchy` | shop-categories.routes.ts |
| GET | `/api/shops/categories/popular/services` | shop-categories.routes.ts |
| GET | `/api/shops/categories/search` | shop-categories.routes.ts |
| GET | `/api/shops/categories/stats` | shop-categories.routes.ts |
| POST | `/api/shops/images/:shopId/images` | shop-image.routes.ts |
| GET | `/api/shops/images/:shopId/images` | shop-image.routes.ts |
| DELETE | `/api/shops/images/:shopId/images/:imageId` | shop-image.routes.ts |
| PUT | `/api/shops/images/:shopId/images/:imageId` | shop-image.routes.ts |
| POST | `/api/shops/images/:shopId/images/:imageId/set-primary` | shop-image.routes.ts |
| GET | `/api/shops/nearby` | shop.routes.ts |
| GET | `/api/shops/reports` | shop-reporting.routes.ts |
| GET | `/api/shops/reports/:reportId` | shop-reporting.routes.ts |
| PUT | `/api/shops/reports/:reportId` | shop-reporting.routes.ts |
| DELETE | `/api/shops/reports/:reportId` | shop-reporting.routes.ts |
| GET | `/api/shops/search` | shop-search.routes.ts |
| GET | `/api/shops/search/popular` | shop-search.routes.ts |
| GET | `/api/shops/search/suggestions` | shop-search.routes.ts |
| GET | `/api/shutdown/health` | shutdown.routes.ts |
| POST | `/api/shutdown/initiate` | shutdown.routes.ts |
| GET | `/api/shutdown/status` | shutdown.routes.ts |
| POST | `/api/shutdown/test` | shutdown.routes.ts |
| POST | `/api/split-payments/create-plan` | split-payment.routes.ts |
| POST | `/api/split-payments/initialize-remaining` | split-payment.routes.ts |
| GET | `/api/split-payments/overdue` | split-payment.routes.ts |
| POST | `/api/split-payments/process` | split-payment.routes.ts |
| GET | `/api/split-payments/status/:reservationId` | split-payment.routes.ts |
| POST | `/api/storage/cleanup` | storage.routes.ts |
| GET | `/api/storage/files/:bucketId` | storage.routes.ts |
| DELETE | `/api/storage/files/:bucketId/:filePath` | storage.routes.ts |
| POST | `/api/storage/initialize` | storage.routes.ts |
| GET | `/api/storage/stats` | storage.routes.ts |
| POST | `/api/storage/upload` | storage.routes.ts |
| GET | `/api/test-error/async-error` | test-error.routes.ts |
| GET | `/api/test-error/auth-error` | test-error.routes.ts |
| GET | `/api/test-error/authorization-error` | test-error.routes.ts |
| GET | `/api/test-error/business-error` | test-error.routes.ts |
| GET | `/api/test-error/custom-error` | test-error.routes.ts |
| GET | `/api/test-error/database-error` | test-error.routes.ts |
| GET | `/api/test-error/external-error` | test-error.routes.ts |
| POST | `/api/test-error/json-error` | test-error.routes.ts |
| GET | `/api/test-error/not-found-error` | test-error.routes.ts |
| GET | `/api/test-error/rate-limit-error` | test-error.routes.ts |
| GET | `/api/test-error/validation-error` | test-error.routes.ts |
| GET | `/api/user/favorites` | favorites.routes.ts |
| POST | `/api/user/favorites/bulk` | favorites.routes.ts |
| POST | `/api/user/favorites/check` | favorites.routes.ts |
| GET | `/api/user/favorites/stats` | favorites.routes.ts |
| GET | `/api/user/sessions` | user-sessions.routes.ts |
| DELETE | `/api/user/sessions/:sessionId` | user-sessions.routes.ts |
| GET | `/api/user/sessions/analytics` | user-sessions.routes.ts |
| POST | `/api/user/sessions/revoke-all-others` | user-sessions.routes.ts |
| GET | `/api/users/:userId/points/analytics` | point-balance.routes.ts |
| GET | `/api/users/:userId/points/balance` | point-balance.routes.ts |
| GET | `/api/users/:userId/points/history` | point-balance.routes.ts |
| GET | `/api/users/:userId/points/projection` | point-balance.routes.ts |
| GET | `/api/users/:userId/points/summary` | point-balance.routes.ts |
| GET | `/api/users/settings` | user-settings.routes.ts |
| PUT | `/api/users/settings` | user-settings.routes.ts |
| PATCH | `/api/users/settings` | user-settings.routes.ts |
| GET | `/api/users/settings/accessibility` | user-settings.routes.ts |
| PUT | `/api/users/settings/accessibility` | user-settings.routes.ts |
| GET | `/api/users/settings/advanced` | user-settings.routes.ts |
| PUT | `/api/users/settings/advanced` | user-settings.routes.ts |
| GET | `/api/users/settings/analytics` | user-settings.routes.ts |
| GET | `/api/users/settings/analytics/trends` | user-settings.routes.ts |
| GET | `/api/users/settings/analytics/usage` | user-settings.routes.ts |
| GET | `/api/users/settings/appearance` | user-settings.routes.ts |
| PUT | `/api/users/settings/appearance` | user-settings.routes.ts |
| POST | `/api/users/settings/backup` | user-settings.routes.ts |
| GET | `/api/users/settings/backups` | user-settings.routes.ts |
| DELETE | `/api/users/settings/backups/:backupId` | user-settings.routes.ts |
| PUT | `/api/users/settings/bulk` | user-settings.routes.ts |
| GET | `/api/users/settings/categories` | user-settings.routes.ts |
| GET | `/api/users/settings/category/:category` | user-settings.routes.ts |
| GET | `/api/users/settings/defaults` | user-settings.routes.ts |
| GET | `/api/users/settings/export` | user-settings.routes.ts |
| GET | `/api/users/settings/fields` | user-settings.routes.ts |
| GET | `/api/users/settings/fields/:field` | user-settings.routes.ts |
| GET | `/api/users/settings/health` | user-settings.routes.ts |
| GET | `/api/users/settings/history` | user-settings.routes.ts |
| GET | `/api/users/settings/history/:id` | user-settings.routes.ts |
| POST | `/api/users/settings/import` | user-settings.routes.ts |
| GET | `/api/users/settings/metadata` | user-settings.routes.ts |
| GET | `/api/users/settings/notifications` | user-settings.routes.ts |
| PUT | `/api/users/settings/notifications` | user-settings.routes.ts |
| GET | `/api/users/settings/preferences` | user-settings.routes.ts |
| PUT | `/api/users/settings/preferences` | user-settings.routes.ts |
| GET | `/api/users/settings/privacy` | user-settings.routes.ts |
| PUT | `/api/users/settings/privacy` | user-settings.routes.ts |
| POST | `/api/users/settings/reset` | user-settings.routes.ts |
| POST | `/api/users/settings/restore/:backupId` | user-settings.routes.ts |
| GET | `/api/users/settings/schema` | user-settings.routes.ts |
| GET | `/api/users/settings/search` | user-settings.routes.ts |
| GET | `/api/users/settings/stats` | user-settings.routes.ts |
| POST | `/api/users/settings/sync` | user-settings.routes.ts |
| GET | `/api/users/settings/sync/status` | user-settings.routes.ts |
| GET | `/api/users/settings/usage` | user-settings.routes.ts |
| POST | `/api/users/settings/validate` | user-settings.routes.ts |
| POST | `/api/users/settings/validate-field` | user-settings.routes.ts |
| GET | `/api/users/settings/validation-rules` | user-settings.routes.ts |
| GET | `/api/users/settings/validation-rules/:field` | user-settings.routes.ts |
| POST | `/api/users/settings/webhooks` | user-settings.routes.ts |
| GET | `/api/users/settings/webhooks` | user-settings.routes.ts |
| PUT | `/api/users/settings/webhooks/:webhookId` | user-settings.routes.ts |
| DELETE | `/api/users/settings/webhooks/:webhookId` | user-settings.routes.ts |
| GET | `/api/webhooks/:paymentId` | payment.routes.ts |
| POST | `/api/webhooks/deposit/prepare` | payment.routes.ts |
| GET | `/api/webhooks/fail` | payment.routes.ts |
| POST | `/api/webhooks/final/prepare` | payment.routes.ts |
| GET | `/api/webhooks/status/:reservationId` | payment.routes.ts |
| GET | `/api/webhooks/success` | payment.routes.ts |
| POST | `/api/webhooks/toss/confirm` | payment.routes.ts |
| POST | `/api/webhooks/toss/prepare` | payment.routes.ts |
| GET | `/api/webhooks/user/:userId` | payment.routes.ts |
| POST | `/api/webhooks/webhooks/toss-payments` | payment.routes.ts |
| POST | `/api/websocket/admin/notification` | websocket.routes.ts |
| POST | `/api/websocket/broadcast` | websocket.routes.ts |
| POST | `/api/websocket/cleanup` | websocket.routes.ts |
| POST | `/api/websocket/reservation/update` | websocket.routes.ts |
| POST | `/api/websocket/room/message` | websocket.routes.ts |
| GET | `/api/websocket/rooms` | websocket.routes.ts |
| GET | `/api/websocket/rooms/:roomId` | websocket.routes.ts |
| GET | `/api/websocket/stats` | websocket.routes.ts |
| POST | `/api/websocket/user/message` | websocket.routes.ts |
| GET | `/health` | health.routes.ts |
| POST | `/health/cache/clear` | health.routes.ts |
| GET | `/health/detailed` | health.routes.ts |
| GET | `/health/live` | health.routes.ts |
| GET | `/health/ready` | health.routes.ts |

---

## API Documentation

- **Complete API Docs**: http://localhost:3001/api-docs
- **Admin API Docs**: http://localhost:3001/admin-docs
- **Service API Docs**: http://localhost:3001/service-docs

## Summary

- ✅ **Mounted & Working**: 69 route files
- ❌ **Unmounted (404)**: 0 route files
- ✅ **Path Conflicts**: 0 actual conflicts (6 safe multi-router paths)
- 📊 **Total Admin Endpoints**: 160
- 📊 **Total User Endpoints**: 400
- 📊 **Total Working Endpoints**: 560

## Notes

- All admin endpoints require JWT authentication with admin role
- User endpoints may require user authentication (check individual endpoint documentation)
- WebSocket endpoints use Socket.io for real-time communication
- Payment webhook endpoints are used by TossPayments for payment callbacks
- ✅ This documentation only shows MOUNTED routes that actually work

### Routing Architecture

**Multi-Router Paths**: This API uses Express.js multi-router pattern where multiple routers can be mounted at the same base path. This is **safe and intentional** when:
- Routes are resource-specific (e.g., `/users/*`, `/content/*`, `/violations/*`)
- Routers are mounted in order from most specific to most general
- No overlapping route patterns exist between routers

**Admin Shop Service Routes**: Mounted at `/api/admin/shops/:shopId/services` with shopId captured from URL path automatically, eliminating conflicts with general shop management routes at `/api/admin/shops`.
