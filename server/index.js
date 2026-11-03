const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { ADMIN_USERNAME, ADMIN_PASSWORD, generateToken, requireAdminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static uploaded product images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// -------------------------------------------------------------
// Admin Authentication Routes with Security & Brute-Force Rate Limiting
// -------------------------------------------------------------
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;   // 10 minutes

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attemptRecord = loginAttempts.get(ip) || { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };

  // Check if IP is currently locked out
  if (attemptRecord.lockedUntil && now < attemptRecord.lockedUntil) {
    const minutesLeft = Math.ceil((attemptRecord.lockedUntil - now) / (60 * 1000));
    return res.status(429).json({
      error: `Too many failed login attempts. Access is locked for security. Please try again in ${minutesLeft} minute(s).`
    });
  }

  // Reset window if expired
  if (now > attemptRecord.resetAt) {
    attemptRecord.count = 0;
    attemptRecord.resetAt = now + ATTEMPT_WINDOW_MS;
    delete attemptRecord.lockedUntil;
  }

  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUser = username.trim();
  const cleanPass = password;

  // Constant-time comparison
  const userBuf = Buffer.from(cleanUser.padEnd(64, ' '));
  const expectedUserBuf = Buffer.from(ADMIN_USERNAME.padEnd(64, ' '));
  const usernameMatch = crypto.timingSafeEqual(userBuf, expectedUserBuf) && cleanUser.length === ADMIN_USERNAME.length;

  const passBuf = Buffer.from(cleanPass.padEnd(64, ' '));
  const expectedPassBuf = Buffer.from(ADMIN_PASSWORD.padEnd(64, ' '));
  const passwordMatch = crypto.timingSafeEqual(passBuf, expectedPassBuf) && cleanPass.length === ADMIN_PASSWORD.length;

  if (usernameMatch && passwordMatch) {
    // Reset attempts on successful authentication
    loginAttempts.delete(ip);

    const token = generateToken({ username: cleanUser, role: 'admin' });
    
    // Also set an HTTP-only cookie for convenience
    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      token,
      admin: { username: cleanUser }
    });
  }

  // Increment failed attempts
  attemptRecord.count += 1;
  if (attemptRecord.count >= MAX_FAILED_ATTEMPTS) {
    attemptRecord.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(ip, attemptRecord);
    return res.status(429).json({
      error: 'Too many failed login attempts. Access locked for 15 minutes.'
    });
  }

  loginAttempts.set(ip, attemptRecord);
  const remaining = MAX_FAILED_ATTEMPTS - attemptRecord.count;
  return res.status(401).json({
    error: `Invalid username or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
  });
});

app.get('/api/admin/me', requireAdminAuth, (req, res) => {
  res.json({
    authenticated: true,
    admin: req.admin
  });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// -------------------------------------------------------------
// Mount Product, Order, Promoter, Pincode, and Export Routes
// -------------------------------------------------------------
const productsRouter = require('./routes/products');
const exportRouter = require('./routes/export');
const ordersRouter = require('./routes/orders');
const promotersRouter = require('./routes/promoters');
const pincodeRouter = require('./routes/pincode');

app.use('/api', productsRouter);
app.use('/api', promotersRouter);
app.use('/api', pincodeRouter);
app.use('/api', exportRouter); // Export mounted before orders so /export is handled before /:id
app.use('/api', ordersRouter);

// -------------------------------------------------------------
// Serve Static Frontend (Vite production build)
// -------------------------------------------------------------
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Catch-all handler for client-side routing
app.use((req, res) => {
  // If request is not an API or uploads path, serve index.html for client-side routing
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    const indexPath = path.join(clientDist, 'index.html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('Product Ordering System API is running.');
      }
    });
  }
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Admin default credentials: username="${ADMIN_USERNAME}", password="${ADMIN_PASSWORD}"`);
});
