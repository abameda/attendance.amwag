import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
}

// Export to CSV
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map((row) =>
            headers
                .map((header) => {
                    const value = row[header];
                    const stringValue = value === null || value === undefined ? '' : String(value);
                    // Escape quotes and wrap in quotes if contains comma
                    if (stringValue.includes(',') || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                })
                .join(',')
        ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
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
