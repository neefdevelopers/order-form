const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

// ==========================================
// PUBLIC PROMOTER VALIDATION ENDPOINT
// ==========================================
// Customer Order Form validates if promoter ID is authorized before proceeding
router.get('/promoters/validate/:code', (req, res) => {
  try {
    const code = (req.params.code || '').trim();
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Promoter ID is required' });
    }

    const stmt = db.prepare('SELECT id, promoter_code, name, is_active FROM promoters WHERE LOWER(promoter_code) = LOWER(?)');
    const promoter = stmt.get(code);

    if (!promoter) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid Promoter ID. Only authorized promoters can place orders.'
      });
    }

    if (promoter.is_active !== 1) {
      return res.status(403).json({
        valid: false,
        error: 'This Promoter ID is currently inactive. Please contact the administrator.'
      });
    }

    res.json({
      valid: true,
      promoter: {
        code: promoter.promoter_code,
        name: promoter.name
      }
    });
  } catch (err) {
    console.error('Error validating promoter code:', err);
    res.status(500).json({ valid: false, error: 'Failed to validate Promoter ID' });
  }
});

// ==========================================
// ADMIN PROMOTER MANAGEMENT ENDPOINTS
// ==========================================

// 1. List all promoters with order count
router.get('/admin/promoters', requireAdminAuth, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        p.*, 
        COUNT(o.id) AS order_count
      FROM promoters p
      LEFT JOIN orders o ON LOWER(o.promoter_id) = LOWER(p.promoter_code)
      GROUP BY p.id
      ORDER BY p.id DESC
    `);
    const promoters = stmt.all();

    // Ensure all promoters have an access_token populated
    const updateTokenStmt = db.prepare('UPDATE promoters SET access_token = ? WHERE id = ?');
    for (const p of promoters) {
      if (!p.access_token) {
        p.access_token = crypto.randomBytes(16).toString('hex');
        updateTokenStmt.run(p.access_token, p.id);
      }
    }

    res.json(promoters);
  } catch (err) {
    console.error('Error fetching admin promoters:', err);
    res.status(500).json({ error: 'Failed to fetch promoters' });
  }
});

// 2. Add a new promoter ID
router.post('/admin/promoters', requireAdminAuth, (req, res) => {
  try {
    const promoterCode = (req.body.promoter_code || '').trim();
    const name = (req.body.name || '').trim();
    const isActive = req.body.is_active !== undefined ? (req.body.is_active === 0 || req.body.is_active === false || req.body.is_active === '0' ? 0 : 1) : 1;

    if (!promoterCode) {
      return res.status(400).json({ error: 'Promoter ID code is required (e.g. PR-1001)' });
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM promoters WHERE LOWER(promoter_code) = LOWER(?)').get(promoterCode);
    if (existing) {
      return res.status(400).json({ error: `Promoter ID "${promoterCode}" already exists` });
    }

    const now = new Date().toISOString();
    const accessToken = crypto.randomBytes(16).toString('hex');
    const insertStmt = db.prepare(`
      INSERT INTO promoters (promoter_code, name, access_token, is_active, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(promoterCode, name, accessToken, isActive, now);
    const newPromoter = db.prepare('SELECT * FROM promoters WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Promoter ID added successfully',
      promoter: newPromoter
    });
  } catch (err) {
    console.error('Error adding promoter:', err);
    res.status(500).json({ error: err.message || 'Failed to add promoter' });
  }
});

// 3. Edit promoter ID
router.put('/admin/promoters/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid promoter ID' });
    }

    const existing = db.prepare('SELECT * FROM promoters WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Promoter not found' });
    }

    const promoterCode = req.body.promoter_code !== undefined ? req.body.promoter_code.trim() : existing.promoter_code;
    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;

    if (!promoterCode) {
      return res.status(400).json({ error: 'Promoter ID code cannot be empty' });
    }

    // If changing code, ensure no collision
    if (promoterCode.toLowerCase() !== existing.promoter_code.toLowerCase()) {
      const duplicate = db.prepare('SELECT id FROM promoters WHERE LOWER(promoter_code) = LOWER(?) AND id != ?').get(promoterCode, id);
      if (duplicate) {
        return res.status(400).json({ error: `Promoter ID "${promoterCode}" already exists` });
      }
    }

    let isActive = existing.is_active;
    if (req.body.is_active !== undefined) {
      isActive = (req.body.is_active === 1 || req.body.is_active === true || req.body.is_active === '1') ? 1 : 0;
    }

    const updateStmt = db.prepare(`
      UPDATE promoters
      SET promoter_code = ?, name = ?, is_active = ?
      WHERE id = ?
    `);

    updateStmt.run(promoterCode, name, isActive, id);
    const updated = db.prepare('SELECT * FROM promoters WHERE id = ?').get(id);

    res.json({
      message: 'Promoter updated successfully',
      promoter: updated
    });
  } catch (err) {
    console.error('Error updating promoter:', err);
    res.status(500).json({ error: err.message || 'Failed to update promoter' });
  }
});

// 4. Delete promoter ID
router.delete('/admin/promoters/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid promoter ID' });
    }

    const existing = db.prepare('SELECT * FROM promoters WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Promoter not found' });
    }

    db.prepare('DELETE FROM promoters WHERE id = ?').run(id);

    res.json({
      message: 'Promoter ID deleted successfully',
      id
    });
  } catch (err) {
    console.error('Error deleting promoter:', err);
    res.status(500).json({ error: 'Failed to delete promoter' });
  }
});

// 5. Admin: Regenerate promoter access link token
router.post('/admin/promoters/:id/regenerate-token', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid promoter ID' });
    }

    const existing = db.prepare('SELECT * FROM promoters WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Promoter not found' });
    }

    const newToken = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE promoters SET access_token = ? WHERE id = ?').run(newToken, id);
    const updated = db.prepare('SELECT * FROM promoters WHERE id = ?').get(id);

    res.json({
      message: 'Access token regenerated successfully',
      promoter: updated
    });
  } catch (err) {
    console.error('Error regenerating token:', err);
    res.status(500).json({ error: 'Failed to regenerate access token' });
  }
});

// ==========================================
// PROMOTER DASHBOARD (AUTHENTICATED VIA UNIQUE TOKEN)
// ==========================================
const handlePromoterDashboard = (req, res) => {
  try {
    const token = (req.params.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const promoterStmt = db.prepare('SELECT id, promoter_code, name, is_active, created_at FROM promoters WHERE access_token = ?');
    const promoter = promoterStmt.get(token);

    if (!promoter) {
      return res.status(404).json({ error: 'Invalid or expired promoter access link.' });
    }

    if (promoter.is_active !== 1) {
      return res.status(403).json({ error: 'This promoter account is currently inactive. Please contact your administrator.' });
    }

    // Fetch only this promoter's orders
    const ordersStmt = db.prepare(`
      SELECT 
        id,
        promoter_id,
        product_id,
        product_name,
        product_price,
        quantity,
        total_amount,
        items_json,
        created_at
      FROM orders 
      WHERE LOWER(promoter_id) = LOWER(?)
      ORDER BY created_at DESC
    `);
    const rawOrders = ordersStmt.all(promoter.promoter_code);

    let totalProductsSold = 0;
    let totalOrderAmount = 0;

    const orders = rawOrders.map(order => {
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

      const orderItemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const orderTotal = Number(order.total_amount) || 0;

      totalProductsSold += orderItemCount;
      totalOrderAmount += orderTotal;

      return {
        id: order.id,
        created_at: order.created_at,
        total_amount: orderTotal,
        total_quantity: orderItemCount,
        items: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          product_price: Number(it.product_price) || 0,
          quantity: Number(it.quantity) || 1,
          subtotal: Number(it.subtotal) || (Number(it.product_price) || 0) * (Number(it.quantity) || 1)
        }))
      };
    });

    res.json({
      promoter: {
        id: promoter.id,
        promoter_code: promoter.promoter_code,
        name: promoter.name,
        is_active: promoter.is_active
      },
      stats: {
        total_orders: orders.length,
        total_products_sold: totalProductsSold,
        total_order_amount: totalOrderAmount
      },
      orders
    });
  } catch (err) {
    console.error('Error fetching promoter dashboard data:', err);
    res.status(500).json({ error: 'Failed to load promoter dashboard data' });
  }
};

router.get('/promoters/dashboard/:token', handlePromoterDashboard);
router.get('/promoter-dashboard/:token', handlePromoterDashboard);

module.exports = router;

