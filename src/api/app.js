import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static assets
  app.use(express.static(publicDir));
  app.use('/uploads', express.static(path.join(publicDir, 'uploads')));

  // Experience Layer API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', organizationRoutes);
  app.use('/api/v1', menuRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1', qrRoutes);
  app.use('/api/v1/public', publicMenuRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'UP',
      product: 'Restaurant & Food Service Platform (RFSP)',
      unit: 'Core Platform v1',
      database: 'PostgreSQL',
      timestamp: new Date().toISOString()
    });
  });

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
