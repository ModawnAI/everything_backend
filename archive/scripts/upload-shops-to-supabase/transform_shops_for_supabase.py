#!/usr/bin/env python3
"""
Transform geocoded shop data to Supabase-compatible format
Maps Korean beauty shop types to ServiceCategory enums
"""

import csv
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Korean shop type to ServiceCategory enum mapping
CATEGORY_MAPPING = {
    '네일미용업': 'nail',
    '일반미용업': 'hair',
    '종합미용업': 'hair',
    '피부미용업': 'waxing',
    '화장ㆍ분장 미용업': 'eyebrow_tattoo',
    '미용업': 'hair',  # Generic beauty -> hair
}

# Valid enum values
VALID_CATEGORIES = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair']

def clean_phone_number(phone: str) -> str:
    """Clean phone number format"""
    # Remove extra spaces
    cleaned = ' '.join(phone.split())
    # Ensure it starts with proper format
    if not cleaned.startswith('0'):
        cleaned = f'0{cleaned}'
    return cleaned

def parse_shop_type(type_str: str) -> Tuple[str, Optional[List[str]]]:
    """
    Parse Korean shop type string and return (main_category, sub_categories)

    Examples:
        '네일미용업' -> ('nail', None)
        '네일미용업, 화장ㆍ분장 미용업' -> ('nail', ['eyebrow_tattoo'])
        '일반미용업, 네일미용업, 화장ㆍ분장 미용업' -> ('hair', ['nail', 'eyebrow_tattoo'])
    """
    # Split by comma or Korean comma
    types = [t.strip() for t in type_str.replace('，', ',').split(',')]

    # Map all types to categories
    categories = []
    for t in types:
        # Try exact match first
        if t in CATEGORY_MAPPING:
            categories.append(CATEGORY_MAPPING[t])
        else:
            # Try partial match
            found = False
            for korean_type, enum_val in CATEGORY_MAPPING.items():
                if korean_type in t:
                    categories.append(enum_val)
                    found = True
                    break
            if not found:
                # Default to hair for unknown types
                categories.append('hair')

    # Remove duplicates while preserving order
    seen = set()
    unique_categories = []
    for cat in categories:
        if cat not in seen:
            seen.add(cat)
            unique_categories.append(cat)

    if not unique_categories:
        return ('hair', None)  # Default fallback

    main = unique_categories[0]
    sub = unique_categories[1:] if len(unique_categories) > 1 else None

    return (main, sub)

def transform_shop(row: Dict, index: int) -> Optional[Dict]:
    """Transform a single shop row to Supabase format"""

    # Skip if no coordinates
    if not row.get('LATITUDE') or not row.get('LONGITUDE'):
        print(f"⚠️  Skipping {row['SHOP_NAME']} - no coordinates")
        return None

    try:
        lat = float(row['LATITUDE'])
        lon = float(row['LONGITUDE'])
    except (ValueError, TypeError):
        print(f"⚠️  Skipping {row['SHOP_NAME']} - invalid coordinates")
        return None

    # Validate coordinates are in Seoul area
    if not (37.4 <= lat <= 37.7 and 126.8 <= lon <= 127.2):
        print(f"⚠️  Warning: {row['SHOP_NAME']} coordinates outside Seoul bounds: {lat}, {lon}")

    # Parse categories
    main_category, sub_categories = parse_shop_type(row['TYPE_OF_SHOP'])

    # Generate UUID
    shop_id = str(uuid.uuid4())

    # Create timestamp
    now = datetime.utcnow().isoformat() + 'Z'

    # Build shop object
    shop = {
        'id': shop_id,
        'name': row['SHOP_NAME'].strip(),
        'address': row['ADDRESS'].strip(),
        'phone_number': clean_phone_number(row['PHONE_NUMBER']),
        'latitude': lat,
        'longitude': lon,
        'main_category': main_category,
        'sub_categories': sub_categories,
        'shop_type': 'non_partnered',
        'shop_status': 'pending_approval',
        'verification_status': 'pending',
        'commission_rate': 0.15,
        'total_bookings': 0,
        'is_featured': False,
        'created_at': now,
        'updated_at': now
    }

    return shop

def main():
    input_file = 'shop_with_coordinates.csv'
    output_file = 'shops_for_supabase.json'

    shops = []
    skipped = 0

    print("🔄 Transforming shop data for Supabase...")
    print(f"📂 Reading from: {input_file}")

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for idx, row in enumerate(reader, 1):
            shop = transform_shop(row, idx)
            if shop:
                shops.append(shop)
                if idx <= 5:  # Show first 5 for verification
                    print(f"✓ {idx}. {shop['name'][:30]:30} -> {shop['main_category']:15} ({shop['latitude']:.4f}, {shop['longitude']:.4f})")
            else:
                skipped += 1

    # Category distribution
    category_counts = {}
    for shop in shops:
        cat = shop['main_category']
        category_counts[cat] = category_counts.get(cat, 0) + 1

    print(f"\n{'='*60}")
    print(f"📊 Transformation Summary:")
    print(f"{'='*60}")
    print(f"Total shops processed: {len(shops) + skipped}")
    print(f"Successfully transformed: {len(shops)}")
    print(f"Skipped (no coordinates): {skipped}")
    print(f"\n📈 Category Distribution:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat:20} : {count:3} shops")

    # Save to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(shops, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Output saved to: {output_file}")
    print(f"{'='*60}\n")

    # Also create a small test batch
    test_batch_file = 'shops_test_batch.json'
    test_batch = shops[:10]  # First 10 shops
    with open(test_batch_file, 'w', encoding='utf-8') as f:
        json.dump(test_batch, f, ensure_ascii=False, indent=2)
    print(f"📝 Test batch (10 shops) saved to: {test_batch_file}")

    return shops

if __name__ == '__main__':
    shops = main()
