import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DashboardSummary, DashboardSummaryTopBranch } from '@/types';

// Utility to merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Format time from HH:MM:SS to 12-hour format
export function formatTime(time: string | null): string {
    if (!time) return '-';

    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format timestamp to time only
export function formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return '-';

    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

// Format date for display
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// Calculate lateness in minutes
export function calculateLateness(
    checkInTime: string,
    shiftStart: string | null
): number {
    if (!shiftStart) return 0;

    const checkIn = new Date(checkInTime);
    const [shiftHours, shiftMinutes] = shiftStart.split(':').map(Number);

    const shiftStartDate = new Date(checkIn);
    shiftStartDate.setHours(shiftHours, shiftMinutes, 0, 0);

    const diffMs = checkIn.getTime() - shiftStartDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    return diffMinutes > 0 ? diffMinutes : 0;
}

// Format lateness duration
export function formatLateness(minutes: number): string {
    if (minutes <= 0) return '-';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

// Format early departure duration
export function formatEarlyDeparture(minutes: number): string {
    if (minutes <= 0) return '-';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m early`;
    }
    return `${mins}m early`;
}

// Get status badge color
export function getStatusColor(status: string): string {
    switch (status) {
        case 'present':
            return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
        case 'late':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
        case 'absent':
            return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        case 'missing_checkout':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
}

// Get current date in YYYY-MM-DD format
export function getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
}

// Check if user has already checked in today
export function hasCheckedInToday(
    attendance: { date: string; check_in_time: string | null }[],
    today: string
): boolean {
    return attendance.some(
        (record) => record.date === today && record.check_in_time !== null
    );
}

// Check if user has already checked out today
export function hasCheckedOutToday(
    attendance: { date: string; check_out_time: string | null }[],
    today: string
): boolean {
    return attendance.some(
        (record) => record.date === today && record.check_out_time !== null
    );
}

// Calculate overtime in minutes (max 180 minutes = 3 hours)
export function calculateOvertime(
    checkOutTime: string,
    shiftEnd: string | null,
    shiftStart: string | null,
    maxMinutes: number = 180
): number {
    if (!shiftEnd) return 0;

    const checkOut = new Date(checkOutTime);
    const [endH, endM] = shiftEnd.split(':').map(Number);

    const shiftEndDate = new Date(checkOut);
    shiftEndDate.setHours(endH, endM, 0, 0);

    // Handle overnight shifts
    if (shiftStart) {
        const [startH, startM] = shiftStart.split(':').map(Number);
        const isOvernightShift = endH < startH || (endH === startH && endM < startM);

        if (isOvernightShift) {
            const shiftStartToday = new Date(checkOut);
            shiftStartToday.setHours(startH, startM, 0, 0);

            if (checkOut >= shiftStartToday) {
                // We're in the first part of the overnight shift, end is tomorrow
                shiftEndDate.setDate(shiftEndDate.getDate() + 1);
            }
        }
    }

    const diffMs = checkOut.getTime() - shiftEndDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes <= 0) return 0;

    return Math.min(diffMinutes, maxMinutes);
}

// Format overtime duration
export function formatOvertime(minutes: number): string {
    if (minutes <= 0) return '-';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

export interface AttendanceSummaryBranchMetrics {
    branch: string;
    expectedEmployees: number;
    presentCount: number;
    lateCount: number;
    missingCheckoutCount?: number;
}

export interface AttendanceSummaryMetrics {
    date: string;
    expectedEmployees: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    missingCheckoutCount: number;
    branchMetrics: AttendanceSummaryBranchMetrics[];
}

function toPercent(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(2));
}

export function buildDashboardSummary(metrics: AttendanceSummaryMetrics): DashboardSummary {
    const topBranch: DashboardSummaryTopBranch | null = metrics.branchMetrics
        .filter((branch) => branch.expectedEmployees > 0)
        .map((branch) => ({
            name: branch.branch,
            attendanceRate: toPercent(
                branch.presentCount + branch.lateCount + (branch.missingCheckoutCount ?? 0),
                branch.expectedEmployees
            ),
        }))
        .sort((left, right) => right.attendanceRate - left.attendanceRate)[0] ?? null;

    const checkedInCount = metrics.presentCount + metrics.lateCount + metrics.missingCheckoutCount;
    const departureCompletedCount = metrics.presentCount + metrics.lateCount;

    return {
        date: metrics.date,
        periodType: metrics.date.length === 7 ? 'month' : 'day',
        expectedEmployees: metrics.expectedEmployees,
        presentCount: metrics.presentCount,
        lateCount: metrics.lateCount,
        absentCount: metrics.absentCount,
        missingCheckoutCount: metrics.missingCheckoutCount,
        attendanceRate: toPercent(checkedInCount, metrics.expectedEmployees),
        departureCompletionRate: toPercent(departureCompletedCount, checkedInCount),
        topBranch,
    };
}

export function getDashboardSummaryCacheKey(date: string): string {
    return `attendance-summary:${date}`;
}
