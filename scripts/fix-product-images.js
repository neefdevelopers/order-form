require('dotenv').config();
const db = require('../server/db');

async function fixImages() {
  await db.init();
  
  // 1. Remove dummy test sampler products
  await db.query("DELETE FROM products WHERE name LIKE '%Sampler%'");

  // 2. Map of product name patterns to authentic SVG files
  const mappings = [
    { pattern: '%Hair Oil (100ml)%', url: '/uploads/products/dhaara-oil-100ml.svg' },
    { pattern: '%Hair Oil (200ml)%', url: '/uploads/products/dhaara-oil-200ml.svg' },
    { pattern: '%Growth Combo%', url: '/uploads/products/dhaara-combo.svg' },
    { pattern: '%Value pack(200x3)%', url: '/uploads/products/dhaara-oil-3pack.svg' },
    { pattern: '%Shampoo(100ml)%', url: '/uploads/products/dhaara-shampoo-100ml.svg' },
    { pattern: '%Shampoo(200ml)%', url: '/uploads/products/dhaara-shampoo-200ml.svg' },
    { pattern: '%Shampoo%pack(200x2)%', url: '/uploads/products/dhaara-shampoo-combo.svg' },
    { pattern: '%Face Wash%', url: '/uploads/products/dhaara-facewash.svg' },
    { pattern: '%Hair Care Combo (2x200ml)%', url: '/uploads/products/dhaara-haircare-combo.svg' },
    { pattern: '%Hair & Skin Care Combo%', url: '/uploads/products/dhaara-skin-hair-combo.svg' },
    { pattern: '%Health Mix%(Men & Women%', url: '/uploads/products/ojas-healthmix-combo.svg' },
    { pattern: '%Health Mix%(Men)%', url: '/uploads/products/ojas-healthmix-men.svg' },
    { pattern: '%Health Mix%(Women)%', url: '/uploads/products/ojas-healthmix-women.svg' }
  ];

  for (const m of mappings) {
    if (db.isPostgres) {
      await db.pool.query('UPDATE products SET image_url = $1 WHERE name ILIKE $2', [m.url, m.pattern]);
    } else {
      db.sqliteDb.prepare('UPDATE products SET image_url = ? WHERE name LIKE ?').run(m.url, m.pattern);
    }
  }

  const products = await db.all('SELECT id, name, image_url FROM products ORDER BY id ASC');
  console.log('Successfully updated product image URLs:');
  console.log(JSON.stringify(products, null, 2));
  process.exit(0);
}

fixImages().catch(e => {
  console.error(e);
  process.exit(1);
});
