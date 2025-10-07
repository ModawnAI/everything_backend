const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const outputFile = path.join(__dirname, 'API_ENDPOINTS.md');

// Route mounting paths from app.ts
const routeMounts = {
  'auth.routes': '/api/auth',
  'registration.routes': '/api/registration',
  'user-status.routes': '/api/admin',
  'shop.routes': '/api/shops',
  'shop-image.routes': '/api/shops/images',
  'admin-shop.routes': '/api/admin/shops',
  'admin-shop-approval.routes': '/api/admin/shops/approval',
  'admin-reservation.routes': '/api/admin/reservations',
  'shop-owner.routes': '/api/shop-owner',
  'storage.routes': '/api/storage',
  'reservation.routes': '/api',
  'no-show-detection.routes': '/api/admin/no-show',
  'reservation-rescheduling.routes': '/api',
  'conflict-resolution.routes': '/api',
  'payment.routes': ['/api/payments', '/api/webhooks'],
  'split-payment.routes': '/api/split-payments',
  'point.routes': '/api/points',
  'point-balance.routes': '/api',
  'point-processing.routes': '/api/admin/point-processing',
  'payment-security.routes': '/api/payment-security',
  'influencer-bonus.routes': '/api',
  'admin-adjustment.routes': '/api',
  'admin-payment.routes': '/api/admin/payments',
  'admin-analytics.routes': '/api/admin/analytics',
  'admin-reservation.routes': '/api/admin/reservations',
  'admin-shop-approval.routes': '/api/admin/shops/approval',
  'admin-shop.routes': '/api/admin/shops',
  'admin-user-management.routes': '/api/admin/users',
  'admin-financial.routes': '/api/admin/financial',
  'ip-blocking.routes': '/api/admin',
  'security.routes': '/api/security',
  'notification.routes': '/api/notifications',
  'websocket.routes': '/api/websocket',
  'test-error.routes': '/api/test-error',
  'health.routes': '/health',
  'admin-auth.routes': '/api/admin/auth',
  'admin-user-management.routes': '/api/admin/users',
  'cache.routes': '/api/cache',
  'monitoring.routes': '/api/monitoring',
  'monitoring-dashboard.routes': '/api/monitoring',
  'shutdown.routes': '/api/shutdown',
  'user-sessions.routes': '/api/user/sessions',
  'admin-security.routes': '/api/admin/security',
  'admin-security-enhanced.routes': '/api/admin/security-enhanced',
  'admin-security-events.routes': '/api/admin/security-events',
  'auth-analytics.routes': '/api/analytics/auth',
  'referral-code.routes': '/api/referral-codes',
  'referral-relationship.routes': '/api/referral-relationships',
  'influencer-qualification.routes': '/api/influencer-qualification',
  'referral-earnings.routes': '/api/referral-earnings',
  'referral-analytics.routes': '/api/referral-analytics',
  'user-settings.routes': '/api/users',
  'shop-registration.routes': '/api/shop/register',
  'shop-search.routes': '/api/shops/search',
  'shop-profile.routes': '/api/shop/profile',
  'shop-service.routes': '/api/shop/services',
  'shop-operating-hours.routes': '/api/shop/operating-hours',
  'shop-dashboard.routes': '/api/shop/dashboard',
  'image-metadata.routes': '/api/shop/images',
  'cdn.routes': '/api/cdn',
  'favorites.routes': '/api',
  'shop-contact-methods.routes': '/api/shop',
  'shop-reporting.routes': '/api/shops',
  'admin-moderation.routes': '/api/admin',
  'shop-categories.routes': '/api/shops/categories',
  'service-catalog.routes': '/api/service-catalog',
  'feed.routes': '/api/feed',
  'csrf.routes': '/api/csrf'
};

const adminEndpoints = [];
const userEndpoints = [];

function extractEndpoints(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  // Try exact match first, then try without .ts extension
  const basePath = routeMounts[fileName] || routeMounts[fileName.replace('.ts', '')] || '/api';

  const isAdmin = fileName.startsWith('admin-') || basePath.includes('/admin');

  const methodRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  const endpoints = [];

  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let route = match[2];

    // Handle multiple mount paths
    const mounts = Array.isArray(basePath) ? basePath : [basePath];

    mounts.forEach(mount => {
      const fullPath = route === '/' ? mount : `${mount}${route}`;
      endpoints.push({ method, path: fullPath, file: fileName });
    });
  }

  return { isAdmin, endpoints };
}

// Read all route files
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const { isAdmin, endpoints } = extractEndpoints(filePath);

  if (isAdmin) {
    adminEndpoints.push(...endpoints);
  } else {
    userEndpoints.push(...endpoints);
  }
});

// Also check admin subfolder
const adminDir = path.join(routesDir, 'admin');
if (fs.existsSync(adminDir)) {
  const adminFiles = fs.readdirSync(adminDir).filter(f => f.endsWith('.routes.ts'));
  adminFiles.forEach(file => {
    const filePath = path.join(adminDir, file);
    const { endpoints } = extractEndpoints(filePath);
    adminEndpoints.push(...endpoints);
  });
}

// Sort endpoints
adminEndpoints.sort((a, b) => a.path.localeCompare(b.path));
userEndpoints.sort((a, b) => a.path.localeCompare(b.path));

// Generate markdown
let markdown = `# 에뷰리띵 Backend API Endpoints

> Auto-generated on ${new Date().toISOString()}

## Table of Contents
- [Admin Endpoints](#admin-endpoints) (${adminEndpoints.length} endpoints)
- [User/Public Endpoints](#userpublic-endpoints) (${userEndpoints.length} endpoints)

---

## Admin Endpoints

These endpoints require admin authentication and are accessible through the admin panel.

| Method | Endpoint | Source File |
|--------|----------|-------------|
`;

adminEndpoints.forEach(ep => {
  markdown += `| ${ep.method} | \`${ep.path}\` | ${ep.file} |\n`;
});

markdown += `\n---\n\n## User/Public Endpoints\n\nThese endpoints are used by the Flutter mobile app and public-facing services.\n\n| Method | Endpoint | Source File |\n|--------|----------|-------------|\n`;

userEndpoints.forEach(ep => {
  markdown += `| ${ep.method} | \`${ep.path}\` | ${ep.file} |\n`;
});

markdown += `\n---\n\n## API Documentation\n\n- **Complete API Docs**: http://localhost:3001/api-docs\n- **Admin API Docs**: http://localhost:3001/admin-docs\n- **Service API Docs**: http://localhost:3001/service-docs\n\n## Notes\n\n- All admin endpoints require JWT authentication with admin role\n- User endpoints may require user authentication (check individual endpoint documentation)\n- WebSocket endpoints use Socket.io for real-time communication\n- Payment webhook endpoints are used by TossPayments for payment callbacks\n`;

fs.writeFileSync(outputFile, markdown);
console.log(`✅ Endpoint documentation generated: ${outputFile}`);
console.log(`📊 Admin Endpoints: ${adminEndpoints.length}`);
console.log(`📊 User Endpoints: ${userEndpoints.length}`);
console.log(`📊 Total Endpoints: ${adminEndpoints.length + userEndpoints.length}`);
