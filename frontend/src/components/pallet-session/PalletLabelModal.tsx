"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, Monitor, Cpu, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { Button } from '@/components/aceternity/button';
import { Label } from '@/components/aceternity/label';
import { api } from '@/api/client';
import type { PalletSession } from '@/contexts/PalletSessionContext';

type PrintMethod = 'browser' | 'zebra';

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
  const [printerIp, setPrinterIp] = useState('');
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load label preview when modal opens
  useEffect(() => {
    if (isOpen && session) {
      loadPreview();
    } else {
      setLabelPreview(null);
      setPrintResult(null);
    }
  }, [isOpen, session]);

  const loadPreview = async () => {
    if (!session) return;

    setLoadingPreview(true);
    try {
      const previewUrl = await api.getPalletLabel(session.palletId, 'png');
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

    try {
      if (printMethod === 'browser') {
        // Browser print - open print dialog
        const imageUrl = await api.getPalletLabel(session.palletId, 'png');
        const printWindow = window.open('', '_blank', 'width=400,height=300');
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
                  max-width: 4in;
                  height: auto;
                }
                @media print {
                  @page {
                    size: 4in 2in;
                    margin: 0;
                  }
                  body {
                    min-height: auto;
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

        await api.printZplLabel(printerIp.trim(), session.palletId);
        setPrintResult({ success: true, message: 'Label sent to printer' });
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
        {/* Label Preview */}
        <div className="bg-white rounded-lg p-4 flex items-center justify-center min-h-[120px]">
          {loadingPreview ? (
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          ) : labelPreview ? (
            <motion.img
              src={labelPreview}
              alt={`Label for ${session.palletId}`}
              className="max-w-full h-auto"
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

        {/* Zebra Printer IP Input */}
        {printMethod === 'zebra' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Label htmlFor="printerIp">Zebra Printer IP Address</Label>
            <input
              id="printerIp"
              type="text"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              className="w-full mt-2 bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:border-ql-yellow focus:outline-none transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Enter the IP address of your Zebra thermal printer
            </p>
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
            Print Label
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
}
