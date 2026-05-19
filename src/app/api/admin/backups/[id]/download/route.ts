import { isAdmin } from '@/lib/auth';
import { getBackupForDownload } from '@/lib/backups';

import { createDownloadBackupHandler } from '../../handlers';

export const runtime = 'nodejs';

export const GET = createDownloadBackupHandler({
  isAdmin,
  getBackupForDownload,
});
