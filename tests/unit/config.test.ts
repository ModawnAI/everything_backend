import { config } from '../../src/config/environment';

describe('Configuration Tests', () => {
  test('should load configuration object', () => {
    expect(config).toBeDefined();
    expect(config.server).toBeDefined();
    expect(config.supabase).toBeDefined();
  });

  test('should have correct server configuration', () => {
    expect(config.server.port).toBe(parseInt(process.env.PORT || '3001', 10));
  });

  test('should have database configuration', () => {
    expect(config.supabase.url).toBeDefined();
    expect(config.supabase.anonKey).toBeDefined();
  });

  test('should have payments configuration', () => {
    expect(config.payments).toBeDefined();
    expect(config.payments.tossPayments).toBeDefined();
    expect(config.payments.tossPayments.baseUrl).toBe('https://api.tosspayments.com');
  });
});
