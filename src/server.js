import { createApp } from './api/app.js';
import { config, validateConfig } from './config/appConfig.js';
import { getDb, queryOne, closeDb } from './data/db.js';
import { runMigrations } from './data/migrator.js';
import { runSeed } from './data/seed.js';

let serverInstance = null;
let isShuttingDown = false;

async function bootstrap() {
  console.log('====================================================');
  console.log('  Restaurant & Food Service Platform (RFSP)');
  console.log('  Release Unit: Core Platform v1');
  console.log(`  Environment: ${config.env.toUpperCase()}`);
  console.log('  Database Engine: PostgreSQL');
  console.log('====================================================');

  // 1. Validate Environment & Runtime Configuration
  validateConfig();
  console.log('[Bootstrap] Configuration validated successfully.');

  // 2. Initialize PostgreSQL connection pool
  await getDb();

  // 3. Run deterministic migrations
  await runMigrations();

  // 4. Seeding Check (controlled by environment)
  const userRow = await queryOne('SELECT COUNT(*) AS count FROM users');
  const userCount = Number(userRow?.count || 0);

  if (userCount === 0) {
    if (config.autoSeed) {
      console.log('[Bootstrap] No existing users found. Running initial Core Platform v1 seed data...');
      await runSeed();
    } else {
      console.log('[Bootstrap] Notice: Database has 0 users. Auto-seed is disabled in this environment. Run "npm run seed" if initial data is desired.');
    }
  }

  // 5. Create and start express app
  const app = createApp();
  serverInstance = app.listen(config.port, config.host, () => {
    console.log(`[RFSP Core v1] Server running on http://${config.host}:${config.port}`);
    console.log(`  - Administration Experience: http://${config.host}:${config.port}/admin`);
    console.log(`  - Customer Digital Menu:     http://${config.host}:${config.port}/menu/downtown-flagship`);
    console.log(`  - QR Resolution Example:     http://${config.host}:${config.port}/qr/QR_DT01_MAIN`);
    console.log(`  - Health Check Endpoint:     http://${config.host}:${config.port}/api/health`);
    console.log('====================================================');
  });

  return { app, server: serverInstance };
}

/**
 * Handle graceful shutdown of HTTP server and database connection pool
 */
async function handleShutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimer = setTimeout(() => {
    console.error('[Shutdown Error] Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, config.shutdownTimeoutMs);

  // Unref timeout so it doesn't keep event loop alive if everything finishes early
  shutdownTimer.unref();

  try {
    // 1. Stop accepting new HTTP connections
    if (serverInstance) {
      console.log('[Shutdown] Closing HTTP server and rejecting new connections...');
      await new Promise((resolve, reject) => {
        serverInstance.close((err) => {
          if (err) {
            return reject(err);
          }
          console.log('[Shutdown] All in-flight HTTP connections closed.');
          resolve();
        });
      });
    }

    // 2. Close PostgreSQL connection pool
    await closeDb();

    console.log('[Shutdown] Graceful shutdown completed cleanly. Exiting.');
    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (err) {
    console.error('[Shutdown Error] Error during graceful shutdown:', err.message);
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

// Process signal listeners for graceful shutdown
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Process error listeners to prevent silent crash and log cleanly
process.on('uncaughtException', (err) => {
  console.error('[Process Fatal] Uncaught Exception:', err.message);
  console.error(err.stack);
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Fatal] Unhandled Rejection:', reason);
  handleShutdown('unhandledRejection');
});

bootstrap().catch(err => {
  console.error('[Bootstrap Error] Failed to start server:', err.message);
  process.exit(1);
});
