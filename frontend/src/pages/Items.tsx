"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  ChevronRight,
  Eye,
  Package,
  Filter,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Label } from '@/components/aceternity/label';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { Loader } from '@/components/aceternity/loader';
import { useToast } from '@/components/aceternity/toast';
import { Badge, PriorityBadge } from '@/components/shared/Badge';

const STAGE_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  INTAKE: 'info',
  TESTING: 'warning',
  REPAIR: 'warning',
  CLEANING: 'warning',
  FINAL_QC: 'info',
  COMPLETE: 'success',
};

const STAGES = [
  { value: '', label: 'All Stages' },
  { value: 'INTAKE', label: 'Intake' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'FINAL_QC', label: 'Final QC' },
  { value: 'COMPLETE', label: 'Complete' },
];

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'TV', label: 'TV' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'GAMING', label: 'Gaming' },
  { value: 'WEARABLE', label: 'Wearable' },
  { value: 'OTHER', label: 'Other' },
];

export function Items() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ stage: '', category: '' });
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const toast = useToast();

  // Track request ID to prevent race conditions
  const requestIdRef = useRef(0);

  const loadItems = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);

    const params: Record<string, string> = {};
    if (filter.stage) params.stage = filter.stage;
    if (filter.category) params.category = filter.category;

    try {
      const data = await api.getItems(params);
      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setItems(data);
      }
    } catch (error: any) {
      if (currentRequestId === requestIdRef.current) {
        console.error(error);
        toast.error('Failed to load items', error.message);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filter, toast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdvance = async (item: any) => {
    setAdvancing(item.qlid);
    try {
      await api.advanceItem(item.qlid);
      toast.success('Item Advanced', `${item.qlid} moved to next stage`);
      loadItems();
    } catch (error: any) {
      toast.error('Failed to advance item', error.message);
    } finally {
      setAdvancing(null);
    }
  };

  const viewItem = async (qlid: string) => {
    try {
      const item = await api.getItem(qlid);
      setSelectedItem(item);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Failed to load item:', error);
      toast.error('Failed to load item details', error.message);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="bars" text="Loading items..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Items</h1>
          <TextGenerateEffect
            words="Track and manage all items in the system"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="secondary" onClick={loadItems} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SpotlightCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Filter size={18} />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex gap-4 flex-1">
              <div className="flex-1">
                <Label htmlFor="stageFilter" className="sr-only">Stage</Label>
                <select
                  id="stageFilter"
                  className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-ql-yellow focus:outline-none text-sm"
                  value={filter.stage}
                  onChange={(e) => setFilter({ ...filter, stage: e.target.value })}
                >
                  {STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <Label htmlFor="categoryFilter" className="sr-only">Category</Label>
                <select
                  id="categoryFilter"
                  className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-ql-yellow focus:outline-none text-sm"
                  value={filter.category}
                  onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Items Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">QLID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pallet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-8 h-8 text-zinc-600" />
                          <span>No items found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <motion.tr
                        key={item.qlid}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b border-border hover:bg-dark-tertiary/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-accent-blue">{item.qlid}</span>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {item.manufacturer} {item.model}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{item.category}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-zinc-400">{item.palletId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STAGE_VARIANTS[item.currentStage] || 'info'} size="sm">
                            {item.currentStage.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={item.priority.toLowerCase() as 'urgent' | 'high' | 'normal' | 'low'} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewItem(item.qlid)}
                              title="View Details"
                            >
                              <Eye size={16} />
                            </Button>
                            {item.currentStage !== 'COMPLETE' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAdvance(item)}
                                loading={advancing === item.qlid}
                                title="Advance Stage"
                              >
                                <ChevronRight size={16} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Item Details Modal */}
      <AnimatedModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedItem?.qlid}
      >
        {selectedItem && (
          <div className="space-y-6">
            <div>
              <p className="text-lg text-white font-medium">
                {selectedItem.manufacturer} {selectedItem.model}
              </p>
              <Badge
                variant={STAGE_VARIANTS[selectedItem.currentStage] || 'info'}
                className="mt-2"
              >
                {selectedItem.currentStage.replace('_', ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Category</span>
                <p className="text-white">{selectedItem.category}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Pallet</span>
                <p className="font-mono text-white">{selectedItem.palletId}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Serial Number</span>
                <p className="text-white">{selectedItem.serialNumber || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Priority</span>
                <p className="text-white">{selectedItem.priority}</p>
              </div>
            </div>

            {/* Stage History */}
            {selectedItem.history && selectedItem.history.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Clock size={14} />
                  Stage History
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedItem.history.map((h: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-dark-primary rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                          <span>{h.fromStage || 'NEW'}</span>
                          <ArrowRight size={14} className="text-ql-yellow" />
                          <span>{h.toStage}</span>
                        </div>
                        <span className="text-zinc-500 text-xs">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {h.technicianName && (
                        <p className="text-zinc-400 text-xs mt-1">
                          By: {h.technicianName}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
