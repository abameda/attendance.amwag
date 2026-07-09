import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { assertValidProductionRuntimeEnvironment, getDatabaseUrl } from '@/lib/env';

import * as schema from './schema';

assertValidProductionRuntimeEnvironment();

const pool = mysql.createPool({
  uri: getDatabaseUrl(),
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
});

export const db = drizzle(pool, { schema, mode: 'default' });

export { pool };
