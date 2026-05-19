import { isAdmin } from '@/lib/auth';
import { listBackups } from '@/lib/backups';

import { createListBackupsHandler } from './handlers';

export const runtime = 'nodejs';

export const GET = createListBackupsHandler({
  isAdmin,
  listBackups,
});
