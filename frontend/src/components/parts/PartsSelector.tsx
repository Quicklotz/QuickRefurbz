"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Minus,
  Search,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  DollarSign,
  Wrench
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Badge } from '@/components/shared/Badge';

interface Part {
  id: string;
  partNumber: string;
  name: string;
  description?: string;
  category: string;
  quantityOnHand: number;
  quantityReserved: number;
  unitCost: number;
  location?: string;
}

interface SelectedPart {
  part: Part;
  quantity: number;
  notes?: string;
}

interface PartsUsage {
  id: string;
  qlid: string;
  partId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  usedByTechnicianId: string;
  usedByTechnicianName?: string;
  notes?: string;
  createdAt: string;
}

interface PartsSelectorProps {
  qlid: string;
  category: string;
  onPartsUsed?: (usage: PartsUsage[], totalCost: number) => void;
  readOnly?: boolean;
}

export function PartsSelector({
  qlid,
  category,
  onPartsUsed,
  readOnly = false
}: PartsSelectorProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [existingUsage, setExistingUsage] = useState<PartsUsage[]>([]);

  // Load parts and existing usage
  useEffect(() => {
    loadData();
  }, [qlid, category]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [partsData, usageData] = await Promise.all([
        api.getCompatibleParts(category),
        api.getPartsUsageForItem(qlid)
      ]);

      setParts(partsData);
      setExistingUsage(usageData);
    } catch (err: any) {
      setError(err.message || 'Failed to load parts data');
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(part => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      part.name.toLowerCase().includes(q) ||
      part.partNumber.toLowerCase().includes(q) ||
      (part.description?.toLowerCase().includes(q))
    );
  });

  const addPart = (part: Part) => {
    const existing = selectedParts.find(sp => sp.part.id === part.id);
    if (existing) {
      setSelectedParts(prev =>
        prev.map(sp =>
          sp.part.id === part.id
            ? { ...sp, quantity: Math.min(sp.quantity + 1, part.quantityOnHand - part.quantityReserved) }
            : sp
        )
      );
    } else {
      setSelectedParts(prev => [...prev, { part, quantity: 1 }]);
    }
  };

  const removePart = (partId: string) => {
    setSelectedParts(prev => prev.filter(sp => sp.part.id !== partId));
  };

  const updateQuantity = (partId: string, quantity: number) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;

    const maxQty = part.quantityOnHand - part.quantityReserved;
    const newQty = Math.max(1, Math.min(quantity, maxQty));

    setSelectedParts(prev =>
      prev.map(sp =>
        sp.part.id === partId ? { ...sp, quantity: newQty } : sp
      )
    );
  };

  const updateNotes = (partId: string, notes: string) => {
    setSelectedParts(prev =>
      prev.map(sp =>
        sp.part.id === partId ? { ...sp, notes } : sp
      )
    );
  };

  const getTotalCost = () => {
    return selectedParts.reduce(
      (sum, sp) => sum + sp.part.unitCost * sp.quantity,
      0
    );
  };

  const getExistingTotalCost = () => {
    return existingUsage.reduce((sum, u) => sum + u.totalCost, 0);
  };

  const submitParts = async () => {
    if (selectedParts.length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const result = await api.usePartsForItem(
        qlid,
        selectedParts.map(sp => ({
          partId: sp.part.id,
          quantity: sp.quantity,
          notes: sp.notes
        }))
      );

      // Clear selection and reload usage
      setSelectedParts([]);
      await loadData();

      onPartsUsed?.(result.usage as unknown as PartsUsage[], result.totalCost);
    } catch (err: any) {
      setError(err.message || 'Failed to record parts usage');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-ql-yellow" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Wrench size={18} className="text-ql-yellow" />
          Parts Used
        </h3>
        <Badge variant="default" size="sm">
          {existingUsage.length + selectedParts.length} parts
        </Badge>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-accent-red text-sm bg-accent-red/10 p-2 rounded"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Usage */}
      {existingUsage.length > 0 && (
        <div className="bg-dark-primary border border-border rounded-lg p-3">
          <p className="text-xs text-zinc-500 mb-2">Previously used parts</p>
          <div className="space-y-2">
            {existingUsage.map(usage => (
              <div
                key={usage.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-accent-green" />
                  <span className="text-white">{usage.partName}</span>
                  <Badge variant="default" size="sm">x{usage.quantity}</Badge>
                </div>
                <span className="text-accent-green">
                  ${usage.totalCost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-between">
            <span className="text-xs text-zinc-500">Previous total:</span>
            <span className="text-sm font-semibold text-white">
              ${getExistingTotalCost().toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          </div>

          {/* Parts List */}
          <div className="max-h-60 overflow-y-auto space-y-1 bg-dark-primary border border-border rounded-lg p-2">
            {filteredParts.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">
                No compatible parts found
              </p>
            ) : (
              filteredParts.map(part => {
                const available = part.quantityOnHand - part.quantityReserved;
                const isSelected = selectedParts.some(sp => sp.part.id === part.id);
                const isOutOfStock = available <= 0;

                return (
                  <button
                    key={part.id}
                    onClick={() => !isOutOfStock && addPart(part)}
                    disabled={isOutOfStock}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      isSelected
                        ? 'bg-ql-yellow/10 border border-ql-yellow/30'
                        : isOutOfStock
                        ? 'bg-dark-tertiary opacity-50 cursor-not-allowed'
                        : 'bg-dark-tertiary hover:bg-dark-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{part.name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{part.partNumber}</span>
                          {part.location && <span>• {part.location}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-accent-green text-sm">${part.unitCost.toFixed(2)}</p>
                        <p className={`text-xs ${available <= 5 ? 'text-accent-red' : 'text-zinc-500'}`}>
                          {available} in stock
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Parts */}
          {selectedParts.length > 0 && (
            <div className="bg-dark-tertiary border border-ql-yellow/30 rounded-lg p-3 space-y-3">
              <p className="text-xs text-ql-yellow font-medium">Selected parts</p>

              {selectedParts.map(({ part, quantity, notes }) => (
                <div key={part.id} className="bg-dark-primary rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">{part.name}</span>
                    <button
                      onClick={() => removePart(part.id)}
                      className="text-zinc-500 hover:text-accent-red"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(part.id, quantity - 1)}
                        className="p-1 rounded bg-dark-tertiary hover:bg-dark-card"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-white">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(part.id, quantity + 1)}
                        className="p-1 rounded bg-dark-tertiary hover:bg-dark-card"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Notes..."
                      value={notes || ''}
                      onChange={(e) => updateNotes(part.id, e.target.value)}
                      className="flex-1 bg-dark-tertiary border border-border rounded px-2 py-1 text-xs text-white placeholder:text-zinc-600"
                    />

                    <span className="text-accent-green text-sm">
                      ${(part.unitCost * quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1 text-zinc-400">
                  <DollarSign size={14} />
                  <span className="text-sm">Total cost:</span>
                </div>
                <span className="text-lg font-bold text-ql-yellow">
                  ${getTotalCost().toFixed(2)}
                </span>
              </div>

              {/* Submit */}
              <Button
                variant="primary"
                className="w-full"
                onClick={submitParts}
                loading={submitting}
              >
                <Package size={16} />
                Record Parts Usage
              </Button>
            </div>
          )}
        </>
      )}

      {/* Read-only summary */}
      {readOnly && existingUsage.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-4">
          No parts used for this item
        </p>
      )}
    </div>
  );
}

export default PartsSelector;
