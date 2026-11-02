const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  const BASE_URL = 'http://localhost:5000';
  console.log('--- Starting API Verification Tests ---');

  // 1. Admin login test
  console.log('Testing: Admin login...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200, 'Login should succeed with status 200');
  const loginData = await loginRes.json();
  assert(loginData.token, 'Response should contain token');
  const adminToken = loginData.token;
  console.log('✓ Admin login succeeded. Received JWT token.');

  // 2. Fetch public active products
  console.log('Testing: Fetch public products...');
  const productsRes = await fetch(`${BASE_URL}/api/products`);
  assert.strictEqual(productsRes.status, 200);
  const products = await productsRes.json();
  assert(Array.isArray(products) && products.length > 0, 'Products should be a non-empty array');
  console.log(`✓ Fetched ${products.length} active products.`);

  // 3. Customer order validation test (missing required fields)
  console.log('Testing: Customer order validation error handling...');
  const invalidOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promoter_id: '' })
  });
  assert.strictEqual(invalidOrderRes.status, 400, 'Empty order should return 400 Bad Request');
  console.log('✓ Order validation correctly rejected invalid payload.');

  // 4. Place valid customer order
  console.log('Testing: Place valid customer order...');
  const testProduct = products[0];
  const orderPayload = {
    promoter_id: 'PROM-9981',
    product_id: testProduct.id,
    quantity: 2,
    customer_name: 'Jane Doe',
    phone_number: '+91 98765 43210',
    complete_address: 'Flat 402, Lotus Tower, MG Road, Indiranagar, Near Metro Station',
    pincode: '560038',
    city: 'Bengaluru',
    state: 'Karnataka'
  };

  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });
  assert.strictEqual(orderRes.status, 201, 'Order placement should return 201 Created');
  const orderData = await orderRes.json();
  assert(orderData.success, 'Order response should be successful');
  assert(orderData.orderId && orderData.orderId.startsWith('ORD-'), 'Order ID should start with ORD-');
  console.log(`✓ Order placed successfully! Order ID: ${orderData.orderId}`);

  // 5. Test duplicate submission debounce
  console.log('Testing: Duplicate order submission prevention...');
  const duplicateRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });
  assert.strictEqual(duplicateRes.status, 429, 'Immediate duplicate should return 429 Too Many Requests');
  console.log('✓ Duplicate submission successfully prevented.');

  // 6. Admin view orders test
  console.log('Testing: Admin view orders...');
  const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminOrdersRes.status, 200);
  const adminOrders = await adminOrdersRes.json();
  assert(Array.isArray(adminOrders) && adminOrders.length > 0, 'Admin should see orders');
  const foundOrder = adminOrders.find(o => o.id === orderData.orderId);
  assert(foundOrder, 'Submitted order must exist in admin list');
  assert.strictEqual(foundOrder.promoter_id, 'PROM-9981');
  assert.strictEqual(foundOrder.customer_name, 'Jane Doe');
  assert.strictEqual(foundOrder.product_name, testProduct.name);
  assert.strictEqual(foundOrder.quantity, 2);
  assert.strictEqual(foundOrder.complete_address, orderPayload.complete_address);
  console.log(`✓ Admin successfully retrieved ${adminOrders.length} orders including all required fields.`);

  // 7. Admin Excel export test
  console.log('Testing: Admin Excel export (.xlsx)...');
  const excelRes = await fetch(`${BASE_URL}/api/admin/orders/export`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(excelRes.status, 200, 'Excel export should return status 200');
  const contentType = excelRes.headers.get('content-type');
  assert(contentType.includes('spreadsheetml'), `Content-Type should be xlsx, got: ${contentType}`);
  const excelBuffer = await excelRes.arrayBuffer();
  assert(excelBuffer.byteLength > 1000, 'Excel file buffer should have valid size');
  console.log(`✓ Excel export downloaded successfully. Size: ${excelBuffer.byteLength} bytes.`);

  // 8. Admin Products CRUD test
  console.log('Testing: Admin Product CRUD...');
  // Create a dummy image file for upload testing
  const dummySvgPath = path.join(__dirname, 'dummy.svg');
  fs.writeFileSync(dummySvgPath, '<svg><circle r="10"/></svg>');

  const formData = new FormData();
  formData.append('name', 'Test Mechanical Keyboard');
  formData.append('is_active', '1');
  const fileBlob = new Blob([fs.readFileSync(dummySvgPath)], { type: 'image/svg+xml' });
  formData.append('image', fileBlob, 'keyboard.svg');

  const addProdRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: formData
  });
  assert.strictEqual(addProdRes.status, 201, 'Product creation should return 201');
  const addProdData = await addProdRes.json();
  const newProdId = addProdData.product.id;
  console.log(`✓ Product added successfully with ID: ${newProdId}`);

  // Edit product
  const editFormData = new FormData();
  editFormData.append('name', 'Test Mechanical Keyboard - RGB Edition');
  editFormData.append('is_active', '0'); // Deactivate

  const editProdRes = await fetch(`${BASE_URL}/api/admin/products/${newProdId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: editFormData
  });
  assert.strictEqual(editProdRes.status, 200, 'Product edit should return 200');
  const editProdData = await editProdRes.json();
  assert.strictEqual(editProdData.product.name, 'Test Mechanical Keyboard - RGB Edition');
  assert.strictEqual(editProdData.product.is_active, 0);
  console.log('✓ Product edited successfully (name and active status updated).');

  // Verify that deactivated product does not appear in customer list
  const publicAfterDeactivate = await (await fetch(`${BASE_URL}/api/products`)).json();
  assert(!publicAfterDeactivate.some(p => p.id === newProdId), 'Deactivated product must not appear in customer list');
  console.log('✓ Inactive product correctly hidden from customer product list.');

  // Delete product
  const deleteRes = await fetch(`${BASE_URL}/api/admin/products/${newProdId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(deleteRes.status, 200, 'Product delete should return 200');
  console.log('✓ Product deleted successfully.');

  // Clean up dummy svg
  if (fs.existsSync(dummySvgPath)) fs.unlinkSync(dummySvgPath);

  console.log('\n--- ALL API TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

