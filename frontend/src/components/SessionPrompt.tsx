"use client";
import { useState, useEffect } from 'react';
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
  IconLock,
} from '@tabler/icons-react';

interface SessionPromptProps {
  onSessionStarted: (session: any) => void;
}

/**
 * Derive Workstation ID from station-config.json stationId.
 * e.g. stationId "RFB-13" → "L1-WK-13" (default to Line 1)
 */
function deriveWorkstationId(stationId: string | undefined | null): string {
  if (!stationId) return '';
  const match = stationId.match(/RFB-(\d+)/i);
  if (!match) return '';
  const stationNum = match[1]; // e.g. "13"
  return `L1-WK-${stationNum}`;
}

export function SessionPrompt({ onSessionStarted }: SessionPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    employeeId: '',
    workstationId: '',
    warehouseId: 'WH01',
  });

  // Load station config from Electron to auto-populate workstation ID
  useEffect(() => {
    const loadStationConfig = async () => {
      try {
        const electron = (window as any).electronAPI;
        if (electron?.getStationConfig) {
          const config = await electron.getStationConfig();
          if (config?.stationId) {
            const derived = deriveWorkstationId(config.stationId);
            if (derived) {
              setFormData(prev => ({ ...prev, workstationId: derived }));
            }
          }
        }
      } catch {
        // Not in Electron or config unavailable — leave empty
      }
    };
    loadStationConfig();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Validate Employee ID: exactly 4 digits
  const validateEmployeeId = (value: string): string | null => {
    if (!value) return 'Employee ID is required';
    if (!/^\d{4}$/.test(value)) return 'Must be exactly 4 digits';
    return null;
  };

  // Validate Workstation ID: L{n}-WK-{nn}
  const validateWorkstationId = (value: string): string | null => {
    if (!value) return 'Workstation ID is required';
    if (!/^L\d+-WK-\d+$/i.test(value)) return 'Format: L{line}-WK-{station} (e.g. L4-WK-13)';
    return null;
  };

  const handleEmployeeIdChange = (value: string) => {
    // Only allow digits, max 4
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setFormData(prev => ({ ...prev, employeeId: cleaned }));
    if (validationErrors.employeeId) {
      setValidationErrors(prev => ({ ...prev, employeeId: '' }));
    }
  };

  const handleWorkstationIdChange = (value: string) => {
    // Uppercase the L and WK parts automatically
    const upper = value.toUpperCase();
    setFormData(prev => ({ ...prev, workstationId: upper }));
    if (validationErrors.workstationId) {
      setValidationErrors(prev => ({ ...prev, workstationId: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Run validation
    const empErr = validateEmployeeId(formData.employeeId);
    const wkErr = validateWorkstationId(formData.workstationId);
    if (empErr || wkErr) {
      setValidationErrors({
        employeeId: empErr || '',
        workstationId: wkErr || '',
      });
      return;
    }
    setValidationErrors({});
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
              {/* Employee ID — 4-digit number */}
              <div>
                <Label htmlFor="employeeId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
                  Employee ID
                </Label>
                <div className="relative">
                  <Input
                    id="employeeId"
                    type="text"
                    inputMode="numeric"
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeIdChange(e.target.value)}
                    placeholder="1294"
                    maxLength={4}
                    className="pl-10 font-mono tracking-widest"
                    autoFocus
                    required
                  />
                  <IconUser
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                </div>
                {validationErrors.employeeId && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.employeeId}</p>
                )}
                <p className="text-[11px] text-zinc-600 mt-1">4-digit employee number</p>
              </div>

              {/* Workstation ID — L{line}-WK-{station} */}
              <div>
                <Label htmlFor="workstationId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
                  Workstation ID
                </Label>
                <div className="relative">
                  <Input
                    id="workstationId"
                    type="text"
                    value={formData.workstationId}
                    onChange={(e) => handleWorkstationIdChange(e.target.value)}
                    placeholder="L4-WK-13"
                    className="pl-10 font-mono"
                    required
                  />
                  <IconDeviceDesktop
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                </div>
                {validationErrors.workstationId && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.workstationId}</p>
                )}
                <p className="text-[11px] text-zinc-600 mt-1">Format: L{'{line}'}-WK-{'{station}'}</p>
              </div>

              {/* Warehouse ID — read-only, auto-populated */}
              <div>
                <Label htmlFor="warehouseId" className="mb-2 block text-zinc-400 text-xs uppercase tracking-wider">
                  Warehouse ID
                </Label>
                <div className="relative">
                  <Input
                    id="warehouseId"
                    type="text"
                    value={formData.warehouseId}
                    readOnly
                    className="pl-10 font-mono cursor-not-allowed opacity-70"
                  />
                  <IconBuilding
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                  <IconLock
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700"
                  />
                </div>
                <p className="text-[11px] text-zinc-600 mt-1">Default warehouse</p>
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
