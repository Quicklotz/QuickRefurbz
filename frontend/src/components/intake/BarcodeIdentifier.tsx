"use client";
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Barcode, Check, X } from 'lucide-react';
import { api } from '@/api/client';
import { Input } from '@/components/aceternity/input';
import { Loader } from '@/components/aceternity/loader';

interface Props {
  onIdentified: (data: any) => void;
}

export function BarcodeIdentifier({ onIdentified }: Props) {
  const { t } = useTranslation();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (value: string) => {
    if (!value.trim() || value.trim().length < 6) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await api.identifyByBarcode(value.trim());
      setResult(data);
      if (data.found) {
        onIdentified({
          ...data,
          identificationMethod: 'barcode',
          upc: value.trim(),
        });
      }
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan(barcode);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Barcode size={20} className="text-ql-yellow" />
        <h3 className="text-white font-medium">{t('identify.scanBarcode')}</h3>
      </div>
      <Input
        ref={inputRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('identify.scanPlaceholder')}
        className="font-mono text-lg"
        autoFocus
      />
      {loading && (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader size="sm" variant="spinner" />
          <span className="text-sm">{t('identify.searching')}</span>
        </div>
      )}
      {result && !loading && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          result.found
            ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
            : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
        }`}>
          {result.found ? <Check size={16} /> : <X size={16} />}
          <span className="text-sm">{result.found ? t('identify.productFound') : t('identify.notFound')}</span>
          {result.found && result.brand && (
            <span className="text-sm ml-auto text-zinc-300">{result.brand} {result.model}</span>
          )}
        </div>
      )}
    </div>
  );
}
