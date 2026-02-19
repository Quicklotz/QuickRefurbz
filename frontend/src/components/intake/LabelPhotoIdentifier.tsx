"use client";
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RotateCcw } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Loader } from '@/components/aceternity/loader';

interface Props {
  onIdentified: (data: any) => void;
}

export function LabelPhotoIdentifier({ onIdentified }: Props) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResult(null);
    analyzePhoto(file);
  };

  const analyzePhoto = async (file: File) => {
    setLoading(true);
    try {
      const data = await api.identifyFromLabelPhoto(file);
      setResult(data);
      if (data.brand || data.model || data.upc) {
        onIdentified({
          ...data,
          found: true,
          identificationMethod: 'label-photo',
        });
      }
    } catch {
      setResult({ error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setResult(null);
    fileRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-12 rounded-xl border-2 border-dashed border-border hover:border-ql-yellow transition-colors flex flex-col items-center gap-3"
        >
          <Camera size={32} className="text-zinc-500" />
          <span className="text-zinc-400">{t('identify.captureLabel')}</span>
        </button>
      ) : (
        <div className="space-y-3">
          <img src={preview} alt="Label" className="w-full max-h-48 object-contain rounded-lg border border-border" />
          {loading && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader size="sm" variant="spinner" />
              <span className="text-sm text-zinc-400">{t('identify.analyzing')}</span>
            </div>
          )}
          {result && !loading && (
            <div className="rounded-lg border border-border bg-dark-tertiary p-3 space-y-1">
              <p className="text-xs text-zinc-500">{t('identify.labelReadResult')}</p>
              {result.brand && <p className="text-sm text-white">{t('identify.brand')}: {result.brand}</p>}
              {result.model && <p className="text-sm text-white">{t('identify.model')}: {result.model}</p>}
              {result.upc && <p className="text-sm text-white font-mono">UPC: {result.upc}</p>}
              {result.serialNumber && <p className="text-sm text-white font-mono">S/N: {result.serialNumber}</p>}
              {result.confidence && (
                <p className="text-xs text-zinc-500">{t('identify.confidence')}: {result.confidence}%</p>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleRetake}>
            <RotateCcw size={14} /> {t('identify.retake')}
          </Button>
        </div>
      )}
    </div>
  );
}
