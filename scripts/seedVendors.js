/**
 * Seed script — creates 4 mock vendor accounts using the Supabase Admin API
 * so they can actually log in with signInWithPassword.
 *
 * Usage:
 *   cd backend
 *   node scripts/seedVendors.js
 */

require('dotenv').config();
const connectDB = require('../config/db');

const sb = connectDB();

const VENDORS = [
  {
    email: 'ali.electronics@hivemarket.pk',
    password: 'vendor123',
    name: 'Ali Khan',
    store: {
      storeName: "Ali's Electronics",
      description: 'Premium gadgets, phones, laptops and accessories at competitive prices. Authorized dealer for leading brands in Pakistan.',
      logo: 'https://ui-avatars.com/api/?name=Ali+Electronics&background=3b82f6&color=fff&size=128&bold=true',
      commissionRate: 10,
      status: 'approved',
      totalEarnings: 245000,
      totalSales: 89,
      bankDetails: { bankName: 'HBL', accountNumber: 'PK36HABB0000123456789' },
    },
    categoryKeywords: ['electron', 'tech', 'mobile', 'phone', 'laptop', 'computer'],
  },
  {
    email: 'fatima.fashion@hivemarket.pk',
    password: 'vendor123',
    name: 'Fatima Malik',
    store: {
      storeName: "Fatima's Fashion",
      description: 'Trendy Pakistani and Western clothing for women and kids. New collections added every week.',
      logo: 'https://ui-avatars.com/api/?name=Fatima+Fashion&background=ec4899&color=fff&size=128&bold=true',
      commissionRate: 10,
      status: 'approved',
      totalEarnings: 182000,
      totalSales: 134,
      bankDetails: { bankName: 'Meezan Bank', accountNumber: 'PK04MEZN0001234567890' },
    },
    categoryKeywords: ['cloth', 'fashion', 'apparel', 'wear', 'dress', 'shirt'],
  },
  {
    email: 'ahmed.sports@hivemarket.pk',
    password: 'vendor123',
    name: 'Ahmed Raza',
    store: {
      storeName: 'Ahmed Sports Hub',
      description: 'Everything for sports lovers — gym equipment, cricket gear, football, badminton and outdoor accessories.',
      logo: 'https://ui-avatars.com/api/?name=Ahmed+Sports&background=10b981&color=fff&size=128&bold=true',
      commissionRate: 10,
      status: 'approved',
      totalEarnings: 97500,
      totalSales: 56,
      bankDetails: { bankName: 'UBL', accountNumber: 'PK60UNIL0000000123456' },
    },
    categoryKeywords: ['sport', 'fitness', 'gym', 'outdoor', 'cricket', 'football'],
  },
  {
    email: 'sara.homedecor@hivemarket.pk',
    password: 'vendor123',
    name: 'Sara Qureshi',
    store: {
      storeName: "Sara's Home Decor",
      description: 'Beautiful home decoration, kitchenware and lifestyle products to transform your living space.',
      logo: 'https://ui-avatars.com/api/?name=Sara+Home&background=f59e0b&color=fff&size=128&bold=true',
      commissionRate: 10,
      status: 'pending',
      totalEarnings: 0,
      totalSales: 0,
      bankDetails: {},
    },
    categoryKeywords: ['home', 'kitchen', 'decor', 'furniture', 'living', 'bedroom'],
  },
];

async function run() {
  console.log('🌱 Seeding mock vendors...\n');

  for (const v of VENDORS) {
    process.stdout.write(`  → ${v.store.storeName} (${v.email}) ... `);

    try {
      // 1. Create the auth user via admin API (this is what makes login work)
      const { data: authData, error: authErr } = await sb.auth.admin.createUser({
        email: v.email,
        password: v.password,
        email_confirm: true,
        user_metadata: { name: v.name },
      });

      if (authErr) {
        if (/already (registered|exists)/i.test(authErr.message)) {
          console.log('⚠️  user already exists, skipping');
          continue;
        }
        throw new Error(authErr.message);
      }

      const userId = authData.user.id;

      // 2. Ensure profile row exists (the trigger should create it, but belt-and-suspenders)
      await sb.from('users').upsert(
        { id: userId, email: v.email, name: v.name, role: 'user' },
        { onConflict: 'id' }
      );

      // 3. Create the vendor record
      const { data: vendor, error: vendorErr } = await sb
        .from('vendors')
        .insert({
          user_id: userId,
          store_name: v.store.storeName,
          description: v.store.description,
          logo: v.store.logo,
          commission_rate: v.store.commissionRate,
          status: v.store.status,
          total_earnings: v.store.totalEarnings,
          total_sales: v.store.totalSales,
          bank_details: v.store.bankDetails,
        })
        .select('id')
        .single();

      if (vendorErr) throw new Error(vendorErr.message);

      // 4. Assign matching products to this vendor
      const conditions = v.categoryKeywords
        .map(k => `category.ilike.%${k}%`)
        .join(',');

      const { data: products } = await sb
        .from('products')
        .select('id')
        .or(conditions)
        .is('vendor_id', null)
        .eq('is_active', true)
        .order('sold_count', { ascending: false })
        .limit(6);

      if (products && products.length > 0) {
        const ids = products.map(p => p.id);
        await sb.from('products').update({ vendor_id: vendor.id }).in('id', ids);
        console.log(`✅  vendor + ${ids.length} products assigned`);
      } else {
        console.log('✅  vendor created (no matching products found)');
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
    }
  }

  console.log('\n✅ Done! All vendor accounts use password: vendor123\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
