/**
 * Agent Orchestrator using Claude Agent SDK
 * Main agent that coordinates testing of eBeautything platform
 */

import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  apiRequest,
  validateResponse as validateApiResponse
} from './tools/api-client';
import {
  browserNavigate,
  browserFill,
  browserClick,
  browserScreenshot,
  closeBrowser
} from './tools/browser';
import { BACKEND_URL, ADMIN_URL } from './config/agent.config';
import { BACKEND_ENDPOINTS, ADMIN_FRONTEND_ROUTES, TEST_CREDENTIALS } from './config/api.config';
import { logger } from './utils/logger';

/**
 * Create MCP server with custom tools for the agent
 */
let mcpServerInstance: ReturnType<typeof createSdkMcpServer> | null = null;

function createTestingMcpServer() {
  if (mcpServerInstance) {
    return mcpServerInstance;
  }

  mcpServerInstance = createSdkMcpServer({
    name: 'ebeautything-testing-tools',
    version: '1.0.0',
    tools: [
      // API testing tool
      tool(
        'api-test',
        'Make HTTP request to backend API and validate response',
        {
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
          endpoint: z.string().describe('API endpoint path (e.g., /api/admin/auth/login)'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
          body: z.any().optional().describe('Request body'),
          params: z.record(z.string()).optional().describe('Query parameters'),
          expectedStatus: z.number().optional().describe('Expected HTTP status code'),
          validateFormat: z.enum(['success', 'error', 'paginated']).optional()
        },
        async (input) => {
        const response = await apiRequest({
          method: input.method,
          endpoint: input.endpoint,
          headers: input.headers,
          body: input.body,
          params: input.params
        });

        let validation = null;
        if (input.expectedStatus || input.validateFormat) {
          validation = await validateApiResponse({
            response,
            expectedStatus: input.expectedStatus,
            expectedFormat: input.validateFormat
          });
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: response.success,
              status: response.status,
              data: response.data,
              validation,
              executionTime: response.executionTime
            }, null, 2)
          }]
        };
        }
      ),

      // Browser automation tool
      tool(
        'browser-interact',
        'Interact with the admin frontend using Playwright',
        {
          action: z.enum(['navigate', 'fill', 'click', 'screenshot']),
          url: z.string().optional().describe('URL to navigate to'),
          selector: z.string().optional().describe('Element selector'),
          value: z.string().optional().describe('Value to fill'),
          screenshotName: z.string().optional().describe('Screenshot filename'),
          fullPage: z.boolean().optional().default(true)
        },
        async (input) => {
        let result: any;

        switch (input.action) {
          case 'navigate':
            result = await browserNavigate({
              url: input.url!,
              waitUntil: 'networkidle',
              timeout: 10000
            });
            break;

          case 'fill':
            result = await browserFill({
              selector: input.selector!,
              value: input.value!
            });
            break;

          case 'click':
            result = await browserClick({
              selector: input.selector!
            });
            break;

          case 'screenshot':
            result = await browserScreenshot({
              name: input.screenshotName || 'screenshot',
              fullPage: input.fullPage
            });
            break;

          default:
            result = { success: false, error: 'Unknown action' };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
        }
      ),

      // Test scenario execution tool
      tool(
        'run-test-scenario',
        'Execute a predefined test scenario',
        {
          scenario: z.enum([
            'admin-login-flow',
            'shop-approval-flow',
            'user-management-flow',
            'full-admin-workflow'
          ]),
          includeValidation: z.boolean().optional().default(true),
          captureScreenshots: z.boolean().optional().default(true)
        },
        async (input) => {
        logger.info(`Executing scenario: ${input.scenario}`);

        const results: any[] = [];

        // This would execute the specific scenario
        // For now, we'll return a placeholder
        results.push({
          scenario: input.scenario,
          status: 'initiated',
          timestamp: new Date().toISOString()
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              scenario: input.scenario,
              results,
              summary: `Scenario ${input.scenario} execution initiated`
            }, null, 2)
          }]
        };
        }
      )
    ]
  });

  return mcpServerInstance;
}

/**
 * Get agent configuration
 */
function getAgentOptions() {
  return {
    systemPrompt: {
    type: 'preset' as const,
    preset: 'claude_code' as const,
    append: `
You are an advanced testing orchestrator for the eBeautything platform.

## Platform Architecture
- **Backend API**: ${BACKEND_URL} (Node.js/Express/TypeScript)
- **Admin Frontend**: ${ADMIN_URL} (Next.js/React)
- **Database**: ${process.env.SUPABASE_URL} (Supabase/PostgreSQL)

## Your Role
You coordinate comprehensive end-to-end testing across:
1. Backend API endpoints (authentication, CRUD operations, business logic)
2. Admin frontend UI (Playwright browser automation)
3. Database state validation (Supabase queries)
4. Real-time WebSocket functionality

## Available Tools
1. **api-test**: Make HTTP requests to backend API with validation
2. **browser-interact**: Automate frontend UI interactions with Playwright
3. **mcp__supabase__execute_sql**: Execute SQL queries on Supabase database
4. **mcp__supabase__list_tables**: List all tables in the database
5. **run-test-scenario**: Execute predefined test scenarios

Use the Supabase MCP tools for database validation and queries.

## Testing Approach
- **Comprehensive**: Test all critical user flows end-to-end
- **Realistic**: Simulate actual user behavior patterns
- **Data-driven**: Validate API responses and database state
- **Visual**: Capture screenshots for UI validation
- **Performance-aware**: Monitor response times

## Test Credentials
- Admin: ${TEST_CREDENTIALS.admin.email} / ${TEST_CREDENTIALS.admin.password}
- Super Admin: ${TEST_CREDENTIALS.superAdmin.email} / ${TEST_CREDENTIALS.superAdmin.password}

## Key Workflows to Test
1. Admin Login Flow (API + Frontend)
2. Shop Approval/Rejection
3. User Management (Ban/Restore)
4. Analytics Dashboard
5. Payment Reconciliation

Always validate both the API response and the database state after operations.
Capture screenshots at key points for visual validation.
Provide detailed, actionable test reports.
`
  },
  mcpServers: {
    'supabase': {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', '@supabase/supabase-mcp'],
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      }
    }
  },
  allowedTools: [
    'api-test',
    'browser-interact',
    'run-test-scenario',
    // Supabase MCP tools (will be auto-discovered)
    'mcp__supabase__execute_sql',
    'mcp__supabase__list_tables'
  ],
    permissionMode: 'bypassPermissions' as const,
    model: 'claude-sonnet-4-5-20250929'
  };
}

/**
 * Main agent orchestrator function
 */
export async function runAgentOrchestrator(testPrompt: string) {
  logger.info('🤖 Starting Agent Orchestrator');
  logger.info('Test Prompt:', { prompt: testPrompt });

  try {
    const agentOptions = getAgentOptions();
    const agentQuery = query({
      prompt: testPrompt,
      options: agentOptions
    });

    const messages: any[] = [];

    for await (const message of agentQuery) {
      messages.push(message);

      if (message.type === 'assistant') {
        const textContent = message.message.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');

        if (textContent) {
          logger.info('Agent Response:', {
            text: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : '')
          });
        }
      }

      if (message.type === 'result') {
        const resultOutput = JSON.stringify(message.result.content) || '';
        logger.info('Tool Result:', {
          tool: message.result.tool_use_id,
          output: resultOutput.substring(0, 300)
        });
      }
    }

    logger.info('✅ Agent orchestrator completed successfully');

    return {
      success: true,
      messages,
      summary: 'Test execution completed'
    };

  } catch (error: any) {
    logger.error('❌ Agent orchestrator failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };
  } finally {
    // Cleanup
    await closeBrowser();
  }
}

/**
 * Predefined test scenarios
 */
export const testScenarios = {
  fullSystemTest: `
Execute a comprehensive end-to-end test of the eBeautything platform:

1. **Backend API Health Check**
   - Test /health endpoint
   - Verify backend is running on port 3001

2. **Admin Authentication Flow**
   - Login via POST ${BACKEND_ENDPOINTS.admin.auth.login}
   - Validate JWT token structure
   - Check admin user data in database
   - Test session validation endpoint
   - Test logout

3. **Admin Frontend Login**
   - Navigate to ${ADMIN_URL}/login
   - Fill login form with admin credentials
   - Submit and verify redirect to dashboard
   - Capture screenshot of successful login

4. **Shop Management Test**
   - Fetch pending shops via API
   - Navigate to shops page on frontend
   - Validate shop list rendering
   - Capture screenshot

5. **Database Validation**
   - Query admin_users table to verify admin exists
   - Query shops table to check data integrity
   - Verify audit logs are being created

6. **Session & Security Test**
   - Test token refresh
   - Validate session expiry
   - Test unauthorized access scenarios

Provide a comprehensive test report with:
- Total test steps executed
- Success/failure rate
- API response times
- Database validation results
- Screenshots captured
- Any issues or recommendations
`,

  quickHealthCheck: `
Perform a quick health check of the eBeautything platform:

1. Test backend API health endpoint
2. Login to admin API
3. Fetch one shop from database
4. Navigate to admin frontend login page
5. Capture screenshot

Provide a brief status report.
`,

  adminWorkflowTest: `
Test the complete admin workflow:

1. Admin login (API + Frontend)
2. Navigate through all admin sections
3. Test shop approval/rejection
4. Test user ban/restore
5. View analytics dashboard
6. Validate all database changes
7. Capture screenshots at each step

Provide detailed test results.
`
};
