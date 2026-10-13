import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'nexforge_super_secret_jwt_key_2026_forge',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  WORKSPACES_DIR: process.env.WORKSPACES_DIR || path.join(process.cwd(), '..', 'workspaces_storage')
};
