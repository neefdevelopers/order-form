require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

async function clearNeon() {
  console.log('========================================================');
  console.log('            NEON POSTGRESQL DATABASE RESET             ');
  console.log('========================================================\n');

  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('1. Clearing all customer orders and order items...');
    await client.query('TRUNCATE order_items, orders CASCADE;');
    await client.query('ALTER SEQUENCE IF EXISTS order_id_seq RESTART WITH 1;');
    console.log('   ✓ Deleted all orders, item breakdowns, and reset Order ID sequence to 0001.');

    console.log('2. Resetting products table and sequence...');
    await client.query('TRUNCATE products RESTART IDENTITY CASCADE;');
    console.log('   ✓ Products table emptied and ID sequence reset to 1.');

    console.log('3. Resetting promoters table and sequence...');
    await client.query('TRUNCATE promoters RESTART IDENTITY CASCADE;');
    console.log('   ✓ Promoters table emptied and ID sequence reset to 1.');

    console.log('4. Seeding clean authentic Dhaara products...');
    const now = new Date().toISOString();
    await client.query(`
      INSERT INTO products (
        name, price, image_url, is_active,
        shipping_type, prepaid_shipping_fee, cod_shipping_fee, allowed_payment_types,
        created_at, updated_at
      )
      VALUES 
        ('Dhaara Herbal Hair Oil (100ml)', 349, '/uploads/products/dhaara-oil-100ml.svg', 1, 'standard', 40, 60, 'both', $1, $1),
        ('Dhaara Herbal Hair Oil (200ml)', 599, '/uploads/products/dhaara-oil-200ml.svg', 1, 'standard', 40, 60, 'both', $1, $1),
        ('Dhaara Herbal Hair Growth Combo (2x200ml)', 1099, '/uploads/products/dhaara-combo.svg', 1, 'standard', 40, 60, 'both', $1, $1);
    `, [now]);
    console.log('   ✓ Seeded:');
    console.log('     - ID 1: Dhaara Herbal Hair Oil (100ml) [₹349]');
    console.log('     - ID 2: Dhaara Herbal Hair Oil (200ml) [₹599]');
    console.log('     - ID 3: Dhaara Herbal Hair Growth Combo (2x200ml) [₹1099]');

    console.log('5. Seeding default authorized promoters...');
    await client.query(`
      INSERT INTO promoters (promoter_code, name, access_token, is_active, created_at)
      VALUES 
        ('PR-1001', 'North Zone Promoter', $1, 1, $4),
        ('PR-1002', 'South Zone Promoter', $2, 1, $4),
        ('PROM-9981', 'Field Sales Representative', $3, 1, $4);
    `, [
      crypto.randomBytes(16).toString('hex'),
      crypto.randomBytes(16).toString('hex'),
      crypto.randomBytes(16).toString('hex'),
      now
    ]);
    console.log('   ✓ Seeded:');
    console.log('     - PR-1001 (North Zone Promoter)');
    console.log('     - PR-1002 (South Zone Promoter)');
    console.log('     - PROM-9981 (Field Sales Representative)');

    console.log('\n========================================================');
    console.log('   NEON DATABASE CLEARED & RESET SUCCESSFULLY!          ');
    console.log('========================================================');
    console.log('Total Orders: 0 (completely fresh)');
    console.log('Total Products: 3 clean authentic products');
    console.log('Total Promoters: 3 active promoters');

  } finally {
    client.release();
    await pool.end();
  }
}

clearNeon().catch(err => {
  console.error('\nFailed to clear Neon database:', err);
  process.exit(1);
});

