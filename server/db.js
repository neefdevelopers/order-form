require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool, types } = require('pg');
types.setTypeParser(types.builtins.NUMERIC, val => val === null ? null : parseFloat(val));
const { DatabaseSync } = require('node:sqlite');

const databaseUrl = (process.env.DATABASE_URL || '').trim();
const isPostgres = Boolean(databaseUrl);

let pool = null;
let sqliteDb = null;
const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'orders.db');

if (isPostgres) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('[DB] Configured for Neon PostgreSQL Cloud Database.');
} else {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  console.log(`[DB] Configured for Local SQLite Database (${dbPath}).`);
}

function toPostgresSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

let initPromise = null;

async function initPostgres() {
  await pool.query(`
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_promoters_access_token ON promoters(access_token);

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

  // Ensure all columns exist for migration compatibility
  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_type TEXT NOT NULL DEFAULT 'standard';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS prepaid_shipping_fee NUMERIC NOT NULL DEFAULT 40;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cod_shipping_fee NUMERIC NOT NULL DEFAULT 60;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS allowed_payment_types TEXT NOT NULL DEFAULT 'both';

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_price NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_json TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_amount NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS post_office TEXT;

    ALTER TABLE promoters ADD COLUMN IF NOT EXISTS access_token TEXT;
    ALTER TABLE promoters ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE promoters ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
    ALTER TABLE promoters ADD COLUMN IF NOT EXISTS address TEXT;
  `);

  // Backfill existing promoters missing access_token with secure random tokens
  const promotersWithoutToken = (await pool.query("SELECT id FROM promoters WHERE access_token IS NULL OR access_token = ''")).rows;
  if (promotersWithoutToken.length > 0) {
    for (const p of promotersWithoutToken) {
      const token = crypto.randomBytes(16).toString('hex');
      await pool.query('UPDATE promoters SET access_token = $1 WHERE id = $2', [token, p.id]);
    }
  }

  // Seed default products if empty
  const countRes = await pool.query('SELECT COUNT(*) as count FROM products');
  const count = parseInt(countRes.rows[0].count, 10);
  if (count === 0) {
    const now = new Date().toISOString();
    await pool.query(`
      INSERT INTO products (name, price, image_url, is_active, created_at, updated_at)
      VALUES 
        ('Dhaara Herbal Hair Oil (100ml)', 349, '/uploads/products/dhaara-oil-100ml.svg', 1, $1, $1),
        ('Dhaara Herbal Hair Oil (200ml)', 599, '/uploads/products/dhaara-oil-200ml.svg', 1, $1, $1),
        ('Dhaara Herbal Hair Growth Combo (2x200ml)', 1099, '/uploads/products/dhaara-combo.svg', 1, $1, $1);
    `, [now]);
    console.log('[DB] Seeded Neon PostgreSQL with default Dhaara Herbal Hair Oil products.');
  }

  // Ensure default demo promoters exist without overwriting user promoters
  const now = new Date().toISOString();
  await pool.query(`
    INSERT INTO promoters (promoter_code, name, access_token, is_active, created_at)
    VALUES 
      ('PR-1001', 'North Zone Promoter', $1, 1, $4),
      ('PR-1002', 'South Zone Promoter', $2, 1, $4),
      ('PROM-9981', 'Field Sales Representative', $3, 1, $4)
    ON CONFLICT (promoter_code) DO NOTHING;
  `, [
    crypto.randomBytes(16).toString('hex'),
    crypto.randomBytes(16).toString('hex'),
    crypto.randomBytes(16).toString('hex'),
    now
  ]);
}

async function initSqlite() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      shipping_type TEXT NOT NULL DEFAULT 'standard',
      prepaid_shipping_fee REAL NOT NULL DEFAULT 40,
      cod_shipping_fee REAL NOT NULL DEFAULT 60,
      allowed_payment_types TEXT NOT NULL DEFAULT 'both',
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
      items_amount REAL NOT NULL DEFAULT 0,
      shipping_amount REAL NOT NULL DEFAULT 0,
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promoters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promoter_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
      name TEXT,
      phone_number TEXT,
      aadhaar_number TEXT,
      address TEXT,
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

    CREATE TABLE IF NOT EXISTS order_seq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL
    );
  `);

  const productCols = sqliteDb.prepare('PRAGMA table_info(products)').all();
  if (!productCols.some(c => c.name === 'price')) {
    sqliteDb.exec('ALTER TABLE products ADD COLUMN price REAL NOT NULL DEFAULT 500;');
  }
  if (!productCols.some(c => c.name === 'shipping_type')) {
    sqliteDb.exec("ALTER TABLE products ADD COLUMN shipping_type TEXT NOT NULL DEFAULT 'standard';");
  }
  if (!productCols.some(c => c.name === 'prepaid_shipping_fee')) {
    sqliteDb.exec("ALTER TABLE products ADD COLUMN prepaid_shipping_fee REAL NOT NULL DEFAULT 40;");
  }
  if (!productCols.some(c => c.name === 'cod_shipping_fee')) {
    sqliteDb.exec("ALTER TABLE products ADD COLUMN cod_shipping_fee REAL NOT NULL DEFAULT 60;");
  }
  if (!productCols.some(c => c.name === 'allowed_payment_types')) {
    sqliteDb.exec("ALTER TABLE products ADD COLUMN allowed_payment_types TEXT NOT NULL DEFAULT 'both';");
  }

  const orderCols = sqliteDb.prepare('PRAGMA table_info(orders)').all();
  if (!orderCols.some(c => c.name === 'product_price')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN product_price REAL NOT NULL DEFAULT 0;');
  }
  if (!orderCols.some(c => c.name === 'total_amount')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0;');
  }
  if (!orderCols.some(c => c.name === 'items_json')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN items_json TEXT;');
  }
  if (!orderCols.some(c => c.name === 'items_amount')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN items_amount REAL NOT NULL DEFAULT 0;');
  }
  if (!orderCols.some(c => c.name === 'shipping_amount')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN shipping_amount REAL NOT NULL DEFAULT 0;');
  }
  if (!orderCols.some(c => c.name === 'payment_method')) {
    sqliteDb.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cod';");
  }
  if (!orderCols.some(c => c.name === 'payment_screenshot_url')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN payment_screenshot_url TEXT;');
  }
  if (!orderCols.some(c => c.name === 'transaction_id')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN transaction_id TEXT;');
  }
  if (!orderCols.some(c => c.name === 'payment_status')) {
    sqliteDb.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';");
  }
  if (!orderCols.some(c => c.name === 'post_office')) {
    sqliteDb.exec('ALTER TABLE orders ADD COLUMN post_office TEXT;');
  }

  const promoterCols = sqliteDb.prepare('PRAGMA table_info(promoters)').all();
  if (!promoterCols.some(c => c.name === 'access_token')) {
    sqliteDb.exec('ALTER TABLE promoters ADD COLUMN access_token TEXT;');
  }
  if (!promoterCols.some(c => c.name === 'phone_number')) {
    sqliteDb.exec('ALTER TABLE promoters ADD COLUMN phone_number TEXT;');
  }
  if (!promoterCols.some(c => c.name === 'aadhaar_number')) {
    sqliteDb.exec('ALTER TABLE promoters ADD COLUMN aadhaar_number TEXT;');
  }
  if (!promoterCols.some(c => c.name === 'address')) {
    sqliteDb.exec('ALTER TABLE promoters ADD COLUMN address TEXT;');
  }
  sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_promoters_access_token ON promoters(access_token);');

  const promotersWithoutToken = sqliteDb.prepare("SELECT id FROM promoters WHERE access_token IS NULL OR access_token = ''").all();
  if (promotersWithoutToken.length > 0) {
    const updateTokenStmt = sqliteDb.prepare('UPDATE promoters SET access_token = ? WHERE id = ?');
    for (const p of promotersWithoutToken) {
      const token = crypto.randomBytes(16).toString('hex');
      updateTokenStmt.run(token, p.id);
    }
  }

  sqliteDb.exec(`
    UPDATE products SET name = 'Dhaara Herbal Hair Oil (100ml)', price = 349, image_url = '/uploads/products/dhaara-oil-100ml.svg' WHERE id = 1 OR name LIKE '%Headphones%';
    UPDATE products SET name = 'Dhaara Herbal Hair Oil (200ml)', price = 599, image_url = '/uploads/products/dhaara-oil-200ml.svg' WHERE id = 2 OR name LIKE '%Watch%';
    UPDATE products SET name = 'Dhaara Herbal Hair Growth Combo (2x200ml)', price = 1099, image_url = '/uploads/products/dhaara-combo.svg' WHERE id = 3 OR name LIKE '%Mouse%';
  `);

  const countStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM products');
  const countRow = countStmt.get();
  if (!countRow || countRow.count === 0) {
    const insertProduct = sqliteDb.prepare(`
      INSERT INTO products (name, price, image_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);

    const now = new Date().toISOString();
    insertProduct.run('Dhaara Herbal Hair Oil (100ml)', 349, '/uploads/products/dhaara-oil-100ml.svg', now, now);
    insertProduct.run('Dhaara Herbal Hair Oil (200ml)', 599, '/uploads/products/dhaara-oil-200ml.svg', now, now);
    insertProduct.run('Dhaara Herbal Hair Growth Combo (2x200ml)', 1099, '/uploads/products/dhaara-combo.svg', now, now);
    console.log('[DB] Seeded local SQLite with Dhaara Herbal Hair Oil products.');
  }

  const promoterCountStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM promoters');
  const promoterCountRow = promoterCountStmt.get();
  if (!promoterCountRow || promoterCountRow.count === 0) {
    const insertPromoter = sqliteDb.prepare(`
      INSERT OR IGNORE INTO promoters (promoter_code, name, access_token, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `);
    const now = new Date().toISOString();
    insertPromoter.run('PR-1001', 'North Zone Promoter', crypto.randomBytes(16).toString('hex'), now);
    insertPromoter.run('PR-1002', 'South Zone Promoter', crypto.randomBytes(16).toString('hex'), now);
    insertPromoter.run('PROM-9981', 'Field Sales Representative', crypto.randomBytes(16).toString('hex'), now);

    try {
      const existingOrderPromoters = sqliteDb.prepare('SELECT DISTINCT promoter_id FROM orders WHERE promoter_id IS NOT NULL AND promoter_id != ""').all();
      for (const row of existingOrderPromoters) {
        insertPromoter.run(row.promoter_id.trim(), 'Existing Promoter', crypto.randomBytes(16).toString('hex'), now);
      }
    } catch (e) {
      // Ignore if orders table is empty
    }

    console.log('[DB] Seeded local SQLite with initial authorized promoter IDs.');
  }
}

function init() {
  if (!initPromise) {
    initPromise = (async () => {
      if (isPostgres) {
        await initPostgres();
      } else {
        await initSqlite();
      }
    })();
  }
  return initPromise;
}

// Auto-trigger initialization in background so it begins immediately on module load
init().catch((err) => {
  console.error('[DB] Initialization error:', err);
});

async function query(sql, params = []) {
  await init();
  const arrParams = Array.isArray(params) ? params : [params];
  if (isPostgres) {
    const res = await pool.query(toPostgresSql(sql), arrParams);
    return res.rows;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...arrParams);
  }
}

async function get(sql, params = []) {
  await init();
  const arrParams = Array.isArray(params) ? params : [params];
  if (isPostgres) {
    const res = await pool.query(toPostgresSql(sql), arrParams);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return stmt.get(...arrParams) || null;
  }
}

async function all(sql, params = []) {
  return query(sql, params);
}

async function run(sql, params = []) {
  await init();
  const arrParams = Array.isArray(params) ? params : [params];
  if (isPostgres) {
    let pgSql = toPostgresSql(sql.trim());
    const isInsert = /^insert\s+into/i.test(pgSql);
    const hasReturning = /returning/i.test(pgSql);
    if (isInsert && !hasReturning) {
      pgSql += ' RETURNING id';
    }
    const res = await pool.query(pgSql, arrParams);
    return {
      lastInsertRowid: res.rows?.[0]?.id,
      rowCount: res.rowCount,
      rows: res.rows
    };
  } else {
    const stmt = sqliteDb.prepare(sql);
    const result = stmt.run(...arrParams);
    return {
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes,
      rowCount: result.changes
    };
  }
}

async function exec(sql) {
  await init();
  if (isPostgres) {
    await pool.query(sql);
  } else {
    sqliteDb.exec(sql);
  }
}

function prepare(sql) {
  return {
    all: (...args) => query(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    get: (...args) => get(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    run: (...args) => run(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args)
  };
}

async function getNextOrderId() {
  await init();
  if (isPostgres) {
    const res = await pool.query("SELECT nextval('order_id_seq') AS num");
    const num = parseInt(res.rows[0].num, 10);
    return `ORD-${String(num).padStart(4, '0')}`;
  } else {
    const now = new Date().toISOString();
    const res = sqliteDb.prepare("INSERT INTO order_seq (created_at) VALUES (?)").run(now);
    const num = Number(res.lastInsertRowid);
    return `ORD-${String(num).padStart(4, '0')}`;
  }
}

module.exports = {
  isPostgres,
  dbPath,
  pool,
  sqliteDb,
  init,
  query,
  get,
  all,
  run,
  exec,
  prepare,
  getNextOrderId
};
