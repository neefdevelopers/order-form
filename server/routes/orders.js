const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

// Configure multer storage for payment screenshots
const uploadsPaymentsDir = path.join(__dirname, '../../uploads/payments');
if (!fs.existsSync(uploadsPaymentsDir)) {
  fs.mkdirSync(uploadsPaymentsDir, { recursive: true });
}

const paymentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsPaymentsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `pay_${uniqueSuffix}${ext || '.png'}`);
  }
});

const uploadPaymentScreenshot = multer({
  storage: paymentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.toLowerCase().startsWith('image/')) {
      cb(null, true);
    } else {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, PNG, WEBP, GIF, etc.) are allowed for payment screenshots.'));
      }
    }
  }
});

// Conditionally handle multipart/form-data for payment screenshot upload
function handleOrderUpload(req, res, next) {
  if (req.is('multipart/form-data')) {
    uploadPaymentScreenshot.single('payment_screenshot')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Error uploading payment screenshot' });
      }
      next();
    });
  } else {
    next();
  }
}

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
// CUSTOMER ORDER SUBMISSION ENDPOINT (Multiple Products Support)
// ==========================================
router.post('/orders', handleOrderUpload, (req, res) => {
  try {
    const body = req.body || {};
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
    } = body;

    // Parse items if passed as string in FormData
    let items = body.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    // Field validations
    const errors = [];
    if (!promoter_id || !promoter_id.trim()) errors.push('Promoter ID is required');

    // Support both new `items` array and legacy `product_id` + `quantity`
    let orderItemsInput = [];
    if (Array.isArray(items) && items.length > 0) {
      orderItemsInput = items;
    } else if (product_id !== undefined && product_id !== null && product_id !== '') {
      orderItemsInput = [{ product_id, quantity: quantity || 1 }];
    } else {
      errors.push('At least one product must be selected');
    }

    if (!customer_name || !customer_name.trim()) errors.push('Full Name is required');
    if (!phone_number || !phone_number.trim()) errors.push('Phone Number is required');
    if (!complete_address || !complete_address.trim()) errors.push('Complete Address is required');
    if (!pincode || !pincode.trim()) errors.push('Pincode is required');
    if (!city || !city.trim()) errors.push('City is required');
    if (!state || !state.trim()) errors.push('State is required');

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    // Payment method and screenshot handling
    const postOffice = (body.post_office || '').trim();
    const rawPaymentMethod = (body.payment_method || '').trim().toLowerCase();
    const paymentMethod = rawPaymentMethod === 'prepaid' ? 'prepaid' : 'cod';
    const transactionId = (body.transaction_id || '').trim();
    const paymentScreenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : (body.payment_screenshot_url || null);

    if (paymentMethod === 'prepaid' && !paymentScreenshotUrl) {
      return res.status(400).json({ error: 'Payment screenshot is required for Prepaid orders. Please upload your payment receipt.' });
    }

    // Verify promoter ID is authorized and active
    const promoter = db.prepare('SELECT id, promoter_code, is_active FROM promoters WHERE LOWER(promoter_code) = LOWER(?)').get(promoter_id.trim());
    if (!promoter) {
      return res.status(400).json({ error: 'Invalid Promoter ID. Only authorized promoters can place orders.' });
    }
    if (promoter.is_active !== 1) {
      return res.status(403).json({ error: 'This Promoter ID is currently inactive. Please contact the administrator.' });
    }

    // Consolidate duplicate products if any in input
    const itemMap = new Map();
    for (const it of orderItemsInput) {
      const pid = parseInt(it.product_id, 10);
      const qty = parseInt(it.quantity, 10);
      if (isNaN(pid)) {
        return res.status(400).json({ error: 'Invalid product selected' });
      }
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ error: 'Quantity must be at least 1 for all selected products' });
      }
      itemMap.set(pid, (itemMap.get(pid) || 0) + qty);
    }

    if (itemMap.size === 0) {
      return res.status(400).json({ error: 'At least one product must be selected' });
    }

    // Verify each product exists, is active, and fetch its verified DB price & shipping settings
    const validatedItems = [];
    let overallItemsSubtotal = 0;
    let overallQuantity = 0;
    let allFreeShipping = true;
    let maxPrepaidFee = 0;
    let maxCodFee = 0;

    for (const [pid, qty] of itemMap.entries()) {
      const product = db.prepare('SELECT id, name, price, is_active, shipping_type, prepaid_shipping_fee, cod_shipping_fee, allowed_payment_types FROM products WHERE id = ?').get(pid);
      if (!product) {
        return res.status(404).json({ error: `Selected product ID ${pid} not found` });
      }
      if (!product.is_active) {
        return res.status(400).json({ error: `Selected product "${product.name}" is no longer active` });
      }

      // Check allowed payment type
      if (product.allowed_payment_types === 'prepaid' && paymentMethod === 'cod') {
        return res.status(400).json({ error: `Product "${product.name}" only supports Prepaid orders.` });
      }
      if (product.allowed_payment_types === 'cod' && paymentMethod === 'prepaid') {
        return res.status(400).json({ error: `Product "${product.name}" only supports Cash on Delivery (COD) orders.` });
      }

      const isFree = product.shipping_type === 'free' || (product.prepaid_shipping_fee === 0 && product.cod_shipping_fee === 0);
      if (!isFree) {
        allFreeShipping = false;
        maxPrepaidFee = Math.max(maxPrepaidFee, product.prepaid_shipping_fee !== undefined ? product.prepaid_shipping_fee : 40);
        maxCodFee = Math.max(maxCodFee, product.cod_shipping_fee !== undefined ? product.cod_shipping_fee : 60);
      }

      const unitPrice = Number(product.price) || 0;
      const subtotal = unitPrice * qty;
      overallItemsSubtotal += subtotal;
      overallQuantity += qty;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        product_price: unitPrice,
        quantity: qty,
        subtotal
      });
    }

    // Calculate shipping amount
    let shippingAmount = 0;
    if (body.shipping_amount !== undefined) {
      shippingAmount = Math.max(0, parseFloat(body.shipping_amount) || 0);
    } else if (body.payment_method) {
      if (!allFreeShipping) {
        shippingAmount = paymentMethod === 'prepaid' ? (maxPrepaidFee || 40) : (maxCodFee || 60);
      }
    } else {
      // Legacy backwards-compatibility
      shippingAmount = 0;
    }

    const totalAmount = overallItemsSubtotal + shippingAmount;
    const paymentStatus = paymentMethod === 'prepaid' ? 'pending_verification' : 'cod_pending';

    // Duplicate submission prevention check
    const itemsKey = validatedItems.map(it => `${it.product_id}:${it.quantity}`).sort().join('|');
    const submissionKey = `${promoter_id.trim()}-${itemsKey}-${customer_name.trim().toLowerCase()}-${phone_number.trim()}`;
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
    while (db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId)) {
      orderId = generateOrderId();
    }

    const createdAt = new Date().toISOString();
    const primaryItem = validatedItems[0];
    const productSummary = validatedItems.length === 1
      ? primaryItem.product_name
      : validatedItems.map(it => `${it.product_name} (x${it.quantity})`).join(', ');

    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        id, promoter_id, product_id, product_name, product_price,
        quantity, total_amount, items_amount, shipping_amount,
        payment_method, payment_screenshot_url, transaction_id, payment_status,
        items_json, customer_name, phone_number,
        complete_address, pincode, post_office, city, state, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrderStmt.run(
      orderId,
      promoter_id.trim(),
      primaryItem.product_id,
      productSummary,
      primaryItem.product_price,
      overallQuantity,
      totalAmount,
      overallItemsSubtotal,
      shippingAmount,
      paymentMethod,
      paymentScreenshotUrl,
      transactionId,
      paymentStatus,
      JSON.stringify(validatedItems),
      customer_name.trim(),
      phone_number.trim(),
      complete_address.trim(),
      pincode.trim(),
      postOffice,
      city.trim(),
      state.trim(),
      createdAt
    );

    // Insert normalized individual records into order_items
    const insertOrderItemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_price,
        quantity, subtotal, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of validatedItems) {
      insertOrderItemStmt.run(
        orderId,
        it.product_id,
        it.product_name,
        it.product_price,
        it.quantity,
        it.subtotal,
        createdAt
      );
    }

    return res.status(201).json({
      success: true,
      orderId,
      orderDate: createdAt,
      productPrice: primaryItem.product_price,
      itemsAmount: overallItemsSubtotal,
      shippingAmount,
      totalAmount,
      paymentMethod,
      paymentScreenshotUrl,
      paymentStatus,
      quantity: overallQuantity,
      postOffice,
      items: validatedItems,
      message: 'Order placed successfully'
    });
  } catch (err) {
    console.error('Error placing order:', err);
    return res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// Helper to attach parsed `items` array to an order record
function attachItemsToOrder(order) {
  if (!order) return order;
  let items = [];
  if (order.items_json) {
    try {
      items = JSON.parse(order.items_json);
    } catch (e) {
      items = [];
    }
  }
  if (!items || items.length === 0) {
    const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
    const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * (order.quantity || 1);
    items = [{
      product_id: order.product_id,
      product_name: order.product_name,
      product_price: priceVal,
      quantity: order.quantity || 1,
      subtotal: totalVal
    }];
  }
  return { ...order, items };
}

// ==========================================
// ADMIN ORDER MANAGEMENT ENDPOINTS
// ==========================================

// List all submitted orders (optionally filtered by promoter_id)
router.get('/admin/orders', requireAdminAuth, (req, res) => {
  try {
    let sql = 'SELECT * FROM orders';
    const params = [];
    if (req.query.promoter_id && req.query.promoter_id.trim()) {
      sql += ' WHERE LOWER(promoter_id) = LOWER(?)';
      params.push(req.query.promoter_id.trim());
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    const orders = stmt.all(...params).map(attachItemsToOrder);
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
    res.json(attachItemsToOrder(order));
  } catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

module.exports = router;
