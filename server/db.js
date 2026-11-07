const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
    access_token TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
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
if (!orderCols.some(c => c.name === 'items_json')) {
  db.exec('ALTER TABLE orders ADD COLUMN items_json TEXT;');
}

const promoterCols = db.prepare('PRAGMA table_info(promoters)').all();
if (!promoterCols.some(c => c.name === 'access_token')) {
  db.exec('ALTER TABLE promoters ADD COLUMN access_token TEXT;');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_promoters_access_token ON promoters(access_token);');

// Backfill existing promoters missing access_token with secure random tokens
const promotersWithoutToken = db.prepare("SELECT id FROM promoters WHERE access_token IS NULL OR access_token = ''").all();
if (promotersWithoutToken.length > 0) {
  const updateTokenStmt = db.prepare('UPDATE promoters SET access_token = ? WHERE id = ?');
  for (const p of promotersWithoutToken) {
    const token = crypto.randomBytes(16).toString('hex');
    updateTokenStmt.run(token, p.id);
  }
}

// Ensure products use Dhaara Herbal Hair Oil branding and authentic prices
db.exec(`
  UPDATE products SET name = 'Dhaara Herbal Hair Oil (100ml)', price = 349, image_url = '/uploads/products/dhaara-oil-100ml.svg' WHERE id = 1 OR name LIKE '%Headphones%';
  UPDATE products SET name = 'Dhaara Herbal Hair Oil (200ml)', price = 599, image_url = '/uploads/products/dhaara-oil-200ml.svg' WHERE id = 2 OR name LIKE '%Watch%';
  UPDATE products SET name = 'Dhaara Herbal Hair Growth Combo (2x200ml)', price = 1099, image_url = '/uploads/products/dhaara-combo.svg' WHERE id = 3 OR name LIKE '%Mouse%';
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
  insertProduct.run('Dhaara Herbal Hair Oil (100ml)', 349, '/uploads/products/dhaara-oil-100ml.svg', now, now);
  insertProduct.run('Dhaara Herbal Hair Oil (200ml)', 599, '/uploads/products/dhaara-oil-200ml.svg', now, now);
  insertProduct.run('Dhaara Herbal Hair Growth Combo (2x200ml)', 1099, '/uploads/products/dhaara-combo.svg', now, now);
  console.log('Database seeded with Dhaara Herbal Hair Oil products.');
}

// Seed default promoters if empty
const promoterCountStmt = db.prepare('SELECT COUNT(*) as count FROM promoters');
const promoterCountRow = promoterCountStmt.get();
if (!promoterCountRow || promoterCountRow.count === 0) {
  const insertPromoter = db.prepare(`
    INSERT OR IGNORE INTO promoters (promoter_code, name, access_token, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `);
  const now = new Date().toISOString();
  insertPromoter.run('PR-1001', 'North Zone Promoter', crypto.randomBytes(16).toString('hex'), now);
  insertPromoter.run('PR-1002', 'South Zone Promoter', crypto.randomBytes(16).toString('hex'), now);
  insertPromoter.run('PROM-9981', 'Field Sales Representative', crypto.randomBytes(16).toString('hex'), now);

  // Also import any distinct promoter_ids from existing orders
  try {
    const existingOrderPromoters = db.prepare('SELECT DISTINCT promoter_id FROM orders WHERE promoter_id IS NOT NULL AND promoter_id != ""').all();
    for (const row of existingOrderPromoters) {
      insertPromoter.run(row.promoter_id.trim(), 'Existing Promoter', crypto.randomBytes(16).toString('hex'), now);
    }
  } catch (e) {
    // Ignore if orders table is empty
  }

  console.log('Database seeded with initial authorized promoter IDs.');
}

module.exports = db;
