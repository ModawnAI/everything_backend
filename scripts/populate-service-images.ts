/**
 * Populate Service Images with Placeholder Data
 *
 * This script adds placeholder images to all services that don't have images yet.
 */

import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800', // Nail art
  'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800', // Beauty salon
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800', // Spa
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800', // Manicure
  'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=800', // Salon
];

async function populateServiceImages() {
  try {
    console.log('🔍 Fetching all services...');

    // Get all services
    const { data: services, error: servicesError } = await supabase
      .from('shop_services')
      .select('id, name, category');

    if (servicesError) {
      throw new Error(`Failed to fetch services: ${servicesError.message}`);
    }

    if (!services || services.length === 0) {
      console.log('⚠️  No services found');
      return;
    }

    console.log(`✅ Found ${services.length} services`);

    // Check which services already have images
    const { data: existingImages, error: imagesError } = await supabase
      .from('service_images')
      .select('service_id');

    if (imagesError) {
      throw new Error(`Failed to fetch existing images: ${imagesError.message}`);
    }

    const servicesWithImages = new Set(existingImages?.map(img => img.service_id) || []);

    // Filter services without images
    const servicesNeedingImages = services.filter(s => !servicesWithImages.has(s.id));

    console.log(`📸 ${servicesNeedingImages.length} services need images`);

    if (servicesNeedingImages.length === 0) {
      console.log('✅ All services already have images!');
      return;
    }

    // Create placeholder images for each service
    const imagesToInsert = [];

    for (const service of servicesNeedingImages) {
      // Add 2-3 placeholder images per service
      const numImages = Math.floor(Math.random() * 2) + 2; // 2 or 3 images

      for (let i = 0; i < numImages; i++) {
        imagesToInsert.push({
          service_id: service.id,
          image_url: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length],
          alt_text: `${service.name} - Image ${i + 1}`,
          display_order: i
        });
      }
    }

    console.log(`📦 Inserting ${imagesToInsert.length} placeholder images...`);

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < imagesToInsert.length; i += batchSize) {
      const batch = imagesToInsert.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('service_images')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
      } else {
        console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} images)`);
      }
    }

    console.log('🎉 Successfully populated service images!');

  } catch (error) {
    console.error('❌ Error populating service images:', error);
    process.exit(1);
  }
}

// Run the script
populateServiceImages()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
