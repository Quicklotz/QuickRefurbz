"use client";
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Package, ChevronRight, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Badge } from '@/components/shared/Badge';

// Retailer-specific categories
const RETAILER_CATEGORIES: Record<string, string[]> = {
  BESTBUY: ['Phones', 'Tablets', 'Laptops', 'Desktops', 'Monitors', 'TVs', 'Small Appliances', 'Large Appliances', 'Audio', 'Cameras', 'Gaming', 'Wearables', 'Smart Home', 'Mixed Electronics'],
  TARGET: ['Electronics', 'Small Appliances', 'Home & Kitchen', 'Toys', 'Mixed'],
  AMAZON: ['Electronics', 'Home & Kitchen', 'Tools', 'Mixed Returns'],
  COSTCO: ['Electronics', 'Appliances', 'Mixed Wholesale'],
  WALMART: ['Electronics', 'Small Appliances', 'Home', 'Mixed'],
  HOME_DEPOT: ['Power Tools', 'Hand Tools', 'Electrical', 'Plumbing', 'Mixed'],
  LOWES: ['Power Tools', 'Hand Tools', 'Electrical', 'Plumbing', 'Mixed'],
  OTHER: ['Electronics', 'Appliances', 'Mixed'],
};

type Step = 'scan-pallet' | 'scan-order' | 'manual' | 'preview' | 'created';

interface SourcingPalletFlowProps {
  onPalletCreated: (pallet: any) => void;
  onCancel: () => void;
}

export function SourcingPalletFlow({ onPalletCreated, onCancel }: SourcingPalletFlowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [step, setStep] = useState<Step>('scan-pallet');
  const [palletInput, setPalletInput] = useState('');
  const [orderInput, setOrderInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcingData, setSourcingData] = useState<any>(null);
  const [selectedPallet, setSelectedPallet] = useState<any>(null);
  const [orderPallets, setOrderPallets] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [manualRetailer, setManualRetailer] = useState('BESTBUY');
  const [manualCategory, setManualCategory] = useState('Mixed Electronics');
  const [manualExpected, setManualExpected] = useState(0);
  const [manualCogs, setManualCogs] = useState(0);

  // Creating state
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Auto-focus input on step change
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [step]);

  const handlePalletScan = async () => {
    if (!palletInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.lookupSourcingPallet(palletInput.trim());
      setSourcingData(result);
      setSelectedPallet(result.pallet);
      setStep('preview');
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setError(null);
        setStep('scan-order');
      } else {
        setError(err.message || t('errors.connectionFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOrderScan = async () => {
    if (!orderInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.lookupSourcingOrder(orderInput.trim());
      if (result.pallets && result.pallets.length > 0) {
        setOrderPallets(result.pallets);
        if (result.pallets.length === 1) {
          setSelectedPallet(result.pallets[0]);
          setStep('preview');
        }
        // If multiple pallets, show selection (handled in render)
      } else {
        setStep('manual');
      }
    } catch {
      setStep('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromSourcing = async () => {
    if (!selectedPallet) return;
    setCreating(true);
    setError(null);
    try {
      const result = await api.createPalletFromSourcing({
        sourcingPalletId: selectedPallet.palletId || selectedPallet.pallet_id,
        sourcingOrderId: selectedPallet.orderId || selectedPallet.order_id,
      });
      setStep('created');
      onPalletCreated(result);
    } catch (err: any) {
      setError(err.message || t('errors.palletCreationFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleManualCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const pallet = await api.createPallet({
        retailer: manualRetailer,
        liquidationSource: 'TECH_LIQUIDATORS',
        totalCogs: manualCogs,
        expectedItems: manualExpected,
        category: manualCategory,
      });
      setStep('created');
      onPalletCreated(pallet);
    } catch (err: any) {
      setError(err.message || t('errors.palletCreationFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // Step indicator
  const stepNum = step === 'scan-pallet' ? 1 : step === 'scan-order' ? 2 : step === 'manual' ? 3 : step === 'preview' ? 2 : 3;

  return (
    <div className="rounded-2xl border border-border bg-dark-card overflow-hidden">
      {/* Header with step indicator */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t('palletScan.title')}</h2>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                n === stepNum ? 'bg-ql-yellow text-black' :
                n < stepNum ? 'bg-accent-green text-white' :
                'bg-dark-tertiary text-zinc-500'
              }`}>
                {n < stepNum ? <Check size={14} /> : n}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Step 1: Scan Pallet ID */}
        {step === 'scan-pallet' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium">{t('palletScan.step1Title')}</h3>
              <p className="text-sm text-zinc-500 mt-1">{t('palletScan.step1Desc')}</p>
            </div>
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={palletInput}
                onChange={(e) => setPalletInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleKeyDown(e, handlePalletScan)}
                placeholder={t('palletScan.step1Placeholder')}
                className="font-mono flex-1"
                autoFocus
              />
              <Button variant="primary" onClick={handlePalletScan} loading={loading}>
                <Search size={18} />
                {t('common.search')}
              </Button>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setStep('manual')}>
                {t('palletScan.manualEntry')} <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Order/Shipment ID */}
        {step === 'scan-order' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium">{t('palletScan.step2Title')}</h3>
              <p className="text-sm text-zinc-500 mt-1">{t('palletScan.step2Desc')}</p>
            </div>
            {orderPallets.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">{t('palletScan.selectPallet')}</p>
                {orderPallets.map((p: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPallet(p); setStep('preview'); }}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-ql-yellow transition-colors"
                  >
                    <span className="font-mono text-ql-yellow">{p.palletId || p.pallet_id}</span>
                    <span className="text-zinc-500 ml-2">— {p.estimatedItems || p.estimated_items} items</span>
                  </button>
                ))}
              </div>
            )}
            {orderPallets.length <= 1 && (
              <div className="flex gap-3">
                <Input
                  ref={inputRef}
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => handleKeyDown(e, handleOrderScan)}
                  placeholder={t('palletScan.step2Placeholder')}
                  className="font-mono flex-1"
                  autoFocus
                />
                <Button variant="primary" onClick={handleOrderScan} loading={loading}>
                  <Search size={18} />
                  {t('common.search')}
                </Button>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('scan-pallet')}>
                <ArrowLeft size={14} /> {t('common.back')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep('manual')}>
                {t('palletScan.manualEntry')} <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Manual Entry */}
        {step === 'manual' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium">{t('palletScan.step3Title')}</h3>
              <p className="text-sm text-zinc-500 mt-1">{t('palletScan.step3Desc')}</p>
            </div>
            <div>
              <Label>{t('palletScan.retailer')}</Label>
              <select
                className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none focus:ring-[2px] focus:ring-ql-yellow transition duration-400"
                value={manualRetailer}
                onChange={(e) => {
                  setManualRetailer(e.target.value);
                  const cats = RETAILER_CATEGORIES[e.target.value] || RETAILER_CATEGORIES.OTHER;
                  setManualCategory(cats[cats.length - 1]);
                }}
              >
                {Object.keys(RETAILER_CATEGORIES).map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('palletScan.category')}</Label>
              <select
                className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none focus:ring-[2px] focus:ring-ql-yellow transition duration-400"
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
              >
                {(RETAILER_CATEGORIES[manualRetailer] || RETAILER_CATEGORIES.OTHER).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('palletScan.expectedItems')}</Label>
                <Input type="number" min={0} value={manualExpected} onChange={(e) => setManualExpected(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('palletScan.totalCogs')} ($)</Label>
                <Input type="number" min={0} step={0.01} value={manualCogs} onChange={(e) => setManualCogs(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('scan-pallet')}>
                <ArrowLeft size={14} /> {t('common.back')}
              </Button>
              <Button variant="primary" onClick={handleManualCreate} loading={creating}>
                <Package size={18} />
                {t('palletScan.createPallet')}
              </Button>
            </div>
          </div>
        )}

        {/* Preview (from sourcing lookup) */}
        {step === 'preview' && selectedPallet && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-accent-green" />
              <h3 className="text-white font-medium">{t('palletScan.palletFound')}</h3>
            </div>
            <div className="rounded-lg border border-border bg-dark-tertiary p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">{t('palletScan.palletId')}</span>
                <span className="font-mono text-ql-yellow">{selectedPallet.palletId || selectedPallet.pallet_id}</span>
              </div>
              {(selectedPallet.orderId || selectedPallet.order_id) && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Order ID</span>
                  <span className="font-mono text-zinc-300">{selectedPallet.orderId || selectedPallet.order_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">{t('palletScan.estimatedItems')}</span>
                <span className="text-white">{selectedPallet.estimatedItems || selectedPallet.estimated_items || '—'}</span>
              </div>
              {isAdmin && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t('palletScan.estimatedCogs')}</span>
                  <span className="text-white">${(selectedPallet.estimatedCogs || selectedPallet.estimated_cogs || 0).toLocaleString()}</span>
                </div>
              )}
              {selectedPallet.retailer && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t('palletScan.retailer')}</span>
                  <Badge variant="info" size="sm">{selectedPallet.retailer}</Badge>
                </div>
              )}
            </div>
            {sourcingData?.lineItems?.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-zinc-400 mb-2">Line Items ({sourcingData.lineItems.length})</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {sourcingData.lineItems.slice(0, 10).map((li: any, i: number) => (
                    <p key={i} className="text-xs text-zinc-500 truncate">
                      {li.brand && <span className="text-zinc-300">{li.brand}</span>} {li.title}
                    </p>
                  ))}
                  {sourcingData.lineItems.length > 10 && (
                    <p className="text-xs text-zinc-600">+{sourcingData.lineItems.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('scan-pallet')}>
                <ArrowLeft size={14} /> {t('common.back')}
              </Button>
              <Button variant="primary" onClick={handleCreateFromSourcing} loading={creating}>
                <Check size={18} />
                {t('palletScan.confirmAndCreate')}
              </Button>
            </div>
          </div>
        )}

        {/* Created */}
        {step === 'created' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent-green/20 flex items-center justify-center mx-auto">
              <Check size={32} className="text-accent-green" />
            </div>
            <h3 className="text-white font-medium text-lg">{t('palletScan.palletCreated')}</h3>
          </div>
        )}
      </div>
    </div>
  );
}
