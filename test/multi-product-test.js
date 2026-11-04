const assert = require('assert');
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:5000';

async function runMultiProductTests() {
  console.log('========================================================');
  console.log('   MULTI-PRODUCT ORDERING & EXPORT VERIFICATION TEST    ');
  console.log('========================================================\n');

  // 1. Fetch available products
  console.log('1. Fetching available products...');
  const prodRes = await fetch(`${BASE_URL}/api/products`);
  assert.strictEqual(prodRes.status, 200, 'Products endpoint should return 200');
  let products = await prodRes.json();
  assert(products.length > 0, 'Must have at least one product');
  console.log(`   ✓ Found ${products.length} products`);

  // Ensure we have at least 2 products for testing multi-product selection
  let p1 = products[0];
  let p2 = products.length > 1 ? products[1] : products[0];
  console.log(`   Product 1: ${p1.name} (₹${p1.price})`);
  console.log(`   Product 2: ${p2.name} (₹${p2.price})`);

  // 2. Submit multi-product order
  console.log('\n2. Submitting multi-product customer order...');
  const q1 = 2;
  const q2 = 3;
  const expectedSubtotal1 = p1.price * q1;
  const expectedSubtotal2 = p2.price * q2;
  const expectedTotal = expectedSubtotal1 + expectedSubtotal2;
  const expectedTotalQty = q1 + q2;

  const orderPayload = {
    promoter_id: 'PR-1001',
    customer_name: 'Aditi Rao',
    phone_number: '9845012345',
    complete_address: 'Flat 402, Lotus Residency, MG Road',
    pincode: '560001',
    city: 'Bengaluru',
    state: 'Karnataka',
    items: [
      { product_id: p1.id, quantity: q1 },
      { product_id: p2.id, quantity: q2 }
    ]
  };

  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });

  assert.strictEqual(orderRes.status, 201, 'Order submission should return 201');
  const orderResult = await orderRes.json();
  console.log(`   ✓ Order created successfully: ID=${orderResult.orderId}`);
  console.log(`   ✓ Server returned total amount: ₹${orderResult.totalAmount} (expected ₹${expectedTotal})`);
  assert.strictEqual(orderResult.totalAmount, expectedTotal, 'Calculated total amount must match sum of subtotals');
  assert(orderResult.orderId, 'Order ID must be generated and returned');

  // 3. Login as Admin
  console.log('\n3. Logging in as Admin to verify order retrieval...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
  const setCookie = loginRes.headers.get('set-cookie');
  assert(setCookie, 'Must receive session cookie on login');
  const cookie = setCookie.split(';')[0];
  console.log('   ✓ Admin authenticated successfully');

  // 4. Fetch orders list via Admin API
  console.log('\n4. Verifying order in admin orders list...');
  const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { 'Cookie': cookie }
  });
  assert.strictEqual(adminOrdersRes.status, 200, 'Admin orders should return 200');
  const adminOrders = await adminOrdersRes.json();
  const createdOrder = adminOrders.find(o => o.id === orderResult.orderId);
  assert(createdOrder, 'Created order should be present in admin orders list');
  console.log(`   ✓ Found order in admin list: Total ₹${createdOrder.total_amount}, Qty ${createdOrder.quantity}`);
  assert.strictEqual(createdOrder.total_amount, expectedTotal, 'Admin order total must match');
  assert.strictEqual(createdOrder.quantity, expectedTotalQty, 'Total quantity should equal sum of items');
  assert(Array.isArray(createdOrder.items), 'Order must contain items array');
  assert.strictEqual(createdOrder.items.length, 2, 'Items array should contain exactly 2 items');

  // Verify item subtotals
  for (const item of createdOrder.items) {
    const expectedSub = item.product_price * item.quantity;
    assert.strictEqual(item.subtotal, expectedSub, `Item subtotal for ${item.product_name} must equal price * qty`);
    console.log(`   ✓ Item verified: ${item.product_name} | ₹${item.product_price} × ${item.quantity} = ₹${item.subtotal}`);
  }

  // 5. Fetch single order details
  console.log('\n5. Verifying single order details endpoint...');
  const singleOrderRes = await fetch(`${BASE_URL}/api/admin/orders/${orderResult.orderId}`, {
    headers: { 'Cookie': cookie }
  });
  assert.strictEqual(singleOrderRes.status, 200);
  const singleOrder = await singleOrderRes.json();
  assert.strictEqual(singleOrder.id, orderResult.orderId);
  assert(Array.isArray(singleOrder.items) && singleOrder.items.length === 2);
  console.log('   ✓ Single order details verified with items breakdown');

  // 6. Test Excel export with multi-product order
  console.log('\n6. Verifying Excel Export with multi-product rows...');
  const exportRes = await fetch(`${BASE_URL}/api/admin/orders/export`, {
    headers: { 'Cookie': cookie }
  });
  assert.strictEqual(exportRes.status, 200, 'Excel export should return 200');
  assert(exportRes.headers.get('content-type').includes('spreadsheetml'), 'Content-Type should be xlsx');

  const arrayBuffer = await exportRes.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(arrayBuffer));
  const worksheet = workbook.getWorksheet('Orders');
  assert(worksheet, 'Worksheet "Orders" must exist');

  let targetRowFound = false;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const orderIdCell = row.getCell(1).value;
    if (orderIdCell === orderResult.orderId) {
      targetRowFound = true;
      const productCell = String(row.getCell(4).value);
      const qtyCell = Number(row.getCell(6).value);
      const totalCell = Number(row.getCell(7).value);

      console.log(`   ✓ Export row found for ${orderResult.orderId}`);
      console.log(`   Product Cell:\n${productCell}`);
      console.log(`   Total Qty: ${qtyCell}, Total Amount: ₹${totalCell}`);

      assert(productCell.includes(p1.name), 'Product cell must mention product 1');
      assert.strictEqual(qtyCell, expectedTotalQty, 'Excel quantity must match total items quantity');
      assert.strictEqual(totalCell, expectedTotal, 'Excel total amount must match calculated order total');
    }
  });
  assert(targetRowFound, 'Created order row must be present in Excel worksheet');

  // 7. Verify legacy single-product order backward compatibility
  console.log('\n7. Verifying backward compatibility with legacy single-product submission...');
  const legacyOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promoter_id: 'PR-1001',
      product_id: p1.id,
      quantity: 1,
      customer_name: 'Legacy Buyer',
      phone_number: '9845012399',
      complete_address: 'Room 12, Legacy Lane',
      pincode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka'
    })
  });
  assert.strictEqual(legacyOrderRes.status, 201, 'Legacy order should create successfully');
  const legacyData = await legacyOrderRes.json();
  assert.strictEqual(legacyData.totalAmount, p1.price, 'Legacy order total should equal product price * 1');
  console.log(`   ✓ Legacy order ${legacyData.orderId} created cleanly with ₹${legacyData.totalAmount}`);

  console.log('\n========================================================');
  console.log('   ALL MULTI-PRODUCT & EXPORT TESTS PASSED SUCCESSFULLY! ');
  console.log('========================================================\n');
}

runMultiProductTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
