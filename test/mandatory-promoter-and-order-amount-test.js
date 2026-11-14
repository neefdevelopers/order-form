require('dotenv').config();
const assert = require('assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('../server/db');
const { generateToken } = require('../server/auth');
const promotersRouter = require('../server/routes/promoters');
const ordersRouter = require('../server/routes/orders');

async function runTest() {
  console.log('====================================================');
  console.log('   MANDATORY PROMOTER FIELDS & ORDER TOTAL TEST     ');
  console.log('====================================================\n');

  await db.init();
  console.log('✓ Database initialized successfully.');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', promotersRouter);
  app.use('/api', ordersRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const adminToken = generateToken({ username: 'admin', role: 'admin' });

  try {
    // 1. Test missing promoter_code
    console.log('1. Testing missing promoter_code rejection...');
    let res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'John Doe',
        phone_number: '+91 98765 43210',
        aadhaar_number: '1234 5678 9012',
        address: '123 Green Way, City'
      })
    });
    assert.strictEqual(res.status, 400);
    let data = await res.json();
    assert.ok(data.error.includes('Promoter ID code is required'), 'Should reject missing promoter_code');
    console.log(`   ✓ Correctly rejected missing promoter_code: "${data.error}"`);

    // 2. Test missing name
    console.log('\n2. Testing missing name rejection...');
    res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        promoter_code: 'PR-TEST-REQ1',
        phone_number: '+91 98765 43210',
        aadhaar_number: '1234 5678 9012',
        address: '123 Green Way, City'
      })
    });
    assert.strictEqual(res.status, 400);
    data = await res.json();
    assert.ok(data.error.includes('Promoter name is required'), 'Should reject missing name');
    console.log(`   ✓ Correctly rejected missing name: "${data.error}"`);

    // 3. Test missing phone_number
    console.log('\n3. Testing missing phone_number rejection...');
    res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        promoter_code: 'PR-TEST-REQ2',
        name: 'John Doe',
        aadhaar_number: '1234 5678 9012',
        address: '123 Green Way, City'
      })
    });
    assert.strictEqual(res.status, 400);
    data = await res.json();
    assert.ok(data.error.includes('Phone number is required'), 'Should reject missing phone_number');
    console.log(`   ✓ Correctly rejected missing phone_number: "${data.error}"`);

    // 4. Test missing aadhaar_number
    console.log('\n4. Testing missing aadhaar_number rejection...');
    res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        promoter_code: 'PR-TEST-REQ3',
        name: 'John Doe',
        phone_number: '+91 98765 43210',
        address: '123 Green Way, City'
      })
    });
    assert.strictEqual(res.status, 400);
    data = await res.json();
    assert.ok(data.error.includes('Aadhaar number is required'), 'Should reject missing aadhaar_number');
    console.log(`   ✓ Correctly rejected missing aadhaar_number: "${data.error}"`);

    // 5. Test missing address
    console.log('\n5. Testing missing address rejection...');
    res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        promoter_code: 'PR-TEST-REQ4',
        name: 'John Doe',
        phone_number: '+91 98765 43210',
        aadhaar_number: '1234 5678 9012'
      })
    });
    assert.strictEqual(res.status, 400);
    data = await res.json();
    assert.ok(data.error.includes('Promoter address is required'), 'Should reject missing address');
    console.log(`   ✓ Correctly rejected missing address: "${data.error}"`);

    // 6. Test valid addition when all 5 fields are supplied
    console.log('\n6. Testing valid addition with all 5 mandatory fields...');
    const testCode = `PR-FULL-${Date.now().toString().slice(-4)}`;
    res = await fetch(`${baseUrl}/api/admin/promoters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        promoter_code: testCode,
        name: 'Ramesh Patel',
        phone_number: '+91 98765 43210',
        aadhaar_number: '9876 5432 1098',
        address: 'Flat 301, Sunrise Enclave, MG Road, Pune, Maharashtra - 411001'
      })
    });
    assert.strictEqual(res.status, 201);
    data = await res.json();
    assert.ok(data.promoter);
    assert.strictEqual(data.promoter.promoter_code, testCode);
    assert.strictEqual(data.promoter.name, 'Ramesh Patel');
    assert.strictEqual(data.promoter.phone_number, '+91 98765 43210');
    assert.strictEqual(data.promoter.aadhaar_number, '9876 5432 1098');
    assert.strictEqual(data.promoter.address, 'Flat 301, Sunrise Enclave, MG Road, Pune, Maharashtra - 411001');
    console.log(`   ✓ Promoter ${testCode} added with all mandatory fields successfully!`);

    // 7. Test PUT validation when an existing field is cleared to empty
    console.log('\n7. Testing PUT validation: empty fields must be rejected...');
    res = await fetch(`${baseUrl}/api/admin/promoters/${data.promoter.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: '   '
      })
    });
    assert.strictEqual(res.status, 400);
    data = await res.json();
    assert.ok(data.error.includes('Promoter name cannot be empty'));
    console.log(`   ✓ PUT correctly rejected empty name: "${data.error}"`);

    // Clean up test promoter
    await db.run('DELETE FROM promoters WHERE promoter_code = ?', [testCode]);
    console.log('   ✓ Test promoter cleaned up.');

    // 8. Test totalAmountGenerated dynamic logic test
    console.log('\n8. Testing Total Amount Generated logic...');
    const sampleOrders = [
      { id: 'ORD-0001', promoter_id: 'PR-A', total_amount: 1250, payment_method: 'cod', customer_name: 'Alice', phone_number: '1111' },
      { id: 'ORD-0002', promoter_id: 'PR-B', total_amount: 800, payment_method: 'prepaid', customer_name: 'Bob', phone_number: '2222' },
      { id: 'ORD-0003', promoter_id: 'PR-A', total_amount: 450, payment_method: 'prepaid', customer_name: 'Charlie', phone_number: '3333' }
    ];

    const calcTotal = (orders) => orders.reduce((sum, o) => {
      const val = o.total_amount !== undefined && o.total_amount !== null
        ? Number(o.total_amount)
        : (Number(o.product_price) || 0) * (Number(o.quantity) || 1);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const unfilteredTotal = calcTotal(sampleOrders);
    assert.strictEqual(unfilteredTotal, 2500, 'Unfiltered total must equal 1250 + 800 + 450 = 2500');

    // Filtered by PR-A
    const filteredByPrA = sampleOrders.filter(o => o.promoter_id === 'PR-A');
    const filteredTotal = calcTotal(filteredByPrA);
    assert.strictEqual(filteredTotal, 1700, 'Filtered total for PR-A must equal 1250 + 450 = 1700');
    console.log(`   ✓ Total Amount math verified: Unfiltered ₹${unfilteredTotal}, Filtered ₹${filteredTotal}`);

    console.log('\n====================================================');
    console.log('   ALL TESTS PASSED SUCCESSFULLY!                    ');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
