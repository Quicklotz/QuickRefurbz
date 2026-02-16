"use client";
import { useState } from 'react';
import { api } from '../api/client';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import {
  IconUser,
  IconDeviceDesktop,
  IconBuilding,
  IconAlertCircle,
  IconArrowRight,
} from '@tabler/icons-react';

interface SessionPromptProps {
  onSessionStarted: (session: any) => void;
}

export function SessionPrompt({ onSessionStarted }: SessionPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    workstationId: '',
    warehouseId: '',
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await api.startSession(formData);
      onSessionStarted(session);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-dark-primary)] flex items-center justify-center p-4 z-[2000]">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,168,0,0.05),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--color-ql-yellow)] to-[#E5C040] px-6 py-5">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black tracking-tight">
                QuickRefurbz
              </h1>
              <p className="text-black/70 text-sm mt-1 font-medium">{today}</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white">
                Start Your Work Session
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Enter your session details to continue
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 mb-4 bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded-xl">
                <IconAlertCircle size={18} className="text-[var(--color-accent-red)] flex-shrink-0" />
                <span className="text-sm text-[var(--color-accent-red)]">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employeeId" className="mb-2 block">
                  Employee ID
                </Label>
                <div className="relative">
                  <Input
                    id="employeeId"
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="Enter your employee ID"
                    className="pl-10"
                    autoFocus
                    required
                  />
                  <IconUser
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="workstationId" className="mb-2 block">
                  Workstation ID
                </Label>
                <div className="relative">
                  <Input
                    id="workstationId"
                    type="text"
                    value={formData.workstationId}
                    onChange={(e) => setFormData({ ...formData, workstationId: e.target.value })}
                    placeholder="e.g., WS-001"
                    className="pl-10"
                    required
                  />
                  <IconDeviceDesktop
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 ml-1">
                  The workstation you are working at
                </p>
              </div>

              <div>
                <Label htmlFor="warehouseId" className="mb-2 block">
                  Warehouse ID
                </Label>
                <div className="relative">
                  <Input
                    id="warehouseId"
                    type="text"
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    placeholder="e.g., WH-001"
                    className="pl-10"
                    required
                  />
                  <IconBuilding
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 ml-1">
                  The warehouse location
                </p>
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full group"
                  loading={loading}
                >
                  {loading ? (
                    'Starting Session...'
                  ) : (
                    <>
                      Start Session
                      <IconArrowRight
                        size={18}
                        className="ml-2 group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Refurbishment Management System
        </p>
      </div>
    </div>
  );
}
