import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getGlobalSettings } from '@/lib/globalSettings';

import { createCheckInHandler } from './handler';

export const POST = createCheckInHandler({
  db,
  getCurrentUser,
  getGlobalSettings,
});
