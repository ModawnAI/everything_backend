/**
 * Migration 085: Fix Referral Commission Per Payment
 * Run this script to execute the migration using backend's Supabase connection
 */

import { getSupabaseClient } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('=================================================================');
  console.log('Migration 085: Fix Referral Commission Per Payment');
  console.log('=================================================================\n');

  const supabase = getSupabaseClient();
  const referrerId = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
  const referredId = '3fc00cc7-e748-45c1-9e30-07a779678a76';

  try {
    // Step 1: Delete existing bulk commission
    console.log('Step 1: Deleting bulk commission record...');
    const { data: deletedData, error: deleteError } = await supabase
      .from('point_transactions')
      .delete()
      .eq('id', '7295bfb5-8273-4136-880f-587b08defd33')
      .eq('transaction_type', 'earned_referral')
      .eq('user_id', referrerId)
      .eq('referred_user_id', referredId)
      .select();

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    console.log(`✓ Deleted ${deletedData?.length || 0} bulk commission record(s)\n`);

    // Step 2: Get all fully paid payments
    console.log('Step 2: Fetching fully paid payments...');
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, amount, paid_at')
      .eq('user_id', referredId)
      .eq('payment_status', 'fully_paid')
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: true });

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    console.log(`✓ Found ${payments?.length || 0} fully paid payments\n`);

    // Step 3: Create individual commissions
    console.log('Step 3: Creating individual commission records...');

    const commissionsToCreate = payments?.map((payment, index) => {
      const paymentOrder = index + 1;
      const basePoints = Math.floor(payment.amount * 0.05);
      const commissionRate = paymentOrder === 1 ? 0.10 : 0.05;
      const commissionAmount = Math.floor(basePoints * commissionRate);

      return {
        user_id: referrerId,
        referred_user_id: referredId,
        amount: commissionAmount,
        transaction_type: 'earned_referral',
        description: `추천 보상: ${commissionAmount}포인트`,
        status: 'available',
        payment_id: payment.id,
        available_from: payment.paid_at,
        expires_at: new Date(new Date(payment.paid_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: payment.paid_at,
        updated_at: payment.paid_at,
        metadata: {
          payment_order: paymentOrder,
          payment_amount: payment.amount,
          base_points: basePoints,
          commission_rate: commissionRate,
          migration: '085_fix_referral_commission_per_payment',
          migrated_at: new Date().toISOString()
        }
      };
    }) || [];

    if (commissionsToCreate.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('point_transactions')
        .insert(commissionsToCreate)
        .select();

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      console.log(`✓ Created ${insertedData?.length || 0} individual commission record(s)\n`);

      // Show created commissions
      console.log('Created commissions:');
      insertedData?.forEach((comm: any) => {
        console.log(`  - Payment #${comm.metadata.payment_order}: ${comm.amount}P (rate: ${comm.metadata.commission_rate * 100}%, payment_id: ${comm.payment_id})`);
      });

      // Calculate total
      const totalCommission = insertedData?.reduce((sum: number, comm: any) => sum + comm.amount, 0) || 0;
      console.log(`\nTotal commission: ${totalCommission}P\n`);

      // Step 4: Update referrals table
      console.log('Step 4: Updating referrals table...');
      const { error: updateError } = await supabase
        .from('referrals')
        .update({
          bonus_amount: totalCommission,
          updated_at: new Date().toISOString()
        })
        .eq('referrer_id', referrerId)
        .eq('referred_id', referredId);

      if (updateError) {
        console.warn(`⚠ Failed to update referrals table: ${updateError.message}`);
      } else {
        console.log('✓ Updated referrals table with total bonus amount\n');
      }
    }

    console.log('=================================================================');
    console.log('✓ Migration 085 completed successfully!');
    console.log('=================================================================');
    console.log('\nNext steps:');
    console.log('1. Test friend detail page - each payment should show correct commission');
    console.log('2. Verify total commission matches sum of individual commissions');
    console.log('3. Check that new payments create individual commissions automatically');
    console.log('=================================================================\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    console.error('\nPlease fix the error and try again.\n');
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
