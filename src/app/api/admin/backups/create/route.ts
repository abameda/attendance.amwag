import { isAdmin } from '@/lib/auth';
import { createSystemBackup } from '@/lib/backups';

import { createCreateBackupHandler } from '../handlers';

export const runtime = 'nodejs';

export const POST = createCreateBackupHandler({
  isAdmin,
  createSystemBackup,
});
