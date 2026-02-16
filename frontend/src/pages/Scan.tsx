"use client";
import { useState, useRef, useEffect } from 'react';
import {
  ScanLine,
  CheckCircle,
  AlertCircle,
  Package,
  ChevronRight,
  QrCode,
  Warehouse
} from 'lucide-react';
import { api } from '@/api/client';
import { usePalletSession } from '@/contexts/PalletSessionContext';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { Badge } from '@/components/shared/Badge';
import { PalletSessionCard } from '@/components/pallet-session/PalletSessionCard';
import { PalletMismatchModal } from '@/components/pallet-session/PalletMismatchModal';
import { PalletLabelModal } from '@/components/pallet-session/PalletLabelModal';
import { RefurbLabelModal } from '@/components/workflow/RefurbLabelModal';
import type { ValidationResult } from '@/contexts/PalletSessionContext';

const STAGE_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  INTAKE: 'info',
  TESTING: 'warning',
  REPAIR: 'warning',
  CLEANING: 'warning',
  FINAL_QC: 'info',
  COMPLETE: 'success',
};

export function Scan() {
  const { session, isActive, validateBarcode, startSession } = usePalletSession();

  const [barcode, setBarcode] = useState('');
  const [warehouseId, setWarehouseId] = useState('WH001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mismatch modal state
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState<ValidationResult | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [switchingPallet, setSwitchingPallet] = useState(false);

  // Print label modal state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Refurb label modal state (shows when item reaches COMPLETE)
  const [showRefurbLabelModal, setShowRefurbLabelModal] = useState(false);
  const [completedItem, setCompletedItem] = useState<any>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performScan = async (barcodeValue: string) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const scanResult = await api.scanItem(barcodeValue, warehouseId);
      setResult(scanResult);
      setBarcode('');
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const barcodeValue = barcode.trim();

    // Validate against active pallet session
    if (isActive) {
      const validation = validateBarcode(barcodeValue);

      if (!validation.valid) {
        setError(validation.error || 'Invalid barcode format');
        return;
      }

      if (!validation.palletMatch) {
        // Show mismatch modal
        setMismatchData(validation);
        setPendingBarcode(barcodeValue);
        setShowMismatchModal(true);
        return;
      }
    }

    // Proceed with scan
    await performScan(barcodeValue);
  };

  const handleMismatchCancel = () => {
    setShowMismatchModal(false);
    setMismatchData(null);
    setPendingBarcode('');
    setBarcode('');
    inputRef.current?.focus();
  };

  const handleMismatchSwitch = async () => {
    if (!mismatchData) return;

    setSwitchingPallet(true);
    try {
      await startSession(mismatchData.scannedPallet);
      setShowMismatchModal(false);
      await performScan(pendingBarcode);
    } catch (err: any) {
      setError(err.message || 'Failed to switch pallet');
    } finally {
      setSwitchingPallet(false);
      setMismatchData(null);
      setPendingBarcode('');
    }
  };

  const handleMismatchScanAnyway = async () => {
    setShowMismatchModal(false);
    await performScan(pendingBarcode);
    setMismatchData(null);
    setPendingBarcode('');
  };

  const handleAdvance = async () => {
    if (!result?.item) return;
    setAdvancing(true);
    try {
      const updated = await api.advanceItem(result.item.qlid);
      setResult({ ...result, item: updated });

      // If item reached COMPLETE, show refurb label modal
      if (updated.currentStage === 'COMPLETE') {
        setCompletedItem(updated);
        setShowRefurbLabelModal(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Scan Item</h1>
        <p className="text-zinc-500 text-sm mt-1">Scan barcodes to track items through refurbishment</p>
      </div>

      {/* Pallet Session Card */}
      <PalletSessionCard onPrintLabel={() => setShowPrintModal(true)} />

      {/* Scan Form */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6">
        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <div className="flex gap-3 mt-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  id="barcode"
                  type="text"
                  placeholder="Scan barcode (RFB-P1BBY-QLID000000001)"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="pl-10 font-mono"
                />
                <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </div>
              <Button type="submit" variant="primary" loading={loading} disabled={!barcode.trim()}>
                <ScanLine size={18} />
                Scan
              </Button>
            </div>
            {isActive && (
              <p className="text-xs text-[var(--color-accent-green)] mt-2 flex items-center gap-1">
                <CheckCircle size={12} />
                Validating against pallet {session?.palletId}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="warehouse">Warehouse</Label>
            <div className="relative mt-2">
              <select
                id="warehouse"
                className="w-full bg-[var(--color-dark-tertiary)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-[var(--color-ql-yellow)] focus:outline-none transition-colors appearance-none"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="WH001">WH001 - Main Warehouse</option>
                <option value="WH002">WH002 - Secondary</option>
              </select>
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--color-accent-red)] flex-shrink-0" />
          <span className="text-[var(--color-accent-red)]">{error}</span>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="rounded-2xl border border-[var(--color-accent-green)]/30 bg-[var(--color-dark-card)] p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-green)]/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--color-accent-green)]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {result.isNew ? 'Item Added to Refurbishment' : 'Item Found'}
              </h3>
              <p className="text-sm text-zinc-400">
                {result.isNew ? 'New item has been added to the system' : 'Existing item located'}
              </p>
            </div>
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">QLID</span>
              <p className="font-mono font-semibold text-[var(--color-ql-yellow)]">{result.item.qlid}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Pallet</span>
              <p className="font-mono text-white">{result.item.palletId}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Product</span>
              <p className="text-white">{result.item.manufacturer} {result.item.model}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Stage</span>
              <Badge
                variant={STAGE_VARIANTS[result.item.currentStage] || 'info'}
                className="mt-1"
              >
                {result.item.currentStage.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          {result.item.currentStage !== 'COMPLETE' && (
            <Button
              variant="primary"
              onClick={handleAdvance}
              loading={advancing}
              className="w-full"
            >
              Advance to Next Stage
              <ChevronRight size={16} />
            </Button>
          )}

          {result.item.currentStage === 'COMPLETE' && (
            <div className="flex items-center justify-center gap-2 py-2 text-[var(--color-accent-green)]">
              <CheckCircle size={18} />
              <span className="font-medium">Item Complete</span>
            </div>
          )}
        </div>
      )}

      {/* Barcode Format Help */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-ql-yellow)]/10 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-[var(--color-ql-yellow)]" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Barcode Formats (QuickIntakez-compatible)</h3>
            <p className="text-sm text-zinc-400 mb-2">
              Supported barcode formats:
            </p>
            <div className="space-y-2">
              <div>
                <code className="block bg-[var(--color-dark-primary)] px-3 py-2 rounded font-mono text-sm text-[var(--color-accent-green)]">
                  RFB-P1BBY-QLID000000001
                </code>
                <p className="text-xs text-zinc-500 mt-1">
                  QuickRefurbz origin: RFB-[PalletID]-[QLID]
                </p>
              </div>
              <div>
                <code className="block bg-[var(--color-dark-primary)] px-3 py-2 rounded font-mono text-sm text-zinc-400">
                  P1BBY-QLID000000001
                </code>
                <p className="text-xs text-zinc-500 mt-1">
                  QuickIntakez origin: [PalletID]-[QLID]
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-3">
              The <span className="text-[var(--color-accent-green)]">RFB-</span> prefix identifies items that originated in QuickRefurbz for easy WMS reintegration.
            </p>
          </div>
        </div>
      </div>

      {/* Pallet Mismatch Modal */}
      <PalletMismatchModal
        isOpen={showMismatchModal}
        onClose={() => setShowMismatchModal(false)}
        validation={mismatchData}
        scannedBarcode={pendingBarcode}
        onCancel={handleMismatchCancel}
        onSwitchPallet={handleMismatchSwitch}
        onScanAnyway={handleMismatchScanAnyway}
        switchLoading={switchingPallet}
      />

      {/* Print Label Modal */}
      <PalletLabelModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        session={session}
      />

      {/* Refurb Label Modal (shows on completion) */}
      <RefurbLabelModal
        isOpen={showRefurbLabelModal}
        onClose={() => {
          setShowRefurbLabelModal(false);
          setCompletedItem(null);
        }}
        qlid={completedItem?.qlid || null}
        manufacturer={completedItem?.manufacturer}
        model={completedItem?.model}
        finalGrade={completedItem?.finalGrade}
        warrantyEligible={completedItem?.warrantyEligible}
      />
    </div>
  );
}
