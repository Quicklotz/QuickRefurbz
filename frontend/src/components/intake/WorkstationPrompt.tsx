"use client";
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, ArrowRight } from 'lucide-react';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';

interface WorkstationPromptProps {
  onConfirm: (workstationId: string) => void;
  currentWorkstation?: string | null;
}

export function WorkstationPrompt({ onConfirm, currentWorkstation }: WorkstationPromptProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentWorkstation || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recentStations: string[] = JSON.parse(localStorage.getItem('qr_recent_stations') || '[]');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validate = (v: string) => /^wk-\d+$/i.test(v);

  const handleSubmit = () => {
    const trimmed = value.trim().toLowerCase();
    if (!validate(trimmed)) {
      setError(t('workstation.invalidFormat'));
      return;
    }
    setError(null);
    onConfirm(trimmed);
  };

  return (
    <div className="rounded-2xl border border-border bg-dark-card p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-ql-yellow/10 flex items-center justify-center mx-auto mb-3">
          <Monitor size={28} className="text-ql-yellow" />
        </div>
        <h2 className="text-lg font-semibold text-white">{t('workstation.title')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('workstation.subtitle')}</p>
      </div>

      <div className="space-y-4">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('workstation.placeholder')}
          className="font-mono text-center text-lg"
        />
        {error && <p className="text-sm text-accent-red text-center">{error}</p>}

        {recentStations.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">{t('workstation.recentStations')}</p>
            <div className="flex flex-wrap gap-2">
              {recentStations.map((s) => (
                <button
                  key={s}
                  onClick={() => { setValue(s); onConfirm(s); }}
                  className="px-3 py-1.5 rounded-full bg-dark-tertiary border border-border text-sm font-mono text-zinc-300 hover:border-ql-yellow hover:text-ql-yellow transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button variant="primary" className="w-full" onClick={handleSubmit}>
          {t('workstation.confirm')} <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}
