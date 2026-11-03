const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:5000';

async function runE2ETests() {
  console.log('====================================================');
  console.log('   PRODUCT ORDERING SYSTEM - E2E WITH PRICE TESTS   ');
  console.log('====================================================\n');

  // STEP 1: Verify Server Health & Static UI
  console.log('1. Checking Server & Frontend delivery...');
  const htmlRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(htmlRes.status, 200);
  const htmlText = await htmlRes.text();
  assert(htmlText.includes('Product Ordering System'), 'Title should appear in HTML');
  console.log('   ✓ Express successfully serving frontend single-page application');

  // STEP 2: Customer Flow - Verify Product Price & Dynamic Total
  console.log('\n2. Testing Product Selection & Price Fetching...');
  const productsRes = await fetch(`${BASE_URL}/api/products`);
  assert.strictEqual(productsRes.status, 200);
  const products = await productsRes.json();
  assert(products.length > 0, 'Should have active products available');

  const chosenProduct = products[0];
  assert(chosenProduct.price !== undefined && chosenProduct.price > 0, 'Product must have price from DB');
  console.log(`   ✓ Selected product: "${chosenProduct.name}"`);
  console.log(`   ✓ Fetched price from DB: ₹${chosenProduct.price}`);

  // Test dynamic calculation: Price × Qty
  const testQty = 4;
  const expectedTotal = chosenProduct.price * testQty;
  console.log(`   ✓ Quantity: ${testQty} => Dynamically calculated total: ₹${expectedTotal}`);

  // Submit Complete Valid Customer Order
  const customerOrder = {
    promoter_id: 'PR-1001',
    product_id: chosenProduct.id,
    quantity: testQty,
    customer_name: 'Ananya Sharma',
    phone_number: '+91 98765 12345',
    complete_address: 'Flat 101, Palm Grove, 5th Main Road, Koramangala, Opposite Forum Mall',
    pincode: '560095',
    city: 'Bengaluru',
    state: 'Karnataka'
  };

  const submitRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerOrder)
  });
  assert.strictEqual(submitRes.status, 201);
  const submitData = await submitRes.json();
  assert(submitData.success);
  assert(submitData.orderId && submitData.orderId.startsWith('ORD-'));
  assert.strictEqual(submitData.productPrice, chosenProduct.price, 'Order response must include saved product price');
  assert.strictEqual(submitData.totalAmount, expectedTotal, 'Order response must include total amount (Price x Qty)');
  const generatedOrderId = submitData.orderId;
  console.log(`   ✓ Customer order submitted successfully!`);
  console.log(`     • Generated Order ID: ${generatedOrderId}`);
  console.log(`     • Saved Product Price: ₹${submitData.productPrice}`);
  console.log(`     • Saved Total Amount: ₹${submitData.totalAmount}`);

  // Duplicate Submission Prevention
  const dupRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerOrder)
  });
  assert.strictEqual(dupRes.status, 429);
  console.log('   ✓ Duplicate order submission prevented by debounce guard');

  // STEP 3: Admin Flow - Login & Verify Orders with Price & Total
  console.log('\n3. Testing Admin Security & Order Viewing with Price/Total...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200);
  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  console.log('   ✓ Admin login authenticated successfully.');

  const ordersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(ordersRes.status, 200);
  const allOrders = await ordersRes.json();
  const placedOrder = allOrders.find(o => o.id === generatedOrderId);
  assert(placedOrder, 'Placed order must exist in admin list');
  assert.strictEqual(placedOrder.product_price, chosenProduct.price, 'Database record must have product_price');
  assert.strictEqual(placedOrder.total_amount, expectedTotal, 'Database record must have total_amount');
  console.log('   ✓ Admin order record verified in database:');
  console.log(`     Product: ${placedOrder.product_name} | Price: ₹${placedOrder.product_price} | Qty: ${placedOrder.quantity} | Total: ₹${placedOrder.total_amount}`);

  // STEP 4: Excel (.xlsx) Export with Price & Total Columns
  console.log('\n4. Testing Excel (.xlsx) Export with Price and Total Amount...');
  const exportRes = await fetch(`${BASE_URL}/api/admin/orders/export`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(exportRes.status, 200);

  const excelBuffer = Buffer.from(await exportRes.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);

  const sheet = workbook.getWorksheet('Orders');
  assert(sheet, 'Workbook must contain "Orders" worksheet');
  const headerValues = sheet.getRow(1).values;
  assert(headerValues.includes('Product Price (₹)'), 'Excel must include Product Price (₹) column');
  assert(headerValues.includes('Total Amount (₹)'), 'Excel must include Total Amount (₹) column');
  console.log('   ✓ Excel headings verified:');
  console.log('    ', sheet.getRow(1).values.filter(Boolean).join(' | '));

  let foundInExcel = false;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && row.getCell(1).value === generatedOrderId) {
      foundInExcel = true;
      assert.strictEqual(row.getCell(5).value, chosenProduct.price, 'Price in Excel must match');
      assert.strictEqual(row.getCell(6).value, testQty, 'Quantity in Excel must match');
      assert.strictEqual(row.getCell(7).value, expectedTotal, 'Total Amount in Excel must match');
    }
  });
  assert(foundInExcel, 'Order must be present in Excel rows with correct price and total');
  console.log('   ✓ Excel row verified with correct Product Price and Total Amount.');

  // STEP 5: Admin Product Management Price CRUD
  console.log('\n5. Testing Admin Product Management with custom Price...');
  const testImgPath = path.join(__dirname, 'test-gadget.svg');
  fs.writeFileSync(testImgPath, '<svg><rect width="50" height="50"/></svg>');

  const form = new FormData();
  form.append('name', 'Fast Wireless Charger');
  form.append('price', '999');
  form.append('is_active', '1');
  const imgBlob = new Blob([fs.readFileSync(testImgPath)], { type: 'image/svg+xml' });
  form.append('image', imgBlob, 'charger.svg');

  const addRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: form
  });
  assert.strictEqual(addRes.status, 201);
  const addData = await addRes.json();
  const newProdId = addData.product.id;
  assert.strictEqual(addData.product.price, 999, 'Added product price must be 999');
  console.log(`   ✓ Added product with price: ₹${addData.product.price}`);

  // Edit product price
  const editForm = new FormData();
  editForm.append('name', 'Fast Wireless Charger 15W');
  editForm.append('price', '1299');

  const editRes = await fetch(`${BASE_URL}/api/admin/products/${newProdId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: editForm
  });
  assert.strictEqual(editRes.status, 200);
  const editData = await editRes.json();
  assert.strictEqual(editData.product.price, 1299, 'Updated price must be 1299');
  console.log(`   ✓ Updated product price to: ₹${editData.product.price}`);

  // Delete product
  const delRes = await fetch(`${BASE_URL}/api/admin/products/${newProdId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delRes.status, 200);
  console.log('   ✓ Cleanup: Test product deleted.');

  if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);

  console.log('\n====================================================');
  console.log('   ALL PRODUCT PRICE & TOTAL TESTS PASSED!          ');
  console.log('====================================================\n');
}

runE2ETests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
