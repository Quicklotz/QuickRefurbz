"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Edit3 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Badge } from '@/components/shared/Badge';

const CATEGORIES = [
  'PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'MONITOR', 'TV',
  'APPLIANCE_SMALL', 'APPLIANCE_LARGE', 'ICE_MAKER', 'VACUUM',
  'AUDIO', 'GAMING', 'WEARABLE', 'OTHER',
];

interface ReviewConfirmCardProps {
  data: any;
  palletId: string;
  workstationId: string;
  onSaved: (item: any) => void;
  onCancel: () => void;
}

export function ReviewConfirmCard({ data, palletId, workstationId, onSaved, onCancel }: ReviewConfirmCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brand, setBrand] = useState(data.brand || '');
  const [model, setModel] = useState(data.model || '');
  const [category, setCategory] = useState(data.category || 'OTHER');
  const [upc, setUpc] = useState(data.upc || '');
  const [serialNumber, setSerialNumber] = useState(data.serialNumber || '');
  const [msrp, setMsrp] = useState(data.msrp || 0);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.createItem({
        palletId,
        manufacturer: brand || 'Unknown',
        model: model || 'Unknown',
        category: category,
        upc: upc || undefined,
        serialNumber: serialNumber || undefined,
        workstationId,
        msrp: msrp || undefined,
        manifestMatch: data.source === 'manifest' || data.source === 'bestbuy',
        identificationMethod: data.identificationMethod || 'manual',
      });
      onSaved(result);
    } catch (err: any) {
      setError(err.message || t('errors.itemSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-dark-card overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">{t('review.title')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{t('review.subtitle')}</p>
        </div>
        <button onClick={() => setEditing(!editing)} className="text-zinc-400 hover:text-white transition-colors">
          <Edit3 size={16} />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
            {error}
          </div>
        )}

        {data.identificationMethod && (
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">{t('review.identifiedVia')}: {data.identificationMethod}</Badge>
            {data.confidence && <Badge variant="default" size="sm">{data.confidence}%</Badge>}
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('identify.brand')}</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div>
                <Label>{t('identify.model')}</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t('review.category')}</Label>
              <select
                className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none focus:ring-[2px] focus:ring-ql-yellow transition duration-400"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>UPC</Label>
                <Input value={upc} onChange={(e) => setUpc(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label>{t('identify.serialNumber')}</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label>MSRP ($)</Label>
                <Input type="number" min={0} step={0.01} value={msrp} onChange={(e) => setMsrp(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-dark-tertiary p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('identify.brand')}</span>
              <span className="text-white font-medium">{brand || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('identify.model')}</span>
              <span className="text-white">{model || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('review.category')}</span>
              <span className="text-white">{category.replace(/_/g, ' ')}</span>
            </div>
            {upc && (
              <div className="flex justify-between">
                <span className="text-zinc-500">UPC</span>
                <span className="text-white font-mono text-sm">{upc}</span>
              </div>
            )}
            {msrp > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">MSRP</span>
                <span className="text-accent-green">${msrp.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} className="flex-1">
            <Printer size={18} />
            {t('review.saveAndPrint')}
          </Button>
        </div>
      </div>
    </div>
  );
}
