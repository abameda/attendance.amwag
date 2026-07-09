import { isAdminOrAccountant, getCurrentUser } from '@/lib/auth';

import { createAttendancePdfExportHandler, renderAttendancePdf } from './handler';

export const runtime = 'nodejs';

export const POST = createAttendancePdfExportHandler({
  isAdminOrAccountant,
  getCurrentUser,
  renderPdf: renderAttendancePdf,
});
