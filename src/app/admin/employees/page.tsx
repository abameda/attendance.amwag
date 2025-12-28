'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Input,
    Select,
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    Modal,
    addToast,
} from '@/components/ui';
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
        shift_end: '',
        off_day: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

    const fetchEmployees = async () => {
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
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            full_name: '',
            branch: '',
            job_title: '',
            shift_start: '',
            shift_end: '',
            off_day: '',
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
            shift_end: employee.shift_end || '',
            off_day: employee.off_day || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (editingEmployee) {
                // Update existing employee
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: formData.full_name,
                        branch: formData.branch,
                        job_title: formData.job_title,
                        shift_start: formData.shift_start || null,
                        shift_end: formData.shift_end || null,
                        off_day: formData.off_day || null,
                    })
                    .eq('id', editingEmployee.id);

                if (error) throw error;
                addToast('Employee updated successfully', 'success');
            } else {
                // Create new employee
                const response = await fetch('/api/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
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
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
            addToast('Employee deleted successfully', 'success');
            fetchEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            addToast('Failed to delete employee', 'error');
        }
    };

    const filteredEmployees = employees.filter(
        (emp) =>
            emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.branch?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
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

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Employees Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-16 bg-slate-800 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <p className="text-slate-400">
                            {searchQuery ? 'No employees match your search' : 'No employees found'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEmployees.map((employee) => (
                        <Card key={employee.id} className="group hover:ring-1 hover:ring-teal-500/30 transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-teal-500/20">
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
                                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-teal-400"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(employee.id)}
                                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400"
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
                                            <CalendarOff className="w-4 h-4 text-orange-400" />
                                            Off: <span className="capitalize">{employee.off_day}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
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
                                { value: 'ملوي', label: 'ملوي' },
                                { value: 'الأضافيه', label: 'الأضافيه' },
                                { value: 'شلبي', label: 'شلبي' },
                                { value: 'بني مزار', label: 'بني مزار' },
                                { value: 'الجيزه', label: 'الجيزه' },
                                { value: 'رمسيس', label: 'رمسيس' },
                                { value: 'محرم بك', label: 'محرم بك' },
                                { value: 'شرم الشيخ', label: 'شرم الشيخ' },
                                { value: 'الغردقه', label: 'الغردقه' },
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
                        <Input
                            id="shift_start"
                            label="Shift Start Time"
                            type="time"
                            value={formData.shift_start}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, shift_start: e.target.value }))
                            }
                        />
                        <Input
                            id="shift_end"
                            label="Shift End Time"
                            type="time"
                            value={formData.shift_end}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, shift_end: e.target.value }))
                            }
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

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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

            {/* Bulk Import Modal */}
            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={fetchEmployees}
            />
        </div>
    );
}
