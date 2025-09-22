// Mock configuration for testing
export const config = {
  redis: {
    url: 'redis://localhost:6379',
    password: '',
    db: 0
  },
  supabase: {
    url: 'http://localhost:54321',
    anonKey: 'test-key'
  },
  firebase: {
    projectId: 'test-project',
    privateKey: 'test-private-key',
    clientEmail: 'test@example.com'
  },
  payments: {
    tossPayments: {
      secretKey: 'test-secret',
      clientKey: 'test-client',
      baseUrl: 'https://api.tosspayments.com'
    }
  },
  server: {
    port: 3000
  },
  logging: {
    level: 'info'
  }
};
