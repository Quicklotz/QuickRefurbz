"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Eye,
  Package,
  Filter,
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Label } from '@/components/aceternity/label';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { Loader } from '@/components/aceternity/loader';
import { useToast } from '@/components/aceternity/toast';
import { Badge } from '@/components/shared/Badge';

const GRADE_VARIANTS: Record<string, 'success' | 'warning' | 'danger'> = {
  NEW: 'success',
  A: 'success',
  B: 'warning',
  C: 'warning',
  D: 'danger',
  SALVAGE: 'danger',
};


export function Items() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ grade: '', category: '' });
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  // Track request ID to prevent race conditions
  const requestIdRef = useRef(0);

  const loadItems = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);

    const params: Record<string, string> = {};
    if (filter.grade) params.grade = filter.grade;
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
          <h1 className="text-3xl font-bold text-white mb-2">{t('items.title')}</h1>
          <TextGenerateEffect
            words={t('items.subtitle')}
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="secondary" onClick={loadItems} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
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
              <span className="text-sm font-medium">{t('items.filters')}</span>
            </div>
            <div className="flex gap-4 flex-1">
              <div className="flex-1">
                <Label htmlFor="gradeFilter" className="sr-only">Grade</Label>
                <select
                  id="gradeFilter"
                  className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-ql-yellow focus:outline-none text-sm"
                  value={filter.grade}
                  onChange={(e) => setFilter({ ...filter, grade: e.target.value })}
                >
                  <option value="">{t('items.allGrades')}</option>
                  {[
                    { value: 'NEW', key: 'grading.grade_NEW' },
                    { value: 'A', key: 'grading.grade_A' },
                    { value: 'B', key: 'grading.grade_B' },
                    { value: 'C', key: 'grading.grade_C' },
                    { value: 'D', key: 'grading.grade_D' },
                    { value: 'SALVAGE', key: 'grading.grade_SALVAGE' },
                  ].map((g) => (
                    <option key={g.value} value={g.value}>{t(g.key)}</option>
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
                  <option value="">{t('items.allCategories')}</option>
                  {['VACUUM','APPLIANCE_SMALL','ICE_MAKER','APPLIANCE_LARGE','TV','MONITOR','LAPTOP','DESKTOP','PHONE','TABLET','AUDIO','GAMING','WEARABLE','OTHER'].map((c) => (
                    <option key={c} value={c}>{t('categories.' + c)}</option>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('items.product')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('items.category')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('items.pallet')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('items.grade')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('items.msrp')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-8 h-8 text-zinc-600" />
                          <span>{t('items.noItems')}</span>
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
                        <td className="px-4 py-3 text-zinc-300">{String(t('categories.' + item.category, item.category))}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-zinc-400">{item.palletId}</span>
                        </td>
                        <td className="px-4 py-3">
                          {(item.final_grade || item.finalGrade) ? (
                            <Badge variant={GRADE_VARIANTS[item.final_grade || item.finalGrade] || 'info'} size="sm">
                              {item.final_grade || item.finalGrade}
                            </Badge>
                          ) : (
                            <span className="text-zinc-600 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 text-sm">
                          {(item.msrp && Number(item.msrp) > 0) ? `$${Number(item.msrp).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewItem(item.qlid)}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </Button>
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
              {(selectedItem.final_grade || selectedItem.finalGrade) && (
                <Badge
                  variant={GRADE_VARIANTS[selectedItem.final_grade || selectedItem.finalGrade] || 'info'}
                  className="mt-2"
                >
                  Grade {selectedItem.final_grade || selectedItem.finalGrade}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.category')}</span>
                <p className="text-white">{String(t('categories.' + selectedItem.category, selectedItem.category))}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.pallet')}</span>
                <p className="font-mono text-white">{selectedItem.palletId || selectedItem.pallet_id}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.upc')}</span>
                <p className="font-mono text-white">{selectedItem.upc || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.serialNumber')}</span>
                <p className="font-mono text-white">{selectedItem.serialNumber || selectedItem.serial_number || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.msrp')}</span>
                <p className="text-white">{(selectedItem.msrp && Number(selectedItem.msrp) > 0) ? `$${Number(selectedItem.msrp).toLocaleString()}` : '—'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{t('items.intake')}</span>
                <p className="text-white text-sm">{selectedItem.intake_ts ? new Date(selectedItem.intake_ts).toLocaleDateString() : '—'}</p>
              </div>
            </div>

            {/* Refurb Checklist Summary */}
            {(selectedItem.refurb_checklist || selectedItem.refurbChecklist) && (() => {
              const checklist = selectedItem.refurb_checklist || selectedItem.refurbChecklist;
              const checks = checklist.checks || [];
              const pass = checks.filter((c: any) => c.result === 'PASS').length;
              const fail = checks.filter((c: any) => c.result === 'FAIL').length;
              const na = checks.filter((c: any) => c.result === 'N/A').length;
              return (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                    {String(t('items.refurbChecklist'))} — {String(t('refurb.category_' + checklist.category, (checklist.category || '').replace(/_/g, ' ')))}
                  </h4>
                  <div className="flex gap-4 text-sm mb-3">
                    <span className="text-green-400">{pass} {t('refurb.pass')}</span>
                    <span className="text-red-400">{fail} {t('refurb.fail')}</span>
                    <span className="text-zinc-400">{na} {t('refurb.na')}</span>
                  </div>
                  {fail > 0 && (
                    <div className="space-y-1">
                      {checks.filter((c: any) => c.result === 'FAIL').map((c: any) => (
                        <div key={c.code} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded px-3 py-1.5">
                          <span className="font-medium">{c.name}</span>
                          {c.notes && <span className="text-red-300/70 ml-auto text-xs">{c.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
