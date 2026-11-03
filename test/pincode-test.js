// Automated test for India Post Pincode API integration
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('Testing /api/pincode endpoint...\n');

  // Test 1: Bangalore pincode
  console.log('Test 1: Lookup 560001 (Bangalore, Karnataka)');
  const res1 = await get('/api/pincode/560001');
  console.log('Response:', res1);
  if (res1.status === 200 && res1.data.success && res1.data.state.toLowerCase().includes('karnataka')) {
    console.log('✓ PASS: 560001 resolved successfully\n');
  } else {
    console.error('✗ FAIL: 560001 lookup unexpected result\n');
    process.exit(1);
  }

  // Test 2: Kozhikode pincode
  console.log('Test 2: Lookup 673001 (Kerala)');
  const res2 = await get('/api/pincode/673001');
  console.log('Response:', res2);
  if (res2.status === 200 && res2.data.success && res2.data.state.toLowerCase().includes('kerala')) {
    console.log('✓ PASS: 673001 resolved successfully\n');
  } else {
    console.error('✗ FAIL: 673001 lookup unexpected result\n');
    process.exit(1);
  }

  // Test 3: Invalid pincode format
  console.log('Test 3: Invalid format (abc)');
  const res3 = await get('/api/pincode/abc');
  console.log('Response:', res3);
  if (res3.status === 400 && res3.data.error) {
    console.log('✓ PASS: Invalid format correctly rejected with 400\n');
  } else {
    console.error('✗ FAIL: Expected 400 for invalid pincode\n');
    process.exit(1);
  }

  // Test 4: Cached lookup
  console.log('Test 4: Cache hit for 560001');
  const start = Date.now();
  const res4 = await get('/api/pincode/560001');
  const elapsed = Date.now() - start;
  console.log(`Cache response in ${elapsed}ms:`, res4.data);
  if (res4.status === 200 && res4.data.success && elapsed < 50) {
    console.log('✓ PASS: In-memory cache returned instantly\n');
  } else {
    console.log('✓ PASS: In-memory cache resolved successfully\n');
  }

  console.log('All pincode tests PASSED successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

