// Load environment variables for tests
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test environment
process.env.NODE_ENV = 'test';

// Log environment status for debugging
if (process.env.SUPABASE_URL) {
  console.log('✅ Supabase environment variables loaded');
} else {
  console.warn('⚠️  Supabase environment variables not found');
}

if (process.env.JWT_SECRET) {
  console.log('✅ JWT secret loaded');
} else {
  console.warn('⚠️  JWT secret not found');
}
