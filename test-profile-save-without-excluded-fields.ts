/**
 * Test if profile saves correctly when excluding email, phoneNumber, gender
 */

import { userProfileService } from './src/services/user-profile.service';
import { getSupabaseClient } from './src/config/database';

const TEST_USER_ID = '265cd37d-da55-4071-aa86-91fc02b5b022'; // KJ Yoo

async function testProfileSaveWithoutExcludedFields() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Profile Save WITHOUT email, phoneNumber, gender');
  console.log('='.repeat(80));
  console.log();

  try {
    // Simulate exactly what frontend should send
    console.log('📝 Step 1: Prepare Update Data (Frontend Perspective)');
    console.log('-'.repeat(80));

    const frontendUpdate = {
      name: 'KJ Yoo Updated',
      birthDate: '1990-05-20',
      bookingPreferences: {
        skinType: 'dry',
        allergyInfo: 'Peanut allergy test',
        preferredStylist: 'Jane Stylist',
        specialRequests: 'Please use organic products'
      }
      // ❌ NOT including: email, phoneNumber, gender
    };

    console.log('Frontend sending (camelCase):');
    console.log(JSON.stringify(frontendUpdate, null, 2));
    console.log();

    // Transform as controller does
    console.log('🔄 Step 2: Backend Transforms to snake_case');
    console.log('-'.repeat(80));

    const backendUpdate: any = {
      name: frontendUpdate.name,
      birth_date: frontendUpdate.birthDate,
      booking_preferences: {
        skin_type: frontendUpdate.bookingPreferences.skinType,
        allergy_info: frontendUpdate.bookingPreferences.allergyInfo,
        preferred_stylist: frontendUpdate.bookingPreferences.preferredStylist,
        special_requests: frontendUpdate.bookingPreferences.specialRequests
      }
    };

    console.log('Backend saves (snake_case):');
    console.log(JSON.stringify(backendUpdate, null, 2));
    console.log();

    // Save to database
    console.log('💾 Step 3: Save to Supabase');
    console.log('-'.repeat(80));

    const updatedProfile = await userProfileService.updateUserProfile(
      TEST_USER_ID,
      backendUpdate
    );

    console.log('✅ Profile saved successfully!');
    console.log('Saved profile:');
    console.log({
      id: updatedProfile.id,
      name: updatedProfile.name,
      birth_date: updatedProfile.birth_date,
      booking_preferences: updatedProfile.booking_preferences
    });
    console.log();

    // Verify in database
    console.log('🔍 Step 4: Verify Data in Database');
    console.log('-'.repeat(80));

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone_number, gender, birth_date, booking_preferences, updated_at')
      .eq('id', TEST_USER_ID)
      .single();

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    console.log('Database record:');
    console.log('  - Name:', user.name);
    console.log('  - Email:', user.email, '(unchanged ✅)');
    console.log('  - Phone:', user.phone_number, '(unchanged ✅)');
    console.log('  - Gender:', user.gender, '(unchanged ✅)');
    console.log('  - Birth Date:', user.birth_date);
    console.log('  - Updated At:', user.updated_at);
    console.log();
    console.log('  Booking Preferences:');
    console.log('  ' + JSON.stringify(user.booking_preferences, null, 2).replace(/\n/g, '\n  '));
    console.log();

    // Verification
    console.log('✅ Step 5: Verification Results');
    console.log('-'.repeat(80));

    const prefs = user.booking_preferences as any;

    const nameMatches = user.name === 'KJ Yoo Updated';
    const birthDateMatches = user.birth_date === '1990-05-20';
    const skinTypeMatches = prefs?.skin_type === 'dry';
    const allergyMatches = prefs?.allergy_info === 'Peanut allergy test';
    const stylistMatches = prefs?.preferred_stylist === 'Jane Stylist';
    const requestsMatches = prefs?.special_requests === 'Please use organic products';

    const emailUnchanged = user.email === 'kj@journi.city'; // Original email
    const phoneUnchanged = user.phone_number === null; // Original phone
    const genderUnchanged = user.gender === 'female'; // Original gender

    console.log('Updated Fields:');
    console.log('  - name:', nameMatches ? '✅ SAVED' : '❌ FAILED');
    console.log('  - birthDate:', birthDateMatches ? '✅ SAVED' : '❌ FAILED');
    console.log('  - bookingPreferences.skinType:', skinTypeMatches ? '✅ SAVED (snake_case)' : '❌ FAILED');
    console.log('  - bookingPreferences.allergyInfo:', allergyMatches ? '✅ SAVED (snake_case)' : '❌ FAILED');
    console.log('  - bookingPreferences.preferredStylist:', stylistMatches ? '✅ SAVED (snake_case)' : '❌ FAILED');
    console.log('  - bookingPreferences.specialRequests:', requestsMatches ? '✅ SAVED (snake_case)' : '❌ FAILED');
    console.log();
    console.log('Excluded Fields (Should NOT Change):');
    console.log('  - email:', emailUnchanged ? '✅ UNCHANGED' : '⚠️ CHANGED (unexpected)');
    console.log('  - phoneNumber:', phoneUnchanged ? '✅ UNCHANGED' : '⚠️ CHANGED (unexpected)');
    console.log('  - gender:', genderUnchanged ? '✅ UNCHANGED' : '⚠️ CHANGED (unexpected)');
    console.log();

    const allUpdatesSuccessful = nameMatches && birthDateMatches && skinTypeMatches &&
                                  allergyMatches && stylistMatches && requestsMatches;
    const noUnexpectedChanges = emailUnchanged && phoneUnchanged && genderUnchanged;

    console.log('='.repeat(80));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(80));

    if (allUpdatesSuccessful && noUnexpectedChanges) {
      console.log('🎉 SUCCESS! Profile saves correctly to Supabase!');
      console.log();
      console.log('✅ All allowed fields updated successfully');
      console.log('✅ All excluded fields remained unchanged');
      console.log('✅ Data saved in correct snake_case format');
      console.log();
      console.log('👉 Frontend can now safely send profile updates without email/phone/gender');
    } else if (allUpdatesSuccessful && !noUnexpectedChanges) {
      console.log('⚠️ PARTIAL SUCCESS - Updates saved but excluded fields changed unexpectedly');
    } else {
      console.log('❌ FAILED - Some fields did not save correctly');
    }
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

testProfileSaveWithoutExcludedFields();
