"use client";
import { motion } from 'framer-motion';
import { AlertTriangle, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { Button } from '@/components/aceternity/button';
import type { ValidationResult } from '@/contexts/PalletSessionContext';

interface PalletMismatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: ValidationResult | null;
  scannedBarcode: string;
  onCancel: () => void;
  onSwitchPallet: () => void;
  onScanAnyway: () => void;
  switchLoading?: boolean;
}

export function PalletMismatchModal({
  isOpen,
  onClose,
  validation,
  scannedBarcode,
  onCancel,
  onSwitchPallet,
  onScanAnyway,
  switchLoading = false,
}: PalletMismatchModalProps) {
  if (!validation) return null;

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Pallet Mismatch"
    >
      <div className="space-y-6">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-16 h-16 rounded-full bg-ql-yellow/10 flex items-center justify-center"
          >
            <AlertTriangle className="w-8 h-8 text-ql-yellow" />
          </motion.div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-zinc-300 mb-4">
            The scanned item belongs to a different pallet than your active session.
          </p>
        </div>

        {/* Comparison */}
        <div className="bg-dark-tertiary rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Scanned Barcode</span>
            <code className="font-mono text-white text-sm">{scannedBarcode}</code>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Scanned Pallet</span>
            <code className="font-mono text-accent-red font-bold">{validation.scannedPallet}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Expected Pallet</span>
            <code className="font-mono text-accent-green font-bold">{validation.expectedPallet}</code>
          </div>
        </div>

        {/* Question */}
        <p className="text-center text-zinc-400 text-sm">
          What would you like to do?
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="w-full justify-center"
          >
            <XCircle size={16} />
            Cancel Scan
          </Button>

          <Button
            variant="primary"
            onClick={onSwitchPallet}
            loading={switchLoading}
            className="w-full justify-center"
          >
            <RefreshCw size={16} />
            Switch to {validation.scannedPallet}
          </Button>

          <Button
            variant="ghost"
            onClick={onScanAnyway}
            className="w-full justify-center text-zinc-500 hover:text-ql-yellow"
          >
            <ArrowRight size={16} />
            Scan Anyway
          </Button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          "Scan Anyway" will process the item without validating pallet membership.
        </p>
      </div>
    </AnimatedModal>
  );
}
