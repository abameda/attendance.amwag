'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Input,
    Select,
    Card,
    CardContent,
    Modal,
    Skeleton,
    addToast,
} from '@/components/ui';
import { BRANCHES } from '@/lib/branches';
import { formatTime } from '@/lib/utils';
import type { Profile } from '@/types';
import {
    UserPlus,
    Edit2,
    Trash2,
    Search,
    Clock,
    MapPin,
    Briefcase,
    CalendarOff,
    Upload,
    Timer,
} from 'lucide-react';
import BulkImportModal from '@/components/BulkImportModal';

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
        shift_duration: '8', // 8, 10, or 12 hours
        off_day: '',
        overtime_enabled: true,
    });

    // Calculate shift_end from shift_start and shift_duration
    const calculateShiftEnd = (startTime: string, durationHours: string): string => {
        if (!startTime) return '';
        const [hours, minutes] = startTime.split(':').map(Number);
        const duration = parseInt(durationHours, 10);
        const endHours = (hours + duration) % 24;
        return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const deferredSearchQuery = useDeferredValue(searchQuery);

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

    // Calculate duration from start and end times for editing
    const calculateDurationFromTimes = (startTime: string | null, endTime: string | null): string => {
        if (!startTime || !endTime) return '8';
        const [startHours] = startTime.split(':').map(Number);
        const [endHours] = endTime.split(':').map(Number);
        let duration = endHours - startHours;
        if (duration < 0) duration += 24; // Handle overnight shifts
        if (duration === 10) return '10';
        if (duration === 12) return '12';
        return '8';
    };

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (editingEmployee) {
                // Update existing employee
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
                // Create new employee
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
        if (!normalizedQuery) {
            return employees;
        }

        return employees.filter(
            (employee) =>
                employee.full_name.toLowerCase().includes(normalizedQuery) ||
                employee.email.toLowerCase().includes(normalizedQuery) ||
                employee.branch?.toLowerCase().includes(normalizedQuery)
        );
    }, [employees, deferredSearchQuery]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-50">
                        Employees
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Manage your workforce
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                        <Upload className="w-5 h-5 mr-2" />
                        Bulk Import
                    </Button>
                    <Button onClick={openAddModal}>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Add Employee
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {isLoading ? (
                <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="premium-card">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="space-y-1.5">
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-3 w-36" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    <Skeleton className="h-3.5 w-24" />
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-3.5 w-28" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Card className="premium-card">
                    <CardContent className="p-12 text-center relative z-10">
                        <p className="text-slate-400">
                            {searchQuery ? 'No employees match your search' : 'No employees found'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEmployees.map((employee) => (
                        <Card key={employee.id} interactive className="group premium-card">
                            <CardContent className="p-6 relative z-10">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                                            {employee.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-100">
                                                {employee.full_name}
                                            </h3>
                                            <p className="text-sm text-slate-400">
                                                {employee.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(employee)}
                                            className="p-2 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 active:scale-[0.95]"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(employee.id)}
                                            className="p-2 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.95]"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {employee.job_title && (
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <Briefcase className="w-4 h-4 text-slate-500" />
                                            {employee.job_title}
                                        </div>
                                    )}
                                    {employee.branch && (
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <MapPin className="w-4 h-4 text-slate-500" />
                                            {employee.branch}
                                        </div>
                                    )}
                                    {(employee.shift_start || employee.shift_end) && (
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <Clock className="w-4 h-4 text-slate-500" />
                                            {formatTime(employee.shift_start)} - {formatTime(employee.shift_end)}
                                        </div>
                                    )}
                                    {employee.off_day && (
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <CalendarOff className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                                            Off: <span className="capitalize">{employee.off_day}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm pt-2 border-t border-white/5">
                                        <Timer className={`w-4 h-4 ${employee.overtime_enabled ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'text-slate-500'}`} />
                                        <span className={employee.overtime_enabled ? 'text-cyan-400 font-medium' : 'text-slate-500'}>
                                            Overtime: {employee.overtime_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            id="full_name"
                            label="Full Name"
                            placeholder="John Doe"
                            value={formData.full_name}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                            }
                            required
                        />
                        <Input
                            id="email"
                            label="Email"
                            type="email"
                            placeholder="john@company.com"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, email: e.target.value }))
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
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                                }
                                required
                            />
                        )}
                        <Select
                            id="branch"
                            label="Branch"
                            value={formData.branch}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, branch: e.target.value }))
                            }
                            options={[
                                { value: '', label: 'Select Branch' },
                                ...BRANCHES.map((b) => ({ value: b, label: b })),
                            ]}
                        />
                        <Input
                            id="job_title"
                            label="Job Title"
                            placeholder="Driver"
                            value={formData.job_title}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, job_title: e.target.value }))
                            }
                        />
                        <div className="space-y-2">
                            <Input
                                id="shift_start"
                                label="Shift Start Time"
                                type="time"
                                value={formData.shift_start}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, shift_start: e.target.value }))
                                }
                            />
                            {formData.shift_start && (
                                <div className="flex items-center gap-2 text-sm text-slate-400 min-h-5">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    <span>
                                        Shift ends at:{' '}
                                        <span className="text-teal-400 font-medium">
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
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, shift_duration: e.target.value }))
                            }
                            options={[
                                { value: '8', label: '8 Hours' },
                                { value: '10', label: '10 Hours' },
                                { value: '12', label: '12 Hours' },
                            ]}
                        />
                        <Select
                            id="off_day"
                            label="Off Day"
                            value={formData.off_day}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, off_day: e.target.value }))
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

                    <div className="flex flex-wrap items-start justify-between gap-3 overflow-hidden p-4 glass rounded-xl border border-white/5">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Timer className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200">Overtime Tracking</p>
                                <p className="text-xs text-slate-400">Allow overtime calculation for this employee (max 3 hours)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, overtime_enabled: !prev.overtime_enabled }))}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${formData.overtime_enabled ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${formData.overtime_enabled ? 'switch-thumb-on' : 'switch-thumb-off'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
                        <Button type="submit" isLoading={isSubmitting}>
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
