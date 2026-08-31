import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || 'localhost',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  jwt: {
    secret: process.env.JWT_SECRET || 'rfsp_core_v1_super_secure_jwt_secret_key_2026',
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
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  },

  media: {
    uploadDir: path.join(rootDir, 'public/uploads'),
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
