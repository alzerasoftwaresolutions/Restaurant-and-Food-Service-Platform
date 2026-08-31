import { runMigrations } from './migrator.js';
import { closeDb } from './db.js';

async function main() {
  console.log('====================================================');
  console.log('  RFSP Core Platform v1 — Database Migration Runner');
  console.log('====================================================');

  try {
    const count = await runMigrations();
    console.log(`[Migration CLI] Completed successfully. Applied ${count} migration(s).`);
    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error('[Migration CLI Error] Migration failed:', err.message);
    await closeDb();
    process.exit(1);
  }
}

main();
