import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const { db, close } = createDatabase(url);
await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
await close();
console.log('Migrations applied');
