const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db');
const { requireAdminAuth } = require('../auth');

router.get('/admin/orders/export', requireAdminAuth, async (req, res) => {
  try {
    const ordersStmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = ordersStmt.all();

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
      // Format date for readability in Excel
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
    const filename = `Orders_Export_${nowStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel export:', err);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

module.exports = router;
