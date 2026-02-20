"use client";
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Printer, Check, AlertTriangle, ArrowRight,
  Barcode, Edit3, Camera, Image, X,
  CheckCircle, XCircle, MinusCircle, ChevronRight, ClipboardList,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Loader } from '@/components/aceternity/loader';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | 'scan-pallet'      // 1. Scan supplier pallet ID
  | 'scan-order'       // 1b. Fallback: enter order/shipment ID
  | 'select-pallet'    // 1c. Pick pallet from order results
  | 'confirm-start'    // 2. Show pallet info, confirm to begin
  | 'working'          // 3. QLID printed, identify product
  | 'review'           // 4. Review identified data
  | 'grading'          // 5. Assign condition grade
  | 'refurbish';       // 6. Category-specific refurb checklist

const CATEGORIES = [
  'PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'MONITOR', 'TV',
  'APPLIANCE_SMALL', 'APPLIANCE_LARGE', 'ICE_MAKER', 'VACUUM',
  'AUDIO', 'GAMING', 'WEARABLE', 'OTHER',
];

type IdMethod = 'barcode' | 'manual' | 'label-photo' | 'product-photo';

const CONDITION_GRADES = [
  {
    value: 'NEW',
    label: 'New',
    letter: 'S',
    color: 'emerald',
    description: 'Unused, unopened, pristine with original, intact packaging and manufacturer warranty.',
  },
  {
    value: 'A',
    label: 'Like New / Open Box',
    letter: 'A',
    color: 'green',
    description: 'Perfect working condition with no signs of wear. Packaging might be damaged or missing.',
  },
  {
    value: 'B',
    label: 'Very Good',
    letter: 'B',
    color: 'blue',
    description: 'Minimal, limited signs of wear, fully functional, and well-maintained.',
  },
  {
    value: 'C',
    label: 'Good',
    letter: 'C',
    color: 'yellow',
    description: 'Noticeable wear from regular use, good working condition. May have minor functional damage or missing accessories.',
  },
  {
    value: 'D',
    label: 'Acceptable',
    letter: 'D',
    color: 'orange',
    description: 'Significant wear including scratches, dents, or missing non-essential parts, but still fully functional.',
  },
  {
    value: 'SALVAGE',
    label: 'Salvage',
    letter: 'E',
    color: 'red',
    description: 'Non-functional or missing essential parts. For parts harvesting or recycling only.',
  },
] as const;

// ─── Refurbishment Checklists (category-specific) ────────────────────────────

type CheckResult = 'PASS' | 'FAIL' | 'N/A' | null;

interface RefurbCheckItem {
  code: string;
  name: string;
  group: string;
}

interface RefurbCheckResult {
  code: string;
  name: string;
  group: string;
  result: CheckResult;
  notes: string;
}

// Categories that have refurb checklists
const REFURB_CATEGORIES = ['VACUUM', 'APPLIANCE_SMALL', 'ICE_MAKER'] as const;
type RefurbCategory = typeof REFURB_CATEGORIES[number];

const REFURB_CATEGORY_DISPLAY: Record<RefurbCategory, string> = {
  VACUUM: 'Vacuum',
  APPLIANCE_SMALL: 'Small Appliance',
  ICE_MAKER: 'Ice Maker',
};

const REFURB_CHECKLISTS: Record<RefurbCategory, RefurbCheckItem[]> = {
  VACUUM: [
    // External Inspection
    { code: 'EXT_BODY', name: 'Body/Housing Condition', group: 'External Inspection' },
    { code: 'EXT_CORD', name: 'Power Cord Integrity', group: 'External Inspection' },
    { code: 'EXT_WHEELS', name: 'Wheels/Casters', group: 'External Inspection' },
    { code: 'EXT_HANDLE', name: 'Handle/Grip', group: 'External Inspection' },
    // Power Test
    { code: 'PWR_ON', name: 'Powers On', group: 'Power Test' },
    { code: 'PWR_SUCTION', name: 'Suction Works', group: 'Power Test' },
    { code: 'PWR_MOTOR', name: 'Motor Sounds Normal', group: 'Power Test' },
    // Components
    { code: 'CMP_FILTER', name: 'Filter Present & Clean', group: 'Components' },
    { code: 'CMP_BELT', name: 'Belt Condition', group: 'Components' },
    { code: 'CMP_BRUSH', name: 'Brush Roll', group: 'Components' },
    { code: 'CMP_BAG', name: 'Bag/Canister', group: 'Components' },
    { code: 'CMP_HOSE', name: 'Hose/Wand', group: 'Components' },
    // Attachments
    { code: 'ATT_PRESENT', name: 'All Attachments Present', group: 'Attachments' },
    { code: 'ATT_FUNCTION', name: 'Attachments Functional', group: 'Attachments' },
    // Cleaning
    { code: 'CLN_EXT', name: 'Exterior Cleaned', group: 'Cleaning' },
    { code: 'CLN_INT', name: 'Interior Cleaned/Emptied', group: 'Cleaning' },
  ],
  APPLIANCE_SMALL: [
    // External Inspection
    { code: 'EXT_BODY', name: 'Body/Housing Condition', group: 'External Inspection' },
    { code: 'EXT_CORD', name: 'Power Cord Integrity', group: 'External Inspection' },
    { code: 'EXT_CONTROLS', name: 'Controls/Buttons', group: 'External Inspection' },
    { code: 'EXT_LID', name: 'Lid/Cover', group: 'External Inspection' },
    // Power Test
    { code: 'PWR_ON', name: 'Powers On', group: 'Power Test' },
    { code: 'PWR_SETTINGS', name: 'All Settings Work', group: 'Power Test' },
    { code: 'PWR_DISPLAY', name: 'Display Works', group: 'Power Test' },
    // Function Test
    { code: 'FN_PRIMARY', name: 'Primary Function Works', group: 'Function Test' },
    { code: 'FN_TIMER', name: 'Timer Works', group: 'Function Test' },
    { code: 'FN_TEMP', name: 'Temperature Control', group: 'Function Test' },
    // Safety
    { code: 'SAF_CORD', name: 'Cord Not Frayed', group: 'Safety' },
    { code: 'SAF_WIRING', name: 'No Exposed Wiring', group: 'Safety' },
    { code: 'SAF_BASE', name: 'Base Stable', group: 'Safety' },
    // Cleaning
    { code: 'CLN_EXT', name: 'Exterior Cleaned', group: 'Cleaning' },
    { code: 'CLN_INT', name: 'Interior Cleaned/Sanitized', group: 'Cleaning' },
    { code: 'CLN_PARTS', name: 'Removable Parts Cleaned', group: 'Cleaning' },
  ],
  ICE_MAKER: [
    // External Inspection
    { code: 'EXT_BODY', name: 'Body/Housing Condition', group: 'External Inspection' },
    { code: 'EXT_CORD', name: 'Power Cord Integrity', group: 'External Inspection' },
    { code: 'EXT_RESERVOIR', name: 'Water Reservoir', group: 'External Inspection' },
    { code: 'EXT_BASKET', name: 'Ice Basket', group: 'External Inspection' },
    // Power Test
    { code: 'PWR_ON', name: 'Powers On', group: 'Power Test' },
    { code: 'PWR_COMPRESSOR', name: 'Compressor Runs', group: 'Power Test' },
    { code: 'PWR_DISPLAY', name: 'Display/Controls Work', group: 'Power Test' },
    // Function Test
    { code: 'FN_ICE', name: 'Makes Ice (expected time)', group: 'Function Test' },
    { code: 'FN_QUALITY', name: 'Ice Quality Acceptable', group: 'Function Test' },
    { code: 'FN_DRAIN', name: 'Water Drainage Works', group: 'Function Test' },
    // Components
    { code: 'CMP_PUMP', name: 'Water Pump', group: 'Components' },
    { code: 'CMP_DRAIN', name: 'Drain Plug', group: 'Components' },
    { code: 'CMP_SCOOP', name: 'Ice Scoop Present', group: 'Components' },
    // Cleaning
    { code: 'CLN_EXT', name: 'Exterior Cleaned', group: 'Cleaning' },
    { code: 'CLN_INT', name: 'Interior Sanitized', group: 'Cleaning' },
    { code: 'CLN_WATER', name: 'Water System Flushed', group: 'Cleaning' },
  ],
};

const CHECK_RESULT_STYLES: Record<string, string> = {
  PASS: 'border-green-600 bg-green-500/20 text-green-400',
  FAIL: 'border-red-600 bg-red-500/20 text-red-400',
  'N/A': 'border-zinc-600 bg-zinc-500/10 text-zinc-400',
};

const GRADE_COLORS: Record<string, string> = {
  emerald: 'border-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400',
  green: 'border-green-600 bg-green-500/10 hover:bg-green-500/20 text-green-400',
  blue: 'border-blue-600 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400',
  yellow: 'border-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400',
  orange: 'border-orange-600 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400',
  red: 'border-red-600 bg-red-500/10 hover:bg-red-500/20 text-red-400',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Intake() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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
  const [currentBarcodeValue, setCurrentBarcodeValue] = useState<string | null>(null);
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

  // Grading
  const [conditionGrade, setConditionGrade] = useState<string | null>(null);

  // Refurbishment checklist
  const [refurbCategory, setRefurbCategory] = useState<RefurbCategory | null>(null);
  const [refurbChecks, setRefurbChecks] = useState<RefurbCheckResult[]>([]);

  // Last saved item
  const [lastItem, setLastItem] = useState<any>(null);

  // Printer selection and auto-print toggle
  const [printerIp, setPrinterIp] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState(true);
  const [availablePrinters, setAvailablePrinters] = useState<Array<{ name: string; isDefault: boolean }>>([]);

  const { t } = useTranslation();

  const GROUP_I18N: Record<string, string> = {
    'External Inspection': 'refurb.group_external',
    'Power Test': 'refurb.group_power',
    'Components': 'refurb.group_components',
    'Attachments': 'refurb.group_attachments',
    'Cleaning': 'refurb.group_cleaning',
    'Function Test': 'refurb.group_function',
    'Safety': 'refurb.group_safety',
  };

  const palletInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load saved printer + auto-print preference, detect available printers
  useEffect(() => {
    const saved = localStorage.getItem('qr_printer_ip');
    if (saved) setPrinterIp(saved);
    const ap = localStorage.getItem('qr_auto_print');
    if (ap !== null) setAutoPrint(ap === 'true');

    // In Electron, fetch available printers and auto-select Zebra
    if ((window as any).electronAPI?.getPrinters) {
      (window as any).electronAPI.getPrinters().then((printers: Array<{ name: string; isDefault: boolean }>) => {
        setAvailablePrinters(printers);
        if (!saved) {
          const zebra = printers.find(p => /zebra|zp\s*4/i.test(p.name));
          if (zebra) {
            setPrinterIp(zebra.name);
            localStorage.setItem('qr_printer_ip', zebra.name);
          }
        }
      }).catch(() => {});
    }
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

      // Auto-print pallet label (4x6)
      if (autoPrint) {
        try {
          await api.printZplLabel(printerIp || 'browser', pallet.palletId, '4x6');
        } catch { /* Non-critical */ }
      }

      // Pre-generate first QLID
      await generateNextQlid(pallet.palletId);
      setStep('working');
    } catch (err: any) {
      const msg = err.message || 'Failed to create pallet';
      setError(msg);
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
      setCurrentBarcodeValue(reserved.barcodeValue);
      setQlidPrinted(false);

      // Auto-print QLID label on 1x3"
      if (autoPrint) {
        try {
          await api.printRefurbLabel(printerIp || 'browser', reserved.qlid, '1x3');
          setQlidPrinted(true);
        } catch { /* Non-critical */ }
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
      populateReview({
        ...(data.found ? data : {}),
        upc: code,
        identificationMethod: 'barcode',
      });
    } catch {
      populateReview({ upc: code, identificationMethod: 'barcode' });
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
    populateReview({ ...result, identificationMethod: 'manual' });
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
        populateReview({ ...data, identificationMethod: method });
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
    // Use repeat-mode category preference if active, otherwise use identified category
    const repeatMode = localStorage.getItem('rfb_repeat_mode') === 'true';
    const preferredCat = localStorage.getItem('rfb_preferred_category');
    setCategory(repeatMode && preferredCat ? preferredCat : (data.category || 'OTHER'));
    setUpc(data.upc || '');
    setSerialNumber(data.serialNumber || '');
    setMsrp(data.msrp || data.regularPrice || data.price || 0);
    setIdentifiedData(data);
    setStep('review');
  };

  const handleSkipIdentification = () => {
    setBrand('');
    setModel('');
    const repeatMode = localStorage.getItem('rfb_repeat_mode') === 'true';
    const preferredCat = localStorage.getItem('rfb_preferred_category');
    setCategory(repeatMode && preferredCat ? preferredCat : 'OTHER');
    setUpc('');
    setSerialNumber('');
    setMsrp(0);
    setIdentifiedData({ identificationMethod: 'manual' });
    setStep('review');
  };

  // ── Review → Grading ──────────────────────────────────────────────────────

  const handleConfirmReview = () => {
    setConditionGrade(null);
    setStep('grading');
  };

  // ── Grading → Refurbish or Save ────────────────────────────────────────────

  const handleGradeSelected = (grade: string) => {
    setConditionGrade(grade);

    // Check if this category has a refurb checklist
    const cat = category as RefurbCategory;
    if (REFURB_CHECKLISTS[cat]) {
      // Initialize checklist for this category
      setRefurbCategory(cat);
      setRefurbChecks(
        REFURB_CHECKLISTS[cat].map(item => ({
          ...item,
          result: null,
          notes: '',
        }))
      );
      setStep('refurbish');
    } else {
      // No checklist — save directly
      handleSaveItem(grade, null);
    }
  };

  // ── Refurb checklist helpers ────────────────────────────────────────────────

  const handleCheckResult = (code: string, result: CheckResult) => {
    setRefurbChecks(prev =>
      prev.map(c => c.code === code ? { ...c, result } : c)
    );
  };

  const handleCheckNotes = (code: string, notes: string) => {
    setRefurbChecks(prev =>
      prev.map(c => c.code === code ? { ...c, notes } : c)
    );
  };

  const refurbComplete = refurbChecks.length > 0 && refurbChecks.every(c => c.result !== null);

  // ── Save Item (after grading + optional refurb) ─────────────────────────────

  const handleSaveItem = async (grade: string, checklist: RefurbCheckResult[] | null) => {
    if (!currentQlid || !activePallet) return;
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        manufacturer: brand || 'Unknown',
        model: model || 'Unknown',
        category,
        upc: upc || undefined,
        serialNumber: serialNumber || undefined,
        msrp: msrp || undefined,
        manifestMatch: identifiedData?.source === 'manifest' || identifiedData?.source === 'bestbuy',
        identificationMethod: identifiedData?.identificationMethod || 'manual',
        conditionGrade: grade,
      };

      if (checklist) {
        payload.refurbChecklist = {
          category: refurbCategory,
          completedAt: new Date().toISOString(),
          checks: checklist.map(c => ({
            code: c.code,
            name: c.name,
            group: c.group,
            result: c.result,
            notes: c.notes || undefined,
          })),
        };
      }

      const updated = await api.updateItemByQlid(currentQlid, payload);

      setLastItem({ ...updated, conditionGrade: grade });
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
    setConditionGrade(null);
    setRefurbCategory(null);
    setRefurbChecks([]);
    setError(null);
  };

  // ── End Session ──────────────────────────────────────────────────────────

  const handleEndSession = () => {
    setActivePallet(null);
    setCurrentQlid(null);
    setCurrentBarcodeValue(null);
    setLastItem(null);
    setItemCount(0);
    setPalletInput('');
    setOrderInput('');
    setSourcingPallet(null);
    setOrderPallets([]);
    resetIdentification();
    setStep('scan-pallet');
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
            <span className="text-zinc-400 text-sm">{itemCount} {t('common.items')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoPrint}
              className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                autoPrint
                  ? 'text-green-400 border-green-800 bg-green-500/10 hover:bg-green-500/20'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600'
              }`}
              title={autoPrint ? t('pallet.autoPrintOn') : t('pallet.autoPrintOff')}
            >
              <Printer size={12} />
              {autoPrint ? t('pallet.autoPrintOn') : t('pallet.autoPrintOff')}
            </button>
            {currentQlid && (
              <button
                onClick={handleReprintQlidLabel}
                className="text-xs text-[#d4a800] hover:text-white px-2 py-1 rounded border border-[#d4a800]/40 hover:border-[#d4a800] bg-[#d4a800]/10 hover:bg-[#d4a800]/20 transition-colors flex items-center gap-1"
              >
                <Printer size={12} />
                {t('pallet.printLabel')}
              </button>
            )}
            <button onClick={handleEndSession} className="text-xs text-zinc-500 hover:text-red-400 px-3 py-1 rounded border border-zinc-800 hover:border-red-800 transition-colors">
              {t('pallet.endSession')}
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
          <h2 className="text-xl font-semibold text-white mb-1">{t('pallet.scanPallet')}</h2>
          <p className="text-sm text-zinc-500 mb-6">{t('pallet.scanPalletDesc')}</p>
          <div className="flex gap-3">
            <Input
              ref={palletInputRef}
              value={palletInput}
              onChange={e => setPalletInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handlePalletScan()}
              placeholder={t('palletScan.step1Placeholder')}
              className="font-mono text-lg flex-1"
              autoFocus
            />
            <Button variant="primary" onClick={handlePalletScan} loading={loading}>
              <Search size={18} />
              {t('pallet.lookup')}
            </Button>
          </div>
          <p className="text-xs text-zinc-600 mt-4">
            Pallet not found? You'll be prompted to enter an Order ID next.
          </p>

          {/* Printer config */}
          <div className="mt-6 pt-4 border-t border-zinc-800">
            {(window as any).electronAPI?.sendZpl ? (
              <>
                <div className="flex items-center gap-2">
                  <Printer size={14} className="text-zinc-600" />
                  {availablePrinters.length > 0 ? (
                    <select
                      value={printerIp}
                      onChange={e => {
                        setPrinterIp(e.target.value);
                        localStorage.setItem('qr_printer_ip', e.target.value);
                      }}
                      className="text-sm flex-1 font-mono bg-zinc-900 text-white border border-zinc-700 rounded px-2 py-2"
                    >
                      <option value="">{t('pallet.selectPrinter')}</option>
                      {availablePrinters.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name}{p.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={printerIp}
                      onChange={e => {
                        setPrinterIp(e.target.value);
                        localStorage.setItem('qr_printer_ip', e.target.value);
                      }}
                      placeholder="Printer name or IP (e.g. Zebra ZP 450-200 dpi)"
                      className="text-sm flex-1 font-mono"
                    />
                  )}
                  <button
                    onClick={async () => {
                      if (!printerIp) { setError('Select a printer first'); return; }
                      setError(null);
                      try {
                        await (window as any).electronAPI.sendZpl(printerIp, '^XA^FO50,30^A0N,30,30^FDQuickRefurbz^FS^FO50,70^A0N,25,25^FDTest Print OK^FS^XZ');
                        alert('Test label sent! Check your printer.');
                      } catch (err: any) {
                        setError(`Print failed: ${err.message || err}`);
                      }
                    }}
                    className="text-xs text-[#d4a800] hover:text-white px-3 py-2 rounded border border-[#d4a800]/40 hover:border-[#d4a800] bg-[#d4a800]/10 transition-colors whitespace-nowrap"
                  >
                    {t('pallet.testPrint')}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600 mt-1 ml-7">
                  {/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(printerIp)
                    ? t('pallet.networkPrinter')
                    : t('pallet.usbPrinter')}
                </p>
              </>
            ) : (
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
                <span className="text-sm font-medium">{printerIp ? t('pallet.labelPrintingOn') : t('pallet.labelPrintingOff')}</span>
                <span className={`ml-auto text-xs ${printerIp ? 'text-green-500' : 'text-zinc-600'}`}>
                  {printerIp ? 'Tap to disable' : 'Tap to enable'}
                </span>
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── STEP 1b: Enter Order/Shipment ID ────────────────────────────── */}
      {step === 'scan-order' && (
        <Card>
          <h2 className="text-xl font-semibold text-white mb-1">{t('pallet.palletNotFoundTitle')}</h2>
          <p className="text-sm text-zinc-500 mb-6">{t('pallet.palletNotFoundDesc')}</p>
          <div className="flex gap-3">
            <Input
              ref={orderInputRef}
              value={orderInput}
              onChange={e => setOrderInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleOrderScan()}
              placeholder={t('palletScan.step2Placeholder')}
              className="font-mono text-lg flex-1"
              autoFocus
            />
            <Button variant="primary" onClick={handleOrderScan} loading={loading}>
              <Search size={18} />
              {t('pallet.lookup')}
            </Button>
          </div>
          <button onClick={() => { setError(null); setStep('scan-pallet'); }} className="text-sm text-zinc-500 hover:text-white mt-4 transition-colors">
            &larr; {t('pallet.backToPallet')}
          </button>
        </Card>
      )}

      {/* ── STEP 1c: Select Pallet from Order ──────────────────────────── */}
      {step === 'select-pallet' && (
        <Card>
          <h2 className="text-xl font-semibold text-white mb-1">{t('pallet.selectPallet')}</h2>
          <p className="text-sm text-zinc-500 mb-4">{t('pallet.selectPalletDesc')}</p>
          <div className="space-y-2">
            {orderPallets.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSelectPallet(p)}
                className="w-full text-left p-4 rounded-lg border border-zinc-800 hover:border-[#d4a800]/50 bg-zinc-900/50 hover:bg-zinc-900 transition-all"
              >
                <span className="font-mono text-[#d4a800] font-medium">{p.palletId || p.pallet_id}</span>
                <span className="text-zinc-500 ml-3">{p.estimatedItems || p.estimated_items || '?'} {t('common.items')}</span>
                {isAdmin && (p.estimatedCogs || p.estimated_cogs) && (
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

      {/* ── STEP 2: Confirm & Start Working ──────────────────────────────── */}
      {step === 'confirm-start' && sourcingPallet && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Check size={18} className="text-green-500" />
            <h2 className="text-xl font-semibold text-white">{t('pallet.palletFound')}</h2>
          </div>

          <div className="rounded-lg bg-zinc-900/70 border border-zinc-800 p-4 space-y-3 mb-6">
            <Row label={t('pallet.supplierId')} value={sourcingPallet.palletId || sourcingPallet.pallet_id} mono yellow />
            <Row label={t('pallet.orderId')} value={sourcingPallet.orderId || sourcingPallet.order_id} mono />
            <Row label={t('pallet.estItems')} value={sourcingPallet.estimatedItems || sourcingPallet.estimated_items || '—'} />
            {isAdmin && <Row label={t('pallet.estCogs')} value={`$${Number(sourcingPallet.estimatedCogs || sourcingPallet.estimated_cogs || 0).toLocaleString()}`} />}
          </div>

          <p className="text-sm text-zinc-400 mb-4">
            {t('pallet.readyToBegin')}
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setSourcingPallet(null); setStep('scan-pallet'); }} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirmStart} loading={loading} className="flex-1">
              <ArrowRight size={18} />
              {t('pallet.startPallet')}
            </Button>
          </div>
        </Card>
      )}

      {/* ── STEP 3: Working - Identify Products ──────────────────────────── */}
      {step === 'working' && (
        <>
          {/* Last item success banner */}
          {lastItem && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <Check size={16} className="text-green-500" />
              <span className="text-sm text-green-400">
                {t('pallet.saved')}: {lastItem.manufacturer || lastItem.brand} {lastItem.model}
              </span>
              <span className="font-mono text-xs text-zinc-500 ml-auto">
                {lastItem.conditionGrade && <span className="text-zinc-400 mr-2">Grade {lastItem.conditionGrade}</span>}
                {lastItem.qlid}
              </span>
            </div>
          )}

          {/* Current QLID banner */}
          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{t('pallet.currentItem')}</p>
                <p className="font-mono text-xl font-bold text-[#d4a800]">{currentBarcodeValue || currentQlid || '...'}</p>
                {currentBarcodeValue && currentQlid && currentBarcodeValue !== currentQlid && (
                  <p className="font-mono text-xs text-zinc-500 mt-0.5">{currentQlid}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {qlidPrinted ? (
                  <span className="text-xs text-green-500 flex items-center gap-1"><Check size={12} /> {t('pallet.printed')}</span>
                ) : (
                  <span className="text-xs text-zinc-500">{t('pallet.notPrinted')}</span>
                )}
                {printerIp && (
                  <button onClick={handleReprintQlidLabel} className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
                    <Printer size={14} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">{t('pallet.placeLabel')}</p>
          </Card>

          {/* Identification methods */}
          <Card>
            <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1">
              {([
                { key: 'barcode' as IdMethod, icon: Barcode, label: t('identify.barcode') },
                { key: 'manual' as IdMethod, icon: Edit3, label: t('common.search') },
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
              <div className="flex gap-3">
                <Input
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBarcodeScan()}
                  placeholder={t('identify.scanPlaceholder')}
                  className="font-mono text-lg flex-1"
                  autoFocus
                />
                <Button variant="primary" onClick={handleBarcodeScan} loading={loading}>
                  <Search size={18} />
                </Button>
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
                    placeholder={t('identify.manualPlaceholder')}
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
              {t('pallet.skipIdentification')} &rarr;
            </button>
          </Card>
        </>
      )}

      {/* ── STEP 4: Review & Confirm ─────────────────────────────────────── */}
      {step === 'review' && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-1">{t('pallet.confirmDetails')}</h2>
          <p className="text-sm text-zinc-500 mb-4">
            <span className="font-mono text-[#d4a800]">{currentBarcodeValue || currentQlid}</span>
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">{t('identify.brand')}</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">{t('identify.model')}</Label>
                <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Model" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-zinc-500 mb-1 block">{t('review.category')}</Label>
              <select
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:border-[#d4a800] focus:outline-none transition-colors"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{t('categories.' + c)}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">{t('identify.upc')}</Label>
                <Input value={upc} onChange={e => setUpc(e.target.value)} placeholder="UPC" className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">{t('identify.serialNumber')}</Label>
                <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Serial" className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">{t('identify.msrp')} ($)</Label>
                <Input type="number" min={0} step={0.01} value={msrp} onChange={e => setMsrp(parseFloat(e.target.value) || 0)} className="text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => { setStep('working'); resetIdentification(); }} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirmReview} className="flex-1">
              <ArrowRight size={18} />
              {t('pallet.nextGrade')}
            </Button>
          </div>
        </Card>
      )}

      {/* ── STEP 5: Condition Grading ────────────────────────────────────── */}
      {step === 'grading' && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-1">{t('grading.title')}</h2>
          <p className="text-sm text-zinc-500 mb-2">
            <span className="font-mono text-[#d4a800]">{currentBarcodeValue || currentQlid}</span>
            {brand && <span className="text-zinc-400 ml-2">— {brand} {model}</span>}
          </p>
          <p className="text-xs text-zinc-600 mb-5">{t('grading.subtitle')}</p>

          <div className="space-y-2">
            {CONDITION_GRADES.map((grade) => (
              <button
                key={grade.value}
                onClick={() => handleGradeSelected(grade.value)}
                disabled={loading}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${GRADE_COLORS[grade.color]} ${
                  conditionGrade === grade.value ? 'ring-2 ring-white/30' : ''
                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black font-mono w-8 text-center">{grade.letter}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-sm">{t('grading.grade_' + grade.value, grade.label)}</span>
                    <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{t('grading.grade_' + grade.value + '_desc', grade.description)}</p>
                  </div>
                  {loading && conditionGrade === grade.value && (
                    <Loader size="sm" variant="spinner" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('review')}
            className="text-sm text-zinc-500 hover:text-white mt-4 transition-colors"
          >
            &larr; {t('grading.backToReview')}
          </button>
        </Card>
      )}

      {/* ── STEP 6: Refurbishment Checklist ──────────────────────────────── */}
      {step === 'refurbish' && refurbCategory && (
        <Card>
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList size={20} className="text-[#d4a800]" />
            <h2 className="text-lg font-semibold text-white">{t('refurb.title')}</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-1">
            <span className="font-mono text-[#d4a800]">{currentBarcodeValue || currentQlid}</span>
            {brand && <span className="text-zinc-400 ml-2">— {brand} {model}</span>}
          </p>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs px-2 py-0.5 rounded bg-[#d4a800]/20 text-[#d4a800] font-medium">
              {t('refurb.category_' + refurbCategory, REFURB_CATEGORY_DISPLAY[refurbCategory])}
            </span>
            <span className="text-xs text-zinc-600">
              {refurbChecks.filter(c => c.result !== null).length} / {refurbChecks.length} {t('refurb.completed')}
            </span>
            {conditionGrade && (
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                Grade {conditionGrade}
              </span>
            )}
          </div>

          {/* Checklist grouped by section */}
          <div className="space-y-4">
            {(() => {
              const groups: string[] = [];
              refurbChecks.forEach(c => {
                if (!groups.includes(c.group)) groups.push(c.group);
              });
              return groups.map(group => (
                <div key={group}>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ChevronRight size={12} />
                    {t(GROUP_I18N[group] || group)}
                    <span className="text-zinc-600 font-normal">
                      ({refurbChecks.filter(c => c.group === group && c.result !== null).length}/
                      {refurbChecks.filter(c => c.group === group).length})
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {refurbChecks
                      .filter(c => c.group === group)
                      .map(check => (
                        <div
                          key={check.code}
                          className={`rounded-lg border p-3 transition-all ${
                            check.result
                              ? CHECK_RESULT_STYLES[check.result]
                              : 'border-zinc-800 bg-zinc-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm flex-1 font-medium">{t('refurb.check_' + check.code, check.name)}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleCheckResult(check.code, 'PASS')}
                                className={`p-1.5 rounded-md transition-all ${
                                  check.result === 'PASS'
                                    ? 'bg-green-500 text-black'
                                    : 'text-zinc-600 hover:text-green-400 hover:bg-green-500/10'
                                }`}
                                title={t('refurb.pass')}
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleCheckResult(check.code, 'FAIL')}
                                className={`p-1.5 rounded-md transition-all ${
                                  check.result === 'FAIL'
                                    ? 'bg-red-500 text-black'
                                    : 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'
                                }`}
                                title={t('refurb.fail')}
                              >
                                <XCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleCheckResult(check.code, 'N/A')}
                                className={`p-1.5 rounded-md transition-all ${
                                  check.result === 'N/A'
                                    ? 'bg-zinc-500 text-black'
                                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-500/10'
                                }`}
                                title={t('refurb.na')}
                              >
                                <MinusCircle size={18} />
                              </button>
                            </div>
                          </div>
                          {check.result === 'FAIL' && (
                            <input
                              type="text"
                              value={check.notes}
                              onChange={e => handleCheckNotes(check.code, e.target.value)}
                              placeholder={t('refurb.describeIssue')}
                              className="mt-2 w-full bg-black/50 border border-red-800/50 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Summary bar */}
          {refurbComplete && (
            <div className="mt-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400 font-medium">
                  {refurbChecks.filter(c => c.result === 'PASS').length} {t('refurb.pass')}
                </span>
                <span className="text-red-400 font-medium">
                  {refurbChecks.filter(c => c.result === 'FAIL').length} {t('refurb.fail')}
                </span>
                <span className="text-zinc-400 font-medium">
                  {refurbChecks.filter(c => c.result === 'N/A').length} {t('refurb.na')}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => {
                setRefurbCategory(null);
                setRefurbChecks([]);
                setStep('grading');
              }}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              &larr; {t('refurb.backToGrading')}
            </button>
            <div className="flex-1" />
            <Button
              variant="primary"
              onClick={() => handleSaveItem(conditionGrade!, refurbChecks)}
              disabled={!refurbComplete || loading}
              loading={loading}
              className="px-6"
            >
              <Check size={18} />
              {t('refurb.saveNext')}
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
