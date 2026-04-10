import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

const pool = mysql.createPool({
  uri: databaseUrl ?? 'mysql://build:build@127.0.0.1:1/build_placeholder',
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
});

export const db = drizzle(pool, { schema, mode: 'default' });

export { pool };
