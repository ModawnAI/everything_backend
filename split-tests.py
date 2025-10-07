#!/usr/bin/env python3
"""
Split comprehensive-admin-api-test.ts into individual test files by category
"""

import re
import os

# Read the comprehensive test file
with open('comprehensive-admin-api-test.ts', 'r') as f:
    content = f.read()

# Define categories and their markers
categories = [
    ('01-auth', '1️⃣  ADMIN AUTHENTICATION', '2️⃣  SHOP MANAGEMENT'),
    ('02-shop-management', '2️⃣  SHOP MANAGEMENT', '3️⃣  SHOP SERVICES'),
    ('03-shop-services', '3️⃣  SHOP SERVICES', '4️⃣  SHOP APPROVAL'),
    ('04-shop-approval', '4️⃣  SHOP APPROVAL', '5️⃣  USER MANAGEMENT'),
    ('05-user-management', '5️⃣  USER MANAGEMENT', '6️⃣  RESERVATIONS'),
    ('06-reservations', '6️⃣  RESERVATIONS', '7️⃣  PAYMENTS'),
    ('07-payments', '7️⃣  PAYMENTS', '8️⃣  ANALYTICS'),
    ('08-analytics', '8️⃣  ANALYTICS', '9️⃣'),  # Analytics is last
]

# Extract header (common code)
header_end = content.find('async function runTests()')
header = content[:header_end]

# Create tests/admin directory
os.makedirs('tests/admin', exist_ok=True)

for category_name, start_marker, end_marker in categories:
    print(f"Creating test file for {category_name}...")

    # Find section boundaries
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print(f"  ⚠️  Start marker not found: {start_marker}")
        continue

    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        # For last category, find the final summary
        end_idx = content.find('// Summary', start_idx)
        if end_idx == -1:
            end_idx = content.find('runTests()', start_idx)

    # Extract section
    section = content[start_idx:end_idx]

    # Build the test file
    test_file = f"""{header}
async function runTests() {{
  console.log('===================================================================');
  console.log('🧪 {category_name.upper()} Tests');
  console.log('===================================================================\\n');

{section}

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${{PASSED}}`);
  console.log(`❌ Failed: ${{FAILED}}`);
  console.log(`⏭️  Skipped: ${{SKIPPED}}`);
  console.log(`📈 Total: ${{PASSED + FAILED + SKIPPED}}`);
  console.log('='.repeat(70));

  if (FAILED > 0) {{
    console.log('\\n❌ Some tests failed. See details above.');
    process.exit(1);
  }} else {{
    console.log('\\n✅ All tests passed!');
    process.exit(0);
  }}
}}

// Run tests
runTests().catch((error) => {{
  console.error('\\n💥 Test suite crashed:', error);
  process.exit(1);
}});
"""

    # Write to file
    filename = f"tests/admin/{category_name}.test.ts"
    with open(filename, 'w') as f:
        f.write(test_file)

    print(f"  ✅ Created {filename}")

print("\n✅ All test files created!")
print("\nYou can now run individual tests with:")
print("  npx ts-node tests/admin/01-auth.test.ts")
print("  npx ts-node tests/admin/07-payments.test.ts")
print("  etc.")
