import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental variables from the master config .env located at the root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:SecurePassword2024@localhost:5432/ptalk_business',
  },
  verbose: true,
  strict: true,
});
