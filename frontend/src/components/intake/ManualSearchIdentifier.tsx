"use client";
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { api } from '@/api/client';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Loader } from '@/components/aceternity/loader';

interface Props {
  onIdentified: (data: any) => void;
}

export function ManualSearchIdentifier({ onIdentified }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.identifyBySearch(q);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSelect = (item: any) => {
    onIdentified({
      ...item,
      identificationMethod: 'manual',
    });
    setResults([]);
    setQuery('');
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('identify.manualSearch')}</Label>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t('identify.manualPlaceholder')}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
        </div>
      </div>
      {loading && <Loader size="sm" variant="dots" />}
      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 hover:bg-dark-tertiary transition-colors"
            >
              <p className="text-white text-sm">{r.brand} {r.model || r.title}</p>
              {r.msrp && <p className="text-xs text-zinc-500">MSRP: ${r.msrp} | {r.category}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
