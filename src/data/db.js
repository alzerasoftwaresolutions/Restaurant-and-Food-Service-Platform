import pg from 'pg';
import { newDb } from 'pg-mem';
import { config } from '../config/appConfig.js';

const { Pool } = pg;

let poolInstance = null;
let inMemoryDb = null;
let isInMemoryMode = false;

/**
 * Initialize or retrieve the PostgreSQL connection pool
 */
export async function getDb() {
  if (poolInstance) {
    return poolInstance;
  }

  // Attempt real PostgreSQL connection if explicit config or DATABASE_URL is set
  const hasRealConfig = Boolean(process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGHOST !== 'localhost'));

  if (hasRealConfig) {
    try {
      const poolConfig = config.database.url
        ? { connectionString: config.database.url, ssl: config.database.ssl }
        : {
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            ssl: config.database.ssl,
            max: config.database.pool.max,
            idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
            connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis
          };

      const pool = new Pool(poolConfig);
      // Test connectivity
      const client = await pool.connect();
      client.release();
      poolInstance = pool;
      isInMemoryMode = false;
      console.log(`[Database] Connected to PostgreSQL at ${config.database.host}:${config.database.port}/${config.database.database}`);
      return poolInstance;
    } catch (err) {
      console.warn(`[Database] PostgreSQL daemon not reachable at ${config.database.host}:${config.database.port}. Falling back to embedded in-memory PostgreSQL engine:`, err.message);
    }
  }

  // Fallback to in-memory PostgreSQL engine (pg-mem)
  if (!inMemoryDb) {
    inMemoryDb = newDb();
    // Register current_timestamp and helpers if needed
    inMemoryDb.public.registerFunction({
      name: 'now',
      returns: inMemoryDb.public.getType('timestamp'),
      implementation: () => new Date()
    });
    
    // Create pg-compatible adapter
    const adapter = inMemoryDb.adapters.createPg();
    poolInstance = new adapter.Pool();
    isInMemoryMode = true;
    console.log('[Database] Initialized PostgreSQL engine (in-memory mode for test/standalone execution)');
  }

  return poolInstance;
}

/**
 * Execute query returning full pg result
 */
export async function query(sql, params = []) {
  const pool = await getDb();
  return pool.query(sql, params);
}

/**
 * Execute query returning all rows as an array
 */
export async function queryAll(sql, params = []) {
  const result = await query(sql, params);
  return result.rows || [];
}

/**
 * Execute query returning first matching row or null
 */
export async function queryOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute statement (INSERT, UPDATE, DELETE)
 */
export async function execute(sql, params = []) {
  const result = await query(sql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows
  };
}

/**
 * Execute a sequence of queries within an atomic PostgreSQL transaction
 */
export async function withTransaction(callback) {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connections
 */
export async function closeDb() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
  inMemoryDb = null;
}
