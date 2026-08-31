import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, withTransaction, queryAll, execute, query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

/**
 * Clean SQL comments and split by statement
 */
function parseSqlStatements(sql) {
  const cleanSql = sql.replace(/--.*$/gm, '');
  return cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Execute all pending PostgreSQL migrations in deterministic order
 */
export async function runMigrations() {
  await getDb();

  // 1. Ensure schema_migrations table exists
  try {
    await query('SELECT 1 FROM schema_migrations LIMIT 1');
  } catch (err) {
    await execute(`
      CREATE TABLE schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  }

  // 2. Fetch already applied versions
  const appliedRows = await queryAll('SELECT version FROM schema_migrations ORDER BY version ASC');
  const appliedSet = new Set(appliedRows.map(r => r.version));

  // 3. Read migration files
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`[Migrator] Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    const statements = parseSqlStatements(sqlContent);

    await withTransaction(async (client) => {
      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }
      // Record in schema_migrations
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });

    appliedCount++;
    console.log(`[Migrator] Successfully applied: ${file}`);
  }

  if (appliedCount === 0) {
    console.log('[Migrator] Schema is up to date. No pending migrations.');
  } else {
    console.log(`[Migrator] Finished applying ${appliedCount} migration(s).`);
  }

  return appliedCount;
}
