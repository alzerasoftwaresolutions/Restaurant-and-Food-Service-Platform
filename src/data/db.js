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

  const isStrictEnv = config.env === 'staging' || config.env === 'production';
  const hasRealConfig = Boolean(process.env.DATABASE_URL || process.env.PGHOST || isStrictEnv);

  if (hasRealConfig) {
    try {
      const poolConfig = config.database.url
        ? {
            connectionString: config.database.url,
            ssl: config.database.ssl,
            max: config.database.pool.max,
            idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
            connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis
          }
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

      // Handle unexpected pool errors on idle clients
      pool.on('error', (err) => {
        console.error('[Database Pool Error] Unexpected idle client error:', err.message);
      });

      console.log(`[Database] Connected to PostgreSQL at ${config.database.host}:${config.database.port}/${config.database.database} (Pool Max: ${config.database.pool.max})`);
      return poolInstance;
    } catch (err) {
      if (isStrictEnv) {
        console.error(`[Database Critical Error] Failed to connect to PostgreSQL in ${config.env} environment:`, err.message);
        throw new Error(`PostgreSQL connection failed in ${config.env} mode: ${err.message}`);
      }
      console.warn(`[Database] PostgreSQL daemon not reachable at ${config.database.host}:${config.database.port}. Falling back to embedded in-memory PostgreSQL engine for development:`, err.message);
    }
  }

  // Fallback to in-memory PostgreSQL engine (pg-mem) for development / testing
  if (!inMemoryDb) {
    inMemoryDb = newDb();
    inMemoryDb.public.registerFunction({
      name: 'now',
      returns: inMemoryDb.public.getType('timestamp'),
      implementation: () => new Date()
    });
    inMemoryDb.public.registerFunction({
      name: 'current_database',
      returns: inMemoryDb.public.getType('text'),
      implementation: () => 'rfsp_core_v1_memory'
    });

    const adapter = inMemoryDb.adapters.createPg();
    poolInstance = new adapter.Pool();
    isInMemoryMode = true;
    console.log('[Database] Initialized PostgreSQL engine (in-memory mode for test/standalone execution)');
  }

  return poolInstance;
}

/**
 * Perform a database health check query
 * Returns connectivity status and latency without exposing credentials
 */
export async function checkDbHealth() {
  const startTime = Date.now();
  try {
    const pool = await getDb();
    const result = await pool.query('SELECT 1 AS alive, NOW() AS db_time');
    const latencyMs = Date.now() - startTime;

    if (result.rows && result.rows.length > 0) {
      return {
        status: 'UP',
        latencyMs,
        engine: 'PostgreSQL',
        mode: isInMemoryMode ? 'in-memory-adapter' : 'connection-pool',
        pool: isInMemoryMode ? null : {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      };
    }
    return { status: 'DOWN', error: 'No response from database query' };
  } catch (err) {
    return {
      status: 'DOWN',
      latencyMs: Date.now() - startTime,
      error: err.message
    };
  }
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
 * Close database connections cleanly during shutdown
 */
export async function closeDb() {
  if (poolInstance) {
    console.log('[Database] Closing PostgreSQL connection pool...');
    await poolInstance.end();
    poolInstance = null;
  }
  inMemoryDb = null;
}
