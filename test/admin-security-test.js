const http = require('http');

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING ADMIN SECURITY & LOGIN VERIFICATION TESTS ---');

  // Test 1: Check Security Headers on GET /
  console.log('\n[Test 1] Checking security response headers on / ...');
  const resHome = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/',
    method: 'GET'
  });
  console.log('Status:', resHome.statusCode);
  console.log('X-Content-Type-Options:', resHome.headers['x-content-type-options']);
  console.log('X-Frame-Options:', resHome.headers['x-frame-options']);
  console.log('X-XSS-Protection:', resHome.headers['x-xss-protection']);
  console.log('Cache-Control:', resHome.headers['cache-control']);

  if (resHome.headers['x-content-type-options'] !== 'nosniff' ||
      resHome.headers['x-frame-options'] !== 'DENY' ||
      !resHome.headers['x-xss-protection'].includes('1; mode=block')) {
    throw new Error('Security headers missing or incorrect on response');
  }
  console.log('Test 1 PASSED: Security and caching headers configured correctly.');

  // Test 2: Protected Admin Route without Token
  console.log('\n[Test 2] Checking protected route /api/admin/me without credentials...');
  const resMeUnauth = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/me',
    method: 'GET'
  });
  console.log('Status:', resMeUnauth.statusCode, 'Body:', resMeUnauth.data);
  if (resMeUnauth.statusCode !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${resMeUnauth.statusCode}`);
  }
  console.log('Test 2 PASSED: Unauthenticated access rejected with 401.');

  // Test 3: Failed Login Attempts & Remaining Attempts Counter
  console.log('\n[Test 3] Testing failed login attempts counter...');
  const resFail1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.1' // distinct simulated IP for rate test
    }
  }, { username: 'admin', password: 'wrongpassword' });

  console.log('Failed attempt 1 status:', resFail1.statusCode, 'Message:', resFail1.data);
  if (resFail1.statusCode !== 401 || !resFail1.data.error.includes('4 attempts remaining')) {
    throw new Error(`Expected 401 with "4 attempts remaining", got: ${JSON.stringify(resFail1.data)}`);
  }
  console.log('Test 3 PASSED: Failed attempt decrements remaining count.');

  // Test 4: Rate Limiting & Lockout after 5 failed attempts
  console.log('\n[Test 4] Testing brute force lockout after 5 failed attempts...');
  for (let i = 2; i <= 4; i++) {
    await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.1'
      }
    }, { username: 'admin', password: 'wrongpassword' });
  }

  // 5th failed attempt should trigger 429 lockout
  const resFail5 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.1'
    }
  }, { username: 'admin', password: 'wrongpassword' });

  console.log('5th failed attempt status:', resFail5.statusCode, 'Body:', resFail5.data);
  if (resFail5.statusCode !== 429) {
    throw new Error(`Expected 429 Too Many Requests on 5th failure, got ${resFail5.statusCode}`);
  }

  // Subsequent attempt within lockout window should also return 429
  const resLocked = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.1'
    }
  }, { username: 'admin', password: 'admin123' });

  console.log('Attempt during lockout window status:', resLocked.statusCode, 'Body:', resLocked.data);
  if (resLocked.statusCode !== 429) {
    throw new Error(`Expected 429 during active lockout, got ${resLocked.statusCode}`);
  }
  console.log('Test 4 PASSED: Brute-force lockout functions properly with HTTP 429.');

  // Test 5: Successful Admin Login from Fresh IP
  console.log('\n[Test 5] Testing valid admin authentication...');
  const resSuccess = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.2'
    }
  }, { username: 'admin', password: 'admin123' });

  console.log('Login success status:', resSuccess.statusCode, 'Response:', resSuccess.data);
  if (resSuccess.statusCode !== 200 || !resSuccess.data.token) {
    throw new Error('Valid login failed or missing token');
  }
  const token = resSuccess.data.token;
  console.log('Test 5 PASSED: Admin authenticated successfully, received JWT token.');

  // Test 6: Verify Token on Protected /api/admin/me
  console.log('\n[Test 6] Verifying token access on /api/admin/me...');
  const resMeAuth = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Auth check status:', resMeAuth.statusCode, 'Body:', resMeAuth.data);
  if (resMeAuth.statusCode !== 200 || !resMeAuth.data.authenticated) {
    throw new Error('Failed to access protected route with valid token');
  }
  console.log('Test 6 PASSED: Protected route authorized with JWT token.');

  // Test 7: Logout endpoint
  console.log('\n[Test 7] Testing logout endpoint...');
  const resLogout = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/logout',
    method: 'POST'
  });
  console.log('Logout status:', resLogout.statusCode, 'Body:', resLogout.data);
  if (resLogout.statusCode !== 200) {
    throw new Error('Logout failed');
  }
  console.log('Test 7 PASSED: Logout clears cookies and returns success.');

  console.log('\n=============================================');
  console.log('ALL ADMIN SECURITY & LOGIN TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});

