"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Package,
  CheckCircle,
  AlertCircle,
  Barcode,
  Tag,
  Box,
  Printer,
  RefreshCw
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard, Spotlight } from '@/components/aceternity/spotlight';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { useToast } from '@/components/aceternity/toast';
import { Badge } from '@/components/shared/Badge';

const CATEGORIES = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'TV', label: 'TV' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'GAMING', label: 'Gaming' },
  { value: 'WEARABLE', label: 'Wearable' },
  { value: 'APPLIANCE', label: 'Appliance' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

interface IntakeResult {
  item: {
    qlid: string;
    palletId: string;
    barcodeValue: string;
    manufacturer?: string;
    model?: string;
    category: string;
  };
  labelData: {
    palletId: string;
    rfbId: string;
    barcodeValue: string;
    manufacturer?: string;
    model?: string;
    category: string;
  };
}

export function Intake() {
  const toast = useToast();
  const upcInputRef = useRef<HTMLInputElement>(null);

  // Pallet state
  const [pallets, setPallets] = useState<any[]>([]);
  const [loadingPallets, setLoadingPallets] = useState(true);
  const [selectedPalletId, setSelectedPalletId] = useState('');
  const [creatingPallet, setCreatingPallet] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    upc: '',
    asin: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    category: 'OTHER',
    priority: 'NORMAL',
    condition: '',
    notes: '',
    warehouseId: 'WH001'
  });

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<IntakeResult | null>(null);
  const [error, setError] = useState('');

  // Load pallets on mount
  useEffect(() => {
    loadPallets();
  }, []);

  const loadPallets = async () => {
    setLoadingPallets(true);
    try {
      const data = await api.getPallets({ status: 'RECEIVING,IN_PROGRESS' });
      setPallets(data.filter(p => p.palletId.startsWith('RFB-P-')));
    } catch (err) {
      console.error('Failed to load pallets:', err);
    } finally {
      setLoadingPallets(false);
    }
  };

  const handleCreatePallet = async () => {
    setCreatingPallet(true);
    try {
      // Generate a new RFB pallet ID
      const { palletId } = await api.generateRfbPalletId();

      // Create the pallet
      await api.createPallet({
        retailer: 'OTHER',
        liquidationSource: 'OTHER',
        sourcePalletId: '',
        notes: 'RFB standalone pallet'
      });

      // Reload pallets and select the new one
      await loadPallets();
      setSelectedPalletId(palletId);
      toast.success('Pallet Created', `New pallet ${palletId} is ready`);
    } catch (err: any) {
      toast.error('Failed to create pallet', err.message);
    } finally {
      setCreatingPallet(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLastResult(null);

    if (!selectedPalletId) {
      setError('Please select or create a pallet first');
      return;
    }

    // Validate at least one identifier
    if (!formData.upc && !formData.asin && !formData.manufacturer && !formData.model && !formData.serialNumber) {
      setError('Please enter at least one product identifier (UPC, ASIN, Brand, Model, or Serial Number)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createItem({
        palletId: selectedPalletId,
        upc: formData.upc || undefined,
        asin: formData.asin || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        category: formData.category,
        priority: formData.priority,
        condition: formData.condition || undefined,
        notes: formData.notes || undefined,
        warehouseId: formData.warehouseId
      });

      setLastResult(result);
      toast.success('Item Added', `${result.item.qlid} added to ${selectedPalletId}`);

      // Reset form but keep pallet and warehouse selected
      setFormData(prev => ({
        ...prev,
        upc: '',
        asin: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        condition: '',
        notes: ''
      }));

      // Focus UPC input for next scan
      upcInputRef.current?.focus();

    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto-submit on Enter if we have a UPC
    if (e.key === 'Enter' && formData.upc.trim()) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Item Intake</h1>
        <TextGenerateEffect
          words="Add new items to QuickRefurbz for refurbishment tracking"
          className="text-zinc-400 text-sm"
          duration={0.3}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Pallet Selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <SpotlightCard className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Box size={18} className="text-ql-yellow" />
                Active Pallet
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPallets}
                disabled={loadingPallets}
              >
                <RefreshCw size={14} className={loadingPallets ? 'animate-spin' : ''} />
              </Button>
            </div>

            {/* Pallet Selector */}
            <div className="space-y-3">
              <select
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                value={selectedPalletId}
                onChange={(e) => setSelectedPalletId(e.target.value)}
              >
                <option value="">Select a pallet...</option>
                {pallets.map(p => (
                  <option key={p.palletId} value={p.palletId}>
                    {p.palletId} ({p.receivedItems} items)
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                onClick={handleCreatePallet}
                loading={creatingPallet}
                className="w-full"
              >
                <Plus size={16} />
                New RFB Pallet
              </Button>
            </div>

            {/* Selected Pallet Info */}
            {selectedPalletId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-dark-primary rounded-lg border border-accent-green/30"
              >
                <div className="flex items-center gap-2 text-accent-green mb-2">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">Active Pallet</span>
                </div>
                <p className="font-mono text-lg text-white">{selectedPalletId}</p>
              </motion.div>
            )}
          </SpotlightCard>
        </motion.div>

        {/* Right Column - Item Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Spotlight
            className="bg-dark-card border border-border rounded-xl p-6"
            spotlightColor="rgba(241, 196, 15, 0.15)"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Package size={18} className="text-ql-yellow" />
                Product Information
              </h2>

              {/* Row 1: UPC and ASIN */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="upc">UPC Barcode</Label>
                  <div className="relative mt-1">
                    <Input
                      ref={upcInputRef}
                      id="upc"
                      type="text"
                      placeholder="Scan or enter UPC"
                      value={formData.upc}
                      onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
                      onKeyDown={handleUpcKeyDown}
                      className="pl-10 font-mono"
                    />
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="asin">Amazon ASIN</Label>
                  <Input
                    id="asin"
                    type="text"
                    placeholder="e.g., B08N5WRWNW"
                    value={formData.asin}
                    onChange={(e) => setFormData({ ...formData, asin: e.target.value })}
                    className="font-mono mt-1"
                  />
                </div>
              </div>

              {/* Row 2: Brand and Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manufacturer">Brand / Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    type="text"
                    placeholder="e.g., Apple, Samsung"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    type="text"
                    placeholder="e.g., iPhone 14 Pro"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Row 3: Serial and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    type="text"
                    placeholder="Device serial number"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="font-mono mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none mt-1"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Condition and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="condition">Initial Condition</Label>
                  <Input
                    id="condition"
                    type="text"
                    placeholder="e.g., Screen cracked, Powers on"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none mt-1"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Additional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={!selectedPalletId}
                className="w-full"
              >
                <Plus size={18} />
                Add Item to Pallet
              </Button>
            </form>
          </Spotlight>
        </motion.div>
      </div>

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
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <SpotlightCard className="p-6 border-accent-green">
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
                  <h3 className="font-semibold text-white">Item Added Successfully</h3>
                  <p className="text-sm text-zinc-400">
                    Ready for refurbishment workflow
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">RFB ID</span>
                  <p className="font-mono font-semibold text-ql-yellow">{lastResult.item.qlid}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Pallet</span>
                  <p className="font-mono text-white">{lastResult.item.palletId}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Barcode</span>
                  <p className="font-mono text-sm text-zinc-300">{lastResult.item.barcodeValue}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Category</span>
                  <Badge variant="info" size="sm" className="mt-1">
                    {lastResult.item.category}
                  </Badge>
                </div>
              </div>

              {(lastResult.item.manufacturer || lastResult.item.model) && (
                <div className="text-white mb-4">
                  <span className="text-zinc-400">Product: </span>
                  {lastResult.item.manufacturer} {lastResult.item.model}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    // TODO: Implement label printing
                    toast.info('Print Label', 'Label printing coming soon');
                  }}
                >
                  <Printer size={16} />
                  Print Label
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLastResult(null)}
                >
                  Dismiss
                </Button>
              </div>
            </SpotlightCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-ql-yellow/10 flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 text-ql-yellow" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Quick Tips</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>Scan UPC barcode for automatic product lookup</li>
                <li>Press Enter after scanning UPC to quick-add item</li>
                <li>At minimum, enter one identifier: UPC, ASIN, Brand, Model, or Serial</li>
                <li>Items will receive a unique RFB ID (e.g., RFB100001)</li>
              </ul>
            </div>
          </div>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
