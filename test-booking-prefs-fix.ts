/**
 * Test that booking preferences are now saved in snake_case
 */

import { userProfileService } from './src/services/user-profile.service';
import { getSupabaseClient } from './src/config/database';

const TEST_USER_ID = 'ab60a268-ddff-47ca-b605-fd7830c9560a'; // User 'asdfasd'

async function testBookingPrefsFix() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Booking Preferences Fix');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Update profile with NEW booking preferences (simulating frontend)
    console.log('📝 Step 1: Update Profile with Booking Preferences');
    console.log('-'.repeat(80));

    const updateData = {
      name: 'Fixed User',
      booking_preferences: {
        skin_type: 'sensitive',
        allergy_info: 'Latex allergy - UPDATED',
        preferred_stylist: 'John Smith - UPDATED',
        special_requests: 'Please use fragrance-free products - UPDATED'
      }
    };

    console.log('Sending to service (snake_case):');
    console.log(JSON.stringify(updateData, null, 2));
    console.log();

    const updatedProfile = await userProfileService.updateUserProfile(
      TEST_USER_ID,
      updateData
    );

    console.log('✅ Profile updated successfully!');
    console.log();

    // Step 2: Read from database directly to verify snake_case
    console.log('📋 Step 2: Verify Database Storage (snake_case)');
    console.log('-'.repeat(80));

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, booking_preferences')
      .eq('id', TEST_USER_ID)
      .single();

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    console.log('Database column (booking_preferences):');
    console.log(JSON.stringify(user.booking_preferences, null, 2));
    console.log();

    // Step 3: Verify snake_case keys
    console.log('✅ Step 3: Verification');
    console.log('-'.repeat(80));

    const prefs = user.booking_preferences as any;
    const hasSnakeCase =
      prefs?.skin_type !== undefined &&
      prefs?.allergy_info !== undefined &&
      prefs?.preferred_stylist !== undefined &&
      prefs?.special_requests !== undefined;

    const hasCamelCase =
      prefs?.skinType !== undefined ||
      prefs?.allergyInfo !== undefined ||
      prefs?.preferredStylist !== undefined ||
      prefs?.specialRequests !== undefined;

    console.log('Database keys format:');
    console.log('  - snake_case (skin_type):', prefs?.skin_type ? '✅ PRESENT' : '❌ MISSING');
    console.log('  - snake_case (allergy_info):', prefs?.allergy_info ? '✅ PRESENT' : '❌ MISSING');
    console.log('  - snake_case (preferred_stylist):', prefs?.preferred_stylist ? '✅ PRESENT' : '❌ MISSING');
    console.log('  - snake_case (special_requests):', prefs?.special_requests ? '✅ PRESENT' : '❌ MISSING');
    console.log();
    console.log('  - camelCase (skinType):', prefs?.skinType ? '⚠️ PRESENT (OLD FORMAT)' : '✅ NOT PRESENT');
    console.log('  - camelCase (allergyInfo):', prefs?.allergyInfo ? '⚠️ PRESENT (OLD FORMAT)' : '✅ NOT PRESENT');
    console.log();

    if (hasSnakeCase && !hasCamelCase) {
      console.log('🎉 SUCCESS! Data is now stored in snake_case format!');
    } else if (hasCamelCase) {
      console.log('⚠️ STILL HAS CAMELCASE - User needs to re-save profile from frontend');
    } else {
      console.log('❌ VERIFICATION FAILED - No data found');
    }

    console.log();
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log('User name updated:', user.name === 'Fixed User' ? '✅' : '❌');
    console.log('Booking preferences format:', hasSnakeCase && !hasCamelCase ? '✅ snake_case' : hasCamelCase ? '⚠️ still camelCase' : '❌ missing');
    console.log();
    console.log('Next step: Have frontend user re-save their profile to apply the fix.');
    console.log('='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testBookingPrefsFix();
