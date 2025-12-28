#!/bin/bash
# Execute all batches

-- Batch 1/5
cat batches/batch_01.sql | supabase db execute

-- Batch 2/5
cat batches/batch_02.sql | supabase db execute

-- Batch 3/5
cat batches/batch_03.sql | supabase db execute

-- Batch 4/5
cat batches/batch_04.sql | supabase db execute

-- Batch 5/5
cat batches/batch_05.sql | supabase db execute