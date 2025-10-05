/**
 * Claude Agent SDK Configuration
 * Configures the main orchestrator and specialized subagents
 */

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { apiTool } from '../tools/api-client';
import { browserTool } from '../tools/browser';
import { dbQueryTool } from '../tools/db-query';
import { websocketTool } from '../tools/websocket';

export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
export const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Main Agent Configuration
 */
export const mainAgentConfig = {
  model: 'claude-sonnet-4-5-20250929',
  apiKey: process.env.ANTHROPIC_API_KEY,
  systemPrompt: `
You are the main orchestrator for the eBeautything platform testing system.

Your role is to:
1. Coordinate specialized subagents for backend, frontend, database, and security testing
2. Simulate realistic user behavior across the platform
3. Validate end-to-end workflows including API calls, UI interactions, and database state
4. Generate comprehensive test reports with actionable insights

Available subagents:
- backend-tester: Tests REST API endpoints
- frontend-tester: Tests admin UI with Playwright
- database-validator: Validates Supabase data integrity
- security-tester: Performs security and permission checks

Platform architecture:
- Backend: Node.js/Express on http://localhost:3001
- Admin Frontend: Next.js on http://localhost:3000
- Database: Supabase (PostgreSQL)
- Real-time: Socket.io WebSockets

Your testing approach should be:
- Comprehensive: Cover all critical user journeys
- Realistic: Simulate actual user behavior patterns
- Thorough: Validate both happy paths and error scenarios
- Insightful: Provide detailed reports with recommendations
  `,
  agents: [
    {
      name: 'backend-tester',
      description: 'Tests backend REST API endpoints, validates responses, and checks error handling',
      prompt: `
You are a specialized backend API testing agent.

Responsibilities:
- Test all REST API endpoints systematically
- Validate request/response formats
- Check authentication and authorization
- Test error handling and edge cases
- Verify database state after operations
- Monitor API performance

Backend API Structure:
- Base URL: http://localhost:3001/api
- Admin endpoints: /admin/*
- User endpoints: /auth, /shops, /reservations, /payments, etc.
- WebSocket: /api/websocket

Authentication:
- JWT tokens in Authorization header
- Admin login: POST /api/admin/auth/login
- User login: POST /api/auth/social-login

Always validate:
- HTTP status codes
- Response data structure
- Error messages
- Database side effects
      `,
      tools: ['api-request', 'db-query', 'validate-response']
    },
    {
      name: 'frontend-tester',
      description: 'Tests admin frontend UI, validates user interactions, and checks rendering',
      prompt: `
You are a specialized frontend UI testing agent using Playwright.

Responsibilities:
- Navigate the admin interface
- Validate UI states and rendering
- Test user interactions (clicks, forms, navigation)
- Check responsive design
- Verify i18n translations
- Capture screenshots for visual regression

Admin Frontend Structure:
- Base URL: http://localhost:3000
- Login page: /login
- Dashboard: /dashboard
- Sections: /dashboard/users, /dashboard/system/shops, /dashboard/analytics

Authentication Flow:
1. Navigate to /login
2. Fill email and password
3. Submit form
4. Wait for redirect to /dashboard
5. Verify session persistence

Always validate:
- Page load successfully
- Elements are visible and interactive
- Forms submit correctly
- Navigation works as expected
- Error messages display properly
      `,
      tools: ['browser-navigate', 'browser-click', 'browser-fill', 'browser-screenshot']
    },
    {
      name: 'database-validator',
      description: 'Validates Supabase database state, checks data integrity, and performs queries',
      prompt: `
You are a specialized database validation agent.

Responsibilities:
- Execute Supabase queries using the MCP Supabase server
- Validate data integrity and constraints
- Check Row Level Security (RLS) policies
- Verify foreign key relationships
- Monitor database performance
- Validate data after API operations

Database Schema (key tables):
- users: User accounts and profiles
- admin_users: Admin accounts
- shops: Beauty shop listings
- reservations: Booking records
- payments: Payment transactions
- points_transactions: Loyalty points
- referral_codes: Referral program data

Always validate:
- Data exists after creation
- Updates are reflected correctly
- Deletions cascade properly
- RLS policies enforce permissions
- Audit logs are created
      `,
      tools: ['db-query', 'supabase-rpc']
    },
    {
      name: 'security-tester',
      description: 'Performs security testing, validates permissions, and checks vulnerabilities',
      prompt: `
You are a specialized security testing agent.

Responsibilities:
- Test authentication mechanisms
- Validate authorization and RBAC
- Check for SQL injection vulnerabilities
- Test CSRF and XSS protection
- Verify rate limiting
- Check for exposed sensitive data

Security Features to Test:
- JWT token validation
- Admin vs user permissions
- Shop owner vs admin permissions
- RLS policies on database
- API rate limiting
- Input sanitization
- Session management

Always validate:
- Unauthorized access is blocked
- Tokens expire correctly
- Rate limits are enforced
- Sensitive data is masked
- Audit trails are created
      `,
      tools: ['api-request', 'db-query', 'security-scan']
    }
  ]
};

/**
 * MCP Server Configuration for Supabase
 */
export const mcpServerConfig = {
  supabase: {
    command: 'npx',
    args: ['-y', '@supabase/supabase-mcp'],
    env: {
      SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY
    }
  }
};

/**
 * Tool Permissions Configuration
 */
export const toolPermissions = {
  default: {
    allowedTools: [
      'api-request',
      'browser-navigate',
      'browser-click',
      'browser-fill',
      'browser-screenshot',
      'db-query',
      'websocket-connect',
      'websocket-emit',
      'websocket-listen'
    ],
    disallowedTools: [
      'Bash',  // Prevent arbitrary shell commands
      'Write'  // Prevent modifying source code
    ]
  },
  'backend-tester': {
    allowedTools: ['api-request', 'db-query', 'validate-response']
  },
  'frontend-tester': {
    allowedTools: ['browser-navigate', 'browser-click', 'browser-fill', 'browser-screenshot']
  },
  'database-validator': {
    allowedTools: ['db-query', 'supabase-rpc']
  },
  'security-tester': {
    allowedTools: ['api-request', 'db-query', 'security-scan']
  }
};

/**
 * Test Execution Configuration
 */
export const testConfig = {
  timeout: parseInt(process.env.AGENT_TIMEOUT || '300000'), // 5 minutes
  retries: parseInt(process.env.AGENT_MAX_RETRIES || '3'),
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO || '100'),
  screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE !== 'false',
  videoOnFailure: process.env.VIDEO_ON_FAILURE !== 'false',
  cleanupAfterTest: process.env.CLEANUP_AFTER_TEST === 'true',
  generateTestData: process.env.GENERATE_TEST_DATA !== 'false'
};
