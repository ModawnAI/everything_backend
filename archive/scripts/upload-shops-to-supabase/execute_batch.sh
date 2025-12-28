#!/bin/bash
# Execute a specific batch file
# Usage: ./execute_batch.sh <batch_number>

BATCH_NUM=$1

if [ -z "$BATCH_NUM" ]; then
  echo "Usage: ./execute_batch.sh <batch_number>"
  echo "Example: ./execute_batch.sh 01"
  exit 1
fi

BATCH_FILE="batches/batch_${BATCH_NUM}.sql"

if [ ! -f "$BATCH_FILE" ]; then
  echo "Error: Batch file not found: $BATCH_FILE"
  exit 1
fi

echo "📦 Executing batch ${BATCH_NUM}..."
echo "📂 File: $BATCH_FILE"
echo ""

# Display file info
SHOP_COUNT=$(grep -c "::uuid" "$BATCH_FILE")
echo "💾 Shops in this batch: $SHOP_COUNT"
echo ""

# Show first few shop names
echo "📋 Preview (first 5 shops):"
grep "::varchar" "$BATCH_FILE" | head -5 | sed "s/.*'\(.*\)'::.*/   - \1/"
echo ""

# Output the SQL for execution
cat "$BATCH_FILE"
