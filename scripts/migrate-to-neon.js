#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

async function migrate() {
  console.log('========================================================');
  console.log('   LOCAL SQLITE -> NEON POSTGRESQL DATA MIGRATION TOOL  ');
  console.log('========================================================\n');

  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set in your environment or .env file.');
    console.error('Please add your Neon PostgreSQL connection string to .env:');
    console.error('DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require\n');
    process.exit(1);
  }

  const sqlitePath = path.join(__dirname, '../data/orders.db');
  if (!fs.existsSync(sqlitePath)) {
    console.log(`Notice: Local SQLite file not found at ${sqlitePath}. Nothing to migrate.`);
    process.exit(0);
  }

  console.log(`1. Reading local SQLite database at: ${sqlitePath}`);
  const sqlite = new DatabaseSync(sqlitePath);

  console.log(`2. Connecting to Neon PostgreSQL cloud database...`);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('   ✓ Connected to Neon successfully.\n');

  try {
    console.log('3. Ensuring target tables exist in Neon PostgreSQL...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        image_url TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        shipping_type TEXT NOT NULL DEFAULT 'standard',
        prepaid_shipping_fee NUMERIC NOT NULL DEFAULT 40,
        cod_shipping_fee NUMERIC NOT NULL DEFAULT 60,
        allowed_payment_types TEXT NOT NULL DEFAULT 'both',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        promoter_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_price NUMERIC NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL,
        total_amount NUMERIC NOT NULL DEFAULT 0,
        items_amount NUMERIC NOT NULL DEFAULT 0,
        shipping_amount NUMERIC NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cod',
        payment_screenshot_url TEXT,
        transaction_id TEXT,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        customer_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        complete_address TEXT NOT NULL,
        pincode TEXT NOT NULL,
        post_office TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        items_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS promoters (
        id SERIAL PRIMARY KEY,
        promoter_code TEXT UNIQUE NOT NULL,
        name TEXT,
        phone_number TEXT,
        aadhaar_number TEXT,
        address TEXT,
        access_token TEXT UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_price NUMERIC NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        subtotal NUMERIC NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE SEQUENCE IF NOT EXISTS order_id_seq START WITH 1;
    `);
    console.log('   ✓ Tables confirmed.\n');

    // -----------------------------------------------------------
    // Migrate Products
    // -----------------------------------------------------------
    console.log('4. Migrating products...');
    const products = sqlite.prepare('SELECT * FROM products').all();
    let productsMigrated = 0;
    for (const p of products) {
      await client.query(`
        INSERT INTO products (
          id, name, price, image_url, is_active,
          shipping_type, prepaid_shipping_fee, cod_shipping_fee, allowed_payment_types,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          is_active = EXCLUDED.is_active,
          shipping_type = EXCLUDED.shipping_type,
          prepaid_shipping_fee = EXCLUDED.prepaid_shipping_fee,
          cod_shipping_fee = EXCLUDED.cod_shipping_fee,
          allowed_payment_types = EXCLUDED.allowed_payment_types,
          updated_at = EXCLUDED.updated_at;
      `, [
        p.id, p.name, p.price || 0, p.image_url, p.is_active !== undefined ? p.is_active : 1,
        p.shipping_type || 'standard', p.prepaid_shipping_fee !== undefined ? p.prepaid_shipping_fee : 40,
        p.cod_shipping_fee !== undefined ? p.cod_shipping_fee : 60,
        p.allowed_payment_types || 'both',
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString()
      ]);
      productsMigrated++;
    }
    // Update serial sequence
    await client.query(`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1));`);
    console.log(`   ✓ Migrated ${productsMigrated} product(s).`);

    // -----------------------------------------------------------
    // Migrate Promoters
    // -----------------------------------------------------------
    console.log('5. Migrating promoters...');
    const promoters = sqlite.prepare('SELECT * FROM promoters').all();
    let promotersMigrated = 0;
    for (const pr of promoters) {
      await client.query(`
        INSERT INTO promoters (id, promoter_code, name, phone_number, aadhaar_number, address, access_token, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (promoter_code) DO UPDATE SET
          name = EXCLUDED.name,
          phone_number = EXCLUDED.phone_number,
          aadhaar_number = EXCLUDED.aadhaar_number,
          address = EXCLUDED.address,
          access_token = COALESCE(promoters.access_token, EXCLUDED.access_token),
          is_active = EXCLUDED.is_active;
      `, [
        pr.id, pr.promoter_code, pr.name, pr.phone_number || '', pr.aadhaar_number || '', pr.address || '', pr.access_token,
        pr.is_active !== undefined ? pr.is_active : 1,
        pr.created_at || new Date().toISOString()
      ]);
      promotersMigrated++;
    }
    await client.query(`SELECT setval('promoters_id_seq', COALESCE((SELECT MAX(id) FROM promoters), 1));`);
    console.log(`   ✓ Migrated ${promotersMigrated} promoter(s).`);

    // -----------------------------------------------------------
    // Migrate Orders
    // -----------------------------------------------------------
    console.log('6. Migrating orders...');
    const orders = sqlite.prepare('SELECT * FROM orders').all();
    let ordersMigrated = 0;
    for (const o of orders) {
      await client.query(`
        INSERT INTO orders (
          id, promoter_id, product_id, product_name, product_price,
          quantity, total_amount, items_amount, shipping_amount,
          payment_method, payment_screenshot_url, transaction_id, payment_status,
          items_json, customer_name, phone_number,
          complete_address, pincode, post_office, city, state, created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        ON CONFLICT (id) DO NOTHING;
      `, [
        o.id, o.promoter_id, o.product_id, o.product_name, o.product_price || 0,
        o.quantity || 1, o.total_amount || 0, o.items_amount || 0, o.shipping_amount || 0,
        o.payment_method || 'cod', o.payment_screenshot_url || null, o.transaction_id || null,
        o.payment_status || 'pending', o.items_json || null, o.customer_name, o.phone_number,
        o.complete_address, o.pincode, o.post_office || null, o.city, o.state, o.created_at
      ]);
      ordersMigrated++;
    }
    console.log(`   ✓ Migrated ${ordersMigrated} order(s).`);

    // -----------------------------------------------------------
    // Migrate Order Items
    // -----------------------------------------------------------
    console.log('7. Migrating individual order items...');
    let orderItemsMigrated = 0;
    try {
      const orderItems = sqlite.prepare('SELECT * FROM order_items').all();
      for (const oi of orderItems) {
        await client.query(`
          INSERT INTO order_items (id, order_id, product_id, product_name, product_price, quantity, subtotal, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING;
        `, [
          oi.id, oi.order_id, oi.product_id, oi.product_name,
          oi.product_price || 0, oi.quantity || 1, oi.subtotal || 0,
          oi.created_at || new Date().toISOString()
        ]);
        orderItemsMigrated++;
      }
      await client.query(`SELECT setval('order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 1));`);
    } catch (e) {
      // order_items table might be empty
    }
    console.log(`   ✓ Migrated ${orderItemsMigrated} order item(s).\n`);

    console.log('========================================================');
    console.log('   MIGRATION COMPLETED SUCCESSFULLY!                    ');
    console.log('========================================================');
    console.log(`All local products (${productsMigrated}), promoters (${promotersMigrated}), and orders (${ordersMigrated}) are now live on Neon PostgreSQL!`);

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});

