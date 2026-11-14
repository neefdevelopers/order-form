require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

async function clearOrdersAndPromoters() {
  console.log('========================================================');
  console.log('       CLEAR ALL ORDERS AND PROMOTERS IN DATABASE       ');
  console.log('========================================================\n');

  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  // 1. Clear in Neon PostgreSQL if configured
  if (databaseUrl) {
    console.log('1. Connecting to Neon PostgreSQL...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      console.log('   - Clearing order_items and orders...');
      await client.query('TRUNCATE TABLE order_items, orders CASCADE;');
      await client.query('ALTER SEQUENCE IF EXISTS order_id_seq RESTART WITH 1;');
      console.log('     ✓ All orders cleared. Order ID sequence reset to 1 (ORD-0001).');

      console.log('   - Clearing promoters...');
      await client.query('TRUNCATE TABLE promoters RESTART IDENTITY CASCADE;');
      console.log('     ✓ All promoters cleared. Promoter ID sequence reset.');

      const orderCount = await client.query('SELECT COUNT(*) FROM orders');
      const promoterCount = await client.query('SELECT COUNT(*) FROM promoters');
      const productCount = await client.query('SELECT COUNT(*) FROM products');
      console.log(`\n   Neon DB Status:`);
      console.log(`   - Orders: ${orderCount.rows[0].count}`);
      console.log(`   - Promoters: ${promoterCount.rows[0].count}`);
      console.log(`   - Products preserved: ${productCount.rows[0].count}`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  // 2. Also clear local SQLite data/orders.db if it exists
  const sqlitePath = path.join(__dirname, '../data/orders.db');
  if (fs.existsSync(sqlitePath)) {
    console.log('\n2. Clearing local SQLite database (data/orders.db)...');
    try {
      const sqlite = new DatabaseSync(sqlitePath);
      sqlite.exec('DELETE FROM order_items;');
      sqlite.exec('DELETE FROM orders;');
      sqlite.exec('DELETE FROM promoters;');
      try { sqlite.exec('DELETE FROM order_seq;'); } catch (e) {}
      try { sqlite.exec("DELETE FROM sqlite_sequence WHERE name IN ('promoters', 'order_seq');"); } catch (e) {}
      console.log('   ✓ Local SQLite orders and promoters cleared.');
    } catch (e) {
      console.log('   (Local SQLite notice):', e.message);
    }
  }

  // 3. Clean up uploaded payment receipt screenshots
  const paymentsDir = path.join(__dirname, '../uploads/payments');
  if (fs.existsSync(paymentsDir)) {
    const files = fs.readdirSync(paymentsDir);
    let deletedCount = 0;
    for (const f of files) {
      if (f !== '.gitkeep') {
        try {
          fs.unlinkSync(path.join(paymentsDir, f));
          deletedCount++;
        } catch (e) {}
      }
    }
    console.log(`\n3. Uploaded Payment Receipts Cleaned: ${deletedCount} files removed.`);
  }

  console.log('\n========================================================');
  console.log('   SUCCESS: ALL ORDERS AND PROMOTERS HAVE BEEN CLEARED! ');
  console.log('   - Next order will start cleanly from: ORD-0001        ');
  console.log('   - Products were untouched and preserved               ');
  console.log('========================================================\n');
  process.exit(0);
}

clearOrdersAndPromoters().catch(err => {
  console.error('\nError clearing orders and promoters:', err);
  process.exit(1);
});

