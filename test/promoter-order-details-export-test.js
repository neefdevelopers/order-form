// Test verification for:
// "on promoter session on click each promoter go to that promoter id's order details and can export it"
const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(data);
        const str = fullBuffer.toString('utf8');
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(str), buffer: fullBuffer });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: str, buffer: fullBuffer });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    http.get(`http://localhost:5000${path}`, { headers }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(data);
        const str = fullBuffer.toString('utf8');
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(str), buffer: fullBuffer });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: str, buffer: fullBuffer });
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('========================================================');
  console.log('   PROMOTER ORDERS NAVIGATION & EXPORT VERIFICATION     ');
  console.log('========================================================\n');

  // 1. Admin login
  console.log('1. Admin login...');
  const loginRes = await post('/api/admin/login', { username: 'admin', password: 'admin123' });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Admin login failed');
  }
  const token = loginRes.data.token;
  console.log('   ✓ Admin authenticated successfully.\n');

  // 2. Fetch promoters list and check order_count
  console.log('2. Fetching promoters list with order counts...');
  const promotersRes = await get('/api/admin/promoters', token);
  if (promotersRes.status !== 200 || !Array.isArray(promotersRes.data)) {
    throw new Error('Failed to fetch promoters');
  }
  console.log(`   ✓ Found ${promotersRes.data.length} promoters in database.`);
  promotersRes.data.forEach(p => {
    console.log(`     • [${p.promoter_code}] "${p.name || 'No Name'}" - Orders count: ${p.order_count}`);
  });

  const promoterWithOrders = promotersRes.data.find(p => p.order_count > 0);
  if (!promoterWithOrders) {
    throw new Error('No promoter with orders found for verification');
  }
  const targetCode = promoterWithOrders.promoter_code;
  const expectedCount = promoterWithOrders.order_count;
  console.log(`\n3. Verifying order filtration for promoter: "${targetCode}" (expected orders: ${expectedCount})...`);

  // Fetch all orders and check match
  const ordersRes = await get('/api/admin/orders', token);
  const promoterOrders = ordersRes.data.filter(o => o.promoter_id && o.promoter_id.toLowerCase() === targetCode.toLowerCase());
  console.log(`   ✓ Order records matching promoter "${targetCode}": ${promoterOrders.length}`);
  if (promoterOrders.length !== expectedCount) {
    throw new Error(`Mismatch between promoter order_count (${expectedCount}) and actual orders (${promoterOrders.length})`);
  }

  // 4. Test Export for this specific promoter via GET query
  console.log(`\n4. Testing Direct Promoter Export: GET /api/admin/orders/export?promoter_id=${targetCode}...`);
  const exportRes = await get(`/api/admin/orders/export?promoter_id=${encodeURIComponent(targetCode)}`, token);
  if (exportRes.status !== 200) {
    throw new Error(`Export failed with status ${exportRes.status}`);
  }
  const disposition = exportRes.headers['content-disposition'] || '';
  console.log('   ✓ Content-Disposition header:', disposition);
  const cleanCode = targetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!disposition.includes(cleanCode)) {
    throw new Error(`Expected filename to contain "${cleanCode}", got "${disposition}"`);
  }
  console.log(`   ✓ Excel file received (${exportRes.buffer.length} bytes) with custom filename for promoter ${targetCode}.`);

  // 5. Test Export for this promoter via POST body with IDs
  console.log(`\n5. Testing Filtered Export via POST /api/admin/orders/export with promoter_id in body...`);
  const postExportRes = await post('/api/admin/orders/export', {
    ids: promoterOrders.map(o => o.id),
    promoter_id: targetCode
  }, token);
  if (postExportRes.status !== 200) {
    throw new Error(`POST export failed with status ${postExportRes.status}`);
  }
  const postDisp = postExportRes.headers['content-disposition'] || '';
  console.log('   ✓ Content-Disposition header:', postDisp);
  if (!postDisp.includes(cleanCode)) {
    throw new Error(`Expected POST export filename to contain "${cleanCode}", got "${postDisp}"`);
  }
  console.log(`   ✓ Filtered export verified (${postExportRes.buffer.length} bytes).`);

  console.log('\n========================================================');
  console.log('   ALL PROMOTER ORDER NAVIGATION & EXPORT TESTS PASSED! ');
  console.log('========================================================\n');
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

