/**
 * Check Shop-Service Relationship in Database
 *
 * This script queries Supabase to analyze the relationship between shops and services
 */

import { getSupabaseClient } from '../src/config/database';

async function checkShopServices() {
  const supabase = getSupabaseClient();

  console.log('🔍 Analyzing Shop-Service Relationship...\n');

  try {
    // 1. Count total shops
    const { count: totalShops, error: shopsError } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true });

    if (shopsError) {
      console.error('❌ Error counting shops:', shopsError);
      return;
    }

    // 2. Count total services
    const { count: totalServices, error: servicesError } = await supabase
      .from('shop_services')
      .select('*', { count: 'exact', head: true });

    if (servicesError) {
      console.error('❌ Error counting services:', servicesError);
      return;
    }

    // 3. Get shops with their service counts
    const { data: shopsWithServiceCounts, error: joinError } = await supabase
      .from('shops')
      .select(`
        id,
        name,
        main_category,
        shop_status,
        shop_services (
          id,
          name,
          is_available
        )
      `)
      .limit(10);

    if (joinError) {
      console.error('❌ Error fetching shop-service relationship:', joinError);
      return;
    }

    // 4. Count shops with/without services
    let shopsWithServices = 0;
    let shopsWithoutServices = 0;
    const serviceDistribution: { [key: number]: number } = {};

    if (shopsWithServiceCounts) {
      for (const shop of shopsWithServiceCounts) {
        const serviceCount = shop.shop_services?.length || 0;
        if (serviceCount > 0) {
          shopsWithServices++;
          serviceDistribution[serviceCount] = (serviceDistribution[serviceCount] || 0) + 1;
        } else {
          shopsWithoutServices++;
        }
      }
    }

    // 5. Get available vs unavailable services count
    const { count: activeServices } = await supabase
      .from('shop_services')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true);

    const { count: inactiveServices } = await supabase
      .from('shop_services')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', false);

    // Display results
    console.log('📊 Database Statistics:');
    console.log('═'.repeat(60));
    console.log(`Total Shops: ${totalShops}`);
    console.log(`Total Services: ${totalServices}`);
    console.log(`Active Services: ${activeServices}`);
    console.log(`Inactive Services: ${inactiveServices}`);
    console.log('');

    console.log('🔗 Shop-Service Relationship (Sample of 10 shops):');
    console.log('═'.repeat(60));
    console.log(`Shops with services: ${shopsWithServices}`);
    console.log(`Shops without services: ${shopsWithoutServices}`);

    if (totalServices && totalShops) {
      const avgServicesPerShop = (totalServices / totalShops).toFixed(2);
      console.log(`Average services per shop: ${avgServicesPerShop}`);
    }

    console.log('');
    console.log('📈 Service Distribution (from sample):');
    console.log('─'.repeat(60));
    Object.keys(serviceDistribution)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(count => {
        const shopCount = serviceDistribution[parseInt(count)];
        console.log(`  ${count} services: ${shopCount} shops`);
      });

    console.log('');
    console.log('🏪 Sample Shops with Services:');
    console.log('═'.repeat(60));

    if (shopsWithServiceCounts) {
      shopsWithServiceCounts.slice(0, 5).forEach(shop => {
        const serviceCount = shop.shop_services?.length || 0;
        const activeCount = shop.shop_services?.filter(s => s.is_available).length || 0;

        console.log(`\n📍 ${shop.name}`);
        console.log(`   ID: ${shop.id}`);
        console.log(`   Category: ${shop.main_category}`);
        console.log(`   Status: ${shop.shop_status}`);
        console.log(`   Total Services: ${serviceCount} (${activeCount} available)`);

        if (shop.shop_services && shop.shop_services.length > 0) {
          console.log('   Services:');
          shop.shop_services.slice(0, 3).forEach(service => {
            const status = service.is_available ? '✅' : '❌';
            console.log(`     ${status} ${service.name}`);
          });
          if (shop.shop_services.length > 3) {
            console.log(`     ... and ${shop.shop_services.length - 3} more`);
          }
        }
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the analysis
checkShopServices()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
