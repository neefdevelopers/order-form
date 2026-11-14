const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function testPromoterFullDetails() {
  console.log('====================================================');
  console.log('   PROMOTER FULL DETAILS (ADDRESS, PHONE, AADHAAR)  ');
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

  // 2. Add new promoter with Phone, Aadhaar, Address
  console.log('\n2. Adding Promoter with Full Profile Details...');
  const uniqueCode = `PR-FULL-${Date.now().toString().slice(-4)}`;
  const payload = {
    promoter_code: uniqueCode,
    name: 'Rajesh Kumar Nair',
    phone_number: '+91 98470 12345',
    aadhaar_number: '5421 8976 1023',
    address: 'House No. 42, Green Valley, Near Temple Road, Ponnani, Malappuram, Kerala - 679577',
    is_active: 1
  };

  const addRes = await fetch(`${BASE_URL}/api/admin/promoters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(addRes.status, 201);
  const addData = await addRes.json();
  assert(addData.promoter);
  const promoterId = addData.promoter.id;
  assert.strictEqual(addData.promoter.promoter_code, uniqueCode);
  assert.strictEqual(addData.promoter.phone_number, payload.phone_number);
  assert.strictEqual(addData.promoter.aadhaar_number, payload.aadhaar_number);
  assert.strictEqual(addData.promoter.address, payload.address);
  console.log('   ✓ Promoter added with all new fields successfully.');

  // 3. Fetch list of promoters to verify fields are returned
  console.log('\n3. Verifying Promoter List contains full fields...');
  const listRes = await fetch(`${BASE_URL}/api/admin/promoters`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(listRes.status, 200);
  const promoters = await listRes.json();
  const fetched = promoters.find(p => p.id === promoterId);
  assert(fetched, 'Newly added promoter must be present in list');
  assert.strictEqual(fetched.phone_number, payload.phone_number);
  assert.strictEqual(fetched.aadhaar_number, payload.aadhaar_number);
  assert.strictEqual(fetched.address, payload.address);
  console.log('   ✓ Promoter in list contains phone_number, aadhaar_number, address.');

  // 4. Update Promoter with edited details
  console.log('\n4. Updating Promoter Details...');
  const updatePayload = {
    promoter_code: uniqueCode,
    name: 'Rajesh K. Nair (Updated)',
    phone_number: '+91 98470 99999',
    aadhaar_number: '5421 8976 9999',
    address: 'Flat 3B, Palm Meadows, Calicut, Kerala - 673001',
    is_active: 1
  };

  const updateRes = await fetch(`${BASE_URL}/api/admin/promoters/${promoterId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify(updatePayload)
  });
  assert.strictEqual(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.promoter.name, updatePayload.name);
  assert.strictEqual(updateData.promoter.phone_number, updatePayload.phone_number);
  assert.strictEqual(updateData.promoter.aadhaar_number, updatePayload.aadhaar_number);
  assert.strictEqual(updateData.promoter.address, updatePayload.address);
  console.log('   ✓ Promoter updated successfully with new details.');

  // 5. Clean up test promoter
  console.log('\n5. Cleaning up test promoter...');
  const delRes = await fetch(`${BASE_URL}/api/admin/promoters/${promoterId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(delRes.status, 200);
  console.log('   ✓ Test promoter deleted successfully.');

  console.log('\n====================================================');
  console.log('   ALL PROMOTER FULL DETAILS TESTS PASSED!         ');
  console.log('====================================================\n');
}

testPromoterFullDetails().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

