"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/api/client';

// Types
export interface Pallet {
  id: string;
  palletId: string;
  retailer: string;
  liquidationSource: string;
  sourcePalletId?: string;
  sourceOrderId?: string;
  status: string;
  receivedItems: number;
  expectedItems: number;
  completedItems: number;
  totalCogs: number;
  warehouseId?: string;
}

export interface PalletSession {
  palletId: string;
  pallet: Pallet;
  startedAt: string;
  expiresAt: string;
}

export interface ValidationResult {
  valid: boolean;
  palletMatch: boolean;
  expectedPallet: string | null;
  scannedPallet: string;
  error?: string;
}

interface PalletSessionContextValue {
  session: PalletSession | null;
  loading: boolean;
  error: string | null;
  startSession: (palletId: string) => Promise<void>;
  endSession: () => void;
  validateBarcode: (barcode: string) => ValidationResult;
  isActive: boolean;
  activePalletId: string | null;
}

const STORAGE_KEY = 'qr_active_pallet';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const PalletSessionContext = createContext<PalletSessionContextValue | null>(null);

// Parse barcode in format P1BBY-QLID000000001
function parseBarcode(barcode: string): { palletId: string; qlid: string } | null {
  const match = barcode.match(/^(P\d+[A-Z]{2,4})-(QLID\d{9})$/i);
  if (!match) return null;
  return { palletId: match[1].toUpperCase(), qlid: match[2].toUpperCase() };
}

export function PalletSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PalletSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PalletSession = JSON.parse(stored);
        // Check if session is expired
        if (new Date(parsed.expiresAt) > new Date()) {
          setSession(parsed);
        } else {
          // Session expired, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error('Failed to load pallet session from localStorage:', err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [session]);

  const startSession = useCallback(async (palletId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Normalize pallet ID (uppercase)
      const normalizedId = palletId.toUpperCase().trim();

      // Fetch pallet from API
      const pallet = await api.getPallet(normalizedId);

      if (!pallet) {
        throw new Error(`Pallet "${normalizedId}" not found`);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

      const newSession: PalletSession = {
        palletId: pallet.palletId,
        pallet,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      setSession(newSession);
    } catch (err: any) {
      const message = err.message || 'Failed to start pallet session';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const endSession = useCallback(() => {
    setSession(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const validateBarcode = useCallback((barcode: string): ValidationResult => {
    const parsed = parseBarcode(barcode);

    if (!parsed) {
      return {
        valid: false,
        palletMatch: false,
        expectedPallet: session?.palletId || null,
        scannedPallet: barcode,
        error: 'Invalid barcode format. Expected format: P1BBY-QLID000000001',
      };
    }

    // If no active session, always allow
    if (!session) {
      return {
        valid: true,
        palletMatch: true,
        expectedPallet: null,
        scannedPallet: parsed.palletId,
      };
    }

    // Check if pallet matches active session
    const matches = parsed.palletId === session.palletId;

    return {
      valid: true,
      palletMatch: matches,
      expectedPallet: session.palletId,
      scannedPallet: parsed.palletId,
      error: matches ? undefined : `Pallet mismatch: expected ${session.palletId}, got ${parsed.palletId}`,
    };
  }, [session]);

  const value: PalletSessionContextValue = {
    session,
    loading,
    error,
    startSession,
    endSession,
    validateBarcode,
    isActive: !!session,
    activePalletId: session?.palletId || null,
  };

  return (
    <PalletSessionContext.Provider value={value}>
      {children}
    </PalletSessionContext.Provider>
  );
}

export function usePalletSession() {
  const context = useContext(PalletSessionContext);
  if (!context) {
    throw new Error('usePalletSession must be used within a PalletSessionProvider');
  }
  return context;
}

// Additional helper functions
export function getPalletFromBarcode(barcode: string): string | null {
  const parsed = parseBarcode(barcode);
  return parsed?.palletId || null;
}

export function isValidBarcodeFormat(barcode: string): boolean {
  return parseBarcode(barcode) !== null;
}
