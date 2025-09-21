#!/bin/bash
# Supabase Schema Upload Script
# Run this script to upload schema chunks in order

echo "🚀 Starting Supabase schema upload..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

# Upload each chunk
for file in schema-chunks/*.sql; do
    if [ -f "$file" ]; then
        echo "📤 Uploading $file..."
        supabase db push --file "$file" || {
            echo "❌ Failed to upload $file"
            echo "Please upload manually via SQL Editor: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql"
            exit 1
        }
        echo "✅ $file uploaded successfully"
    fi
done

echo "🎉 Schema upload completed!"
