"use client";
import { useState } from 'react';
import { motion } from 'framer-motion';
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
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-[2000]">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(212,168,0,0.06),transparent_70%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Quick<span className="text-[#d4a800]">Refurbz</span>
          </h1>
          <div className="w-8 h-px bg-[#d4a800] mx-auto mt-3" />
          <p className="text-zinc-600 text-xs mt-3 tracking-wide">{today}</p>
        </div>

        <div className="relative bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#d4a800]/30 to-transparent" />

          {/* Header */}
          <div className="px-7 pt-7 pb-0">
            <h2 className="text-lg font-medium text-white">
              Start Session
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Enter your station details to begin
            </p>
          </div>

          {/* Body */}
          <div className="p-7 pt-5">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-3 mb-4 bg-red-500/5 border border-red-500/20 rounded-lg"
              >
                <IconAlertCircle size={16} className="text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employeeId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
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
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="workstationId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
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
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="warehouseId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
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
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                </div>
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
                        size={16}
                        className="ml-2 group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-zinc-700 text-[11px] mt-6 tracking-wide uppercase">
          Refurbishment Management System
        </p>
      </motion.div>
    </div>
  );
}
