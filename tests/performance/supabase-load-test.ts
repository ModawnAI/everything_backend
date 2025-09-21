import { getSupabaseClient } from '../../src/config/database';
import { config } from '../../src/config/environment';

interface LoadTestResult {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  data?: any;
}

interface LoadTestSummary {
  operation: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  errors: string[];
}

class SupabaseLoadTester {
  private supabase: any;
  private results: LoadTestResult[] = [];
  private testUserIds: string[] = [];
  private testShopIds: string[] = [];

  constructor() {
    this.supabase = getSupabaseClient();
  }

  async cleanup() {
    // Cleanup test data
    if (this.testUserIds.length > 0) {
      await this.supabase.from('users').delete().in('id', this.testUserIds);
    }
    if (this.testShopIds.length > 0) {
      await this.supabase.from('shops').delete().in('id', this.testShopIds);
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private generateSummary(operation: string): LoadTestSummary {
    const operationResults = this.results.filter(r => r.operation === operation);
    const durations = operationResults.map(r => r.duration);
    const successful = operationResults.filter(r => r.success);
    const failed = operationResults.filter(r => !r.success);
    const errors = failed.map(r => r.error || 'Unknown error').filter((v, i, a) => a.indexOf(v) === i);

    return {
      operation,
      totalRequests: operationResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      minDuration: Math.min(...durations) || 0,
      maxDuration: Math.max(...durations) || 0,
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
      errors
    };
  }

  private async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        operation,
        duration,
        success: true,
        data: result
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  async testUserCreation(concurrency: number = 10, totalUsers: number = 100): Promise<void> {
    console.log(`Testing user creation with ${concurrency} concurrent requests for ${totalUsers} total users`);
    
    const batches = Math.ceil(totalUsers / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalUsers - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const userIndex = batch * concurrency + i;
        const promise = this.measureOperation('user_creation', async () => {
          const userData = {
            email: `loadtest-user-${userIndex}-${Date.now()}@example.com`,
            phone_number: `+8210123456${String(userIndex).padStart(2, '0')}`,
            full_name: `Load Test User ${userIndex}`,
            date_of_birth: '1990-01-01',
            gender: 'other',
            status: 'active'
          };
          
          const { data, error } = await this.supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
          
          if (error) throw error;
          
          this.testUserIds.push(data.id);
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async testShopCreation(concurrency: number = 5, totalShops: number = 50): Promise<void> {
    console.log(`Testing shop creation with ${concurrency} concurrent requests for ${totalShops} total shops`);
    
    // Ensure we have users to be shop owners
    if (this.testUserIds.length < totalShops) {
      await this.testUserCreation(10, totalShops);
    }
    
    const batches = Math.ceil(totalShops / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalShops - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const shopIndex = batch * concurrency + i;
        const promise = this.measureOperation('shop_creation', async () => {
          const shopData = {
            name: `Load Test Shop ${shopIndex}`,
            description: `Load test shop description ${shopIndex}`,
            address: `Test Address ${shopIndex}`,
            latitude: 37.5665 + (Math.random() - 0.5) * 0.1,
            longitude: 126.9780 + (Math.random() - 0.5) * 0.1,
            phone_number: `+8210987654${String(shopIndex).padStart(2, '0')}`,
            owner_id: this.testUserIds[shopIndex],
            status: 'active'
          };
          
          const { data, error } = await this.supabase
            .from('shops')
            .insert(shopData)
            .select()
            .single();
          
          if (error) throw error;
          
          this.testShopIds.push(data.id);
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async testShopSearch(concurrency: number = 20, totalSearches: number = 200): Promise<void> {
    console.log(`Testing shop search with ${concurrency} concurrent requests for ${totalSearches} total searches`);
    
    const batches = Math.ceil(totalSearches / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalSearches - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const promise = this.measureOperation('shop_search', async () => {
          const { data, error } = await this.supabase
            .from('shops')
            .select('id, name, description, address, latitude, longitude, status')
            .eq('status', 'active')
            .limit(10);
          
          if (error) throw error;
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  async testReservationCreation(concurrency: number = 10, totalReservations: number = 100): Promise<void> {
    console.log(`Testing reservation creation with ${concurrency} concurrent requests for ${totalReservations} total reservations`);
    
    // Ensure we have shops and services
    if (this.testShopIds.length === 0) {
      await this.testShopCreation(5, 10);
    }
    
    // Create services for shops
    const serviceIds: string[] = [];
    for (const shopId of this.testShopIds.slice(0, 5)) {
      const { data: service, error } = await this.supabase
        .from('shop_services')
        .insert({
          shop_id: shopId,
          name: 'Test Service',
          description: 'Load test service',
          duration_minutes: 60,
          price: 50000,
          status: 'active'
        })
        .select()
        .single();
      
      if (!error && service) {
        serviceIds.push(service.id);
      }
    }
    
    const batches = Math.ceil(totalReservations / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalReservations - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const reservationIndex = batch * concurrency + i;
        const promise = this.measureOperation('reservation_creation', async () => {
          const shopId = this.testShopIds[reservationIndex % this.testShopIds.length];
          const userId = this.testUserIds[reservationIndex % this.testUserIds.length];
          const serviceId = serviceIds[reservationIndex % serviceIds.length];
          
          const reservationDate = new Date();
          reservationDate.setDate(reservationDate.getDate() + 1 + (reservationIndex % 7));
          
          const { data, error } = await this.supabase
            .rpc('create_reservation_with_lock', {
              p_user_id: userId,
              p_shop_id: shopId,
              p_service_id: serviceId,
              p_reservation_date: reservationDate.toISOString().split('T')[0],
              p_start_time: `${10 + (reservationIndex % 8)}:00`,
              p_end_time: `${11 + (reservationIndex % 8)}:00`,
              p_notes: `Load test reservation ${reservationIndex}`
            });
          
          if (error) throw error;
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  async testPointTransactions(concurrency: number = 15, totalTransactions: number = 150): Promise<void> {
    console.log(`Testing point transactions with ${concurrency} concurrent requests for ${totalTransactions} total transactions`);
    
    const batches = Math.ceil(totalTransactions / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalTransactions - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const transactionIndex = batch * concurrency + i;
        const promise = this.measureOperation('point_transaction', async () => {
          const userId = this.testUserIds[transactionIndex % this.testUserIds.length];
          const amount = Math.floor(Math.random() * 1000) + 100;
          const type = transactionIndex % 2 === 0 ? 'earned' : 'spent';
          
          const { data, error } = await this.supabase
            .from('point_transactions')
            .insert({
              user_id: userId,
              amount: amount,
              type: type,
              source: 'load_test',
              description: `Load test ${type} transaction ${transactionIndex}`,
              status: 'completed'
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async testComplexQueries(concurrency: number = 10, totalQueries: number = 100): Promise<void> {
    console.log(`Testing complex queries with ${concurrency} concurrent requests for ${totalQueries} total queries`);
    
    const batches = Math.ceil(totalQueries / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalQueries - batch * concurrency);
      const promises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const promise = this.measureOperation('complex_query', async () => {
          // Complex join query
          const { data, error } = await this.supabase
            .from('reservations')
            .select(`
              id,
              status,
              reservation_date,
              start_time,
              end_time,
              users!inner(id, full_name, email),
              shops!inner(id, name, address),
              shop_services!inner(id, name, price)
            `)
            .limit(5);
          
          if (error) throw error;
          return data;
        });
        
        promises.push(promise);
      }
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('LOAD TEST RESULTS');
    console.log('='.repeat(80));
    
    const operations = [...new Set(this.results.map(r => r.operation))];
    
    operations.forEach(operation => {
      const summary = this.generateSummary(operation);
      
      console.log(`\n${operation.toUpperCase()}`);
      console.log('-'.repeat(40));
      console.log(`Total Requests: ${summary.totalRequests}`);
      console.log(`Successful: ${summary.successfulRequests} (${(summary.successfulRequests / summary.totalRequests * 100).toFixed(1)}%)`);
      console.log(`Failed: ${summary.failedRequests} (${(summary.failedRequests / summary.totalRequests * 100).toFixed(1)}%)`);
      console.log(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
      console.log(`Min Duration: ${summary.minDuration}ms`);
      console.log(`Max Duration: ${summary.maxDuration}ms`);
      console.log(`95th Percentile: ${summary.p95Duration}ms`);
      console.log(`99th Percentile: ${summary.p99Duration}ms`);
      
      if (summary.errors.length > 0) {
        console.log(`Errors:`);
        summary.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
    });
    
    // Overall summary
    const totalRequests = this.results.length;
    const totalSuccessful = this.results.filter(r => r.success).length;
    const totalFailed = this.results.filter(r => !r.success).length;
    const overallAvgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalRequests;
    
    console.log('\n' + '='.repeat(40));
    console.log('OVERALL SUMMARY');
    console.log('='.repeat(40));
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${totalSuccessful} (${(totalSuccessful / totalRequests * 100).toFixed(1)}%)`);
    console.log(`Failed: ${totalFailed} (${(totalFailed / totalRequests * 100).toFixed(1)}%)`);
    console.log(`Overall Average Duration: ${overallAvgDuration.toFixed(2)}ms`);
  }
}

// Test execution
describe('Supabase Load Tests', () => {
  let loadTester: SupabaseLoadTester;
  
  beforeAll(async () => {
    loadTester = new SupabaseLoadTester();
  }, 30000);
  
  afterAll(async () => {
    await loadTester.cleanup();
  }, 30000);
  
  it('should handle user creation load', async () => {
    await loadTester.testUserCreation(10, 100);
  }, 60000);
  
  it('should handle shop creation load', async () => {
    await loadTester.testShopCreation(5, 50);
  }, 60000);
  
  it('should handle shop search load', async () => {
    await loadTester.testShopSearch(20, 200);
  }, 60000);
  
  it('should handle reservation creation load', async () => {
    await loadTester.testReservationCreation(10, 100);
  }, 60000);
  
  it('should handle point transactions load', async () => {
    await loadTester.testPointTransactions(15, 150);
  }, 60000);
  
  it('should handle complex queries load', async () => {
    await loadTester.testComplexQueries(10, 100);
  }, 60000);
  
  it('should print load test results', () => {
    loadTester.printResults();
  });
});
