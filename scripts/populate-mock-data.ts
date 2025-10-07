/**
 * Populate Mock Data for Services
 *
 * Adds missing fields like popularity_score, rating_average, booking_count, etc.
 */

import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function populateMockData() {
  try {
    console.log('🔍 Fetching all services...');

    // Get all services
    const { data: services, error: servicesError } = await supabase
      .from('shop_services')
      .select('id, name');

    if (servicesError) {
      throw new Error(`Failed to fetch services: ${servicesError.message}`);
    }

    if (!services || services.length === 0) {
      console.log('⚠️  No services found');
      return;
    }

    console.log(`✅ Found ${services.length} services`);

    // Update each service with mock data
    let updated = 0;
    let failed = 0;

    for (const service of services) {
      const mockData = {
        popularity_score: Math.floor(Math.random() * 100) + 50, // 50-150
        rating_average: (Math.random() * 1.5 + 3.5).toFixed(1), // 3.5-5.0
        rating_count: Math.floor(Math.random() * 200) + 10, // 10-210
        booking_count: Math.floor(Math.random() * 500) + 50, // 50-550
        view_count: Math.floor(Math.random() * 2000) + 100, // 100-2100
        featured: Math.random() > 0.7, // 30% chance
        trending: Math.random() > 0.8, // 20% chance
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('shop_services')
        .update(mockData)
        .eq('id', service.id);

      if (error) {
        console.error(`❌ Failed to update ${service.name}:`, error.message);
        failed++;
      } else {
        updated++;
        if (updated % 5 === 0) {
          console.log(`✅ Updated ${updated}/${services.length} services...`);
        }
      }
    }

    console.log(`\n🎉 Successfully updated ${updated} services!`);
    if (failed > 0) {
      console.log(`⚠️  Failed to update ${failed} services`);
    }

  } catch (error) {
    console.error('❌ Error populating mock data:', error);
    process.exit(1);
  }
}

// Run the script
populateMockData()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
