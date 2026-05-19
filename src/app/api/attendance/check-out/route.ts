import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getGlobalSettings } from '@/lib/globalSettings';

import { createCheckOutHandler } from './handler';

export const POST = createCheckOutHandler({
  db,
  getCurrentUser,
  getGlobalSettings,
});
