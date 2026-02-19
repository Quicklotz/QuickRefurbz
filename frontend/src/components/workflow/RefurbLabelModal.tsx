"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, Monitor, Cpu, Loader2, CheckCircle, AlertCircle, Tag, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { Button } from '@/components/aceternity/button';
import { Label } from '@/components/aceternity/label';
import { Badge } from '@/components/shared/Badge';
import { api } from '@/api/client';

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
type RefurbLabelSize = '2x1.5' | '4x6';

const LABEL_SIZE_OPTIONS: { value: RefurbLabelSize; label: string; description: string }[] = [
  { value: '2x1.5', label: '2" x 1.5"', description: 'Standard item label' },
  { value: '4x6', label: '4" x 6"', description: 'Large warehouse thermal' },
];

// Page dimensions for browser printing
const PAGE_SIZES: Record<RefurbLabelSize, { width: string; height: string }> = {
  '2x1.5': { width: '2in', height: '1.5in' },
  '4x6': { width: '4in', height: '6in' },
};

interface RefurbLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  qlid: string | null;
  manufacturer?: string;
  model?: string;
  finalGrade?: string;
  warrantyEligible?: boolean;
}

const GRADE_DISPLAY: Record<string, string> = {
  A: 'A - Like New',
  B: 'B - Excellent',
  C: 'C - Good',
  D: 'D - Fair',
  F: 'F - Poor',
  SALVAGE: 'Salvage',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-accent-green text-accent-green',
  B: 'bg-blue-500 text-blue-500',
  C: 'bg-ql-yellow text-ql-yellow',
  D: 'bg-orange-500 text-orange-500',
  F: 'bg-accent-red text-accent-red',
  SALVAGE: 'bg-zinc-500 text-zinc-500',
};

export function RefurbLabelModal({
  isOpen,
  onClose,
  qlid,
  manufacturer,
  model,
  finalGrade,
  warrantyEligible,
}: RefurbLabelModalProps) {
  const [printMethod, setPrintMethod] = useState<PrintMethod>('browser');
  const [labelSize, setLabelSize] = useState<RefurbLabelSize>('2x1.5');
  const [printerIp, setPrinterIp] = useState('');
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string; qsku?: string } | null>(null);
  const [savedPrinters, setSavedPrinters] = useState<SavedPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Build QSKU preview
  const qsku = qlid ? `RFB-${qlid}` : '';

  // Load label preview and saved printers when modal opens
  useEffect(() => {
    if (isOpen && qlid) {
      loadPreview();
      loadSavedPrinters();
    } else {
      setLabelPreview(null);
      setPrintResult(null);
    }
  }, [isOpen, qlid]);

  // Reload preview when label size changes
  useEffect(() => {
    if (isOpen && qlid) {
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
    if (!qlid) return;

    setLoadingPreview(true);
    try {
      const previewUrl = await api.getRefurbLabel(qlid, 'png', labelSize);
      setLabelPreview(previewUrl);
    } catch (err) {
      console.error('Failed to load refurb label preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrint = async () => {
    if (!qlid) return;

    setPrinting(true);
    setPrintResult(null);

    const pageSize = PAGE_SIZES[labelSize];

    try {
      if (printMethod === 'browser') {
        // Browser print - open print dialog
        const imageUrl = await api.getRefurbLabel(qlid, 'png', labelSize);
        const winWidth = labelSize === '4x6' ? 500 : 450;
        const winHeight = labelSize === '4x6' ? 700 : 350;
        const printWindow = window.open('', '_blank', `width=${winWidth},height=${winHeight}`);
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Refurb Label - ${qsku}</title>
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
                  max-width: ${pageSize.width};
                  height: auto;
                }
                @media print {
                  @page {
                    size: ${pageSize.width} ${pageSize.height};
                    margin: 0;
                  }
                  body {
                    min-height: auto;
                  }
                  img {
                    width: ${pageSize.width};
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
        setPrintResult({ success: true, message: 'Print dialog opened', qsku });
      } else {
        // Zebra printer - send ZPL directly
        if (!printerIp.trim()) {
          throw new Error('Please enter the Zebra printer IP address');
        }

        const result = await api.printRefurbLabel(printerIp.trim(), qlid, labelSize);
        setPrintResult({ success: true, message: 'Refurb label sent to printer', qsku: result.qsku });
      }
    } catch (err: any) {
      setPrintResult({ success: false, message: err.message || 'Print failed' });
    } finally {
      setPrinting(false);
    }
  };

  if (!qlid) return null;

  const gradeColor = finalGrade ? GRADE_COLORS[finalGrade] || '' : '';
  const gradeDisplay = finalGrade ? GRADE_DISPLAY[finalGrade] || finalGrade : 'N/A';

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Refurbished Label"
    >
      <div className="space-y-6">
        {/* QSKU Preview */}
        <div className="bg-gradient-to-r from-accent-green/10 to-ql-yellow/10 rounded-lg p-4 border border-accent-green/30">
          <div className="flex items-center gap-3 mb-3">
            <Tag className="w-5 h-5 text-accent-green" />
            <span className="text-sm text-zinc-400">New QSKU (FullSKU)</span>
          </div>
          <div className="font-mono font-bold text-2xl text-accent-green">{qsku}</div>
          <div className="mt-2 text-sm text-zinc-400">
            {manufacturer} {model}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {finalGrade && (
              <Badge variant="success" className={gradeColor.split(' ')[0] + '/20'}>
                {gradeDisplay}
              </Badge>
            )}
            {warrantyEligible && (
              <Badge variant="info">Warranty Eligible</Badge>
            )}
          </div>
        </div>

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
                    ? 'border-accent-green bg-accent-green/10'
                    : 'border-border bg-dark-tertiary hover:border-zinc-600'
                }`}
              >
                <span className={`text-sm font-bold ${labelSize === opt.value ? 'text-white' : 'text-zinc-400'}`}>
                  {opt.label}
                </span>
                <span className={`block text-xs mt-0.5 ${labelSize === opt.value ? 'text-accent-green' : 'text-zinc-500'}`}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Label Preview */}
        <div className="bg-white rounded-lg p-4 flex items-center justify-center min-h-[140px]">
          {loadingPreview ? (
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          ) : labelPreview ? (
            <motion.img
              src={labelPreview}
              alt={`Refurb label for ${qsku}`}
              className={`h-auto ${labelSize === '4x6' ? 'max-w-full max-h-[280px]' : 'max-w-full'}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            />
          ) : (
            <div className="text-center">
              <div className="font-mono font-bold text-2xl text-black mb-1">{qsku}</div>
              <div className="text-sm text-zinc-600">{manufacturer} {model}</div>
              <div className="text-xs text-zinc-500 mt-1">Grade: {gradeDisplay}</div>
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
                  ? 'border-accent-green bg-accent-green/10'
                  : 'border-border bg-dark-tertiary hover:border-zinc-600'
              }`}
            >
              <Monitor className={`w-6 h-6 ${printMethod === 'browser' ? 'text-accent-green' : 'text-zinc-400'}`} />
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
                  ? 'border-accent-green bg-accent-green/10'
                  : 'border-border bg-dark-tertiary hover:border-zinc-600'
              }`}
            >
              <Cpu className={`w-6 h-6 ${printMethod === 'zebra' ? 'text-accent-green' : 'text-zinc-400'}`} />
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
                        ? 'border-accent-green bg-accent-green/10'
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
                      <span className="text-xs text-accent-green bg-accent-green/10 px-2 py-0.5 rounded">Default</span>
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
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:border-accent-green focus:outline-none transition-colors text-sm"
              />
            </div>

            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-accent-green transition-colors"
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
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            loading={printing}
            disabled={printMethod === 'zebra' && !printerIp.trim()}
            className="bg-accent-green hover:bg-accent-green/90"
          >
            <Printer size={16} />
            Print RFB Label ({labelSize})
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
}
