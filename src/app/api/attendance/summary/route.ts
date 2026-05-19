import { isAdminOrAccountant } from '@/lib/auth';
import { db } from '@/lib/db';

import { createAttendanceSummaryHandler } from './handler';

export const GET = createAttendanceSummaryHandler({
  db,
  isAdminOrAccountant,
});
