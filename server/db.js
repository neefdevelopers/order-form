const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'orders.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance and durability
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    promoter_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    complete_address TEXT NOT NULL,
    pincode TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promoters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promoter_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
`);

// Migration helper: Ensure columns exist in case the table already existed
const productCols = db.prepare('PRAGMA table_info(products)').all();
if (!productCols.some(c => c.name === 'price')) {
  db.exec('ALTER TABLE products ADD COLUMN price REAL NOT NULL DEFAULT 500;');
}

const orderCols = db.prepare('PRAGMA table_info(orders)').all();
if (!orderCols.some(c => c.name === 'product_price')) {
  db.exec('ALTER TABLE orders ADD COLUMN product_price REAL NOT NULL DEFAULT 0;');
}
if (!orderCols.some(c => c.name === 'total_amount')) {
  db.exec('ALTER TABLE orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0;');
}

// Ensure default products have real prices
db.exec(`
  UPDATE products SET price = 2499 WHERE name LIKE '%Headphones%' AND (price IS NULL OR price = 0 OR price = 500);
  UPDATE products SET price = 1899 WHERE name LIKE '%Watch%' AND (price IS NULL OR price = 0 OR price = 500);
  UPDATE products SET price = 799 WHERE name LIKE '%Mouse%' AND (price IS NULL OR price = 0 OR price = 500);
`);

// Seed default products if empty
const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
const countRow = countStmt.get();
if (!countRow || countRow.count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, price, image_url, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `);

  const now = new Date().toISOString();
  insertProduct.run('Wireless Noise-Canceling Headphones', 2499, '/uploads/products/headphones.svg', now, now);
  insertProduct.run('Smart Fitness Watch', 1899, '/uploads/products/smartwatch.svg', now, now);
  insertProduct.run('Ergonomic Wireless Mouse', 799, '/uploads/products/mouse.svg', now, now);
  console.log('Database seeded with initial active products with prices.');
}

// Seed default promoters if empty
const promoterCountStmt = db.prepare('SELECT COUNT(*) as count FROM promoters');
const promoterCountRow = promoterCountStmt.get();
if (!promoterCountRow || promoterCountRow.count === 0) {
  const insertPromoter = db.prepare(`
    INSERT OR IGNORE INTO promoters (promoter_code, name, is_active, created_at)
    VALUES (?, ?, 1, ?)
  `);
  const now = new Date().toISOString();
  insertPromoter.run('PR-1001', 'North Zone Promoter', now);
  insertPromoter.run('PR-1002', 'South Zone Promoter', now);
  insertPromoter.run('PROM-9981', 'Field Sales Representative', now);

  // Also import any distinct promoter_ids from existing orders
  try {
    const existingOrderPromoters = db.prepare('SELECT DISTINCT promoter_id FROM orders WHERE promoter_id IS NOT NULL AND promoter_id != ""').all();
    for (const row of existingOrderPromoters) {
      insertPromoter.run(row.promoter_id.trim(), 'Existing Promoter', now);
    }
  } catch (e) {
    // Ignore if orders table is empty
  }

  console.log('Database seeded with initial authorized promoter IDs.');
}

module.exports = db;
