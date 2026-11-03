const express = require('express');
const router = express.Router();
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

// 1. List all promoters
router.get('/admin/promoters', requireAdminAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM promoters ORDER BY id DESC');
    const promoters = stmt.all();
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
    const insertStmt = db.prepare(`
      INSERT INTO promoters (promoter_code, name, is_active, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertStmt.run(promoterCode, name, isActive, now);
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

module.exports = router;

