module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/app.ts',
    '!src/config/environment.ts',
    '!src/migrations/**',
    '!src/seeds/**',
    '!src/types/**',
    '!src/constants/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Higher thresholds for critical reservation system components
    './src/services/reservation-state-machine.service.ts': {
      branches: 95,
      functions: 98,
      lines: 98,
      statements: 98,
    },
    './src/services/reservation.service.ts': {
      branches: 95,
      functions: 98,
      lines: 98,
      statements: 98,
    },
    './src/services/time-slot.service.ts': {
      branches: 95,
      functions: 98,
      lines: 98,
      statements: 98,
    },
    './src/services/conflict-resolution.service.ts': {
      branches: 95,
      functions: 98,
      lines: 98,
      statements: 98,
    },
    './src/services/reservation-rescheduling.service.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/services/monitoring.service.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/controllers/reservation.controller.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/controllers/time-slot.controller.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../../src/config/environment$': '<rootDir>/tests/utils/config-mock.ts',
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup-real-db.ts'
  ],
  setupFiles: [
    '<rootDir>/tests/setup-env.ts',
    '<rootDir>/tests/utils/firebase-admin-mock.ts',
    '<rootDir>/tests/utils/faker-comprehensive-mock.ts'
  ],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
}; 