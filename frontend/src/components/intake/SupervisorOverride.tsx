"use client";
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X, Printer, PenLine, ArrowLeft } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';

interface SupervisorOverrideProps {
  palletId: string;
  onClose: () => void;
  onPalletRenamed: (newPalletId: string) => void;
}

type Phase = 'pin' | 'actions';

export function SupervisorOverride({ palletId, onClose, onPalletRenamed }: SupervisorOverrideProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('pin');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [newPalletId, setNewPalletId] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const newIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => codeRef.current?.focus(), 100);
  }, []);

  const handleCodeSubmit = () => {
    // Verify code client-side for fast feedback; backend also validates
    if (code === '2026') {
      setCodeError(false);
      setPhase('actions');
      setTimeout(() => newIdRef.current?.focus(), 100);
    } else {
      setCodeError(true);
      setCode('');
      codeRef.current?.focus();
    }
  };

  const handleReprint = async () => {
    setReprinting(true);
    setMessage(null);
    try {
      await api.supervisorPalletAction({
        code,
        action: 'reprint',
        palletId,
      });
      // Trigger print via the existing label endpoint
      // For now, just confirm the pallet was found (printer IP would come from settings)
      setMessage({ type: 'success', text: t('supervisor.reprintSuccess') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || t('errors.printerError') });
    } finally {
      setReprinting(false);
    }
  };

  const handleRename = async () => {
    const trimmed = newPalletId.toUpperCase().trim();
    if (!trimmed) return;

    setRenaming(true);
    setMessage(null);
    try {
      const result = await api.supervisorPalletAction({
        code,
        action: 'rename',
        palletId,
        newPalletId: trimmed,
      });
      setMessage({ type: 'success', text: t('supervisor.renameSuccess') });
      onPalletRenamed(result.pallet.palletId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || t('supervisor.renameFailed') });
    } finally {
      setRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-white font-semibold">{t('supervisor.title')}</h2>
              {phase === 'actions' && (
                <p className="text-xs text-zinc-500 mt-0.5">{t('supervisor.currentPallet')}: <span className="font-mono text-[var(--color-ql-yellow)]">{palletId}</span></p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* PIN Entry Phase */}
          {phase === 'pin' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">{t('supervisor.enterCode')}</p>
              <Input
                ref={codeRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError(false);
                }}
                onKeyDown={(e) => handleKeyDown(e, handleCodeSubmit)}
                placeholder={t('supervisor.codePlaceholder')}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              {codeError && (
                <p className="text-sm text-[var(--color-accent-red)] text-center">{t('supervisor.invalidCode')}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
                <Button variant="primary" onClick={handleCodeSubmit} className="flex-1">
                  <ShieldCheck size={18} />
                  {t('supervisor.unlock')}
                </Button>
              </div>
            </div>
          )}

          {/* Actions Phase */}
          {phase === 'actions' && (
            <div className="space-y-5">
              {/* Status message */}
              {message && (
                <div className={`p-3 rounded-lg text-sm border ${
                  message.type === 'success'
                    ? 'bg-[var(--color-accent-green)]/10 border-[var(--color-accent-green)]/30 text-[var(--color-accent-green)]'
                    : 'bg-[var(--color-accent-red)]/10 border-[var(--color-accent-red)]/30 text-[var(--color-accent-red)]'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Reprint Label */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-tertiary)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer size={18} className="text-zinc-400" />
                    <span className="text-white text-sm font-medium">{t('supervisor.reprintLabel')}</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleReprint} loading={reprinting}>
                    {t('common.print')}
                  </Button>
                </div>
              </div>

              {/* Rename Pallet */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-tertiary)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <PenLine size={18} className="text-zinc-400" />
                  <span className="text-white text-sm font-medium">{t('supervisor.changePalletId')}</span>
                </div>
                <div>
                  <Label>{t('supervisor.newPalletId')}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      ref={newIdRef}
                      value={newPalletId}
                      onChange={(e) => setNewPalletId(e.target.value.toUpperCase())}
                      onKeyDown={(e) => handleKeyDown(e, handleRename)}
                      placeholder={t('supervisor.newIdPlaceholder')}
                      className="font-mono flex-1"
                    />
                    <Button variant="primary" size="sm" onClick={handleRename} loading={renaming}>
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Back / Close */}
              <div className="flex justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => { setPhase('pin'); setCode(''); }}>
                  <ArrowLeft size={14} /> {t('common.back')}
                </Button>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
