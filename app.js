// Builds the Express app. Dependencies are passed in so tests can use fakes.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { catalogueRouter } = require('./routes/catalogue');
const { notFoundApi, errorHandler } = require('./middleware/errors');

function createApp({ catalogue, pingDb, isProduction = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render sits behind one proxy; needed for correct client IPs

  const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
  csp['img-src'] = ["'self'", 'data:', 'https:'];
  if (!isProduction) csp['upgrade-insecure-requests'] = null; // keeps plain-http local dev working
  app.use(helmet({ contentSecurityPolicy: { directives: csp } }));

  // Lightweight liveness check for Render (does not touch the database).
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'rate_limited', message: 'Too many requests. Please wait a minute and try again.' } },
    })
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', async (req, res) => {
    try {
      await pingDb();
      res.json({ status: 'ok', database: 'ok' });
    } catch (err) {
      console.error('Health check: database unreachable:', err.message);
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  app.use('/api', catalogueRouter(catalogue));
  app.use('/api', notFoundApi);

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: isProduction ? '5m' : 0 }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
    
