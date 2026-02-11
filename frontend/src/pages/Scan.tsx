"use client";
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { SpotlightCard, Spotlight } from '@/components/aceternity/spotlight';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { Badge } from '@/components/shared/Badge';

const STAGE_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  INTAKE: 'info',
  TESTING: 'warning',
  REPAIR: 'warning',
  CLEANING: 'warning',
  FINAL_QC: 'info',
  COMPLETE: 'success',
};

export function Scan() {
  const [barcode, setBarcode] = useState('');
  const [warehouseId, setWarehouseId] = useState('WH001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const scanResult = await api.scanItem(barcode.trim(), warehouseId);
      setResult(scanResult);
      setBarcode('');
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!result?.item) return;
    setAdvancing(true);
    try {
      const updated = await api.advanceItem(result.item.qlid);
      setResult({ ...result, item: updated });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Scan Item</h1>
        <TextGenerateEffect
          words="Scan barcodes to track items through refurbishment"
          className="text-zinc-400 text-sm"
          duration={0.3}
        />
      </motion.div>

      {/* Scan Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Spotlight
          className="bg-dark-card border border-border rounded-xl p-6"
          spotlightColor="rgba(241, 196, 15, 0.15)"
        >
          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <div className="flex gap-3 mt-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    id="barcode"
                    type="text"
                    placeholder="Scan barcode (P1BBY-QLID000000001)"
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
            </div>

            <div>
              <Label htmlFor="warehouse">Warehouse</Label>
              <div className="relative mt-2">
                <select
                  id="warehouse"
                  className="w-full bg-dark-tertiary border border-border rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none transition-colors appearance-none"
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
        </Spotlight>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red rounded-lg p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
            <span className="text-accent-red">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <SpotlightCard className="p-6 border-accent-green">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-10 h-10 rounded-full bg-accent-green/20 flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 text-accent-green" />
                </motion.div>
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
                  <p className="font-mono font-semibold text-ql-yellow">{result.item.qlid}</p>
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
                <div className="flex items-center justify-center gap-2 py-2 text-accent-green">
                  <CheckCircle size={18} />
                  <span className="font-medium">Item Complete</span>
                </div>
              )}
            </SpotlightCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barcode Format Help */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-ql-yellow/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-ql-yellow" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Barcode Format</h3>
              <p className="text-sm text-zinc-400 mb-2">
                Scan barcodes from QuickIntakez labels:
              </p>
              <code className="block bg-dark-primary px-3 py-2 rounded font-mono text-sm text-ql-yellow">
                P1BBY-QLID000000001
              </code>
              <p className="text-xs text-zinc-500 mt-2">
                Format: [PalletID]-[QLID]
              </p>
            </div>
          </div>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
