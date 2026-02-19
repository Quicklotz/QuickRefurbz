"use client";
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Boxes,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/api/client';
import { usePalletSession } from '@/contexts/PalletSessionContext';
import { Button } from '@/components/aceternity/button';
import { Loader } from '@/components/aceternity/loader';
import { SourcingPalletFlow } from '@/components/intake/SourcingPalletFlow';
import { WorkstationPrompt } from '@/components/intake/WorkstationPrompt';
import { IdentificationPanel } from '@/components/intake/IdentificationPanel';
import { ReviewConfirmCard } from '@/components/intake/ReviewConfirmCard';
import { LastItemCard } from '@/components/intake/LastItemCard';
import { SupervisorOverride } from '@/components/intake/SupervisorOverride';

type IntakeState =
  | 'no-session'
  | 'pallet-scan'
  | 'workstation-prompt'
  | 'ready'
  | 'identifying'
  | 'reviewing';

export function Intake() {
  const { t } = useTranslation();
  const { session, isActive, startSession, endSession, workstationId, setWorkstationId } = usePalletSession();

  const [state, setState] = useState<IntakeState>('no-session');
  const [identifiedData, setIdentifiedData] = useState<any>(null);
  const [lastItem, setLastItem] = useState<any>(null);
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [showSupervisor, setShowSupervisor] = useState(false);

  // Determine initial state from session
  useEffect(() => {
    if (loading) return;
    if (isActive && workstationId) {
      setState('ready');
    } else if (isActive && !workstationId) {
      setState('workstation-prompt');
    } else {
      setState('no-session');
    }
  }, [isActive, workstationId, loading]);

  // Load recent items
  useEffect(() => {
    loadRecentItems();
  }, []);

  const loadRecentItems = async () => {
    try {
      const items = await api.getItems({ stage: 'INTAKE', limit: '5' });
      setRecentItems(items);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handlePalletCreated = useCallback(async (pallet: any) => {
    try {
      await startSession(pallet.palletId || pallet.pallet_id);
      if (workstationId) {
        setState('ready');
      } else {
        setState('workstation-prompt');
      }
    } catch {
      // startSession will throw if pallet not found - try with pallet data
      setState('workstation-prompt');
    }
  }, [startSession, workstationId]);

  const handleWorkstationConfirm = useCallback((id: string) => {
    setWorkstationId(id);
    setState('ready');
  }, [setWorkstationId]);

  const handleIdentified = useCallback((data: any) => {
    setIdentifiedData(data);
    setState('reviewing');
  }, []);

  const handleItemSaved = useCallback((item: any) => {
    setLastItem(item);
    setItemCount((c) => c + 1);
    setIdentifiedData(null);
    setState('ready');
    loadRecentItems();
  }, []);

  const handleCancelReview = useCallback(() => {
    setIdentifiedData(null);
    setState('ready');
  }, []);

  const handleEndSession = useCallback(() => {
    endSession();
    setLastItem(null);
    setItemCount(0);
    setIdentifiedData(null);
    setState('no-session');
  }, [endSession]);

  const handlePalletRenamed = useCallback(async (newPalletId: string) => {
    // Re-start session with the new pallet ID to refresh context
    try {
      await startSession(newPalletId);
    } catch { /* session will still work with stale data */ }
    setShowSupervisor(false);
  }, [startSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="bars" text={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('intake.title')}</h1>
          <p className="mt-1 text-zinc-500">{t('intake.subtitle')}</p>
        </div>
        <div className="flex gap-3 items-center">
          {isActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-dark-tertiary)] border border-[var(--color-border)]">
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
              <span className="text-sm font-mono text-[var(--color-ql-yellow)]">{session?.palletId}</span>
              {workstationId && <span className="text-xs text-zinc-500">| {workstationId}</span>}
            </div>
          )}
          {isActive && (
            <button
              onClick={() => setShowSupervisor(true)}
              className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-dark-tertiary)] text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 transition-colors"
              title={t('supervisor.title')}
            >
              <ShieldCheck size={16} />
            </button>
          )}
          {isActive && (
            <Button variant="secondary" size="sm" onClick={handleEndSession}>
              <XCircle size={16} />
              {t('common.close')}
            </Button>
          )}
        </div>
      </div>

      {/* Session stats bar (when active) */}
      {isActive && itemCount > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-4 text-center">
            <p className="text-3xl font-semibold text-[var(--color-ql-yellow)]">{itemCount}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('review.itemCount')}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-4 text-center">
            <p className="text-3xl font-semibold text-white">{session?.pallet?.receivedItems || 0}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('intake.receiving')}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-4 text-center">
            <p className="text-3xl font-semibold text-zinc-400">{session?.pallet?.expectedItems || '\u2014'}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('palletScan.expectedItems')}</p>
          </div>
        </div>
      )}

      {/* State-based content */}

      {/* No session -> Show start options */}
      {state === 'no-session' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-8 text-center">
            <Package size={48} className="mx-auto mb-4 text-zinc-600" />
            <h2 className="text-lg font-medium text-white mb-2">{t('intake.noSession')}</h2>
            <p className="text-zinc-500 mb-6">{t('intake.startSession')}</p>
            <Button variant="primary" size="lg" onClick={() => setState('pallet-scan')}>
              <Boxes size={20} />
              {t('intake.newPallet')}
            </Button>
          </div>

          {/* Recent items */}
          {recentItems.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
              <div className="p-4 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium text-zinc-400">{t('intake.recentItems')}</h3>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {recentItems.map((item: any) => (
                  <div key={item.qlid} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-[var(--color-ql-yellow)]">{item.qlid}</span>
                      <span className="text-zinc-400 text-sm ml-3">{item.manufacturer} {item.model}</span>
                    </div>
                    <span className="text-xs text-zinc-600">{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pallet scan flow */}
      {state === 'pallet-scan' && (
        <SourcingPalletFlow
          onPalletCreated={handlePalletCreated}
          onCancel={() => setState('no-session')}
        />
      )}

      {/* Workstation prompt */}
      {state === 'workstation-prompt' && (
        <WorkstationPrompt
          onConfirm={handleWorkstationConfirm}
          currentWorkstation={workstationId}
        />
      )}

      {/* Ready -> Show identification panel */}
      {state === 'ready' && (
        <div className="space-y-6">
          {lastItem && <LastItemCard item={lastItem} itemCount={itemCount} />}
          <IdentificationPanel onIdentified={handleIdentified} />
        </div>
      )}

      {/* Reviewing -> Show review card */}
      {state === 'reviewing' && identifiedData && (
        <ReviewConfirmCard
          data={identifiedData}
          palletId={session?.palletId || ''}
          workstationId={workstationId || 'wk-0'}
          onSaved={handleItemSaved}
          onCancel={handleCancelReview}
        />
      )}
      {/* Supervisor Override Modal */}
      {showSupervisor && session?.palletId && (
        <SupervisorOverride
          palletId={session.palletId}
          onClose={() => setShowSupervisor(false)}
          onPalletRenamed={handlePalletRenamed}
        />
      )}
    </div>
  );
}
