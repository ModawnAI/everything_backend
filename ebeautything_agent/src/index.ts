/**
 * eBeautything Agent - Main Entry Point
 * Claude Agent SDK for E2E testing of backend + admin frontend
 */

import dotenv from 'dotenv';
import { runAdminWorkflow } from './scenarios/admin-workflow';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  logger.info('🤖 eBeautything Agent SDK Started');
  logger.info('Configuration:', {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3000',
    supabaseUrl: process.env.SUPABASE_URL,
    logLevel: process.env.AGENT_LOG_LEVEL || 'info'
  });

  try {
    // Run admin workflow test
    const results = await runAdminWorkflow();

    logger.info('✅ All tests completed successfully', {
      results: results.success
    });

    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Test execution failed', {
      error: error.message,
      stack: error.stack
    });

    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

export { runAdminWorkflow };
