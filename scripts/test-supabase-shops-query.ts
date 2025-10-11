/**
 * Test Supabase Shops Query Directly
 * Diagnose why the getAllShops endpoint is timing out
 */

import { getSupabaseClient } from '../src/config/database';
import { logger } from '../src/utils/logger';

async function testSupabaseShopsQuery() {
  console.log('🔍 Testing Supabase Shops Query\n');
  console.log('=' .repeat(80));

  try {
    const client = getSupabaseClient();

    // Test 1: Simple count query
    console.log('\n📝 Test 1: Count shops in database...');
    const { count: totalShops, error: countError } = await client
      .from('shops')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError);
      return;
    }

    console.log(`✅ Total shops in database: ${totalShops}`);

    if (totalShops === 0) {
      console.log('\n⚠️  No shops in database - this explains the empty response');
      return;
    }

    // Test 2: Simple select without join
    console.log('\n📝 Test 2: Simple select (no joins)...');
    const { data: shopsSimple, error: simpleError } = await client
      .from('shops')
      .select('id, name, main_category, shop_status, verification_status, created_at')
      .limit(5);

    if (simpleError) {
      console.error('❌ Simple select failed:', simpleError);
      return;
    }

    console.log(`✅ Simple select returned ${shopsSimple?.length || 0} shops`);
    if (shopsSimple && shopsSimple.length > 0) {
      console.log('\nFirst shop:', JSON.stringify(shopsSimple[0], null, 2));
    }

    // Test 3: Select with owner join (like the controller does)
    console.log('\n📝 Test 3: Select with owner join (like controller)...');
    console.log('This is the query that might be hanging...');

    const queryStartTime = Date.now();
    const { data: shopsWithOwner, error: joinError } = await client
      .from('shops')
      .select(`
        id,
        name,
        main_category,
        shop_status,
        verification_status,
        created_at,
        owner:users!shops_owner_id_fkey(
          id,
          name,
          email,
          phone_number
        )
      `)
      .limit(5);

    const queryDuration = Date.now() - queryStartTime;

    if (joinError) {
      console.error(`❌ Join query failed after ${queryDuration}ms:`, joinError);
      return;
    }

    console.log(`✅ Join query succeeded in ${queryDuration}ms`);
    console.log(`Returned ${shopsWithOwner?.length || 0} shops`);

    if (shopsWithOwner && shopsWithOwner.length > 0) {
      console.log('\nFirst shop with owner:', JSON.stringify({
        id: shopsWithOwner[0].id,
        name: shopsWithOwner[0].name,
        owner: shopsWithOwner[0].owner
      }, null, 2));
    }

    // Test 4: Full query like getAllShops controller
    console.log('\n📝 Test 4: Full query (like getAllShops)...');
    const fullQueryStartTime = Date.now();

    let query = client
      .from('shops')
      .select(`
        id,
        name,
        description,
        address,
        detailed_address,
        phone_number,
        email,
        main_category,
        sub_categories,
        shop_type,
        shop_status,
        verification_status,
        commission_rate,
        is_featured,
        created_at,
        updated_at,
        owner:users!shops_owner_id_fkey(
          id,
          name,
          email,
          phone_number
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 9); // page 1, limit 10

    const { data: fullShops, error: fullError, count } = await query;
    const fullQueryDuration = Date.now() - fullQueryStartTime;

    if (fullError) {
      console.error(`❌ Full query failed after ${fullQueryDuration}ms:`, fullError);
      return;
    }

    console.log(`✅ Full query succeeded in ${fullQueryDuration}ms`);
    console.log(`Returned ${fullShops?.length || 0} shops, total count: ${count}`);

    if (fullShops && fullShops.length > 0) {
      console.log('\nSample response structure:');
      console.log(JSON.stringify({
        shops: fullShops.map(s => ({
          id: s.id,
          name: s.name,
          shop_status: s.shop_status,
          owner: s.owner
        })),
        pagination: {
          page: 1,
          limit: 10,
          total: count,
          totalPages: Math.ceil((count || 0) / 10)
        }
      }, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }

  console.log('\n' + '='.repeat(80));
}

testSupabaseShopsQuery();
