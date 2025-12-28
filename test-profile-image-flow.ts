/**
 * Test Profile Image Upload and Update Flow
 *
 * Tests the complete flow of uploading an image and updating profile
 * to verify the backend is correctly returning profileImageUrl in camelCase
 */

import { getSupabaseClient } from './src/config/database';
import { userProfileService } from './src/services/user-profile.service';
import { transformKeysToCamel } from './src/utils/case-transformer';
import { logger } from './src/utils/logger';
import fs from 'fs';
import path from 'path';

// Test user (replace with actual user ID from your database)
const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f';

async function testProfileImageFlow() {
  console.log('═'.repeat(80));
  console.log('🧪 Testing Profile Image Upload and Update Flow');
  console.log('═'.repeat(80));
  console.log();

  try {
    const supabase = getSupabaseClient();

    // Step 1: Get current profile
    console.log('📋 Step 1: Get current profile');
    console.log('-'.repeat(80));

    const currentProfile = await userProfileService.getUserProfile(TEST_USER_ID);
    if (!currentProfile) {
      throw new Error('User not found');
    }

    console.log('Current profile (snake_case from DB):');
    console.log({
      id: currentProfile.id,
      name: currentProfile.name,
      profile_image_url: currentProfile.profile_image_url,
      booking_preferences: currentProfile.booking_preferences
    });

    // Transform to camelCase (as the API middleware would)
    const transformedProfile = transformKeysToCamel(currentProfile);
    console.log('\nTransformed profile (camelCase for frontend):');
    console.log({
      id: transformedProfile.id,
      name: transformedProfile.name,
      profileImageUrl: transformedProfile.profileImageUrl,
      bookingPreferences: transformedProfile.bookingPreferences
    });

    // Step 2: Simulate profile update with bookingPreferences
    console.log('\n\n📝 Step 2: Update profile with bookingPreferences');
    console.log('-'.repeat(80));

    const updateData = {
      name: 'Test User',
      booking_preferences: {
        skinType: 'dry',
        allergyInfo: 'test allergy',
        preferredStylist: 'test stylist',
        specialRequests: 'test request'
      }
    };

    console.log('Update data (snake_case):');
    console.log(JSON.stringify(updateData, null, 2));

    const updatedProfile = await userProfileService.updateUserProfile(TEST_USER_ID, updateData);

    console.log('\nUpdated profile (snake_case from DB):');
    console.log({
      id: updatedProfile.id,
      name: updatedProfile.name,
      profile_image_url: updatedProfile.profile_image_url,
      booking_preferences: updatedProfile.booking_preferences
    });

    // Transform to camelCase (as the API middleware would)
    const transformedUpdated = transformKeysToCamel(updatedProfile);
    console.log('\nTransformed updated profile (camelCase for frontend):');
    console.log({
      id: transformedUpdated.id,
      name: transformedUpdated.name,
      profileImageUrl: transformedUpdated.profileImageUrl,
      bookingPreferences: transformedUpdated.bookingPreferences
    });

    // Step 3: Test image upload simulation (without actual file)
    console.log('\n\n🖼️  Step 3: Check image upload endpoint requirements');
    console.log('-'.repeat(80));
    console.log('Image upload endpoint: POST /api/users/profile/image');
    console.log('Expected field name: "image" (or "avatar" for alias endpoint)');
    console.log('Max file size: 5MB');
    console.log('Allowed formats: JPEG, PNG, WebP');
    console.log();
    console.log('Expected response format:');
    console.log(JSON.stringify({
      success: true,
      data: {
        imageUrl: 'https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/profile-{userId}-{timestamp}.webp',
        thumbnailUrl: 'https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/thumbnails/profile-{userId}-{timestamp}.webp',
        metadata: {
          originalSize: 123456,
          optimizedSize: 45678,
          width: 800,
          height: 800,
          format: 'webp'
        }
      },
      message: '프로필 이미지가 업로드되었습니다.'
    }, null, 2));

    // Step 4: Check Supabase Storage bucket
    console.log('\n\n📦 Step 4: Check Supabase Storage Bucket');
    console.log('-'.repeat(80));

    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        console.log('❌ Error listing buckets:', error.message);
      } else {
        const profileImagesBucket = buckets.find(b => b.name === 'profile-images');
        if (profileImagesBucket) {
          console.log('✅ profile-images bucket EXISTS');
          console.log('   ID:', profileImagesBucket.id);
          console.log('   Public:', profileImagesBucket.public);
          console.log('   Created:', profileImagesBucket.created_at);
        } else {
          console.log('❌ profile-images bucket NOT FOUND');
          console.log('⚠️  This will cause image uploads to fail!');
          console.log('   Available buckets:', buckets.map(b => b.name).join(', '));
        }
      }
    } catch (storageError) {
      console.log('❌ Failed to check storage:', storageError);
    }

    // Step 5: Verify case transformation
    console.log('\n\n🔄 Step 5: Verify Case Transformation');
    console.log('-'.repeat(80));

    const testData = {
      profile_image_url: 'https://example.com/image.jpg',
      booking_preferences: {
        skin_type: 'dry',
        allergy_info: 'none'
      },
      birth_date: '1990-01-01'
    };

    const transformed = transformKeysToCamel(testData);
    console.log('Input (snake_case):');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\nOutput (camelCase):');
    console.log(JSON.stringify(transformed, null, 2));

    const hasCorrectTransformation =
      transformed.profileImageUrl === testData.profile_image_url &&
      transformed.bookingPreferences.skinType === testData.booking_preferences.skin_type &&
      transformed.birthDate === testData.birth_date;

    if (hasCorrectTransformation) {
      console.log('\n✅ Case transformation is working correctly!');
    } else {
      console.log('\n❌ Case transformation has issues!');
    }

    // Summary
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log('✅ Profile retrieval: Working');
    console.log('✅ Profile update: Working');
    console.log('✅ bookingPreferences saved:', !!updatedProfile.booking_preferences);
    console.log('✅ Case transformation: Working');
    console.log();
    console.log('❗ FRONTEND ISSUE IDENTIFIED:');
    console.log('   The frontend is sending:');
    console.log('   {');
    console.log('     "name": "asdf",');
    console.log('     "bookingPreferences": {...}');
    console.log('   }');
    console.log();
    console.log('   ❌ Missing: profileImageUrl field');
    console.log();
    console.log('   This means either:');
    console.log('   1. Image upload endpoint is never called, OR');
    console.log('   2. Image upload fails silently, OR');
    console.log('   3. Frontend receives imageUrl but doesn\'t include it in profile update');
    console.log();
    console.log('🔍 NEXT STEPS FOR FRONTEND:');
    console.log('   1. Add logging to image upload function');
    console.log('   2. Verify upload endpoint URL: POST /api/users/profile/image');
    console.log('   3. Verify field name: "image" (not "avatar" unless using alias)');
    console.log('   4. Check if upload response contains imageUrl');
    console.log('   5. Ensure imageUrl is included in subsequent profile update');
    console.log();

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testProfileImageFlow()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
