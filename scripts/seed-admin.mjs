import { randomUUID } from 'node:crypto';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';

import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '.env.local' });

const rl = readline.createInterface({ input, output });

const email = (await rl.question('Admin email: ')).trim().toLowerCase();
const password = (await rl.question('Admin password (min 8 chars): ')).trim();
const fullName = (await rl.question('Full name: ')).trim();

rl.close();

if (!email || !password || password.length < 8 || !fullName) {
  console.error('Invalid input. Email, password (8+ chars), and full name are required.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Put it in .env.local.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const id = randomUUID();
const pool = mysql.createPool({ uri: process.env.DATABASE_URL });

try {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', 0)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       full_name = VALUES(full_name),
       role = 'admin',
       must_change_password = 0`,
    [id, email, hash, fullName]
  );

  console.log(`Admin user ready: ${email}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Seed failed:', message);
  process.exit(1);
} finally {
  await pool.end();
}
