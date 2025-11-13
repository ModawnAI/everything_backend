/**
 * Check notification table schema
 */
import { getSupabaseClient } from '../src/config/database';

async function checkSchema() {
  const client = getSupabaseClient();

  console.log('=== Checking Notifications Table Schema ===');
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    if (data && data.length > 0) {
      console.log('✅ Sample notification record:');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('\n📋 Available columns:');
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log('⚠️ No notifications in table');
    }
  }

  console.log('\n=== Checking if notifications have related_entity_id ===');
  const { data: withEntity, error: entityError } = await client
    .from('notifications')
    .select('id, notification_type, related_entity_id, related_entity_type, title')
    .not('related_entity_id', 'is', null)
    .limit(5);

  if (entityError) {
    console.error('❌ Error:', entityError.message);
  } else {
    console.log(`✅ Found ${withEntity?.length || 0} notifications with related entities:`);
    withEntity?.forEach(n => {
      console.log(`  - ${n.notification_type}: ${n.title}`);
      console.log(`    Entity: ${n.related_entity_type} / ${n.related_entity_id}`);
    });
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
