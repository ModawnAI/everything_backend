// Test environment setup - load test environment variables
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Prefer .env.test over .env to avoid using production database
const envTestPath = path.resolve(process.cwd(), '.env.test');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
  console.log('✅ Environment variables loaded from .env.test file');
} else {
  dotenv.config({ path: envPath });
  console.log('⚠️ .env.test not found, falling back to .env file');
}

// Set test environment
process.env.NODE_ENV = 'test';

console.log('✅ Test environment configured');