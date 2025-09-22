/**
 * Database Performance Tests with Real Connections
 * 
 * Performance tests focusing on critical database operations:
 * - Query optimization and indexing performance
 * - Transaction performance and locking mechanisms
 * - Bulk operations performance
 * - Database connection performance under load
 * - Critical reservation system database functions
 * 
 * Following testing rule: Use real Supabase connections, not mocks
 */

import { 
  createTestUser, 
  createTestShop, 
  createTestService,
  createTestReservation,
  cleanupTestData,
  initializeTestDatabase,
  testSupabaseClient
} from '../setup-real-db';

// Mock only external services
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Database Performance Tests - Real Database', () => {
  let testUsers: any[] = [];
  let testShops: any[] = [];
  let testServices: any[] = [];

  // Database performance thresholds
  const DB_PERFORMANCE_THRESHOLDS = {
    simpleQuery: 200, // ms
    complexQuery: 1000, // ms
    bulkInsert: 2000, // ms for 100 records
    bulkUpdate: 2000, // ms for 100 records
    transactionCommit: 500, // ms
    rpcFunction: 1000, // ms
    indexedQuery: 100, // ms
    joinQuery: 800, // ms
  };

  beforeAll(async () => {
    await initializeTestDatabase();

    // Create test data for performance testing
    console.log('🔧 Setting up database performance test data...');
    
    // Create test users
    for (let i = 0; i < 20; i++) {
      const user = await createTestUser({
        email: `db-perf-user-${i}@example.com`,
        name: `DB Performance User ${i}`
      });
      testUsers.push(user);
    }

    // Create test shops
    for (let i = 0; i < 10; i++) {
      const shop = await createTestShop({
        name: `DB Performance Shop ${i}`
      });
      testShops.push(shop);

      // Create services for each shop
      for (let j = 0; j < 5; j++) {
        const service = await createTestService({
          shop_id: shop.id,
          name: `DB Perf Service ${i}-${j}`
        });
        testServices.push(service);
      }
    }

    console.log(`✅ DB performance test data created: ${testUsers.length} users, ${testShops.length} shops, ${testServices.length} services`);
  }, 120000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('Query Performance', () => {
    it('should perform simple queries efficiently', async () => {
      const startTime = performance.now();

      // Perform 100 simple user queries
      const queryPromises = testUsers.slice(0, 10).map(user => 
        testSupabaseClient
          .from('users')
          .select('id, name, email')
          .eq('id', user.id)
          .single()
      );

      const results = await Promise.allSettled(queryPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(queryPromises.length * DB_PERFORMANCE_THRESHOLDS.simpleQuery);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      console.log(`📊 Simple Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per query: ${(executionTime / queryPromises.length).toFixed(2)}ms
        - Queries executed: ${queryPromises.length}
        - Success rate: 100%`);
    });

    it('should perform complex join queries efficiently', async () => {
      const startTime = performance.now();

      // Perform complex queries with joins
      const complexQueries = testShops.slice(0, 5).map(shop =>
        testSupabaseClient
          .from('shops')
          .select(`
            id,
            name,
            shop_services(id, name, price_min, price_max),
            reservations(id, status, reservation_date, total_amount)
          `)
          .eq('id', shop.id)
      );

      const results = await Promise.allSettled(complexQueries);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(complexQueries.length * DB_PERFORMANCE_THRESHOLDS.complexQuery);

      console.log(`📊 Complex Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per query: ${(executionTime / complexQueries.length).toFixed(2)}ms
        - Queries executed: ${complexQueries.length}`);
    });

    it('should perform indexed queries efficiently', async () => {
      const startTime = performance.now();

      // Test indexed queries (assuming email is indexed)
      const indexedQueries = testUsers.slice(0, 10).map(user =>
        testSupabaseClient
          .from('users')
          .select('id, name')
          .eq('email', user.email)
      );

      const results = await Promise.allSettled(indexedQueries);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(indexedQueries.length * DB_PERFORMANCE_THRESHOLDS.indexedQuery);

      console.log(`📊 Indexed Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per query: ${(executionTime / indexedQueries.length).toFixed(2)}ms
        - Queries executed: ${indexedQueries.length}`);
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk inserts efficiently', async () => {
      const startTime = performance.now();

      // Create 50 reservations in bulk
      const bulkReservations = [];
      for (let i = 0; i < 50; i++) {
        const user = testUsers[i % testUsers.length];
        const shop = testShops[i % testShops.length];
        
        bulkReservations.push({
          id: crypto.randomUUID(),
          user_id: user.id,
          shop_id: shop.id,
          reservation_date: '2025-01-05',
          reservation_time: `${9 + Math.floor(i / 10)}:${(i % 10) * 6}`.padStart(5, '0'),
          status: 'requested',
          total_amount: 50000 + (i * 1000),
          deposit_amount: 10000,
          remaining_amount: 40000 + (i * 1000),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      const { data, error } = await testSupabaseClient
        .from('reservations')
        .insert(bulkReservations);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(error).toBeNull();
      expect(executionTime).toBeLessThan(DB_PERFORMANCE_THRESHOLDS.bulkInsert);

      console.log(`📊 Bulk Insert Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Records inserted: ${bulkReservations.length}
        - Average per record: ${(executionTime / bulkReservations.length).toFixed(2)}ms`);
    });

    it('should handle bulk updates efficiently', async () => {
      // First create some test reservations
      const testReservations = [];
      for (let i = 0; i < 20; i++) {
        const reservation = await createTestReservation({
          user_id: testUsers[i % testUsers.length].id,
          shop_id: testShops[i % testShops.length].id,
          status: 'requested'
        });
        testReservations.push(reservation);
      }

      const startTime = performance.now();

      // Bulk update all reservations to confirmed status
      const updatePromises = testReservations.map(reservation =>
        testSupabaseClient
          .from('reservations')
          .update({ 
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', reservation.id)
      );

      const results = await Promise.allSettled(updatePromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(DB_PERFORMANCE_THRESHOLDS.bulkUpdate);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      console.log(`📊 Bulk Update Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Records updated: ${testReservations.length}
        - Average per record: ${(executionTime / testReservations.length).toFixed(2)}ms`);
    });
  });

  describe('Database Function Performance', () => {
    it('should test RPC function performance', async () => {
      const startTime = performance.now();

      // Test database function calls
      const rpcPromises = [];
      for (let i = 0; i < 10; i++) {
        const shop = testShops[i % testShops.length];
        
        rpcPromises.push(
          testSupabaseClient.rpc('check_time_slot_availability', {
            p_shop_id: shop.id,
            p_date: '2025-01-06',
            p_time: '14:00',
            p_duration: 60
          })
        );
      }

      const results = await Promise.allSettled(rpcPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(rpcPromises.length * DB_PERFORMANCE_THRESHOLDS.rpcFunction);

      console.log(`📊 RPC Function Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per function call: ${(executionTime / rpcPromises.length).toFixed(2)}ms
        - Function calls: ${rpcPromises.length}`);
    });

    it('should test reservation creation with locking function', async () => {
      const startTime = performance.now();
      const user = testUsers[0];
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      // Test the create_reservation_with_lock function
      const lockingPromises = [];
      for (let i = 0; i < 5; i++) {
        lockingPromises.push(
          testSupabaseClient.rpc('create_reservation_with_lock', {
            p_user_id: user.id,
            p_shop_id: shop.id,
            p_service_id: service.id,
            p_reservation_date: '2025-01-07',
            p_reservation_time: `${14 + i}:00`,
            p_total_amount: 50000,
            p_deposit_amount: 10000
          })
        );
      }

      const results = await Promise.allSettled(lockingPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(lockingPromises.length * DB_PERFORMANCE_THRESHOLDS.rpcFunction);

      console.log(`📊 Locking Function Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per locking operation: ${(executionTime / lockingPromises.length).toFixed(2)}ms
        - Locking operations: ${lockingPromises.length}`);
    });
  });

  describe('Connection Pool Performance', () => {
    it('should handle multiple concurrent connections efficiently', async () => {
      const startTime = performance.now();
      const connectionCount = 20;

      // Create multiple concurrent database operations
      const connectionPromises = Array.from({ length: connectionCount }, (_, index) => {
        const user = testUsers[index % testUsers.length];
        
        return testSupabaseClient
          .from('users')
          .select('id, name, total_points')
          .eq('id', user.id)
          .single()
          .then(() => ({ success: true, index }))
          .catch(error => ({ success: false, index, error: error.message }));
      });

      const results = await Promise.allSettled(connectionPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Analyze connection performance
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );

      // Performance assertions
      expect(executionTime).toBeLessThan(connectionCount * DB_PERFORMANCE_THRESHOLDS.simpleQuery);
      expect(successful.length / results.length).toBeGreaterThan(0.95); // 95% success rate

      console.log(`📊 Connection Pool Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Concurrent connections: ${connectionCount}
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Average per connection: ${(executionTime / connectionCount).toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track database operation metrics', async () => {
      const operations = [];
      const operationTypes = ['select', 'insert', 'update', 'rpc'];
      
      for (const opType of operationTypes) {
        const startTime = performance.now();
        
        try {
          switch (opType) {
            case 'select':
              await testSupabaseClient
                .from('users')
                .select('id, name')
                .limit(10);
              break;
              
            case 'insert':
              const newUser = await createTestUser({
                email: `perf-monitor-${Date.now()}@example.com`
              });
              break;
              
            case 'update':
              if (testUsers.length > 0) {
                await testSupabaseClient
                  .from('users')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', testUsers[0].id);
              }
              break;
              
            case 'rpc':
              await testSupabaseClient.rpc('check_time_slot_availability', {
                p_shop_id: testShops[0]?.id || crypto.randomUUID(),
                p_date: '2025-01-08',
                p_time: '15:00',
                p_duration: 60
              });
              break;
          }
          
          const endTime = performance.now();
          operations.push({
            type: opType,
            duration: endTime - startTime,
            success: true
          });
        } catch (error) {
          const endTime = performance.now();
          operations.push({
            type: opType,
            duration: endTime - startTime,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Analyze operation performance
      const averageDurations = operationTypes.map(type => {
        const ops = operations.filter(op => op.type === type);
        const avgDuration = ops.reduce((sum, op) => sum + op.duration, 0) / ops.length;
        return { type, averageDuration, operations: ops.length };
      });

      console.log(`📊 Database Operation Metrics:`);
      averageDurations.forEach(metric => {
        console.log(`   ${metric.type}: ${metric.averageDuration.toFixed(2)}ms avg (${metric.operations} ops)`);
      });

      // Performance assertions
      expect(operations.every(op => op.duration < 5000)).toBe(true); // All under 5 seconds
    });
  });

  describe('Load Testing Critical Paths', () => {
    it('should handle reservation system critical path under load', async () => {
      const startTime = performance.now();
      const loadOperations = [];

      // Simulate critical path: user lookup -> shop lookup -> service lookup -> availability check
      for (let i = 0; i < 20; i++) {
        const user = testUsers[i % testUsers.length];
        const shop = testShops[i % testShops.length];
        
        const criticalPathPromise = async () => {
          const pathStartTime = performance.now();
          
          try {
            // Step 1: User lookup
            const userResult = await testSupabaseClient
              .from('users')
              .select('id, name, available_points')
              .eq('id', user.id)
              .single();

            // Step 2: Shop lookup with services
            const shopResult = await testSupabaseClient
              .from('shops')
              .select(`
                id, 
                name, 
                operating_hours,
                shop_services(id, name, duration_minutes, price_min)
              `)
              .eq('id', shop.id)
              .single();

            // Step 3: Check availability
            const availabilityResult = await testSupabaseClient.rpc('check_time_slot_availability', {
              p_shop_id: shop.id,
              p_date: '2025-01-09',
              p_time: '16:00',
              p_duration: 60
            });

            const pathEndTime = performance.now();
            return {
              success: true,
              duration: pathEndTime - pathStartTime,
              steps: 3
            };
          } catch (error) {
            const pathEndTime = performance.now();
            return {
              success: false,
              duration: pathEndTime - pathStartTime,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        };

        loadOperations.push(criticalPathPromise());
      }

      const results = await Promise.allSettled(loadOperations);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;

      // Analyze critical path performance
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );

      const averagePathDuration = successful.length > 0 
        ? successful.reduce((sum, r) => sum + (r.value as any).duration, 0) / successful.length
        : 0;

      // Performance assertions
      expect(totalExecutionTime).toBeLessThan(loadOperations.length * 2000); // 2s per operation
      expect(successful.length / results.length).toBeGreaterThan(0.80); // 80% success rate
      expect(averagePathDuration).toBeLessThan(1500); // 1.5s average path duration

      console.log(`📊 Critical Path Load Performance:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Average path duration: ${averagePathDuration.toFixed(2)}ms
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Operations completed: ${loadOperations.length}`);
    }, 60000);
  });

  describe('Database Resource Monitoring', () => {
    it('should monitor database connection health during load', async () => {
      const healthChecks = [];
      const startTime = performance.now();

      // Perform operations while monitoring health
      for (let i = 0; i < 10; i++) {
        const healthCheckStart = performance.now();
        
        try {
          // Simple health check query
          const { data, error } = await testSupabaseClient
            .from('users')
            .select('count')
            .limit(1);

          const healthCheckEnd = performance.now();
          healthChecks.push({
            iteration: i + 1,
            duration: healthCheckEnd - healthCheckStart,
            success: !error,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          const healthCheckEnd = performance.now();
          healthChecks.push({
            iteration: i + 1,
            duration: healthCheckEnd - healthCheckStart,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }

        // Small delay between health checks
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Analyze health check performance
      const successfulChecks = healthChecks.filter(check => check.success);
      const averageHealthCheckTime = healthChecks.reduce((sum, check) => sum + check.duration, 0) / healthChecks.length;

      // Health monitoring assertions
      expect(successfulChecks.length / healthChecks.length).toBeGreaterThan(0.90); // 90% health
      expect(averageHealthCheckTime).toBeLessThan(DB_PERFORMANCE_THRESHOLDS.simpleQuery);

      console.log(`📊 Database Health Monitoring:
        - Total monitoring time: ${totalTime.toFixed(2)}ms
        - Health checks performed: ${healthChecks.length}
        - Health check success rate: ${(successfulChecks.length / healthChecks.length * 100).toFixed(1)}%
        - Average health check time: ${averageHealthCheckTime.toFixed(2)}ms`);
    });
  });
});

