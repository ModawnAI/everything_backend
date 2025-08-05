import { config } from '../../src/config/environment';

describe('Configuration Tests', () => {
  test('should load configuration object', () => {
    expect(config).toBeDefined();
    expect(config.server).toBeDefined();
    expect(config.database).toBeDefined();
  });

  test('should have correct server configuration', () => {
    expect(config.server.env).toBe('test');
    expect(config.server.port).toBe(3000);
    expect(config.server.apiVersion).toBe('v1');
  });

  test('should have database configuration', () => {
    expect(config.database.supabaseUrl).toBeDefined();
    expect(config.database.supabaseAnonKey).toBeDefined();
    expect(config.database.supabaseServiceRoleKey).toBeDefined();
  });

  test('should have authentication configuration', () => {
    expect(config.auth.jwtSecret).toBeDefined();
    expect(config.auth.jwtExpiresIn).toBe('7d');
    expect(config.auth.bcryptSaltRounds).toBe(12);
  });
}); 