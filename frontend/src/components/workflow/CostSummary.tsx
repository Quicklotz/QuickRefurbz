"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  Calculator,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Badge } from '@/components/shared/Badge';

interface CostBreakdown {
  qlid: string;
  unitCogs: number;
  partsCost: number;
  partsCount: number;
  laborCost: number;
  laborMinutes: number;
  overheadCost: number;
  totalCost: number;
  estimatedValue: number | null;
  profitMargin: number | null;
  partsDetail: Array<{
    partName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  laborDetail: Array<{
    stage: string;
    technicianName: string;
    durationMinutes: number;
    laborCost: number;
  }>;
}

interface CostSummaryProps {
  qlid: string;
  onCostCalculated?: (totalCost: number, profitMargin: number | null) => void;
  showDetails?: boolean;
  compact?: boolean;
}

export function CostSummary({
  qlid,
  onCostCalculated,
  showDetails = true,
  compact = false
}: CostSummaryProps) {
  const [costs, setCosts] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    loadCosts();
  }, [qlid]);

  const loadCosts = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api.getCostBreakdown(qlid);
      setCosts(data);
      onCostCalculated?.(data.totalCost, data.profitMargin);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        // No cost data yet, show empty state
        setCosts(null);
      } else {
        setError(err.message || 'Failed to load cost data');
      }
    } finally {
      setLoading(false);
    }
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      await api.calculateCosts(qlid);
      await loadCosts();
    } catch (err: any) {
      setError(err.message || 'Failed to recalculate costs');
    } finally {
      setRecalculating(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-5 h-5 animate-spin text-ql-yellow" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <DollarSign size={14} className="text-zinc-500" />
          <span className="text-white font-semibold">
            ${costs?.totalCost.toFixed(2) || '0.00'}
          </span>
        </div>
        {costs?.profitMargin !== null && costs?.profitMargin !== undefined && (
          <Badge
            variant={costs.profitMargin >= 30 ? 'success' : costs.profitMargin >= 10 ? 'warning' : 'danger'}
            size="sm"
          >
            {costs.profitMargin >= 0 ? (
              <TrendingUp size={10} className="mr-1" />
            ) : (
              <TrendingDown size={10} className="mr-1" />
            )}
            {costs.profitMargin.toFixed(1)}%
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Calculator size={18} className="text-ql-yellow" />
          Cost Summary
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={recalculate}
          loading={recalculating}
        >
          <RefreshCw size={14} />
          Recalculate
        </Button>
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

      {!costs ? (
        <div className="bg-dark-primary border border-border rounded-lg p-6 text-center">
          <Calculator size={32} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-zinc-400 text-sm mb-3">No cost data calculated yet</p>
          <Button variant="secondary" size="sm" onClick={recalculate} loading={recalculating}>
            Calculate Costs
          </Button>
        </div>
      ) : (
        <>
          {/* Main cost card */}
          <div className="bg-dark-primary border border-border rounded-lg overflow-hidden">
            {/* Total and Profit */}
            <div className="p-4 bg-gradient-to-r from-ql-yellow/10 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Refurb Cost</p>
                  <p className="text-3xl font-bold text-white">
                    ${costs.totalCost.toFixed(2)}
                  </p>
                </div>
                {costs.profitMargin !== null && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Profit Margin</p>
                    <div className={`text-2xl font-bold flex items-center gap-1 ${
                      costs.profitMargin >= 30 ? 'text-accent-green' :
                      costs.profitMargin >= 10 ? 'text-yellow-500' :
                      costs.profitMargin >= 0 ? 'text-orange-500' :
                      'text-accent-red'
                    }`}>
                      {costs.profitMargin >= 0 ? (
                        <TrendingUp size={20} />
                      ) : (
                        <TrendingDown size={20} />
                      )}
                      {costs.profitMargin.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              {costs.estimatedValue && (
                <p className="text-sm text-zinc-400 mt-2">
                  Est. Value: <span className="text-accent-green">${costs.estimatedValue.toFixed(2)}</span>
                  {' '}→ Potential Profit: <span className="text-accent-green">
                    ${(costs.estimatedValue - costs.totalCost).toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            {/* Cost breakdown */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Unit COGS</span>
                <span className="text-white">${costs.unitCogs.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Package size={12} />
                  Parts ({costs.partsCount})
                </span>
                <span className="text-white">${costs.partsCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Clock size={12} />
                  Labor ({formatDuration(costs.laborMinutes)})
                </span>
                <span className="text-white">${costs.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <span className="text-zinc-400">Overhead (10%)</span>
                <span className="text-white">${costs.overheadCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Expandable details */}
          {showDetails && (costs.partsDetail.length > 0 || costs.laborDetail.length > 0) && (
            <div className="bg-dark-tertiary border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-dark-card transition-colors"
              >
                <span className="text-sm font-medium text-white">Cost Details</span>
                {expanded ? (
                  <ChevronUp size={16} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={16} className="text-zinc-400" />
                )}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4">
                      {/* Parts detail */}
                      {costs.partsDetail.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Package size={12} />
                            Parts Used
                          </p>
                          <div className="space-y-1">
                            {costs.partsDetail.map((part, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">
                                  {part.partName} × {part.quantity}
                                </span>
                                <span className="text-zinc-400">
                                  ${part.totalCost.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Labor detail */}
                      {costs.laborDetail.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Clock size={12} />
                            Labor Time
                          </p>
                          <div className="space-y-1">
                            {costs.laborDetail.map((labor, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">
                                  {labor.stage} ({labor.technicianName}) - {formatDuration(labor.durationMinutes)}
                                </span>
                                <span className="text-zinc-400">
                                  ${labor.laborCost.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CostSummary;
