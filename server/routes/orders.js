const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

// Helper to generate a unique readable Order ID: ORD-YYYYMMDD-XXXX
function generateOrderId() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  return `ORD-${year}${month}${day}-${randomSuffix}`;
}

// In-memory set or cache to prevent rapid duplicate submissions within 5 seconds
const recentSubmissions = new Map();

// ==========================================
// CUSTOMER ORDER SUBMISSION ENDPOINT
// ==========================================
router.post('/orders', (req, res) => {
  try {
    const {
      promoter_id,
      product_id,
      quantity,
      customer_name,
      phone_number,
      complete_address,
      pincode,
      city,
      state
    } = req.body;

    // Field validations
    const errors = [];
    if (!promoter_id || !promoter_id.trim()) errors.push('Promoter ID is required');
    if (!product_id) errors.push('Product selection is required');
    
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1) errors.push('Quantity must be at least 1');

    if (!customer_name || !customer_name.trim()) errors.push('Full Name is required');
    if (!phone_number || !phone_number.trim()) errors.push('Phone Number is required');
    if (!complete_address || !complete_address.trim()) errors.push('Complete Address is required');
    if (!pincode || !pincode.trim()) errors.push('Pincode is required');
    if (!city || !city.trim()) errors.push('City is required');
    if (!state || !state.trim()) errors.push('State is required');

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    // Verify product exists and is active, and fetch its saved price from the database
    const product = db.prepare('SELECT id, name, price, is_active FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Selected product not found' });
    }
    if (!product.is_active) {
      return res.status(400).json({ error: 'Selected product is no longer active' });
    }

    // Server-calculated prices (never trust client-supplied prices)
    const productPrice = Number(product.price) || 0;
    const totalAmount = productPrice * parsedQty;

    // Duplicate submission prevention check
    const submissionKey = `${promoter_id.trim()}-${product_id}-${parsedQty}-${customer_name.trim().toLowerCase()}-${phone_number.trim()}`;
    const nowTimestamp = Date.now();
    if (recentSubmissions.has(submissionKey)) {
      const prevTimestamp = recentSubmissions.get(submissionKey);
      if (nowTimestamp - prevTimestamp < 8000) { // 8 seconds debounce window
        return res.status(429).json({ error: 'Duplicate submission detected. Please wait a moment before submitting again.' });
      }
    }
    recentSubmissions.set(submissionKey, nowTimestamp);

    // Clean old entries from recentSubmissions periodically
    if (recentSubmissions.size > 200) {
      for (const [key, timestamp] of recentSubmissions.entries()) {
        if (nowTimestamp - timestamp > 60000) {
          recentSubmissions.delete(key);
        }
      }
    }

    // Generate unique order ID
    let orderId = generateOrderId();
    // Verify it doesn't collide
    while (db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId)) {
      orderId = generateOrderId();
    }

    const createdAt = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO orders (
        id, promoter_id, product_id, product_name, product_price,
        quantity, total_amount, customer_name, phone_number,
        complete_address, pincode, city, state, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      orderId,
      promoter_id.trim(),
      product.id,
      product.name,
      productPrice,
      parsedQty,
      totalAmount,
      customer_name.trim(),
      phone_number.trim(),
      complete_address.trim(),
      pincode.trim(),
      city.trim(),
      state.trim(),
      createdAt
    );

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    return res.status(201).json({
      success: true,
      orderId: createdOrder.id,
      orderDate: createdOrder.created_at,
      productPrice: createdOrder.product_price,
      totalAmount: createdOrder.total_amount,
      message: 'Order placed successfully'
    });
  } catch (err) {
    console.error('Error placing order:', err);
    return res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// ==========================================
// ADMIN ORDER MANAGEMENT ENDPOINTS
// ==========================================

// List all submitted orders
router.get('/admin/orders', requireAdminAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = stmt.all();
    res.json(orders);
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// View single order details
router.get('/admin/orders/:id', requireAdminAuth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

module.exports = router;
