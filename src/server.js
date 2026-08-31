import { createApp } from './api/app.js';
import { config } from './config/appConfig.js';
import { getDb, queryOne } from './data/db.js';
import { runMigrations } from './data/migrator.js';
import { runSeed } from './data/seed.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('  Restaurant & Food Service Platform (RFSP)');
  console.log('  Release Unit: Core Platform v1');
  console.log('  Database Engine: PostgreSQL');
  console.log('====================================================');

  // 1. Initialize PostgreSQL connection pool
  await getDb();

  // 2. Run deterministic migrations
  await runMigrations();

  // 3. Auto-seed if users table is empty
  const userRow = await queryOne('SELECT COUNT(*) AS count FROM users');
  const userCount = Number(userRow?.count || 0);
  if (userCount === 0) {
    console.log('[Bootstrap] No existing users found. Auto-seeding initial Core Platform v1 data...');
    await runSeed();
  }

  // 4. Create and start express app
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[RFSP Core v1] Server running on http://${config.host}:${config.port}`);
    console.log(`  - Administration Experience: http://${config.host}:${config.port}/admin`);
    console.log(`  - Customer Digital Menu:     http://${config.host}:${config.port}/menu/downtown-flagship`);
    console.log(`  - QR Resolution Example:     http://${config.host}:${config.port}/qr/QR_DT01_MAIN`);
    console.log(`  - Health Check Endpoint:     http://${config.host}:${config.port}/api/health`);
    console.log('====================================================');
  });

  return { app, server };
}

bootstrap().catch(err => {
  console.error('[Bootstrap Error] Failed to start server:', err);
  process.exit(1);
});
