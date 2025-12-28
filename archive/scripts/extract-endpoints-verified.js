const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const outputFile = path.join(__dirname, 'API_ENDPOINTS.md');
const appTsPath = path.join(__dirname, 'src', 'app.ts');

// Parse app.ts to get actual mounted routes
function parseAppTsMountings() {
  const appContent = fs.readFileSync(appTsPath, 'utf-8');
  const mountings = new Map();
  const conflicts = new Map();

  // Extract all app.use() statements with routes
  const useRegex = /app\.use\(['"]([^'"]+)['"],\s*(\w+)\)/g;
  let match;

  while ((match = useRegex.exec(appContent)) !== null) {
    const [, mountPath, routeVar] = match;

    // Convert route variable to filename (e.g., authRoutes -> auth.routes.ts)
    const fileName = routeVar
      .replace(/Routes$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '') + '.routes.ts';

    // Track conflicts (same path, different files)
    if (mountings.has(fileName)) {
      const existing = mountings.get(fileName);
      if (Array.isArray(existing)) {
        existing.push(mountPath);
      } else {
        mountings.set(fileName, [existing, mountPath]);
      }
    } else {
      mountings.set(fileName, mountPath);
    }

    // Track path conflicts (same mountPath, different files)
    if (!conflicts.has(mountPath)) {
      conflicts.set(mountPath, []);
    }
    conflicts.get(mountPath).push(fileName);
  }

  return { mountings, conflicts };
}

function extractEndpoints(filePath, basePaths) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const methodRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const endpoints = [];

  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];

    // Handle multiple mount paths (if file is mounted twice)
    const paths = Array.isArray(basePaths) ? basePaths : [basePaths];

    paths.forEach(basePath => {
      const fullPath = route === '/' ? basePath : `${basePath}${route}`;
      endpoints.push({ method, path: fullPath, file: fileName });
    });
  }

  return endpoints;
}

// Parse app.ts
const { mountings, conflicts } = parseAppTsMountings();

// Get all route files
const allFiles = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.routes.ts'))
  .filter(f => !f.includes('.d.ts'));

// Check admin subfolder
const adminDir = path.join(routesDir, 'admin');
if (fs.existsSync(adminDir)) {
  const adminFiles = fs.readdirSync(adminDir)
    .filter(f => f.endsWith('.routes.ts'))
    .map(f => `admin/${f}`);
  allFiles.push(...adminFiles);
}

const unmountedFiles = allFiles.filter(f => !mountings.has(path.basename(f)));
const adminEndpoints = [];
const userEndpoints = [];

// Extract endpoints only from MOUNTED routes
for (const [fileName, basePath] of mountings.entries()) {
  const filePath = fileName.includes('/')
    ? path.join(routesDir, fileName)
    : path.join(routesDir, fileName);

  if (!fs.existsSync(filePath)) continue;

  const endpoints = extractEndpoints(filePath, basePath);
  const isAdmin = fileName.startsWith('admin-') ||
                  (typeof basePath === 'string' && basePath.includes('/admin')) ||
                  (Array.isArray(basePath) && basePath.some(p => p.includes('/admin')));

  if (isAdmin) {
    adminEndpoints.push(...endpoints);
  } else {
    userEndpoints.push(...endpoints);
  }
}

// Sort
adminEndpoints.sort((a, b) => a.path.localeCompare(b.path));
userEndpoints.sort((a, b) => a.path.localeCompare(b.path));

// Find path conflicts
const pathConflicts = Array.from(conflicts.entries())
  .filter(([, files]) => files.length > 1);

// Generate markdown with warnings
let markdown = `# 에뷰리띵 Backend API Endpoints

> Auto-generated on ${new Date().toISOString()}
> ✅ Verified against app.ts route mounting

## ⚠️ WARNINGS

`;

if (unmountedFiles.length > 0) {
  markdown += `### 🔴 Unmounted Routes (These endpoints DON'T WORK!)

The following route files exist but are NOT mounted in app.ts:

`;
  unmountedFiles.forEach(f => {
    markdown += `- ❌ \`${f}\` - Endpoints will return 404\n`;
  });
  markdown += `\n**Action Required**: Add these routes to app.ts or remove the files.\n\n`;
}

if (pathConflicts.length > 0) {
  markdown += `### ⚠️ Path Conflicts (Multiple routers at same path)

The following paths have multiple route files mounted:

`;
  pathConflicts.forEach(([path, files]) => {
    markdown += `\n**\`${path}\`** - ${files.length} routers:\n`;
    files.forEach(f => markdown += `  - ${f}\n`);
  });
  markdown += `\n**Risk**: Routes may conflict or have unpredictable behavior.\n\n`;
}

markdown += `---

## Table of Contents
- [Admin Endpoints](#admin-endpoints) (${adminEndpoints.length} endpoints)
- [User/Public Endpoints](#userpublic-endpoints) (${userEndpoints.length} endpoints)
${unmountedFiles.length > 0 ? '- ⚠️ [Unmounted Routes](#warnings) - NOT WORKING!\n' : ''}

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

markdown += `\n---\n\n## API Documentation

- **Complete API Docs**: http://localhost:3001/api-docs
- **Admin API Docs**: http://localhost:3001/admin-docs
- **Service API Docs**: http://localhost:3001/service-docs

## Summary

- ✅ **Mounted & Working**: ${mountings.size} route files
- ❌ **Unmounted (404)**: ${unmountedFiles.length} route files
- ⚠️ **Path Conflicts**: ${pathConflicts.length} paths
- 📊 **Total Admin Endpoints**: ${adminEndpoints.length}
- 📊 **Total User Endpoints**: ${userEndpoints.length}
- 📊 **Total Working Endpoints**: ${adminEndpoints.length + userEndpoints.length}

## Notes

- All admin endpoints require JWT authentication with admin role
- User endpoints may require user authentication (check individual endpoint documentation)
- WebSocket endpoints use Socket.io for real-time communication
- Payment webhook endpoints are used by TossPayments for payment callbacks
- ✅ This documentation only shows MOUNTED routes that actually work
`;

fs.writeFileSync(outputFile, markdown);

console.log(`✅ Endpoint documentation generated: ${outputFile}`);
console.log(`📊 Mounted Routes: ${mountings.size}`);
console.log(`📊 Admin Endpoints: ${adminEndpoints.length}`);
console.log(`📊 User Endpoints: ${userEndpoints.length}`);
console.log(`📊 Total Working Endpoints: ${adminEndpoints.length + userEndpoints.length}`);

if (unmountedFiles.length > 0) {
  console.log(`\n⚠️  WARNING: ${unmountedFiles.length} unmounted route files found!`);
  unmountedFiles.forEach(f => console.log(`   ❌ ${f}`));
}

if (pathConflicts.length > 0) {
  console.log(`\n⚠️  WARNING: ${pathConflicts.length} path conflicts found!`);
  pathConflicts.forEach(([path, files]) => {
    console.log(`   ⚠️  ${path} (${files.length} routers)`);
  });
}
