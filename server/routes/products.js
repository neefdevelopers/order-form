const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

// Configure multer storage for product images
const uploadsDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `prod_${cleanBase}_${uniqueSuffix}${ext || '.png'}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file type. Only JPEG, PNG, WEBP, GIF, and SVG are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter
});

// ==========================================
// PUBLIC CUSTOMER ENDPOINT
// ==========================================
// Only active products appear in the customer order form, with their saved price
router.get('/products', async (req, res) => {
  try {
    const products = await db.all('SELECT id, name, price, image_url, shipping_type, prepaid_shipping_fee, cod_shipping_fee, allowed_payment_types FROM products WHERE is_active = 1 ORDER BY name ASC');
    res.json(products);
  } catch (err) {
    console.error('Error fetching customer products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ==========================================
// ADMIN PRODUCT MANAGEMENT ENDPOINTS
// ==========================================

// 1. List all products (both active and inactive)
router.get('/admin/products', requireAdminAuth, async (req, res) => {
  try {
    const products = await db.all('SELECT * FROM products ORDER BY id DESC');
    res.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 2. Add a new product
router.post('/admin/products', requireAdminAuth, upload.single('image'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const price = req.body.price !== undefined ? parseFloat(req.body.price) : 0;
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Valid product price (₹) is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Product image is required' });
    }

    const imageUrl = `/uploads/products/${req.file.filename}`;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active === '0' || req.body.is_active === 0 || req.body.is_active === false ? 0 : 1) : 1;
    
    // Shipping and payment types configuration
    const shippingType = (req.body.shipping_type || 'standard').trim().toLowerCase();
    let prepaidFee = 40;
    let codFee = 60;
    if (shippingType === 'free') {
      prepaidFee = 0;
      codFee = 0;
    } else if (shippingType === 'custom') {
      prepaidFee = req.body.prepaid_shipping_fee !== undefined ? Math.max(0, parseFloat(req.body.prepaid_shipping_fee) || 0) : 40;
      codFee = req.body.cod_shipping_fee !== undefined ? Math.max(0, parseFloat(req.body.cod_shipping_fee) || 0) : 60;
    }
    const allowedPaymentTypes = (req.body.allowed_payment_types || 'both').trim().toLowerCase();

    const now = new Date().toISOString();

    const result = await db.run(`
      INSERT INTO products (
        name, price, image_url, is_active,
        shipping_type, prepaid_shipping_fee, cod_shipping_fee, allowed_payment_types,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, price, imageUrl, isActive,
      shippingType, prepaidFee, codFee, allowedPaymentTypes,
      now, now
    ]);

    const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Product added successfully',
      product: newProduct
    });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: err.message || 'Failed to add product' });
  }
});

// 3. Edit product details
router.put('/admin/products/:id', requireAdminAuth, upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    if (!name) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }

    let price = existing.price;
    if (req.body.price !== undefined) {
      const parsedPrice = parseFloat(req.body.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Valid product price (₹) is required' });
      }
      price = parsedPrice;
    }

    let imageUrl = existing.image_url;
    if (req.file) {
      imageUrl = `/uploads/products/${req.file.filename}`;
      // Clean up previous image if it was an uploaded file (not a seeded SVG)
      if (existing.image_url.startsWith('/uploads/products/prod_')) {
        const oldPath = path.join(__dirname, '../..', existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlink(oldPath, () => {});
        }
      }
    }

    let isActive = existing.is_active;
    if (req.body.is_active !== undefined) {
      isActive = (req.body.is_active === '1' || req.body.is_active === 1 || req.body.is_active === true || req.body.is_active === 'true') ? 1 : 0;
    }

    // Shipping and payment types update
    let shippingType = existing.shipping_type || 'standard';
    if (req.body.shipping_type !== undefined) {
      shippingType = req.body.shipping_type.trim().toLowerCase();
    }

    let prepaidFee = existing.prepaid_shipping_fee !== undefined ? existing.prepaid_shipping_fee : 40;
    let codFee = existing.cod_shipping_fee !== undefined ? existing.cod_shipping_fee : 60;

    if (shippingType === 'free') {
      prepaidFee = 0;
      codFee = 0;
    } else if (shippingType === 'standard') {
      prepaidFee = 40;
      codFee = 60;
    } else if (shippingType === 'custom') {
      if (req.body.prepaid_shipping_fee !== undefined) {
        prepaidFee = Math.max(0, parseFloat(req.body.prepaid_shipping_fee) || 0);
      }
      if (req.body.cod_shipping_fee !== undefined) {
        codFee = Math.max(0, parseFloat(req.body.cod_shipping_fee) || 0);
      }
    }

    let allowedPaymentTypes = existing.allowed_payment_types || 'both';
    if (req.body.allowed_payment_types !== undefined) {
      allowedPaymentTypes = req.body.allowed_payment_types.trim().toLowerCase();
    }

    const now = new Date().toISOString();
    await db.run(`
      UPDATE products
      SET name = ?, price = ?, image_url = ?, is_active = ?,
          shipping_type = ?, prepaid_shipping_fee = ?, cod_shipping_fee = ?, allowed_payment_types = ?,
          updated_at = ?
      WHERE id = ?
    `, [name, price, imageUrl, isActive, shippingType, prepaidFee, codFee, allowedPaymentTypes, now, id]);

    const updated = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      message: 'Product updated successfully',
      product: updated
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// 4. Delete product
router.delete('/admin/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Clean up uploaded image if custom
    if (existing.image_url.startsWith('/uploads/products/prod_')) {
      const oldPath = path.join(__dirname, '../..', existing.image_url);
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, () => {});
      }
    }

    await db.run('DELETE FROM products WHERE id = ?', [id]);

    res.json({
      message: 'Product deleted successfully',
      id
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
