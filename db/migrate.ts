import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:SecurePassword2024@localhost:5432/ptalk_business';

async function runMigrations() {
  console.log('Running database migrations...');
  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  try {
    // Run migration using Drizzle ORM migrator pointing to the generated drizzle/ folder
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
