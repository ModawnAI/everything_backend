// Test environment setup - load real environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set test environment
process.env.NODE_ENV = 'test';

console.log('✅ Environment variables loaded from .env file');
console.log('✅ Test environment configured');