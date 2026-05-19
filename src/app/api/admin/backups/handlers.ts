import { NextRequest, NextResponse } from 'next/server';

import type { AdminCheckResult } from '@/lib/auth';
import {
  BackupError,
  type BackupDownload,
  type BackupRecord,
} from '@/lib/backups';

export interface ListBackupsDependencies {
  isAdmin: (request: NextRequest) => Promise<AdminCheckResult>;
  listBackups: () => Promise<BackupRecord[]>;
}

export interface CreateBackupDependencies {
  isAdmin: (request: NextRequest) => Promise<AdminCheckResult>;
  createSystemBackup: (options: { generatedBy: string }) => Promise<BackupRecord>;
}

export interface DownloadBackupDependencies {
  isAdmin: (request: NextRequest) => Promise<AdminCheckResult>;
  getBackupForDownload: (id: string) => Promise<BackupDownload>;
}

export interface DeleteBackupDependencies {
  isAdmin: (request: NextRequest) => Promise<AdminCheckResult>;
  deleteBackup: (id: string) => Promise<void>;
}

export function createListBackupsHandler(dependencies: ListBackupsDependencies) {
  return async function GET(request: NextRequest) {
    try {
      const auth = await dependencies.isAdmin(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }

      const backups = await dependencies.listBackups();
      return NextResponse.json({ success: true, data: backups });
    } catch (error) {
      console.error('List backups error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function createCreateBackupHandler(dependencies: CreateBackupDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const auth = await dependencies.isAdmin(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }

      const backup = await dependencies.createSystemBackup({
        generatedBy: auth.userId ?? 'unknown-admin',
      });

      console.info('System backup create API called', {
        backupName: backup.name,
        createdBy: auth.userId,
      });

      return NextResponse.json({ success: true, data: backup });
    } catch (error) {
      console.error('Create backup error:', error);

      if (error instanceof BackupError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function createDownloadBackupHandler(dependencies: DownloadBackupDependencies) {
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const auth = await dependencies.isAdmin(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }

      const { id } = await params;
      const backup = await dependencies.getBackupForDownload(id);

      console.info('System backup downloaded', {
        backupName: backup.fileName,
        downloadedBy: auth.userId,
      });

      return new NextResponse(new Uint8Array(backup.buffer), {
        status: 200,
        headers: {
          'Content-Type': backup.contentType,
          'Content-Length': String(backup.fileSize),
          'Content-Disposition': `attachment; filename="${backup.fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      console.error('Download backup error:', error);

      if (error instanceof BackupError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function createDeleteBackupHandler(dependencies: DeleteBackupDependencies) {
  return async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const auth = await dependencies.isAdmin(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }

      const { id } = await params;
      await dependencies.deleteBackup(id);

      console.info('System backup deleted', {
        backupName: id,
        deletedBy: auth.userId,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Delete backup error:', error);

      if (error instanceof BackupError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
