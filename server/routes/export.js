const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

async function handleOrdersExport(req, res) {
  try {
    let orders = [];
    let isFiltered = false;

    // Check if specific order IDs are requested (via POST body or GET query)
    let requestedIds = [];
    if (req.body && Array.isArray(req.body.ids) && req.body.ids.length > 0) {
      requestedIds = req.body.ids;
    } else if (req.query && req.query.ids) {
      requestedIds = req.query.ids.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (requestedIds.length > 0) {
      isFiltered = true;
      const placeholders = requestedIds.map(() => '?').join(',');
      const stmt = db.prepare(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY created_at DESC`);
      orders = stmt.all(...requestedIds);
    } else {
      // Check query filters
      const conditions = [];
      const params = [];

      if (req.query.order_id && req.query.order_id.trim()) {
        conditions.push('LOWER(id) LIKE ?');
        params.push(`%${req.query.order_id.trim().toLowerCase()}%`);
        isFiltered = true;
      }

      if (req.query.promoter_id && req.query.promoter_id.trim()) {
        conditions.push('LOWER(promoter_id) = LOWER(?)');
        params.push(req.query.promoter_id.trim());
        isFiltered = true;
      }

      if (req.query.search && req.query.search.trim()) {
        const s = `%${req.query.search.trim().toLowerCase()}%`;
        conditions.push('(LOWER(customer_name) LIKE ? OR LOWER(phone_number) LIKE ? OR LOWER(city) LIKE ? OR LOWER(state) LIKE ?)');
        params.push(s, s, s, s);
        isFiltered = true;
      }

      let sql = 'SELECT * FROM orders';
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC';

      const stmt = db.prepare(sql);
      orders = stmt.all(...params);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Product Ordering System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Orders');

    // Define columns with clean headings and widths
    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 24 },
      { header: 'Order Date & Time', key: 'created_at', width: 22 },
      { header: 'Promoter ID', key: 'promoter_id', width: 18 },
      { header: 'Product', key: 'product_name', width: 30 },
      { header: 'Product Price (₹)', key: 'product_price', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
      { header: 'Customer Name', key: 'customer_name', width: 24 },
      { header: 'Phone Number', key: 'phone_number', width: 18 },
      { header: 'Complete Address', key: 'complete_address', width: 45 },
      { header: 'Pincode', key: 'pincode', width: 14 },
      { header: 'City', key: 'city', width: 18 },
      { header: 'State', key: 'state', width: 18 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate-800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Add order rows
    orders.forEach((order) => {
      let formattedDate = order.created_at;
      try {
        const d = new Date(order.created_at);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        }
      } catch (e) {
        formattedDate = order.created_at;
      }

      const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
      const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * order.quantity;

      const row = worksheet.addRow({
        id: order.id,
        created_at: formattedDate,
        promoter_id: order.promoter_id,
        product_name: order.product_name,
        product_price: priceVal,
        quantity: order.quantity,
        total_amount: totalVal,
        customer_name: order.customer_name,
        phone_number: order.phone_number,
        complete_address: order.complete_address,
        pincode: order.pincode,
        city: order.city,
        state: order.state
      });

      row.height = 24;
      row.alignment = { vertical: 'middle', wrapText: true };
    });

    // Add subtle grid borders
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    const nowStr = new Date().toISOString().slice(0, 10);
    const promoterFilter = (req.body && req.body.promoter_id) || (req.query && req.query.promoter_id);
    let filename;
    if (promoterFilter && promoterFilter.trim()) {
      const pCode = promoterFilter.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      filename = `Orders_${pCode}_${nowStr}.xlsx`;
    } else if (isFiltered) {
      filename = `Orders_Filtered_${nowStr}.xlsx`;
    } else {
      filename = `Orders_Export_${nowStr}.xlsx`;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel export:', err);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
}

// Support both GET and POST for Excel export
router.get('/admin/orders/export', requireAdminAuth, handleOrdersExport);
router.post('/admin/orders/export', requireAdminAuth, handleOrdersExport);

module.exports = router;
