/**
 * Express application setup.
 * Security middleware, API routes, static file serving, clean URLs, error handler.
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { apiLimiter } = require('./middleware/rateLimiters');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

function createApp() {
  const app = express();

  // --- Timestamp for cache-busting CSS/JS includes ---
  const BUILD_STAMP = Date.now();

  // --- Security ---
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(cors());
  app.use(compression());

  // --- Logging (development only) ---
  if (process.env.NODE_ENV === 'development') {
    const morgan = require('morgan');
    app.use(morgan('dev'));
  }

  // --- Body parsing ---
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // --- Rate limiting on API ---
  app.use('/api', apiLimiter);

  // --- API routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/notifications', notificationRoutes);

  // --- Static file serving with cache rules ---
  const frontendDir = path.join(__dirname, '..', 'frontend');

  // CSS and JS: no-cache with ETag (revalidates every request but uses 304 if unchanged)
  app.use(
    '/css',
    express.static(path.join(frontendDir, 'css'), {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.use(
    '/js',
    express.static(path.join(frontendDir, 'js'), {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );

  // Assets (images, favicon): long immutable caching
  app.use(
    '/assets',
    express.static(path.join(frontendDir, 'assets'), {
      maxAge: '30d',
      immutable: true,
    })
  );

  // --- HTML serving helper: injects ?v= cache-busting param ---
  function serveHtml(filePath) {
    return (_req, res) => {
      const fs = require('fs');
      let html = fs.readFileSync(path.join(frontendDir, filePath), 'utf8');
      // Replace .css" and .js" hrefs/srcs with versioned URLs
      html = html.replace(/(\.css)"/g, `$1?v=${BUILD_STAMP}"`);
      html = html.replace(/(\.js)"/g, `$1?v=${BUILD_STAMP}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    };
  }

  // --- Clean URL routes ---
  app.get('/test-icons', serveHtml('pages/test-icons.html'));
  app.get('/login', serveHtml('pages/login.html'));
  app.get('/register', serveHtml('pages/register.html'));
  app.get('/dashboard', serveHtml('pages/dashboard.html'));
  app.get('/projects/:id', serveHtml('pages/board.html'));
  app.get('/my-tasks', serveHtml('pages/my-tasks.html'));

  // Root redirect
  app.get('/', (req, res) => {
    // Client-side handles auth check; redirect to dashboard by default
    res.redirect('/dashboard');
  });

  // --- 404 for unmatched routes ---
  app.use((req, res, next) => {
    // If it's an API route, return JSON 404
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'Endpoint not found' });
    }
    // Otherwise serve 404 page
    serveHtml('pages/404.html')(req, res);
  });

  // --- Central error handler ---
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

