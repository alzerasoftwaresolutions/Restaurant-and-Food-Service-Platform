import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const DEFAULT_DEV_JWT_SECRET = 'rfsp_core_v1_super_secure_jwt_secret_key_2026';

const isRunningInTest = Boolean(
  process.env.NODE_ENV === 'test' ||
  process.execArgv.some(arg => arg.includes('--test')) ||
  process.argv.some(arg => arg.includes('.test.js') || arg === '--test')
);

export const config = {
  env: process.env.NODE_ENV || (isRunningInTest ? 'test' : 'development'),
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000,
  autoSeed: process.env.AUTO_SEED === 'true' || (!process.env.NODE_ENV || process.env.NODE_ENV === 'development'),

  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  database: {
    engine: 'postgresql',
    url: process.env.DATABASE_URL || null,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'rfsp_core_v1',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    pool: {
      max: parseInt(process.env.PGPOOL_MAX, 10) || 20,
      idleTimeoutMillis: parseInt(process.env.PGIDLE_TIMEOUT_MS, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.PGCONN_TIMEOUT_MS, 10) || 5000
    }
  },

  media: {
    uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, 'public/uploads'),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml'
    ]
  },

  publishing: {
    publicMenuBaseUrl: process.env.PUBLIC_MENU_BASE_URL || 'http://localhost:3000/menu'
  }
};

/**
 * Validate configuration against runtime environment requirements.
 * Fails fast with clear error messages rather than unsafe defaults.
 */
export function validateConfig() {
  const errors = [];
  const isStrictEnv = config.env === 'staging' || config.env === 'production';

  if (isStrictEnv) {
    // 1. Validate JWT Secret in Staging / Production
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET must be explicitly set in staging/production environment.');
    } else if (process.env.JWT_SECRET === DEFAULT_DEV_JWT_SECRET) {
      errors.push('JWT_SECRET is set to the insecure default development secret. Please provide a secure random secret.');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long for cryptographic security.');
    }

    // 2. Validate Database Configuration
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    const hasExplicitPg = Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE);

    if (!hasDatabaseUrl && !hasExplicitPg) {
      errors.push('Database configuration missing. Provide either DATABASE_URL or (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).');
    }

    // 3. Validate Public Menu URL in Production
    if (config.env === 'production') {
      if (!process.env.PUBLIC_MENU_BASE_URL || process.env.PUBLIC_MENU_BASE_URL.includes('localhost')) {
        errors.push('PUBLIC_MENU_BASE_URL must be configured to the canonical domain URL in production.');
      }
    }
  }

  // Common Port Validation
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`Invalid PORT configuration: "${process.env.PORT}". Must be an integer between 1 and 65535.`);
  }

  if (errors.length > 0) {
    const message = `[Configuration Error] Application failed startup validation:\n - ${errors.join('\n - ')}`;
    console.error(message);
    throw new Error(message);
  }

  return true;
}
