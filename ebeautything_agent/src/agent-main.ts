/**
 * eBeautything Agent - Claude Agent SDK Main Entry Point
 * Orchestrates comprehensive testing using AI agents
 */

import dotenv from 'dotenv';
import { runAgentOrchestrator, testScenarios } from './agent-orchestrator';
import { logger } from './utils/logger';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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
    logger.error('Please copy .env.example to .env and fill in the values');
    process.exit(1);
  }
}

/**
 * CLI Interface
 */
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .command('test', 'Run a test scenario', (yargs) => {
    return yargs
      .option('scenario', {
        alias: 's',
        type: 'string',
        description: 'Test scenario to run',
        choices: ['full', 'health', 'admin-workflow', 'custom'],
        default: 'full'
      })
      .option('prompt', {
        alias: 'p',
        type: 'string',
        description: 'Custom test prompt (required when scenario=custom)'
      });
  })
  .command('interactive', 'Run agent in interactive mode')
  .help()
  .alias('help', 'h')
  .parseSync();

/**
 * Main execution function
 */
async function main() {
  logger.info('🤖 eBeautything Agent SDK Started');
  logger.info('Configuration:', {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3000',
    supabaseUrl: process.env.SUPABASE_URL,
    logLevel: process.env.AGENT_LOG_LEVEL || 'info',
    model: 'claude-sonnet-4-5-20250929'
  });

  try {
    const command = argv._[0] as string;

    if (command === 'test') {
      let testPrompt: string;

      switch (argv.scenario) {
        case 'full':
          testPrompt = testScenarios.fullSystemTest;
          logger.info('Running: Full System Test');
          break;

        case 'health':
          testPrompt = testScenarios.quickHealthCheck;
          logger.info('Running: Quick Health Check');
          break;

        case 'admin-workflow':
          testPrompt = testScenarios.adminWorkflowTest;
          logger.info('Running: Admin Workflow Test');
          break;

        case 'custom':
          if (!argv.prompt) {
            logger.error('Custom scenario requires --prompt argument');
            process.exit(1);
          }
          testPrompt = argv.prompt as string;
          logger.info('Running: Custom Test');
          break;

        default:
          testPrompt = testScenarios.fullSystemTest;
      }

      const result = await runAgentOrchestrator(testPrompt);

      if (result.success) {
        logger.info('✅ Test execution completed successfully');
        process.exit(0);
      } else {
        logger.error('❌ Test execution failed', { error: result.error });
        process.exit(1);
      }

    } else if (command === 'interactive') {
      logger.info('Starting interactive mode...');
      logger.info('Enter test prompts (press Ctrl+D to exit):');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '🤖 Test> '
      });

      rl.prompt();

      rl.on('line', async (line: string) => {
        if (line.trim()) {
          await runAgentOrchestrator(line.trim());
        }
        rl.prompt();
      });

      rl.on('close', () => {
        logger.info('Interactive mode ended');
        process.exit(0);
      });

    } else {
      logger.error('Unknown command. Use --help for usage information');
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('❌ Fatal error', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run main function (ESM compatible)
main();

export { runAgentOrchestrator, testScenarios };
