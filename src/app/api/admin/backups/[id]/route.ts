import { isAdmin } from '@/lib/auth';
import { deleteBackup } from '@/lib/backups';

import { createDeleteBackupHandler } from '../handlers';

export const runtime = 'nodejs';

export const DELETE = createDeleteBackupHandler({
  isAdmin,
  deleteBackup,
});
