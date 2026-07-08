import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createCurrentUserAttendanceHandler } from './handler';

export const dynamic = 'force-dynamic';

export const GET = createCurrentUserAttendanceHandler({
  db,
  getCurrentUser,
});
