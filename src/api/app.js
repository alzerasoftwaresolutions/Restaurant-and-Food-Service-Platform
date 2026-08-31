import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from '../config/appConfig.js';
import { checkDbHealth } from '../data/db.js';
import authRoutes from './routes/authRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import publicMenuRoutes from './routes/publicMenuRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { qrService } from '../core/qr/qrService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');

export function createApp() {
  const app = express();

  // Trust proxy for HTTPS headers when behind nginx / cloud reverse proxies
  if (config.env === 'production' || config.env === 'staging') {
    app.set('trust proxy', 1);
  }

  // Basic middleware
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()),
    credentials: true
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Serve static assets
  app.use(express.static(publicDir));
  app.use('/uploads', express.static(config.media.uploadDir));

  // Health check endpoint with real database verification
  app.get('/api/health', async (_req, res) => {
    const dbHealth = await checkDbHealth();
    const isHealthy = dbHealth.status === 'UP';

    const payload = {
      status: isHealthy ? 'UP' : 'DOWN',
      product: 'Restaurant & Food Service Platform (RFSP)',
      unit: 'Core Platform v1',
      environment: config.env,
      database: {
        status: dbHealth.status,
        engine: dbHealth.engine || 'PostgreSQL',
        latencyMs: dbHealth.latencyMs,
        mode: dbHealth.mode
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };

    res.status(isHealthy ? 200 : 503).json(payload);
  });

  // Experience Layer API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', organizationRoutes);
  app.use('/api/v1', menuRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1', qrRoutes);
  app.use('/api/v1/public', publicMenuRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);

  // Canonical QR Scan Handler: /qr/:code
  // Resolves QR code and redirects browser to canonical public menu destination
  app.get('/qr/:code', async (req, res) => {
    try {
      const resolution = await qrService.resolveQRDestination(req.params.code);
      if (!resolution.success) {
        // Serve resolution landing page showing friendly error
        return res.sendFile(path.join(publicDir, 'qr', 'resolve.html'));
      }
      // Seamless redirect to canonical public menu URL
      res.redirect(`/menu/${resolution.branchSlug}`);
    } catch (err) {
      res.sendFile(path.join(publicDir, 'qr', 'resolve.html'));
    }
  });

  // Canonical Public Digital Menu Route: /menu/:branchSlug
  app.get('/menu/:branchSlug', (_req, res) => {
    res.sendFile(path.join(publicDir, 'menu', 'index.html'));
  });

  // Admin Experience Single-Page Console: /admin
  app.get('/admin*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'index.html'));
  });

  // Root redirect to administration console
  app.get('/', (_req, res) => {
    res.redirect('/admin');
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
