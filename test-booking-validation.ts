/**
 * Test Booking Validation
 * Reproduces the exact booking request from the Flutter app
 */

import { BookingValidationService } from './src/services/booking-validation.service';

const validationService = new BookingValidationService();

async function testBookingValidation() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Booking Validation');
  console.log('='.repeat(80));
  console.log();

  // Exact request from Flutter app logs
  const bookingRequest = {
    userId: 'some-user-id', // Will fail if not provided, but let's test the date first
    shopId: '22222222-2222-2222-2222-222222222222',
    serviceId: 'ce98e031-b8d2-4050-9594-0015cd87d57f',
    date: '2025-11-27',
    timeSlot: '16:30',
    quantity: 1
  };

  console.log('📤 Testing booking request:');
  console.log(JSON.stringify(bookingRequest, null, 2));
  console.log();

  try {
    const result = await validationService.validateBookingRequest(bookingRequest);

    console.log('📊 Validation Result:');
    console.log(JSON.stringify({
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings
    }, null, 2));
    console.log();

    if (!result.isValid) {
      console.log('❌ VALIDATION FAILED');
      console.log('='.repeat(80));
      console.log();

      console.log('Critical Errors:');
      const criticalErrors = result.errors.filter(e => e.severity === 'critical');
      criticalErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.code}] ${error.message}`);
        console.log(`   Field: ${error.field}`);
        console.log(`   Details:`, JSON.stringify(error.details, null, 2));
        console.log();
      });

      console.log('This is the error the Flutter app should be displaying!');
      console.log('The response structure is:');
      console.log(JSON.stringify({
        success: false,
        message: 'Booking validation failed',
        errors: result.errors,
        warnings: result.warnings,
        metadata: result.metadata
      }, null, 2));

    } else {
      console.log('✅ VALIDATION PASSED');
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning, index) => {
          console.log(`${index + 1}. [${warning.code}] ${warning.message}`);
        });
      }
    }

  } catch (error) {
    console.error('\n💥 Test error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testBookingValidation()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
