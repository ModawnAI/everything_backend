// Config barrel export
// Export all configuration modules here for clean imports

export { config, default as environment } from './environment';
export { database, initializeDatabase, getDatabase, getSupabaseClient } from './database';
export { 
  runCoreMigrations, 
  runRelationshipMigrations, 
  runFullMigrations, 
  verifyCoreTables, 
  verifyRelationshipTables, 
  verifyAllTables, 
  createExtensions, 
  createEnums, 
  createCoreTables, 
  createRelationshipTables 
} from './migrations';

// Additional config modules will be exported here as they are created:
// export { redisConfig } from './redis';
// export { jwtConfig } from './jwt';
// export { fcmConfig } from './fcm';
// export { tossPaymentsConfig } from './tossPayments';
