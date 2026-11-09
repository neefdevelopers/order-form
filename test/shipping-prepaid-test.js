const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const method = options.method || 'GET';
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof FormData) && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    if (body instanceof FormData) {
      Object.assign(headers, body.getHeaders());
    }

    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          text,
          buffer
        });
      });
    });

    req.on('error', reject);

    if (body instanceof FormData) {
      body.pipe(req);
    } else if (body) {
      req.write(body);
      req.end();
    } else {
      req.end();
    }
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('   SHIPPING & PREPAID PAYMENT QR / SS INTEGRATION TEST   ');
  console.log('========================================================\n');

  // 1. Admin login
  console.log('1. Admin login...');
  const loginRes = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Admin login failed: ' + loginRes.text);
  }
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('   ✓ Admin authenticated\n');

  // 2. Fetch products to get existing items
  console.log('2. Fetching products...');
  const prodRes = await request('/api/products');
  if (prodRes.status !== 200 || !Array.isArray(prodRes.data) || prodRes.data.length === 0) {
    throw new Error('No products found');
  }
  const standardProduct = prodRes.data.find(p => p.shipping_type === 'standard' || p.shipping_type === null || p.shipping_type === undefined) || prodRes.data[0];
  console.log(`   ✓ Found standard product: ${standardProduct.name} (Price: ₹${standardProduct.price})`);

  // 3. Test Prepaid order submission WITHOUT screenshot -> Should be rejected (400)
  console.log('\n3. Testing Prepaid order without screenshot (expecting 400 rejection)...');
  const noSsForm = new FormData();
  noSsForm.append('promoter_id', 'PR-1001');
  noSsForm.append('customer_name', 'Prepaid Test User');
  noSsForm.append('phone_number', '9876543210');
  noSsForm.append('complete_address', '123 Test Street');
  noSsForm.append('pincode', '560001');
  noSsForm.append('city', 'Bengaluru');
  noSsForm.append('state', 'Karnataka');
  noSsForm.append('payment_method', 'prepaid');
  noSsForm.append('items', JSON.stringify([{ product_id: standardProduct.id, quantity: 1 }]));

  const noSsRes = await request('/api/orders', {
    method: 'POST',
    body: noSsForm
  });
  if (noSsRes.status === 400 && noSsRes.data && noSsRes.data.error.includes('screenshot')) {
    console.log('   ✓ Correctly rejected: ' + noSsRes.data.error);
  } else {
    throw new Error('Expected 400 with screenshot error, got: ' + noSsRes.status + ' ' + noSsRes.text);
  }

  // 4. Test Prepaid order WITH payment screenshot -> Should succeed (+₹40 delivery)
  console.log('\n4. Testing Prepaid order WITH payment screenshot (+₹40 delivery fee)...');
  const dummyScreenshotBuffer = Buffer.from('FakeImageDataForPaymentReceiptScreenshot12345');
  const prepaidForm = new FormData();
  prepaidForm.append('promoter_id', 'PR-1001');
  prepaidForm.append('customer_name', 'Rahul Sharma (Prepaid)');
  prepaidForm.append('phone_number', '9876543210');
  prepaidForm.append('complete_address', 'Flat 402, Green Avenue, Indiranagar');
  prepaidForm.append('pincode', '560038');
  prepaidForm.append('city', 'Bengaluru');
  prepaidForm.append('state', 'Karnataka');
  prepaidForm.append('payment_method', 'prepaid');
  prepaidForm.append('transaction_id', 'UPI-123456789012');
  prepaidForm.append('items', JSON.stringify([{ product_id: standardProduct.id, quantity: 1 }]));
  prepaidForm.append('payment_screenshot', dummyScreenshotBuffer, {
    filename: 'test_payment_screenshot.png',
    contentType: 'image/png'
  });

  const prepaidRes = await request('/api/orders', {
    method: 'POST',
    body: prepaidForm
  });

  if (prepaidRes.status !== 201 || !prepaidRes.data.orderId) {
    throw new Error('Prepaid order failed: ' + prepaidRes.text);
  }
  const prepaidOrder = prepaidRes.data;
  console.log(`   ✓ Prepaid order placed: ${prepaidOrder.orderId}`);
  console.log(`   ✓ Items Amount: ₹${prepaidOrder.itemsAmount}, Shipping Fee: ₹${prepaidOrder.shippingAmount}, Total: ₹${prepaidOrder.totalAmount}`);
  console.log(`   ✓ Payment Screenshot URL: ${prepaidOrder.paymentScreenshotUrl}`);
  if (prepaidOrder.shippingAmount !== 40) {
    throw new Error(`Expected shipping amount 40, got ${prepaidOrder.shippingAmount}`);
  }
  if (prepaidOrder.totalAmount !== Number(standardProduct.price) + 40) {
    throw new Error(`Expected total amount ${Number(standardProduct.price) + 40}, got ${prepaidOrder.totalAmount}`);
  }

  // 5. Test COD order submission -> Should succeed (+₹60 delivery)
  console.log('\n5. Testing COD order submission (+₹60 delivery fee)...');
  const codForm = new FormData();
  codForm.append('promoter_id', 'PR-1001');
  codForm.append('customer_name', 'Amit Kumar (COD)');
  codForm.append('phone_number', '9123456780');
  codForm.append('complete_address', 'House 55, Park View, Koramangala');
  codForm.append('pincode', '560034');
  codForm.append('city', 'Bengaluru');
  codForm.append('state', 'Karnataka');
  codForm.append('payment_method', 'cod');
  codForm.append('items', JSON.stringify([{ product_id: standardProduct.id, quantity: 1 }]));

  const codRes = await request('/api/orders', {
    method: 'POST',
    body: codForm
  });

  if (codRes.status !== 201 || !codRes.data.orderId) {
    throw new Error('COD order failed: ' + codRes.text);
  }
  const codOrder = codRes.data;
  console.log(`   ✓ COD order placed: ${codOrder.orderId}`);
  console.log(`   ✓ Items Amount: ₹${codOrder.itemsAmount}, Shipping Fee: ₹${codOrder.shippingAmount}, Total: ₹${codOrder.totalAmount}`);
  if (codOrder.shippingAmount !== 60) {
    throw new Error(`Expected shipping amount 60, got ${codOrder.shippingAmount}`);
  }
  if (codOrder.totalAmount !== Number(standardProduct.price) + 60) {
    throw new Error(`Expected total amount ${Number(standardProduct.price) + 60}, got ${codOrder.totalAmount}`);
  }

  // 6. Test Free Delivery product
  console.log('\n6. Testing Admin Free Delivery product creation & order...');
  const freeProdForm = new FormData();
  freeProdForm.append('name', 'Dhaara Ayurvedic Sampler (Free Delivery Special)');
  freeProdForm.append('price', '199');
  freeProdForm.append('is_active', '1');
  freeProdForm.append('shipping_type', 'free');
  freeProdForm.append('prepaid_shipping_fee', '0');
  freeProdForm.append('cod_shipping_fee', '0');
  freeProdForm.append('allowed_payment_types', 'both');
  freeProdForm.append('image', dummyScreenshotBuffer, {
    filename: 'sampler.png',
    contentType: 'image/png'
  });

  const freeProdRes = await request('/api/admin/products', {
    method: 'POST',
    headers: authHeaders,
    body: freeProdForm
  });
  const freeProduct = freeProdRes.data.product || freeProdRes.data;
  if (freeProdRes.status !== 201 || !freeProduct.id) {
    throw new Error('Failed to create free delivery product: ' + freeProdRes.text);
  }
  console.log(`   ✓ Created free delivery product #${freeProduct.id}: ${freeProduct.name}`);

  // Place COD order for free product -> Shipping should be ₹0!
  const freeOrderForm = new FormData();
  freeOrderForm.append('promoter_id', 'PR-1001');
  freeOrderForm.append('customer_name', 'Free Shipping Customer');
  freeOrderForm.append('phone_number', '9988776655');
  freeOrderForm.append('complete_address', 'Sector 15, HSR Layout');
  freeOrderForm.append('pincode', '560102');
  freeOrderForm.append('city', 'Bengaluru');
  freeOrderForm.append('state', 'Karnataka');
  freeOrderForm.append('payment_method', 'cod');
  freeOrderForm.append('items', JSON.stringify([{ product_id: freeProduct.id, quantity: 2 }]));

  const freeOrderRes = await request('/api/orders', {
    method: 'POST',
    body: freeOrderForm
  });
  if (freeOrderRes.status !== 201) {
    throw new Error('Free shipping order failed: ' + freeOrderRes.text);
  }
  console.log(`   ✓ Free shipping COD order placed: ${freeOrderRes.data.orderId}`);
  console.log(`   ✓ Items Amount: ₹${freeOrderRes.data.itemsAmount}, Shipping Fee: ₹${freeOrderRes.data.shippingAmount}, Total: ₹${freeOrderRes.data.totalAmount}`);
  if (freeOrderRes.data.shippingAmount !== 0) {
    throw new Error(`Expected ₹0 shipping fee, got ₹${freeOrderRes.data.shippingAmount}`);
  }
  if (freeOrderRes.data.totalAmount !== 199 * 2) {
    throw new Error(`Expected ₹${199 * 2} total, got ₹${freeOrderRes.data.totalAmount}`);
  }

  // 7. Verify Admin Order Details returns new payment & shipping fields
  console.log('\n7. Verifying Admin Order Details...');
  const adminOrderRes = await request(`/api/admin/orders/${prepaidOrder.orderId}`, {
    headers: authHeaders
  });
  if (adminOrderRes.status !== 200) {
    throw new Error('Failed to get admin order details: ' + adminOrderRes.text);
  }
  const fetchedPrepaid = adminOrderRes.data;
  console.log(`   ✓ Payment Method: ${fetchedPrepaid.payment_method}`);
  console.log(`   ✓ Payment Screenshot URL: ${fetchedPrepaid.payment_screenshot_url}`);
  console.log(`   ✓ Transaction ID: ${fetchedPrepaid.transaction_id}`);
  console.log(`   ✓ Items Amount: ₹${fetchedPrepaid.items_amount}, Shipping Amount: ₹${fetchedPrepaid.shipping_amount}`);

  // 8. Verify Excel export contains new columns
  console.log('\n8. Verifying Excel Export contains payment & shipping details...');
  const exportRes = await request('/api/admin/orders/export', {
    headers: authHeaders
  });
  if (exportRes.status !== 200) {
    throw new Error('Failed to download Excel export: ' + exportRes.text);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportRes.buffer);
  const worksheet = workbook.getWorksheet('Orders');
  const headerRow = worksheet.getRow(1);
  console.log('   Excel Header Columns 14-18:');
  for (let c = 14; c <= 18; c++) {
    console.log(`     Col ${c}: "${headerRow.getCell(c).value}"`);
  }

  console.log('\n========================================================');
  console.log('   ALL SHIPPING & PREPAID TESTS PASSED SUCCESSFULLY!    ');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
