require('dotenv').config();
const { Pool } = require('pg');

async function restoreOriginal() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const orig = [
    { id: 1, url: '/uploads/products/prod_HAIR_OIL_1_PAGE_1794566735715-841231544.webp' },
    { id: 2, url: '/uploads/products/prod_HAIR_OIL_1_PAGE_1794566761240-834579285.webp' },
    { id: 3, url: '/uploads/products/prod_HAIR_OIL_1_PAGE_1794566777068-866411910.webp' },
    { id: 4, url: '/uploads/products/prod_HAIR_OIL_1_PAGE_1794566845580-473576346.webp' },
    { id: 5, url: '/uploads/products/prod_SHAMPOO__1_PAGE_1794566940942-900680224.webp' },
    { id: 6, url: '/uploads/products/prod_SHAMPOO__1_PAGE_1794566979306-449422364.webp' },
    { id: 7, url: '/uploads/products/prod_SHAMPOO__1_PAGE_1794567045616-815129371.webp' },
    { id: 8, url: '/uploads/products/prod_FACW_WASH_1_1794567127776-502850188.jpg' },
    { id: 9, url: '/uploads/products/prod_FIFTH_PAGE_1794567208032-115960308.webp' },
    { id: 10, url: '/uploads/products/prod_ALL_PRODUCT_BEM_FIT_PRODUCT_IMAGE_copy_1794567268623-612520337.webp' },
    { id: 11, url: '/uploads/products/prod_heromen_1_1794567322542-547260514.webp' },
    { id: 12, url: '/uploads/products/prod_herowomen_1_1794567365818-206318924.webp' },
    { id: 13, url: '/uploads/products/prod_heromen_1_1794567401182-527745798.webp' }
  ];

  for (const item of orig) {
    await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [item.url, item.id]);
  }

  const res = await pool.query('SELECT id, name, image_url FROM products ORDER BY id ASC');
  console.log('Restored original product image URLs:');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
  process.exit(0);
}

restoreOriginal().catch(e => {
  console.error(e);
  process.exit(1);
});

