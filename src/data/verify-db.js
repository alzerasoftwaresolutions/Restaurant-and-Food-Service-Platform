import { getDb, queryOne, queryAll, checkDbHealth, closeDb } from './db.js';
import { config } from '../config/appConfig.js';

async function verifyDatabase() {
  console.log('====================================================');
  console.log('  RFSP Core Platform v1 — Database Verification');
  console.log('====================================================');
  console.log(`Environment: ${config.env}`);
  console.log(`Target:      ${config.database.host}:${config.database.port}/${config.database.database}`);

  try {
    // 1. Connectivity & Health Check
    const health = await checkDbHealth();
    console.log(`Connection Status: ${health.status}`);
    console.log(`Engine:            ${health.engine}`);
    console.log(`Mode:              ${health.mode}`);
    console.log(`Ping Latency:      ${health.latencyMs} ms`);

    if (health.status !== 'UP') {
      throw new Error(`Database ping failed: ${health.error}`);
    }

    // 2. Migration Tracking
    let applied = [];
    let migrationsTableExists = true;
    try {
      applied = await queryAll('SELECT version, applied_at FROM schema_migrations ORDER BY version ASC');
    } catch (migErr) {
      migrationsTableExists = false;
      console.log('\n--- Applied Schema Migrations ---');
      console.log('  ✖ schema_migrations table does not exist. Run "npm run migrate" to apply schema.');
    }

    if (migrationsTableExists) {
      console.log('\n--- Applied Schema Migrations ---');
      if (applied.length === 0) {
        console.log('  (No migrations recorded in schema_migrations table. Run "npm run migrate")');
      } else {
        for (const m of applied) {
          console.log(`  ✔ ${m.version} (Applied: ${m.applied_at})`);
        }
      }
    }

    // 3. Table Schema & Record Verification
    const tables = [
      'users',
      'roles',
      'user_roles',
      'restaurants',
      'branches',
      'menus',
      'categories',
      'menu_items',
      'menu_branch_assignments',
      'qr_codes',
      'media_assets',
      'audit_logs',
      'configuration'
    ];

    console.log('\n--- Core Domain Table Verification ---');
    let allTablesPresent = true;
    for (const table of tables) {
      try {
        const row = await queryOne(`SELECT COUNT(*) AS count FROM ${table}`);
        const count = Number(row?.count || 0);
        console.log(`  ✔ Table "${table}": OK (${count} records)`);
      } catch (tableErr) {
        allTablesPresent = false;
        console.log(`  ✖ Table "${table}": NOT INITIALIZED (Run "npm run migrate")`);
      }
    }

    console.log('\n====================================================');
    if (migrationsTableExists && allTablesPresent && applied.length > 0) {
      console.log('  Database Status: FULLY INITIALIZED & HEALTHY');
    } else if (health.status === 'UP') {
      console.log('  Database Status: REACHABLE (Migrations Pending — Run "npm run migrate")');
    } else {
      console.log('  Database Status: UNHEALTHY');
    }
    console.log('====================================================');
    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error('\n[Database Verification Error]', err.message);
    console.log('====================================================');
    console.log('  Database Verification: FAILED');
    console.log('====================================================');
    await closeDb();
    process.exit(1);
  }
}

verifyDatabase();
