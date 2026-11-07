const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function runPromoterDashboardTests() {
  console.log('====================================================');
  console.log('   PROMOTER DASHBOARD & SHAREABLE LINK TESTS        ');
  console.log('====================================================\n');

  // 1. Authenticate Admin
  console.log('1. Authenticating Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200);
  const { token: adminToken } = await loginRes.json();
  console.log('   ✓ Admin login authenticated.');

  // 2. Fetch available products
  const products = await (await fetch(`${BASE_URL}/api/products`)).json();
  assert.ok(products.length >= 2, 'Should have at least 2 products');
  const prod1 = products[0];
  const prod2 = products[1];

  // 3. Create a unique test promoter
  console.log('\n2. Creating a new unique promoter in Admin...');
  const uniqueCode = `TEST-PROM-${Date.now().toString().slice(-5)}`;
  const createRes = await fetch(`${BASE_URL}/api/admin/promoters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      promoter_code: uniqueCode,
      name: 'Automated Test Promoter',
      is_active: 1
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createData = await createRes.json();
  assert.ok(createData.promoter, 'Promoter object returned');
  assert.ok(createData.promoter.access_token, 'Access token generated');
  assert.strictEqual(createData.promoter.access_token.length, 32, 'Access token is 32-char hex string');
  const promoterToken = createData.promoter.access_token;
  console.log(`   ✓ Promoter ${uniqueCode} created with unique token: ${promoterToken}`);

  // 4. Verify Admin Promoters List includes access_token
  console.log('\n3. Verifying Admin Promoters list contains access_token...');
  const listRes = await fetch(`${BASE_URL}/api/admin/promoters`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(listRes.status, 200);
  const promoters = await listRes.json();
  const found = promoters.find(p => p.promoter_code.toLowerCase() === uniqueCode.toLowerCase());
  assert.ok(found, 'Created promoter found in admin list');
  assert.strictEqual(found.access_token, promoterToken, 'Token matches in admin list');
  console.log('   ✓ Admin list returns access_token for all promoters.');

  // 5. Test initial dashboard state (zero orders)
  console.log('\n4. Testing Promoter Dashboard endpoint with new token (0 orders)...');
  const dashRes1 = await fetch(`${BASE_URL}/api/promoters/dashboard/${promoterToken}`);
  assert.strictEqual(dashRes1.status, 200);
  const dashData1 = await dashRes1.json();
  assert.strictEqual(dashData1.promoter.promoter_code, uniqueCode);
  assert.strictEqual(dashData1.promoter.name, 'Automated Test Promoter');
  assert.strictEqual(dashData1.stats.total_orders, 0);
  assert.strictEqual(dashData1.stats.total_products_sold, 0);
  assert.strictEqual(dashData1.stats.total_order_amount, 0);
  assert.strictEqual(dashData1.orders.length, 0);
  console.log('   ✓ Empty dashboard initialized properly.');

  // 6. Test Security: Invalid token returns 404
  console.log('\n5. Testing Security: Invalid token rejected...');
  const invalidRes = await fetch(`${BASE_URL}/api/promoters/dashboard/invalid_token_xyz_999`);
  assert.strictEqual(invalidRes.status, 404);
  console.log('   ✓ Invalid token rejected with 404 Not Found.');

  // 7. Place Order 1 with 2 different products
  console.log('\n6. Placing multi-item customer order with this promoter ID...');
  const order1Payload = {
    promoter_id: uniqueCode,
    items: [
      { product_id: prod1.id, quantity: 2 },
      { product_id: prod2.id, quantity: 3 }
    ],
    customer_name: 'Rahul Sharma',
    phone_number: '+91 98765 43210',
    complete_address: '42 MG Road, Indiranagar',
    pincode: '560038',
    city: 'Bengaluru',
    state: 'Karnataka'
  };

  const expectedTotal1 = (prod1.price * 2) + (prod2.price * 3);
  const order1Res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order1Payload)
  });
  assert.strictEqual(order1Res.status, 201);
  const order1Data = await order1Res.json();
  const order1Id = order1Data.orderId;
  console.log(`   ✓ Order 1 created: ${order1Id} (Total: ₹${expectedTotal1}, Units: 5)`);

  // 8. Place Order 2 with 1 product
  console.log('\n7. Placing second customer order with this promoter ID...');
  const order2Payload = {
    promoter_id: uniqueCode,
    items: [
      { product_id: prod1.id, quantity: 1 }
    ],
    customer_name: 'Priya Patel',
    phone_number: '+91 91234 56789',
    complete_address: 'Flat 302, Green Meadows',
    pincode: '560038',
    city: 'Bengaluru',
    state: 'Karnataka'
  };

  const expectedTotal2 = prod1.price * 1;
  const order2Res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order2Payload)
  });
  assert.strictEqual(order2Res.status, 201);
  const order2Data = await order2Res.json();
  const order2Id = order2Data.orderId;
  console.log(`   ✓ Order 2 created: ${order2Id} (Total: ₹${expectedTotal2}, Units: 1)`);

  // 9. Query Promoter Dashboard again and verify stats & orders
  console.log('\n8. Verifying Promoter Dashboard metrics and orders data...');
  const dashRes2 = await fetch(`${BASE_URL}/api/promoters/dashboard/${promoterToken}`);
  assert.strictEqual(dashRes2.status, 200);
  const dashData2 = await dashRes2.json();

  // Metrics checks
  const expectedTotalSold = 5 + 1; // 6 units
  const expectedGrossSales = expectedTotal1 + expectedTotal2;
  assert.strictEqual(dashData2.stats.total_orders, 2, 'Total orders should be 2');
  assert.strictEqual(dashData2.stats.total_products_sold, expectedTotalSold, `Total products sold should be ${expectedTotalSold}`);
  assert.strictEqual(dashData2.stats.total_order_amount, expectedGrossSales, `Total order amount should be ${expectedGrossSales}`);
  assert.strictEqual(dashData2.orders.length, 2, 'Orders array should have length 2');

  // Verify item breakdown on Order 1
  const fetchedOrder1 = dashData2.orders.find(o => o.id === order1Id);
  assert.ok(fetchedOrder1, 'Order 1 found in promoter orders');
  assert.strictEqual(fetchedOrder1.total_amount, expectedTotal1);
  assert.strictEqual(fetchedOrder1.total_quantity, 5);
  assert.strictEqual(fetchedOrder1.items.length, 2);
  assert.strictEqual(fetchedOrder1.items[0].product_name, prod1.name);
  assert.strictEqual(fetchedOrder1.items[0].quantity, 2);
  assert.strictEqual(fetchedOrder1.items[1].product_name, prod2.name);
  assert.strictEqual(fetchedOrder1.items[1].quantity, 3);
  console.log('   ✓ Metrics verified:');
  console.log(`     - Total Orders: ${dashData2.stats.total_orders}`);
  console.log(`     - Total Products Sold: ${dashData2.stats.total_products_sold}`);
  console.log(`     - Total Order Amount: ₹${dashData2.stats.total_order_amount}`);

  // 10. Data Isolation Check: Verify orders from other promoters do not appear
  console.log('\n9. Verifying Data Isolation: Only this promoter\'s orders appear...');
  for (const o of dashData2.orders) {
    assert.ok(o.id === order1Id || o.id === order2Id, `Order ${o.id} must belong to ${uniqueCode}`);
  }
  console.log('   ✓ Data isolation verified: No other promoters\' orders are leaked.');

  // 11. Test Security: Deactivating promoter blocks dashboard access with 403
  console.log('\n10. Testing Security: Deactivating promoter blocks dashboard access with 403...');
  const deactivateRes = await fetch(`${BASE_URL}/api/admin/promoters/${found.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      promoter_code: uniqueCode,
      name: 'Automated Test Promoter',
      is_active: 0
    })
  });
  assert.strictEqual(deactivateRes.status, 200);

  const blockedDashRes = await fetch(`${BASE_URL}/api/promoters/dashboard/${promoterToken}`);
  assert.strictEqual(blockedDashRes.status, 403, 'Inactive promoter dashboard must return 403 Forbidden');
  console.log('   ✓ Deactivated promoter correctly blocked with 403 Forbidden.');

  // Clean up: delete test promoter
  await fetch(`${BASE_URL}/api/admin/promoters/${found.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('\n✓ Cleaned up test promoter.');

  console.log('\n====================================================');
  console.log('   ALL PROMOTER DASHBOARD TESTS PASSED SUCCESSFULLY! ');
  console.log('====================================================\n');
}

runPromoterDashboardTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});

