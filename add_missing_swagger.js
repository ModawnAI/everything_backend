const fs = require('fs');
const path = require('path');

// Mapping of route patterns to appropriate tags
const routeTagMapping = {
  'auth': 'Authentication',
  'user': 'Users', 
  'shop': 'Shops',
  'reservation': 'Reservations',
  'payment': 'Payments',
  'admin': 'Admin - Users',
  'admin-shop': 'Admin - Shops',
  'admin-analytics': 'Admin - Analytics',
  'admin-payment': 'Admin - Payments',
  'admin-reservation': 'Admin - Reservations',
  'notification': 'Notifications',
  'storage': 'Storage',
  'point': 'Points & Rewards',
  'referral': 'Points & Rewards',
  'websocket': 'WebSocket',
  'monitoring': 'System',
  'health': 'System',
  'cache': 'System'
};

// Function to determine appropriate tag for a route file
function getTagForFile(fileName) {
  const baseName = fileName.replace('.routes.ts', '');
  
  for (const [pattern, tag] of Object.entries(routeTagMapping)) {
    if (baseName.includes(pattern)) {
      return tag;
    }
  }
  
  return 'System'; // Default tag
}

// Function to generate basic Swagger documentation
function generateSwaggerDoc(method, path, tag, fileName) {
  const methodUpper = method.toUpperCase();
  const summary = `${methodUpper} ${path}`;
  const description = `${methodUpper} endpoint for ${path}`;
  
  // Determine if authentication is likely required
  const requiresAuth = !path.includes('/health') && !path.includes('/webhook') && !fileName.includes('test-error');
  
  let swaggerDoc = `/**
 * @swagger
 * ${path}:
 *   ${method}:
 *     summary: ${summary}
 *     description: ${description}
 *     tags: [${tag}]`;

  if (requiresAuth) {
    swaggerDoc += `
 *     security:
 *       - bearerAuth: []`;
  }

  // Add basic parameters for path variables
  const pathParams = path.match(/\{(\w+)\}/g);
  if (pathParams) {
    swaggerDoc += `
 *     parameters:`;
    pathParams.forEach(param => {
      const paramName = param.slice(1, -1); // Remove { }
      swaggerDoc += `
 *       - in: path
 *         name: ${paramName}
 *         required: true
 *         schema:
 *           type: string
 *         description: ${paramName}`;
    });
  }

  swaggerDoc += `
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error`;

  if (requiresAuth) {
    swaggerDoc += `
 *       401:
 *         description: Authentication required`;
  }

  swaggerDoc += `
 */`;

  return swaggerDoc;
}

// Function to add Swagger docs to a route file
function addSwaggerToFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const tag = getTagForFile(fileName);
  
  let updatedContent = content;
  const lines = content.split('\n');
  
  // Find router method calls that don't have @swagger docs
  const routerMethods = ['get', 'post', 'put', 'delete', 'patch'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line has a router method call
    const routerMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (routerMatch) {
      const method = routerMatch[1];
      const routePath = routerMatch[2];
      
      // Check if there's already a @swagger comment above (within 50 lines)
      let hasSwagger = false;
      for (let j = Math.max(0, i - 50); j < i; j++) {
        if (lines[j] && lines[j].includes('@swagger')) {
          hasSwagger = true;
          break;
        }
      }
      
      // If no @swagger found, add it
      if (!hasSwagger) {
        const swaggerDoc = generateSwaggerDoc(method, routePath, tag, fileName);
        
        // Find the best place to insert (look for existing comment block or add before router call)
        let insertIndex = i;
        
        // Look backwards for existing comment block
        for (let k = i - 1; k >= 0; k--) {
          if (lines[k].trim().startsWith('/**') || lines[k].trim().startsWith('//')) {
            insertIndex = k;
          } else if (lines[k].trim() === '') {
            continue;
          } else {
            break;
          }
        }
        
        // Insert the swagger documentation
        const swaggerLines = swaggerDoc.split('\n');
        lines.splice(insertIndex, 0, '', ...swaggerLines);
        i += swaggerLines.length + 1; // Adjust index for inserted lines
      }
    }
  }
  
  return lines.join('\n');
}

// Process ALL remaining route files
const routesDir = 'src/routes';
const allRouteFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.ts') && file !== 'index.ts')
  .map(file => path.join(routesDir, file));

console.log('Adding Swagger documentation to ALL route files...\n');

allRouteFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Processing: ${filePath}`);
    try {
      const updatedContent = addSwaggerToFile(filePath);
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✅ Updated: ${filePath}`);
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('\nAll route files processed! All endpoints should now be documented in Swagger.');
