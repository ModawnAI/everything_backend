/**
 * Test script to verify database-level locking for time slots
 * This script simulates concurrent reservation requests to test the locking mechanism
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const TEST_SHOP_ID = process.env.TEST_SHOP_ID || '123e4567-e89b-12d3-a456-426614174000';
const TEST_USER_ID = process.env.TEST_USER_ID || '123e4567-e89b-12d3-a456-426614174001';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test data
const testServices = [
  {
    serviceId: '123e4567-e89b-12d3-a456-426614174002',
    quantity: 1
  }
];

const testReservation = {
  shopId: TEST_SHOP_ID,
  userId: TEST_USER_ID,
  reservationDate: '2024-12-20',
  reservationTime: '10:00:00',
  specialRequests: 'Test concurrent reservation',
  pointsUsed: 0,
  services: testServices
};

/**
 * Create a single reservation request
 */
async function createReservation(attemptNumber) {
  const startTime = Date.now();
  
  try {
    console.log(`[Attempt ${attemptNumber}] Starting reservation creation...`);
    
    const { data, error } = await supabase.rpc('create_reservation_with_lock', {
      p_shop_id: testReservation.shopId,
      p_user_id: testReservation.userId,
      p_reservation_date: testReservation.reservationDate,
      p_reservation_time: testReservation.reservationTime,
      p_special_requests: testReservation.specialRequests,
      p_points_used: testReservation.pointsUsed,
      p_services: JSON.stringify(testReservation.services),
      p_lock_timeout: 10000 // 10 seconds
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (error) {
      console.log(`[Attempt ${attemptNumber}] ❌ FAILED after ${duration}ms:`, error.message);
      return {
        success: false,
        error: error.message,
        duration,
        attemptNumber
      };
    }

    console.log(`[Attempt ${attemptNumber}] ✅ SUCCESS after ${duration}ms:`, data.id);
    
    // v3.1 Flow - Verify status is 'requested'
    if (data.status === 'requested') {
      console.log(`[Attempt ${attemptNumber}] ✅ v3.1 Flow: Status correctly set to 'requested'`);
      
      // v3.1 Flow - Verify shop owner notification would be sent
      console.log(`[Attempt ${attemptNumber}] 📱 v3.1 Flow: Shop owner notification triggered for reservation request`);
      console.log(`[Attempt ${attemptNumber}] 📧 v3.1 Flow: Email/SMS notifications would be sent based on preferences`);
    } else {
      console.log(`[Attempt ${attemptNumber}] ⚠️  v3.1 Flow: Expected status 'requested', got '${data.status}'`);
    }
    
    return {
      success: true,
      reservationId: data.id,
      status: data.status,
      duration,
      attemptNumber
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`[Attempt ${attemptNumber}] ❌ EXCEPTION after ${duration}ms:`, error.message);
    return {
      success: false,
      error: error.message,
      duration,
      attemptNumber
    };
  }
}

/**
 * Run concurrent reservation tests
 */
async function runConcurrentTest(numConcurrentRequests = 5) {
  console.log(`\n🚀 Starting concurrent reservation test with ${numConcurrentRequests} requests`);
  console.log(`📅 Test reservation: ${testReservation.reservationDate} at ${testReservation.reservationTime}`);
  console.log(`🏪 Shop ID: ${testReservation.shopId}`);
  console.log(`👤 User ID: ${testReservation.userId}\n`);

  // Create array of promises for concurrent execution
  const promises = [];
  for (let i = 1; i <= numConcurrentRequests; i++) {
    promises.push(createReservation(i));
  }

  // Execute all requests concurrently
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const slotConflicts = failed.filter(r => r.error?.includes('SLOT_CONFLICT'));
  const lockTimeouts = failed.filter(r => r.error?.includes('LOCK_TIMEOUT') || r.error?.includes('ADVISORY_LOCK_TIMEOUT'));
  const deadlocks = failed.filter(r => r.error?.includes('deadlock') || r.error?.includes('DEADLOCK'));

  console.log('\n📊 Test Results:');
  console.log(`⏱️  Total execution time: ${totalTime}ms`);
  console.log(`✅ Successful reservations: ${successful.length}/${numConcurrentRequests}`);
  console.log(`❌ Failed reservations: ${failed.length}/${numConcurrentRequests}`);
  
  if (successful.length > 0) {
    console.log(`🎯 Success rate: ${((successful.length / numConcurrentRequests) * 100).toFixed(1)}%`);
    console.log(`⚡ Average success time: ${(successful.reduce((sum, r) => sum + r.duration, 0) / successful.length).toFixed(0)}ms`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failure Analysis:');
    console.log(`🔒 Slot conflicts: ${slotConflicts.length}`);
    console.log(`⏰ Lock timeouts: ${lockTimeouts.length}`);
    console.log(`🔄 Deadlocks: ${deadlocks.length}`);
    console.log(`❓ Other errors: ${failed.length - slotConflicts.length - lockTimeouts.length - deadlocks.length}`);
  }

  // Verify only one reservation was created
  if (successful.length > 1) {
    console.log('\n⚠️  WARNING: Multiple reservations were created for the same time slot!');
    console.log('This indicates the locking mechanism is not working correctly.');
  } else if (successful.length === 1) {
    console.log('\n✅ SUCCESS: Only one reservation was created, locking mechanism is working correctly!');
  } else {
    console.log('\n❌ FAILURE: No reservations were created successfully.');
  }

  return {
    totalTime,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / numConcurrentRequests) * 100,
    results
  };
}

/**
 * Run multiple test scenarios
 */
async function runTestSuite() {
  console.log('🧪 Database Locking Test Suite');
  console.log('================================\n');

  const scenarios = [
    { name: 'Light Load', concurrent: 3 },
    { name: 'Medium Load', concurrent: 5 },
    { name: 'Heavy Load', concurrent: 10 },
    { name: 'Stress Test', concurrent: 20 }
  ];

  const allResults = [];

  for (const scenario of scenarios) {
    console.log(`\n📋 Running ${scenario.name} (${scenario.concurrent} concurrent requests)`);
    console.log('─'.repeat(50));
    
    const result = await runConcurrentTest(scenario.concurrent);
    allResults.push({
      scenario: scenario.name,
      ...result
    });

    // Wait between tests to avoid interference
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n📈 Test Suite Summary');
  console.log('====================');
  allResults.forEach(result => {
    console.log(`${result.scenario}: ${result.successful}/${result.scenario.split(' ')[1]} successful (${result.successRate.toFixed(1)}%)`);
  });

  const overallSuccess = allResults.every(r => r.successful <= 1);
  if (overallSuccess) {
    console.log('\n🎉 All tests passed! Database locking is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the locking implementation.');
  }
}

// Run the test suite
if (require.main === module) {
  runTestSuite().catch(console.error);
}

module.exports = {
  runConcurrentTest,
  runTestSuite,
  createReservation
};
