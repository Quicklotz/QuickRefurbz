"use client";
import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Play,
  X,
  Printer,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { usePalletSession } from '@/contexts/PalletSessionContext';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Badge } from '@/components/shared/Badge';

const RETAILER_COLORS: Record<string, string> = {
  BESTBUY: '#0046be',
  TARGET: '#cc0000',
  AMAZON: '#ff9900',
  WALMART: '#0071ce',
  COSTCO: '#e31837',
  HOMEDEPOT: '#f96302',
  LOWES: '#004990',
};

const RETAILER_DISPLAY: Record<string, string> = {
  BESTBUY: 'Best Buy',
  TARGET: 'Target',
  AMAZON: 'Amazon',
  WALMART: 'Walmart',
  COSTCO: 'Costco',
  HOMEDEPOT: 'Home Depot',
  LOWES: "Lowe's",
};

interface PalletSessionCardProps {
  onPrintLabel?: () => void;
}

export function PalletSessionCard({ onPrintLabel }: PalletSessionCardProps) {
  const { session, loading, error, startSession, endSession, isActive } = usePalletSession();
  const [palletInput, setPalletInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleStartSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!palletInput.trim()) return;

    setIsStarting(true);
    setStartError(null);

    try {
      await startSession(palletInput.trim());
      setPalletInput('');
    } catch (err: any) {
      setStartError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndSession = () => {
    if (confirm('End pallet session? You can start a new one anytime.')) {
      endSession();
    }
  };

  // Loading state
  if (loading && !session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SpotlightCard className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-ql-yellow animate-spin" />
            <span className="text-zinc-400">Loading pallet session...</span>
          </div>
        </SpotlightCard>
      </motion.div>
    );
  }

  // No active session - show input form
  if (!isActive || !session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SpotlightCard className="p-4">
          <form onSubmit={handleStartSession} className="space-y-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-ql-yellow/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-ql-yellow" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Pallet Session</h3>
                <p className="text-xs text-zinc-500">Set an active pallet to validate scans</p>
              </div>
            </div>

            <AnimatePresence>
              {(startError || error) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-accent-red/10 border border-accent-red rounded-lg p-2 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0" />
                  <span className="text-accent-red text-xs">{startError || error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={palletInput}
                  onChange={(e) => setPalletInput(e.target.value.toUpperCase())}
                  placeholder="Enter Pallet ID (e.g., P1BBY)"
                  className="font-mono text-sm"
                  disabled={isStarting}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!palletInput.trim() || isStarting}
                loading={isStarting}
              >
                <Play size={14} />
                Start
              </Button>
            </div>

            <p className="text-xs text-zinc-600">
              Session persists across page refreshes and expires after 24 hours.
            </p>
          </form>
        </SpotlightCard>
      </motion.div>
    );
  }

  // Active session - show pallet info (session is guaranteed non-null here)
  const pallet = session.pallet;
  const retailerColor = RETAILER_COLORS[pallet.retailer] || '#F1C40F';
  const retailerName = RETAILER_DISPLAY[pallet.retailer] || pallet.retailer;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <SpotlightCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${retailerColor}20` }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: retailerColor }} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white text-sm">Active Pallet</h3>
                <Badge variant="success" size="sm">
                  {pallet.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <code className="text-ql-yellow font-mono font-bold">{session.palletId}</code>
                <Badge variant="info" size="sm">
                  {retailerName}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500 space-y-0.5">
                <p>Source: {pallet.liquidationSource}</p>
                <p>Items: {pallet.receivedItems} / {pallet.expectedItems} received</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrintLabel}
              title="Print pallet label"
            >
              <Printer size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndSession}
              className="text-zinc-400 hover:text-accent-red hover:bg-accent-red/10"
              title="End session"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>Completion</span>
            <span>{pallet.completedItems} / {pallet.receivedItems}</span>
          </div>
          <div className="h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: retailerColor }}
              initial={{ width: 0 }}
              animate={{
                width: pallet.receivedItems > 0
                  ? `${(pallet.completedItems / pallet.receivedItems) * 100}%`
                  : '0%'
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
