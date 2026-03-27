'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    Briefcase,
    CalendarOff,
    Clock,
    Edit2,
    MapPin,
    Search,
    Timer,
    Trash2,
    Upload,
    UserPlus,
    Users,
} from 'lucide-react';
import BulkImportModal from '@/components/BulkImportModal';
import { createClient } from '@/lib/supabase/client';
import { BRANCHES } from '@/lib/branches';
import { formatTime } from '@/lib/utils';
import type { Profile } from '@/types';
import {
    Button,
    Card,
    CardContent,
    Input,
    Modal,
    PageReveal,
    Select,
    Skeleton,
    StaggerGroup,
    StaggerItem,
    addToast,
} from '@/components/ui';

export default function EmployeesPage() {
    const supabase = useMemo(() => createClient(), []);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        branch: '',
        job_title: '',
        shift_start: '',
        shift_duration: '8',
        off_day: '',
        overtime_enabled: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const calculateShiftEnd = (startTime: string, durationHours: string): string => {
        if (!startTime) return '';
        const [hours, minutes] = startTime.split(':').map(Number);
        const duration = parseFloat(durationHours);
        const totalMinutes = hours * 60 + minutes + duration * 60;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = Math.floor(totalMinutes % 60);
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    const calculateDurationFromTimes = (startTime: string | null, endTime: string | null): string => {
        if (!startTime || !endTime) return '8';
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (durationMinutes < 0) durationMinutes += 24 * 60;
        const durationHours = durationMinutes / 60;
        const validDurations = [0.5, 1, 2, 4, 8, 10, 12];
        if (validDurations.includes(durationHours)) return String(durationHours);
        return '8';
    };

    const fetchEmployees = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'employee')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            addToast('Failed to load employees', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            full_name: '',
            branch: '',
            job_title: '',
            shift_start: '',
            shift_duration: '8',
            off_day: '',
            overtime_enabled: true,
        });
        setEditingEmployee(null);
    };

    const openAddModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (employee: Profile) => {
        setEditingEmployee(employee);
        setFormData({
            email: employee.email,
            password: '',
            full_name: employee.full_name,
            branch: employee.branch || '',
            job_title: employee.job_title || '',
            shift_start: employee.shift_start || '',
            shift_duration: calculateDurationFromTimes(employee.shift_start, employee.shift_end),
            off_day: employee.off_day || '',
            overtime_enabled: employee.overtime_enabled ?? true,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            if (editingEmployee) {
                const calculatedShiftEnd = calculateShiftEnd(formData.shift_start, formData.shift_duration);
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: formData.full_name,
                        branch: formData.branch,
                        job_title: formData.job_title,
                        shift_start: formData.shift_start || null,
                        shift_end: calculatedShiftEnd || null,
                        off_day: formData.off_day || null,
                        overtime_enabled: formData.overtime_enabled,
                    })
                    .eq('id', editingEmployee.id);

                if (error) throw error;
                addToast('Employee updated successfully', 'success');
            } else {
                const calculatedShiftEnd = calculateShiftEnd(formData.shift_start, formData.shift_duration);
                const submitData = {
                    ...formData,
                    shift_end: calculatedShiftEnd,
                };
                const response = await fetch('/api/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                });

                const result = await response.json();
                if (!result.success) throw new Error(result.error);
                addToast('Employee created successfully', 'success');
            }

            setIsModalOpen(false);
            resetForm();
            fetchEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            addToast(
                error instanceof Error ? error.message : 'Failed to save employee',
                'error'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;

        try {
            const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to delete employee');
            addToast('Employee deleted successfully', 'success');
            fetchEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            addToast('Failed to delete employee', 'error');
        }
    };

    const filteredEmployees = useMemo(() => {
        const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
        if (!normalizedQuery) return employees;

        return employees.filter(
            (employee) =>
                employee.full_name.toLowerCase().includes(normalizedQuery) ||
                employee.email.toLowerCase().includes(normalizedQuery) ||
                employee.branch?.toLowerCase().includes(normalizedQuery)
        );
    }, [employees, deferredSearchQuery]);

    const stats = useMemo(() => {
        const branchCount = new Set(employees.map((employee) => employee.branch).filter(Boolean)).size;
        const overtimeEnabledCount = employees.filter((employee) => employee.overtime_enabled).length;

        return [
            { label: 'Employees', value: employees.length },
            { label: 'Branches', value: branchCount },
            { label: 'Overtime enabled', value: overtimeEnabledCount },
        ];
    }, [employees]);

    return (
        <div className="space-y-6">
            <PageReveal className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="editorial-frame rounded-[2.5rem] border-[rgba(66,42,50,0.08)]">
                    <CardContent className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="section-kicker">Workforce</p>
                            <h1 className="display-serif text-4xl text-[#1d181c] sm:text-5xl">
                                Employee roster, styled for clarity
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-[#6f6367]">
                                Keep branch assignments, shift planning, and overtime settings in a
                                single calm workspace instead of a noisy admin table.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            {stats.map((stat) => (
                                <div
                                    key={stat.label}
                                    className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4"
                                >
                                    <p className="section-kicker">{stat.label}</p>
                                    <p className="mt-3 text-3xl font-semibold text-[#1e191d]">
                                        {isLoading ? '...' : stat.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.3rem]">
                    <CardContent className="space-y-4 p-6">
                        <p className="section-kicker">Actions</p>
                        <div className="grid gap-3">
                            <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="justify-between">
                                <span>Bulk Import</span>
                                <Upload className="h-4 w-4" />
                            </Button>
                            <Button onClick={openAddModal} className="justify-between">
                                <span>Add Employee</span>
                                <UserPlus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4 text-sm leading-6 text-[#72656a]">
                            Search by name, email, or branch to move quickly through large rosters.
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>

            <PageReveal delay={0.08}>
                <Card className="rounded-[2.2rem]">
                    <CardContent className="p-4 sm:p-5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a7a86]" />
                            <Input
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="pl-11"
                            />
                        </div>
                    </CardContent>
                </Card>
            </PageReveal>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Card key={index} className="rounded-[2.1rem]">
                            <CardContent className="space-y-4 p-6">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-14 w-14 rounded-[1.2rem]" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-44" />
                                    </div>
                                </div>
                                {Array.from({ length: 4 }).map((__, metricIndex) => (
                                    <Skeleton key={metricIndex} className="h-12 rounded-[1.2rem]" />
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Card className="rounded-[2.2rem]">
                    <CardContent className="p-12 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,255,255,0.72)] text-[#9d174d]">
                            <Users className="h-6 w-6" />
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-[#1f1a1e]">
                            {searchQuery ? 'No employees match your search' : 'No employees found'}
                        </h2>
                    </CardContent>
                </Card>
            ) : (
                <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEmployees.map((employee) => (
                        <StaggerItem key={employee.id}>
                            <Card interactive className="group rounded-[2.1rem]">
                                <CardContent className="space-y-5 p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[#171419] text-lg font-semibold text-white">
                                                {employee.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="truncate text-lg font-semibold text-[#1f1a1e]">
                                                    {employee.full_name}
                                                </h3>
                                                <p className="truncate text-sm text-[#73666a]">
                                                    {employee.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditModal(employee)}
                                                className="focus-ring rounded-full p-2 text-[#7e6e74] hover:bg-[rgba(255,255,255,0.72)] hover:text-[#241d22]"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(employee.id)}
                                                className="focus-ring rounded-full p-2 text-[#7e6e74] hover:bg-rose-50 hover:text-rose-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        {employee.job_title && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-3 text-sm text-[#4f4549]">
                                                <Briefcase className="h-4 w-4 text-[#9d174d]" />
                                                <span>{employee.job_title}</span>
                                            </div>
                                        )}
                                        {employee.branch && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-3 text-sm text-[#4f4549]">
                                                <MapPin className="h-4 w-4 text-[#9d174d]" />
                                                <span>{employee.branch}</span>
                                            </div>
                                        )}
                                        {(employee.shift_start || employee.shift_end) && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-3 text-sm text-[#4f4549]">
                                                <Clock className="h-4 w-4 text-[#9d174d]" />
                                                <span>
                                                    {formatTime(employee.shift_start)} - {formatTime(employee.shift_end)}
                                                </span>
                                            </div>
                                        )}
                                        {employee.off_day && (
                                            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-3 text-sm text-[#4f4549]">
                                                <CalendarOff className="h-4 w-4 text-amber-700" />
                                                <span className="capitalize">Off day: {employee.off_day}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between rounded-[1.5rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] px-4 py-3">
                                        <div className="flex items-center gap-3 text-sm text-[#4f4549]">
                                            <Timer className="h-4 w-4 text-[#9d174d]" />
                                            <span>Overtime tracking</span>
                                        </div>
                                        <span className={`text-sm font-semibold ${employee.overtime_enabled ? 'text-emerald-700' : 'text-[#8e7d83]'}`}>
                                            {employee.overtime_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </StaggerItem>
                    ))}
                </StaggerGroup>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input
                            id="full_name"
                            label="Full Name"
                            placeholder="John Doe"
                            value={formData.full_name}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, full_name: event.target.value }))
                            }
                            required
                        />
                        <Input
                            id="email"
                            label="Email"
                            type="email"
                            placeholder="john@company.com"
                            value={formData.email}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, email: event.target.value }))
                            }
                            disabled={!!editingEmployee}
                            required
                        />
                        {!editingEmployee && (
                            <Input
                                id="password"
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                                }
                                required
                            />
                        )}
                        <Select
                            id="branch"
                            label="Branch"
                            value={formData.branch}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, branch: event.target.value }))
                            }
                            options={[
                                { value: '', label: 'Select Branch' },
                                ...BRANCHES.map((branch) => ({ value: branch, label: branch })),
                            ]}
                        />
                        <Input
                            id="job_title"
                            label="Job Title"
                            placeholder="Driver"
                            value={formData.job_title}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, job_title: event.target.value }))
                            }
                        />
                        <div className="space-y-2">
                            <Input
                                id="shift_start"
                                label="Shift Start Time"
                                type="time"
                                value={formData.shift_start}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, shift_start: event.target.value }))
                                }
                            />
                            {formData.shift_start && (
                                <div className="flex items-center gap-2 text-sm text-[#6f6468]">
                                    <Clock className="h-4 w-4 shrink-0 text-[#9d174d]" />
                                    <span>
                                        Shift ends at{' '}
                                        <span className="font-semibold text-[#241d22]">
                                            {calculateShiftEnd(formData.shift_start, formData.shift_duration) || '--:--'}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                        <Select
                            id="shift_duration"
                            label="Shift Duration"
                            value={formData.shift_duration}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, shift_duration: event.target.value }))
                            }
                            options={[
                                { value: '0.5', label: '30 Minutes (Testing)' },
                                { value: '1', label: '1 Hour (Testing)' },
                                { value: '2', label: '2 Hours (Testing)' },
                                { value: '4', label: '4 Hours' },
                                { value: '8', label: '8 Hours' },
                                { value: '10', label: '10 Hours' },
                                { value: '12', label: '12 Hours' },
                            ]}
                        />
                        <Select
                            id="off_day"
                            label="Off Day"
                            value={formData.off_day}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, off_day: event.target.value }))
                            }
                            options={[
                                { value: '', label: 'No off day' },
                                { value: 'sunday', label: 'Sunday' },
                                { value: 'monday', label: 'Monday' },
                                { value: 'tuesday', label: 'Tuesday' },
                                { value: 'wednesday', label: 'Wednesday' },
                                { value: 'thursday', label: 'Thursday' },
                                { value: 'friday', label: 'Friday' },
                                { value: 'saturday', label: 'Saturday' },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-3 rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.56)] p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Timer className="mt-1 h-5 w-5 text-[#9d174d]" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-[#241d22]">Overtime Tracking</p>
                                <p className="text-xs leading-6 text-[#72656a]">
                                    Allow overtime calculation for this employee, up to the existing system maximum.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, overtime_enabled: !prev.overtime_enabled }))}
                            className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.overtime_enabled ? 'bg-[#9d174d]' : 'bg-[#cbbac0]'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${formData.overtime_enabled ? 'switch-thumb-on' : 'switch-thumb-off'}`}
                            />
                        </button>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-[rgba(66,42,50,0.08)] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
                            {editingEmployee ? 'Update Employee' : 'Create Employee'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={fetchEmployees}
            />
        </div>
    );
}
