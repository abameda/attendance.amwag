import { randomUUID } from 'node:crypto';

import { inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

interface ImportResult {
  email: string;
  success: boolean;
  error?: string;
}

interface ParsedEmployee {
  email: string;
  password: string;
  fullName: string;
  branch: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  jobTitle: string | null;
  offDay: string | null;
}

function calculateShiftEnd(shiftStart: string, shiftDuration: string): string | null {
  const duration = Number.parseFloat(shiftDuration);
  if (!Number.isFinite(duration) || !shiftStart.includes(':')) {
    return null;
  }

  const [hours, minutes] = shiftStart.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const totalMinutes = hours * 60 + minutes + Math.round(duration * 60);
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  return `${endHours.toString().padStart(2, '0')}:${endMinutes
    .toString()
    .padStart(2, '0')}`;
}

function responseFromResults(results: ImportResult[]) {
  const successCount = results.filter((result) => result.success).length;
  const failedEmails = results
    .filter((result) => !result.success)
    .map((result) => ({ email: result.email, error: result.error }));

  return {
    total: results.length,
    successCount,
    failedCount: failedEmails.length,
    failedEmails,
    inserted: successCount,
    failed: failedEmails.length,
    errors: failedEmails,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Forbidden' },
        { status: auth.status || 403 }
      );
    }

    const body = await request.json();
    const { csvData } = body ?? {};

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json(
        { success: false, error: 'CSV data is required' },
        { status: 400 }
      );
    }

    const lines = csvData.trim().split('\n').filter((line) => line.trim());
    const parsedRows: ParsedEmployee[] = [];
    const results: ImportResult[] = [];
    const seenEmails = new Set<string>();

    for (const line of lines) {
      const parts = line.split(',').map((part) => part.trim());
      const [email, password, fullName, branch, shiftStart, shiftDuration, jobTitle, offDay] = parts;
      const normalizedEmail = email?.toLowerCase() ?? '';

      if (parts.length < 3) {
        results.push({
          email: email || 'Unknown',
          success: false,
          error: 'Invalid format: at least Email, Password, and Full Name are required',
        });
        continue;
      }

      if (!normalizedEmail || !password || !fullName) {
        results.push({
          email: normalizedEmail || 'Unknown',
          success: false,
          error: 'Missing required fields (email, password, or full name)',
        });
        continue;
      }

      if (password.length < 8) {
        results.push({
          email: normalizedEmail,
          success: false,
          error: 'Password must be at least 8 characters',
        });
        continue;
      }

      if (seenEmails.has(normalizedEmail)) {
        results.push({
          email: normalizedEmail,
          success: false,
          error: 'Duplicate email in CSV',
        });
        continue;
      }

      seenEmails.add(normalizedEmail);
      parsedRows.push({
        email: normalizedEmail,
        password,
        fullName,
        branch: branch || null,
        shiftStart: shiftStart || null,
        shiftEnd: shiftStart && shiftDuration ? calculateShiftEnd(shiftStart, shiftDuration) : null,
        jobTitle: jobTitle || null,
        offDay: offDay?.toLowerCase() || null,
      });
      results.push({ email: normalizedEmail, success: true });
    }

    if (parsedRows.length > 0) {
      const existingUsers = await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, parsedRows.map((row) => row.email)));
      const existingEmails = new Set(existingUsers.map((user) => user.email));

      if (existingEmails.size > 0) {
        for (const result of results) {
          if (result.success && existingEmails.has(result.email)) {
            result.success = false;
            result.error = 'Email already in use';
          }
        }
      }
    }

    const validRows = parsedRows.filter((row) => {
      const result = results.find((item) => item.email === row.email);
      return result?.success;
    });

    if (validRows.length !== results.length) {
      for (const result of results) {
        if (result.success) {
          result.success = false;
          result.error = 'Batch cancelled because another row failed validation';
        }
      }

      return NextResponse.json({
        success: true,
        data: responseFromResults(results),
      });
    }

    try {
      await db.transaction(async (tx) => {
        for (const row of validRows) {
          const passwordHash = await hashPassword(row.password);
          await tx.insert(users).values({
            id: randomUUID(),
            email: row.email,
            passwordHash,
            fullName: row.fullName,
            role: 'employee',
            branch: row.branch,
            jobTitle: row.jobTitle,
            shiftStart: row.shiftStart,
            shiftEnd: row.shiftEnd,
            offDay: row.offDay,
            overtimeEnabled: 1,
            mustChangePassword: 1,
          });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      for (const result of results) {
        result.success = false;
        result.error = message;
      }
    }

    return NextResponse.json({
      success: true,
      data: responseFromResults(results),
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
