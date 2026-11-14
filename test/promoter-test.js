const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function runPromoterTests() {
  console.log('====================================================');
  console.log('   PROMOTER ID ACCESS CONTROL TESTS                 ');
  console.log('====================================================\n');

  // 1. Admin login
  console.log('1. Authenticating Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200);
  const { token: adminToken } = await loginRes.json();
  console.log('   ✓ Admin login authenticated.');

  // 2. Fetch products to get a valid product ID
  const products = await (await fetch(`${BASE_URL}/api/products`)).json();
  const testProduct = products[0];

  // 3. Test Promoter Validation Endpoint
  console.log('\n2. Testing Promoter Validation Endpoint...');
  // Valid active promoter
  const validRes = await fetch(`${BASE_URL}/api/promoters/validate/PR-1001`);
  assert.strictEqual(validRes.status, 200);
  const validData = await validRes.json();
  assert.strictEqual(validData.valid, true);
  console.log('   ✓ Valid active promoter (PR-1001) recognized successfully.');

  // Invalid promoter
  const invalidRes = await fetch(`${BASE_URL}/api/promoters/validate/INVALID-9999`);
  assert.strictEqual(invalidRes.status, 404);
  const invalidData = await invalidRes.json();
  assert.strictEqual(invalidData.valid, false);
  console.log('   ✓ Invalid promoter correctly rejected with 404.');

  // 4. Test Customer Order with Unauthorized Promoter ID
  console.log('\n3. Testing Customer Order with Unauthorized Promoter ID...');
  const unauthorizedOrder = {
    promoter_id: 'UNAUTHORIZED-PROMOTER-XYZ',
    product_id: testProduct.id,
    quantity: 1,
    customer_name: 'Test Customer',
    phone_number: '+91 99999 88888',
    complete_address: '123 Fake Street, Area 51, Landmark Near Tower',
    pincode: '560001',
    city: 'Bengaluru',
    state: 'Karnataka'
  };

  const rejectOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unauthorizedOrder)
  });
  assert.strictEqual(rejectOrderRes.status, 400);
  const rejectData = await rejectOrderRes.json();
  assert(rejectData.error.includes('Only authorized promoters can place orders'), 'Error message must specify access control');
  console.log(`   ✓ Unauthorized promoter order correctly blocked: "${rejectData.error}"`);

  // 5. Test Customer Order with Authorized Promoter ID
  console.log('\n4. Testing Customer Order with Authorized Promoter ID...');
  const authorizedOrder = {
    ...unauthorizedOrder,
    promoter_id: 'PR-1001'
  };

  const acceptOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authorizedOrder)
  });
  assert.strictEqual(acceptOrderRes.status, 201);
  const acceptData = await acceptOrderRes.json();
  assert(acceptData.success);
  console.log(`   ✓ Authorized promoter order accepted! Order ID: ${acceptData.orderId}`);

  // 6. Test Admin Adding, Deactivating, and Deleting Promoter ID
  console.log('\n5. Testing Admin Promoter Management...');
  // Add new promoter
  const newCode = `PR-TEST-${Date.now().toString().slice(-4)}`;
  const addRes = await fetch(`${BASE_URL}/api/admin/promoters`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({
      promoter_code: newCode,
      name: 'Automated Test Promoter',
      phone_number: '+91 98765 43210',
      aadhaar_number: '1234 5678 9012',
      address: '123 Test Street, Bengaluru, Karnataka - 560001',
      is_active: 1
    })
  });
  assert.strictEqual(addRes.status, 201);
  const addData = await addRes.json();
  const createdPromoterId = addData.promoter.id;
  console.log(`   ✓ Added new authorized promoter ID: "${newCode}" (ID: ${createdPromoterId})`);

  // Verify the new promoter can order
  const newPromoterOrder = {
    ...unauthorizedOrder,
    promoter_id: newCode
  };
  const newOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPromoterOrder)
  });
  assert.strictEqual(newOrderRes.status, 201);
  console.log(`   ✓ Order placed with newly created promoter ID "${newCode}"`);

  // Deactivate promoter
  const deactRes = await fetch(`${BASE_URL}/api/admin/promoters/${createdPromoterId}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({
      promoter_code: newCode,
      name: 'Automated Test Promoter',
      is_active: 0
    })
  });
  assert.strictEqual(deactRes.status, 200);
  console.log(`   ✓ Deactivated promoter ID "${newCode}"`);

  // Order with deactivated promoter should be rejected with 403
  const deactOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPromoterOrder)
  });
  assert.strictEqual(deactOrderRes.status, 403);
  console.log(`   ✓ Deactivated promoter order blocked with 403.`);

  // Delete promoter
  const delRes = await fetch(`${BASE_URL}/api/admin/promoters/${createdPromoterId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delRes.status, 200);
  console.log(`   ✓ Deleted promoter ID.`);

  // Order with deleted promoter should now be rejected as invalid (400)
  const delOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPromoterOrder)
  });
  assert.strictEqual(delOrderRes.status, 400);
  console.log(`   ✓ Deleted promoter order blocked as invalid.`);

  console.log('\n====================================================');
  console.log('   ALL PROMOTER ACCESS CONTROL TESTS PASSED!       ');
  console.log('====================================================\n');
}

runPromoterTests().catch(err => {
  console.error('\n❌ Promoter test failed:', err);
  process.exit(1);
});

