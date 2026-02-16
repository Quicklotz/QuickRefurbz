"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Barcode,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Search,
  Database,
  XCircle
} from 'lucide-react';
import { api } from '@/api/client';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { Badge } from '@/components/shared/Badge';

export interface UPCLookupResult {
  upc: string;
  brand: string | null;
  model: string | null;
  title: string | null;
  category: string | null;
  msrp: number | null;
  imageUrl: string | null;
  provider: 'rainforest' | 'cache' | 'manual';
  cached: boolean;
}

interface UpcScannerProps {
  onLookupResult: (result: UPCLookupResult) => void;
  onUpcChange?: (upc: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function UpcScanner({
  onLookupResult,
  onUpcChange,
  onSubmit,
  autoFocus = true,
  disabled = false
}: UpcScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upc, setUpc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UPCLookupResult | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Debounce timer for auto-lookup
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, []);

  const lookupUPC = useCallback(async (upcCode: string) => {
    const normalizedUPC = upcCode.replace(/[\s-]/g, '');

    // Validate UPC format (8-14 digits typically)
    if (normalizedUPC.length < 8 || normalizedUPC.length > 14) {
      return;
    }

    // Only digits
    if (!/^\d+$/.test(normalizedUPC)) {
      return;
    }

    setLoading(true);
    setError('');
    setNotFound(false);
    setResult(null);

    try {
      const data = await api.lookupUPC(normalizedUPC);
      setResult(data);
      onLookupResult(data);
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        setNotFound(true);
      } else {
        setError(err.message || 'Lookup failed');
      }
    } finally {
      setLoading(false);
    }
  }, [onLookupResult]);

  const handleUpcChange = (value: string) => {
    setUpc(value);
    setResult(null);
    setError('');
    setNotFound(false);
    onUpcChange?.(value);

    // Clear existing timeout
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    // Auto-lookup after typing stops (500ms debounce)
    const normalizedUPC = value.replace(/[\s-]/g, '');
    if (normalizedUPC.length >= 8 && normalizedUPC.length <= 14 && /^\d+$/.test(normalizedUPC)) {
      lookupTimeoutRef.current = setTimeout(() => {
        lookupUPC(value);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // If loading, wait
      if (loading) return;

      // If UPC has valid length, trigger lookup first
      const normalizedUPC = upc.replace(/[\s-]/g, '');
      if (normalizedUPC.length >= 8 && !result && !notFound) {
        lookupUPC(upc);
      } else {
        // If we have result or not found, submit the form
        onSubmit?.();
      }
    }
  };

  const handleManualLookup = () => {
    if (upc.trim()) {
      lookupUPC(upc);
    }
  };

  const clearResult = () => {
    setUpc('');
    setResult(null);
    setError('');
    setNotFound(false);
    onUpcChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="upc-scanner" className="flex items-center gap-2">
          <Barcode size={14} className="text-ql-yellow" />
          UPC Barcode
          {result && (
            <Badge variant="success" size="sm" className="ml-2">
              <Sparkles size={10} className="mr-1" />
              Auto-filled
            </Badge>
          )}
        </Label>
        <div className="relative mt-1">
          <Input
            ref={inputRef}
            id="upc-scanner"
            type="text"
            placeholder="Scan or type UPC barcode"
            value={upc}
            onChange={(e) => handleUpcChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="pl-10 pr-24 font-mono"
          />
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

          {/* Status indicators */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-ql-yellow"
              >
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Looking up...</span>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-accent-green"
              >
                <CheckCircle size={14} />
                <span className="text-xs">{result.cached ? 'Cached' : 'Found'}</span>
              </motion.div>
            )}

            {notFound && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-zinc-400"
              >
                <Database size={14} />
                <span className="text-xs">Not found</span>
              </motion.div>
            )}

            {upc && (
              <button
                type="button"
                onClick={clearResult}
                className="p-1 hover:bg-dark-tertiary rounded text-zinc-400 hover:text-white transition-colors"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-accent-red text-sm"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result preview card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-dark-primary border border-accent-green/30 rounded-lg p-3"
          >
            <div className="flex items-start gap-3">
              {/* Product image thumbnail */}
              {result.imageUrl && (
                <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex-shrink-0">
                  <img
                    src={result.imageUrl}
                    alt="Product"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">UPC Lookup Result</span>
                  <Badge
                    variant={result.provider === 'cache' ? 'default' : result.provider === 'manual' ? 'info' : 'success'}
                    size="sm"
                  >
                    {result.provider}
                  </Badge>
                </div>

                {result.title && (
                  <p className="text-white text-sm font-medium truncate" title={result.title}>
                    {result.title}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 mt-1 text-xs text-zinc-400">
                  {result.brand && (
                    <span>
                      <span className="text-zinc-500">Brand:</span>{' '}
                      <span className="text-zinc-300">{result.brand}</span>
                    </span>
                  )}
                  {result.model && (
                    <span>
                      <span className="text-zinc-500">Model:</span>{' '}
                      <span className="text-zinc-300">{result.model}</span>
                    </span>
                  )}
                  {result.category && (
                    <span>
                      <span className="text-zinc-500">Category:</span>{' '}
                      <span className="text-zinc-300">{result.category}</span>
                    </span>
                  )}
                  {result.msrp && (
                    <span>
                      <span className="text-zinc-500">MSRP:</span>{' '}
                      <span className="text-accent-green">${result.msrp.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not found - manual entry prompt */}
      <AnimatePresence>
        {notFound && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-dark-primary border border-zinc-700 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Database size={14} />
              <span>UPC not found in database. Enter product details manually.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual lookup button (for partial/invalid UPCs) */}
      {upc.length > 0 && upc.length < 8 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleManualLookup}
          className="text-zinc-400"
        >
          <Search size={14} />
          Look up partial code
        </Button>
      )}
    </div>
  );
}

export default UpcScanner;
