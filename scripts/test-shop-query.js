const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testShopQuery() {
  const shopId = 'ffa1478d-ae03-4034-bf19-5ded5d3e8867';

  console.log('Testing shop query for ID:', shopId);

  // First try without shop_contact_methods since it doesn't exist
  const { data, error } = await supabase
    .from('shops')
    .select(`
      *,
      shop_images(image_url, alt_text, is_primary, display_order),
      shop_services(
        id, name, description, category, price_min, price_max,
        duration_minutes, is_available, display_order
      )
    `)
    .eq('id', shopId)
    .eq('shop_status', 'active')
    .single();

  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Success! Found shop:', {
      id: data.id,
      name: data.name,
      status: data.shop_status,
      hasImages: data.shop_images ? data.shop_images.length : 0,
      hasServices: data.shop_services ? data.shop_services.length : 0,
      hasContactMethods: data.shop_contact_methods ? data.shop_contact_methods.length : 0
    });
  }

  process.exit(0);
}

testShopQuery();