import { config } from 'dotenv';
import mysql from 'mysql2/promise';

import { buildBranchManagementRepairPlan, readSchemaSnapshot } from '../src/lib/db/schemaRepair';

config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Put it in .env.local.');
  process.exit(1);
}

const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 1,
  timezone: 'Z',
});

async function main() {
  try {
    const [databaseRowsResult] = await pool.query('SELECT DATABASE() AS databaseName');
    const databaseRows = databaseRowsResult as Array<{ databaseName: string | null }>;
    const databaseName = databaseRows[0]?.databaseName;

    if (!databaseName) {
      throw new Error('Could not resolve the active database from DATABASE_URL.');
    }

    const snapshot = await readSchemaSnapshot(pool, databaseName, [
      'users',
      'branch_allowed_ips',
      'branches',
    ]);
    const steps = buildBranchManagementRepairPlan(snapshot);

    if (steps.length === 0) {
      console.log('Branch management schema is already up to date.');
      return;
    }

    for (const step of steps) {
      console.log(`Applying ${step.name}...`);
      await pool.execute(step.sql, step.params);
    }

    console.log(`Branch management schema repaired. Applied ${steps.length} step(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Branch schema repair failed:', message);
  process.exit(1);
});
