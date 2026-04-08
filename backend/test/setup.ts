// Vitest setup — runs once before any test file imports anything else.
//
// Loads .env.test (which points DATABASE_URL at the `test` schema in the same
// Postgres database) and applies the Prisma schema to that schema. We use a
// separate schema rather than a separate database so we don't need to create
// the database from psql at test time.

import { config } from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';

// Override any existing env so the test schema URL wins even if .env was loaded earlier.
config({ path: path.resolve(__dirname, '../.env.test'), override: true });

if (!process.env.DATABASE_URL?.includes('schema=test')) {
  throw new Error('Refusing to run tests: DATABASE_URL does not target the `test` schema. Check .env.test.');
}

// Apply schema to the test schema. Idempotent — safe to run every time.
// `--skip-generate` because the prisma client is already generated against the same schema definition.
try {
  execSync('npx prisma db push --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
    env: process.env,
  });
} catch (err) {
  console.error('Failed to push schema to test database:', err);
  throw err;
}
