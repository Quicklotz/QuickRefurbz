"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Package, Printer, Check, AlertTriangle, ArrowRight,
  Barcode, Edit3, Camera, Image, RotateCcw, X, ChevronDown,
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Loader } from '@/components/aceternity/loader';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | 'scan-pallet'      // 1. Scan supplier pallet ID
  | 'scan-order'       // 2. Fallback: enter order/shipment ID
  | 'select-pallet'    // 2b. Pick pallet from order results
  | 'confirm-start'    // 3. Show pallet info, confirm to begin
  | 'working'          // 4. Main loop: QLID generated, identify product
  | 'review';          // 5. Review identified data, save

const CATEGORIES = [
  'PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'MONITOR', 'TV',
  'APPLIANCE_SMALL', 'APPLIANCE_LARGE', 'ICE_MAKER', 'VACUUM',
  'AUDIO', 'GAMING', 'WEARABLE', 'OTHER',
];

type IdMethod = 'barcode' | 'manual' | 'label-photo' | 'product-photo';

// ─── Component ───────────────────────────────────────────────────────────────

export function Intake() {
  const [step, setStep] = useState<Step>('scan-pallet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pallet lookup
  const [palletInput, setPalletInput] = useState('');
  const [orderInput, setOrderInput] = useState('');
  const [orderPallets, setOrderPallets] = useState<any[]>([]);
  const [sourcingPallet, setSourcingPallet] = useState<any>(null);

  // Active pallet session
  const [activePallet, setActivePallet] = useState<any>(null);
  const [itemCount, setItemCount] = useState(0);

  // Current QLID (pre-generated for the next item)
  const [currentQlid, setCurrentQlid] = useState<string | null>(null);
  const [qlidPrinted, setQlidPrinted] = useState(false);

  // Identification
  const [idMethod, setIdMethod] = useState<IdMethod>('barcode');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [identifiedData, setIdentifiedData] = useState<any>(null);

  // Review fields
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [upc, setUpc] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [msrp, setMsrp] = useState(0);

  // Last saved item
  const [lastItem, setLastItem] = useState<any>(null);

  // Printer IP and auto-print toggle
  const [printerIp, setPrinterIp] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState(true);

  const palletInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load saved printer + auto-print preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('qr_printer_ip');
    if (saved) setPrinterIp(saved);
    const ap = localStorage.getItem('qr_auto_print');
    if (ap !== null) setAutoPrint(ap === 'true');
  }, []);

  const toggleAutoPrint = () => {
    setAutoPrint(prev => {
      localStorage.setItem('qr_auto_print', String(!prev));
      return !prev;
    });
  };

  // Auto-focus inputs based on step
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'scan-pallet') palletInputRef.current?.focus();
      if (step === 'scan-order') orderInputRef.current?.focus();
      if (step === 'working' && idMethod === 'barcode') barcodeInputRef.current?.focus();
      if (step === 'working' && idMethod === 'manual') searchInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [step, idMethod]);

  // ── Step 1: Scan Supplier Pallet ID ──────────────────────────────────────

  const handlePalletScan = async () => {
    const id = palletInput.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.lookupSourcingPallet(id);
      setSourcingPallet(result.pallet);
      setStep('confirm-start');
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setError(null);
        setStep('scan-order');
      } else {
        setError('Could not connect to sourcing database. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Enter Order/Shipment ID ──────────────────────────────────────

  const handleOrderScan = async () => {
    const id = orderInput.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.lookupSourcingOrder(id);
      if (result.pallets?.length === 1) {
        setSourcingPallet(result.pallets[0]);
        setStep('confirm-start');
      } else if (result.pallets?.length > 1) {
        setOrderPallets(result.pallets);
        setStep('select-pallet');
      } else {
        setError('No pallets found for this order. Check the ID and try again.');
      }
    } catch {
      setError('Order not found in sourcing database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPallet = (pallet: any) => {
    setSourcingPallet(pallet);
    setStep('confirm-start');
  };

  // ── Step 3: Create pallet + auto-print label ─────────────────────────────

  const handleConfirmStart = async () => {
    if (!sourcingPallet) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.createPalletFromSourcing({
        sourcingPalletId: sourcingPallet.palletId || sourcingPallet.pallet_id,
        sourcingOrderId: sourcingPallet.orderId || sourcingPallet.order_id,
      });
      const pallet = result.pallet;
      setActivePallet(pallet);
      setItemCount(0);

      // Auto-print pallet label if auto-print is on
      if (autoPrint) {
        try {
          await api.printZplLabel(printerIp || 'browser', pallet.palletId, '4x6');
        } catch {
          // Non-critical - label can be reprinted
        }
      }

      // Pre-generate first QLID
      await generateNextQlid(pallet.palletId);
      setStep('working');
    } catch (err: any) {
      setError(err.message || 'Failed to create pallet');
    } finally {
      setLoading(false);
    }
  };

  // ── QLID Generation ──────────────────────────────────────────────────────

  const generateNextQlid = async (palletId?: string) => {
    try {
      const pid = palletId || activePallet?.palletId;
      if (!pid) throw new Error('No active pallet');
      const reserved = await api.reserveQlid(pid);
      setCurrentQlid(reserved.qlid);
      setQlidPrinted(false);

      // Auto-print QLID label on 1x3" if enabled
      if (autoPrint) {
        try {
          await api.printRefurbLabel(printerIp || 'browser', reserved.qlid, '1x3');
          setQlidPrinted(true);
        } catch {
          // Non-critical - can reprint
        }
      }
    } catch (err: any) {
      setError('Failed to generate QLID: ' + (err.message || ''));
    }
  };

  // ── Product Identification ───────────────────────────────────────────────

  const handleBarcodeScan = async () => {
    const code = barcodeInput.trim();
    if (!code || code.length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.identifyByBarcode(code);
      // Always proceed to review with whatever data we got — barcode is always saved
      populateReview({
        ...(data.found ? data : {}),
        upc: code,
        identificationMethod: 'barcode',
      });
    } catch {
      // Even if lookup fails, still proceed with the barcode saved as UPC
      populateReview({
        upc: code,
        identificationMethod: 'barcode',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    const q = searchInput.trim();
    if (!q || q.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.identifyBySearch(q);
      if (data.results?.length > 0) {
        setSearchResults(data.results);
      } else if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        setError('No results found. Try different keywords.');
      }
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    populateReview({
      ...result,
      identificationMethod: 'manual',
    });
    setSearchResults([]);
  };

  const handlePhotoIdentify = async (file: File, method: 'label-photo' | 'product-photo') => {
    setLoading(true);
    setError(null);
    try {
      const data = method === 'label-photo'
        ? await api.identifyFromLabelPhoto(file)
        : await api.identifyFromProductPhoto(file);
      if (data.brand || data.model) {
        populateReview({
          ...data,
          identificationMethod: method,
        });
      } else {
        setError('Could not identify product from photo. Try another method.');
      }
    } catch {
      setError('Photo identification failed.');
    } finally {
      setLoading(false);
    }
  };

  const populateReview = (data: any) => {
    setBrand(data.brand || data.manufacturer || '');
    setModel(data.model || data.modelNumber || '');
    setCategory(data.category || 'OTHER');
    setUpc(data.upc || '');
    setSerialNumber(data.serialNumber || '');
    setMsrp(data.msrp || data.regularPrice || data.price || 0);
    setIdentifiedData(data);
    setStep('review');
  };

  const handleSkipIdentification = () => {
    // Go to review with empty data - user will fill manually
    setBrand('');
    setModel('');
    setCategory('OTHER');
    setUpc('');
    setSerialNumber('');
    setMsrp(0);
    setIdentifiedData({ identificationMethod: 'manual' });
    setStep('review');
  };

  // ── Save Item ────────────────────────────────────────────────────────────

  const handleSaveItem = async () => {
    if (!currentQlid || !activePallet) return;
    setLoading(true);
    setError(null);
    try {
      // Update the reserved QLID with actual product data
      const updated = await api.updateItemByQlid(currentQlid, {
        manufacturer: brand || 'Unknown',
        model: model || 'Unknown',
        category,
        upc: upc || undefined,
        serialNumber: serialNumber || undefined,
        msrp: msrp || undefined,
        manifestMatch: identifiedData?.source === 'manifest' || identifiedData?.source === 'bestbuy',
        identificationMethod: identifiedData?.identificationMethod || 'manual',
      });

      setLastItem(updated);
      setItemCount(c => c + 1);

      // Reset and generate next QLID
      resetIdentification();
      await generateNextQlid();
      setStep('working');
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const resetIdentification = () => {
    setBarcodeInput('');
    setSearchInput('');
    setSearchResults([]);
    setIdentifiedData(null);
    setBrand('');
    setModel('');
    setCategory('OTHER');
    setUpc('');
    setSerialNumber('');
    setMsrp(0);
    setError(null);
  };

  // ── End Session ──────────────────────────────────────────────────────────

  const handleEndSession = () => {
    setActivePallet(null);
    setCurrentQlid(null);
    setLastItem(null);
    setItemCount(0);
    setPalletInput('');
    setOrderInput('');
    setSourcingPallet(null);
    setOrderPallets([]);
    resetIdentification();
    setStep('scan-pallet');
  };

  const handleReprintPalletLabel = async () => {
    if (!activePallet) return;
    try {
      await api.printZplLabel(printerIp || 'browser', activePallet.palletId, '4x6');
    } catch (err: any) {
      setError(err.message || 'Failed to print pallet label');
    }
  };

  const handleReprintQlidLabel = async () => {
    if (!currentQlid) return;
    try {
      await api.printRefurbLabel(printerIp || 'browser', currentQlid, '1x3');
      setQlidPrinted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to print QLID label');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Active session header */}
      {activePallet && (
        <div className="mb-6 flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono text-lg font-bold text-[#d4a800]">{activePallet.palletId}</span>
            <span className="text-zinc-500 text-sm">|</span>
            <span className="text-zinc-400 text-sm">{itemCount} items</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-print toggle — always visible */}
            <button
              onClick={toggleAutoPrint}
              className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                autoPrint
                  ? 'text-green-400 border-green-800 bg-green-500/10 hover:bg-green-500/20'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600'
              }`}
              title={autoPrint ? 'Auto-print ON' : 'Auto-print OFF'}
            >
              <Printer size={12} />
              {autoPrint ? 'Auto-Print ON' : 'Auto-Print OFF'}
            </button>
            {/* Print Label button — always visible when QLID exists */}
            {currentQlid && (
              <button
                onClick={handleReprintQlidLabel}
                className="text-xs text-[#d4a800] hover:text-white px-2 py-1 rounded border border-[#d4a800]/40 hover:border-[#d4a800] bg-[#d4a800]/10 hover:bg-[#d4a800]/20 transition-colors flex items-center gap-1"
                title={`Print label for ${currentQlid}`}
              >
                <Printer size={12} />
                Print Label
              </button>
            )}
            <button onClick={handleEndSession} className="text-xs text-zinc-500 hover:text-red-400 px-3 py-1 rounded border border-zinc-800 hover:border-red-800 transition-colors">
              End Session
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400"><X size={14} /></button>
        </div>
      )}

      {/* ── STEP 1: Scan Supplier Pallet ID ─────────────────────────────── */}
      {step === 'scan-pallet' && (
        <Card>
          <h2 className="text-xl font-semibold text-white mb-1">Scan Pallet</h2>
          <p className="text-sm text-zinc-500 mb-6">Scan or type the supplier pallet ID (e.g. PTRF67589)</p>
          <div className="flex gap-3">
            <Input
              ref={palletInputRef}
              value={palletInput}
              onChange={e => setPalletInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handlePalletScan()}
              placeholder="PTRF00000"
              className="font-mono text-lg flex-1"
              autoFocus
            />
            <Button variant="primary" onClick={handlePalletScan} loading={loading}>
              <Search size={18} />
              Lookup
            </Button>
          </div>
          <p className="text-xs text-zinc-600 mt-4">
            Pallet not found? You'll be prompted to enter an Order ID next.
          </p>

          {/* Printer config */}
          <div className="mt-6 pt-4 border-t border-zinc-800">
            {(window as any).electronAPI?.sendZpl ? (
              /* Electron: need IP address for raw TCP printing */
              <>
                <div className="flex items-center gap-2">
                  <Printer size={14} className="text-zinc-600" />
                  <Input
                    value={printerIp}
                    onChange={e => {
                      setPrinterIp(e.target.value);
                      localStorage.setItem('qr_printer_ip', e.target.value);
                    }}
                    placeholder="Zebra Printer IP (e.g. 192.168.1.100)"
                    className="text-sm flex-1 font-mono"
                  />
                  <button
                    onClick={async () => {
                      if (!printerIp) { setError('Enter printer IP first'); return; }
                      setError(null);
                      try {
                        await (window as any).electronAPI.sendZpl(printerIp, '^XA^FO50,50^A0N,40,40^FDQuickRefurbz Test^FS^XZ');
                        setError(null);
                        alert('Test label sent! Check your printer.');
                      } catch (err: any) {
                        setError(`Printer not reachable at ${printerIp}:9100 — ${err.message || err}`);
                      }
                    }}
                    className="text-xs text-[#d4a800] hover:text-white px-3 py-2 rounded border border-[#d4a800]/40 hover:border-[#d4a800] bg-[#d4a800]/10 transition-colors whitespace-nowrap"
                  >
                    Test Print
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600 mt-1 ml-7">
                  Enter your Zebra printer's IP address. Sends ZPL directly via TCP port 9100.
                </p>
              </>
            ) : (
              /* Browser: use system print dialog */
              <button
                onClick={() => {
                  const next = printerIp ? '' : 'enabled';
                  setPrinterIp(next);
                  localStorage.setItem('qr_printer_ip', next);
                }}
                className={`flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg border transition-colors ${
                  printerIp
                    ? 'border-green-800 bg-green-500/10 text-green-400'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
              >
                <Printer size={16} />
                <span className="text-sm font-medium">{printerIp ? 'Label Printing ON' : 'Label Printing OFF'}</span>
                <span className={`ml-auto text-xs ${printerIp ? 'text-green-500' : 'text-zinc-600'}`}>
                  {printerIp ? 'Tap to disable' : 'Tap to enable'}
                </span>
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── STEP 2: Enter Order/Shipment ID ─────────────────────────────── */}
      {step === 'scan-order' && (
        <Card>
          <h2 className="text-xl font-semibold text-white mb-1">Pallet Not Found</h2>
          <p className="text-sm text-zinc-500 mb-6">Enter the Order ID or Shipment ID to find pallets</p>
          <div className="flex gap-3">
            <Input
              ref={orderInputRef}
              value={orderInput}
              onChange={e => setOrderInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleOrderScan()}
              placeholder="Order or Shipment ID"
              className="font-mono text-lg flex-1"
              autoFocus
            />
            <Button variant="primary" onClick={handleOrderScan} loading={loading}>
              <Search size={18} />
              Lookup
            </Button>
          </div>
          <button onClick={() => { setError(null); setStep('scan-pallet'); }} className="text-sm text-zinc-500 hover:text-white mt-4 transition-colors">
            &larr; Back to pallet scan
          </button>
        </Card>
      )}

      {/* ── STEP 2b: Select Pallet from Order ───────────────────────────── */}
      {step === 'select-pallet' && (
        <Card>
          <h2 className="text-xl font-semibold text-white mb-1">Select Pallet</h2>
          <p className="text-sm text-zinc-500 mb-4">Multiple pallets found for this order. Select one:</p>
          <div className="space-y-2">
            {orderPallets.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSelectPallet(p)}
                className="w-full text-left p-4 rounded-lg border border-zinc-800 hover:border-[#d4a800]/50 bg-zinc-900/50 hover:bg-zinc-900 transition-all"
              >
                <span className="font-mono text-[#d4a800] font-medium">{p.palletId || p.pallet_id}</span>
                <span className="text-zinc-500 ml-3">{p.estimatedItems || p.estimated_items || '?'} items</span>
                {(p.estimatedCogs || p.estimated_cogs) && (
                  <span className="text-zinc-600 ml-2">${Number(p.estimatedCogs || p.estimated_cogs).toLocaleString()}</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => { setStep('scan-order'); setOrderPallets([]); }} className="text-sm text-zinc-500 hover:text-white mt-4 transition-colors">
            &larr; Back
          </button>
        </Card>
      )}

      {/* ── STEP 3: Confirm & Start Working ─────────────────────────────── */}
      {step === 'confirm-start' && sourcingPallet && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Check size={18} className="text-green-500" />
            <h2 className="text-xl font-semibold text-white">Pallet Found</h2>
          </div>

          <div className="rounded-lg bg-zinc-900/70 border border-zinc-800 p-4 space-y-3 mb-6">
            <Row label="Supplier Pallet" value={sourcingPallet.palletId || sourcingPallet.pallet_id} mono yellow />
            <Row label="Order ID" value={sourcingPallet.orderId || sourcingPallet.order_id} mono />
            <Row label="Est. Items" value={sourcingPallet.estimatedItems || sourcingPallet.estimated_items || '—'} />
            <Row label="Est. COGS" value={`$${Number(sourcingPallet.estimatedCogs || sourcingPallet.estimated_cogs || 0).toLocaleString()}`} />
          </div>

          <p className="text-sm text-zinc-400 mb-4">
            A unique Pallet ID will be generated and printed. Ready to begin?
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setSourcingPallet(null); setStep('scan-pallet'); }} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmStart} loading={loading} className="flex-1">
              <ArrowRight size={18} />
              Start Pallet
            </Button>
          </div>
        </Card>
      )}

      {/* ── STEP 4: Working - Identify Products ─────────────────────────── */}
      {step === 'working' && (
        <>
          {/* Last item success banner */}
          {lastItem && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <Check size={16} className="text-green-500" />
              <span className="text-sm text-green-400">
                Saved: {lastItem.manufacturer} {lastItem.model}
              </span>
              <span className="font-mono text-xs text-zinc-500 ml-auto">{lastItem.qlid}</span>
            </div>
          )}

          {/* Current QLID banner */}
          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current QLID</p>
                <p className="font-mono text-2xl font-bold text-[#d4a800]">{currentQlid || '...'}</p>
              </div>
              <div className="flex items-center gap-2">
                {qlidPrinted ? (
                  <span className="text-xs text-green-500 flex items-center gap-1"><Check size={12} /> Printed</span>
                ) : (
                  <span className="text-xs text-zinc-500">Not printed</span>
                )}
                {printerIp && (
                  <button onClick={handleReprintQlidLabel} className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
                    <Printer size={14} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Place this label on the product, then identify it below.</p>
          </Card>

          {/* Identification methods */}
          <Card>
            <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1">
              {([
                { key: 'barcode' as IdMethod, icon: Barcode, label: 'Barcode' },
                { key: 'manual' as IdMethod, icon: Edit3, label: 'Search' },
                { key: 'label-photo' as IdMethod, icon: Camera, label: 'Label' },
                { key: 'product-photo' as IdMethod, icon: Image, label: 'Photo' },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => { setIdMethod(key); setError(null); setSearchResults([]); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    idMethod === key
                      ? 'bg-[#d4a800] text-black'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Barcode scan */}
            {idMethod === 'barcode' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Input
                    ref={barcodeInputRef}
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleBarcodeScan()}
                    placeholder="Scan or type UPC/barcode"
                    className="font-mono text-lg flex-1"
                    autoFocus
                  />
                  <Button variant="primary" onClick={handleBarcodeScan} loading={loading}>
                    <Search size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* Manual search */}
            {idMethod === 'manual' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Input
                    ref={searchInputRef}
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                    placeholder="Search by brand, model, or product name"
                    className="flex-1"
                    autoFocus
                  />
                  <Button variant="primary" onClick={handleManualSearch} loading={loading}>
                    <Search size={18} />
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-800 rounded-lg">
                    {searchResults.map((r: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleSelectSearchResult(r)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors text-sm"
                      >
                        <span className="text-white">{r.brand || r.manufacturer}</span>
                        <span className="text-zinc-400 ml-2">{r.model || r.modelNumber || r.name}</span>
                        {(r.msrp || r.regularPrice) && (
                          <span className="text-green-500 ml-2">${r.msrp || r.regularPrice}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Photo identification */}
            {(idMethod === 'label-photo' || idMethod === 'product-photo') && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  {idMethod === 'label-photo'
                    ? 'Take a photo of the product label/sticker'
                    : 'Take a photo of the product itself'}
                </p>
                <label className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
                  <Camera size={24} className="text-zinc-500" />
                  <span className="text-zinc-400">Tap to take photo or select file</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoIdentify(file, idMethod);
                    }}
                  />
                </label>
                {loading && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Loader size="sm" variant="spinner" />
                    <span className="text-sm">Analyzing photo...</span>
                  </div>
                )}
              </div>
            )}

            {/* Skip identification */}
            <button onClick={handleSkipIdentification} className="text-xs text-zinc-600 hover:text-zinc-400 mt-4 transition-colors block">
              Skip identification — enter details manually &rarr;
            </button>
          </Card>
        </>
      )}

      {/* ── STEP 5: Review & Save ───────────────────────────────────────── */}
      {step === 'review' && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-1">Confirm Product Details</h2>
          <p className="text-sm text-zinc-500 mb-4">
            QLID: <span className="font-mono text-[#d4a800]">{currentQlid}</span>
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Brand</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Model</Label>
                <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Model" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-zinc-500 mb-1 block">Category</Label>
              <select
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:border-[#d4a800] focus:outline-none transition-colors"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">UPC</Label>
                <Input value={upc} onChange={e => setUpc(e.target.value)} placeholder="UPC" className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Serial #</Label>
                <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Serial" className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">MSRP ($)</Label>
                <Input type="number" min={0} step={0.01} value={msrp} onChange={e => setMsrp(parseFloat(e.target.value) || 0)} className="text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => { setStep('working'); resetIdentification(); }} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveItem} loading={loading} className="flex-1">
              <Check size={18} />
              Save & Next
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-[#0a0a0a] p-6 ${className}`}>
      {children}
    </div>
  );
}

function Row({ label, value, mono, yellow }: { label: string; value: any; mono?: boolean; yellow?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${yellow ? 'text-[#d4a800] font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}
