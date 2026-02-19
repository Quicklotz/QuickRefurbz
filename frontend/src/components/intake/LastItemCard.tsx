"use client";
import { useTranslation } from 'react-i18next';
import { CheckCircle, Tag } from 'lucide-react';
import { Badge } from '@/components/shared/Badge';

interface LastItemCardProps {
  item: any;
  itemCount: number;
}

export function LastItemCard({ item, itemCount }: LastItemCardProps) {
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <div className="rounded-2xl border border-accent-green/30 bg-accent-green/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={16} className="text-accent-green" />
        <span className="text-sm font-medium text-accent-green">{t('review.lastItem')}</span>
        <Badge variant="default" size="sm" className="ml-auto">{t('review.itemCount')}: {itemCount}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium">{item.manufacturer || item.labelData?.manufacturer} {item.model || item.labelData?.model}</p>
          <p className="text-sm text-zinc-500 font-mono">{item.qlid || item.item?.qlid || item.labelData?.qlid}</p>
        </div>
        <Tag size={16} className="text-ql-yellow" />
      </div>
    </div>
  );
}
