"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Barcode, Edit3, Camera, Image } from 'lucide-react';
import { BarcodeIdentifier } from './BarcodeIdentifier';
import { ManualSearchIdentifier } from './ManualSearchIdentifier';
import { LabelPhotoIdentifier } from './LabelPhotoIdentifier';
import { ProductPhotoIdentifier } from './ProductPhotoIdentifier';

interface IdentificationPanelProps {
  onIdentified: (data: any) => void;
}

const TABS = [
  { key: 'barcode', icon: Barcode, labelKey: 'identify.barcode' },
  { key: 'manual', icon: Edit3, labelKey: 'identify.manual' },
  { key: 'label-photo', icon: Camera, labelKey: 'identify.labelPhoto' },
  { key: 'product-photo', icon: Image, labelKey: 'identify.productPhoto' },
] as const;

type TabKey = typeof TABS[number]['key'];

export function IdentificationPanel({ onIdentified }: IdentificationPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('barcode');

  return (
    <div className="rounded-2xl border border-border bg-dark-card overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'text-ql-yellow border-b-2 border-ql-yellow bg-dark-tertiary'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'barcode' && <BarcodeIdentifier onIdentified={onIdentified} />}
        {activeTab === 'manual' && <ManualSearchIdentifier onIdentified={onIdentified} />}
        {activeTab === 'label-photo' && <LabelPhotoIdentifier onIdentified={onIdentified} />}
        {activeTab === 'product-photo' && <ProductPhotoIdentifier onIdentified={onIdentified} />}
      </div>
    </div>
  );
}
