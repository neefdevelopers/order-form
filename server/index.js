const express = require('express');
const path = require('path');
const cors = require('cors');
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

// Serve static uploaded product images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// -------------------------------------------------------------
// Admin Authentication Routes
// -------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateToken({ username, role: 'admin' });
    
    // Also set an HTTP-only cookie for convenience
    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      token,
      admin: { username }
    });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
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
