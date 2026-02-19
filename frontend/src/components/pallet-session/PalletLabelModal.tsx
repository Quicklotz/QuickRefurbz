"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, Monitor, Cpu, Loader2, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { Button } from '@/components/aceternity/button';
import { Label } from '@/components/aceternity/label';
import { api } from '@/api/client';
import type { PalletSession } from '@/contexts/PalletSessionContext';

interface SavedPrinter {
  id: string;
  printer_ip: string;
  printer_name: string | null;
  printer_model: string | null;
  label_width_mm: number;
  label_height_mm: number;
  is_default: boolean;
}

type PrintMethod = 'browser' | 'zebra';
type PalletLabelSize = '4x6' | '2x1';

const LABEL_SIZE_OPTIONS: { value: PalletLabelSize; label: string; description: string }[] = [
  { value: '4x6', label: '4" x 6"', description: 'Warehouse thermal (recommended)' },
  { value: '2x1', label: '2" x 1"', description: 'Small label' },
];

interface PalletLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PalletSession | null;
}

const RETAILER_DISPLAY: Record<string, string> = {
  BESTBUY: 'Best Buy',
  TARGET: 'Target',
  AMAZON: 'Amazon',
  WALMART: 'Walmart',
  COSTCO: 'Costco',
  HOMEDEPOT: 'Home Depot',
  LOWES: "Lowe's",
};

export function PalletLabelModal({ isOpen, onClose, session }: PalletLabelModalProps) {
  const [printMethod, setPrintMethod] = useState<PrintMethod>('browser');
  const [labelSize, setLabelSize] = useState<PalletLabelSize>('4x6');
  const [printerIp, setPrinterIp] = useState('');
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedPrinters, setSavedPrinters] = useState<SavedPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Load label preview and saved printers when modal opens
  useEffect(() => {
    if (isOpen && session) {
      loadPreview();
      loadSavedPrinters();
    } else {
      setLabelPreview(null);
      setPrintResult(null);
    }
  }, [isOpen, session]);

  // Reload preview when label size changes
  useEffect(() => {
    if (isOpen && session) {
      loadPreview();
    }
  }, [labelSize]);

  const loadSavedPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const result = await api.getPrinterSettings();
      setSavedPrinters(result.printers);
      // Pre-select default printer if no IP is set yet
      if (!printerIp) {
        const defaultPrinter = result.printers.find((p) => p.is_default);
        if (defaultPrinter) {
          setPrinterIp(defaultPrinter.printer_ip);
        }
      }
    } catch (err) {
      console.error('Failed to load saved printers:', err);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const loadPreview = async () => {
    if (!session) return;

    setLoadingPreview(true);
    try {
      const previewUrl = await api.getPalletLabel(session.palletId, 'png', labelSize);
      setLabelPreview(previewUrl);
    } catch (err) {
      console.error('Failed to load label preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrint = async () => {
    if (!session) return;

    setPrinting(true);
    setPrintResult(null);

    // Page size for browser print based on label size
    const pageWidth = labelSize === '4x6' ? '4in' : '2in';
    const pageHeight = labelSize === '4x6' ? '6in' : '1in';

    try {
      if (printMethod === 'browser') {
        // Browser print - open print dialog
        const imageUrl = await api.getPalletLabel(session.palletId, 'png', labelSize);
        const printWindow = window.open('', '_blank', 'width=500,height=700');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Pallet Label - ${session.palletId}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: white;
                }
                img {
                  max-width: ${pageWidth};
                  height: auto;
                }
                @media print {
                  @page {
                    size: ${pageWidth} ${pageHeight};
                    margin: 0;
                  }
                  body {
                    min-height: auto;
                  }
                  img {
                    width: ${pageWidth};
                  }
                }
              </style>
            </head>
            <body>
              <img src="${imageUrl}" onload="window.print(); setTimeout(() => window.close(), 500);" />
            </body>
            </html>
          `);
          printWindow.document.close();
        }
        setPrintResult({ success: true, message: 'Print dialog opened' });
      } else {
        // Zebra printer - send ZPL directly
        if (!printerIp.trim()) {
          throw new Error('Please enter the Zebra printer IP address');
        }

        await api.printZplLabel(printerIp.trim(), session.palletId, labelSize);
        setPrintResult({ success: true, message: `Label sent to printer (${labelSize})` });
      }
    } catch (err: any) {
      setPrintResult({ success: false, message: err.message || 'Print failed' });
    } finally {
      setPrinting(false);
    }
  };

  if (!session) return null;

  const retailerName = RETAILER_DISPLAY[session.pallet.retailer] || session.pallet.retailer;

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Pallet Label"
    >
      <div className="space-y-6">
        {/* Label Size Selection */}
        <div>
          <Label className="mb-3 block">Label Size</Label>
          <div className="grid grid-cols-2 gap-3">
            {LABEL_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLabelSize(opt.value)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  labelSize === opt.value
                    ? 'border-ql-yellow bg-ql-yellow/10'
                    : 'border-border bg-dark-tertiary hover:border-zinc-600'
                }`}
              >
                <span className={`text-sm font-bold ${labelSize === opt.value ? 'text-white' : 'text-zinc-400'}`}>
                  {opt.label}
                </span>
                <span className={`block text-xs mt-0.5 ${labelSize === opt.value ? 'text-ql-yellow' : 'text-zinc-500'}`}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Label Preview */}
        <div className="bg-white rounded-lg p-4 flex items-center justify-center min-h-[120px]">
          {loadingPreview ? (
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          ) : labelPreview ? (
            <motion.img
              src={labelPreview}
              alt={`Label for ${session.palletId}`}
              className={`h-auto ${labelSize === '4x6' ? 'max-w-full max-h-[280px]' : 'max-w-full'}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            />
          ) : (
            <div className="text-center">
              <div className="font-mono font-bold text-2xl text-black mb-1">{session.palletId}</div>
              <div className="text-sm text-zinc-600">{retailerName} - {session.pallet.liquidationSource}</div>
            </div>
          )}
        </div>

        {/* Print Method Selection */}
        <div>
          <Label className="mb-3 block">Print Method</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPrintMethod('browser')}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                printMethod === 'browser'
                  ? 'border-ql-yellow bg-ql-yellow/10'
                  : 'border-border bg-dark-tertiary hover:border-zinc-600'
              }`}
            >
              <Monitor className={`w-6 h-6 ${printMethod === 'browser' ? 'text-ql-yellow' : 'text-zinc-400'}`} />
              <span className={`text-sm font-medium ${printMethod === 'browser' ? 'text-white' : 'text-zinc-400'}`}>
                Browser Print
              </span>
              <span className="text-xs text-zinc-500">Opens print dialog</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintMethod('zebra')}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                printMethod === 'zebra'
                  ? 'border-ql-yellow bg-ql-yellow/10'
                  : 'border-border bg-dark-tertiary hover:border-zinc-600'
              }`}
            >
              <Cpu className={`w-6 h-6 ${printMethod === 'zebra' ? 'text-ql-yellow' : 'text-zinc-400'}`} />
              <span className={`text-sm font-medium ${printMethod === 'zebra' ? 'text-white' : 'text-zinc-400'}`}>
                Zebra Printer
              </span>
              <span className="text-xs text-zinc-500">Direct ZPL print</span>
            </button>
          </div>
        </div>

        {/* Zebra Printer Selection */}
        {printMethod === 'zebra' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <Label>Select Printer</Label>
            {loadingPrinters ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading saved printers...
              </div>
            ) : savedPrinters.length > 0 ? (
              <div className="space-y-2">
                {savedPrinters.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPrinterIp(p.printer_ip)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      printerIp === p.printer_ip
                        ? 'border-ql-yellow bg-ql-yellow/10'
                        : 'border-border bg-dark-tertiary hover:border-zinc-600'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${printerIp === p.printer_ip ? 'bg-accent-green' : 'bg-zinc-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {p.printer_name || p.printer_ip}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {p.printer_ip} · {p.label_width_mm}x{p.label_height_mm}mm
                      </div>
                    </div>
                    {p.is_default && (
                      <span className="text-xs text-ql-yellow bg-ql-yellow/10 px-2 py-0.5 rounded">Default</span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Manual IP fallback */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Or enter IP manually</label>
              <input
                type="text"
                value={savedPrinters.some(p => p.printer_ip === printerIp) ? '' : printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                placeholder="e.g., 192.168.1.100"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:border-ql-yellow focus:outline-none transition-colors text-sm"
              />
            </div>

            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-ql-yellow transition-colors"
            >
              <Settings size={12} />
              Manage printers
            </Link>
          </motion.div>
        )}

        {/* Print Result */}
        {printResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg flex items-center gap-2 ${
              printResult.success
                ? 'bg-accent-green/10 border border-accent-green text-accent-green'
                : 'bg-accent-red/10 border border-accent-red text-accent-red'
            }`}
          >
            {printResult.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm">{printResult.message}</span>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            loading={printing}
            disabled={printMethod === 'zebra' && !printerIp.trim()}
          >
            <Printer size={16} />
            Print Label ({labelSize})
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
}
