import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import { ScanLine, CheckCircle, AlertCircle } from 'lucide-react';

export function Scan() {
  const [barcode, setBarcode] = useState('');
  const [warehouseId, setWarehouseId] = useState('WH001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const scanResult = await api.scanItem(barcode.trim(), warehouseId);
      setResult(scanResult);
      setBarcode('');
      inputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Scan Item</h1>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleScan}>
          <div className="form-group">
            <label className="form-label">Barcode</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                placeholder="Scan barcode (P1BBY-QLID000000001)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !barcode.trim()}>
                <ScanLine size={18} />
                {loading ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Warehouse</label>
            <select
              className="form-select"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="WH001">WH001 - Main Warehouse</option>
              <option value="WH002">WH002 - Secondary</option>
            </select>
          </div>
        </form>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--accent-red)',
            borderRadius: '0.5rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '1rem'
          }}>
            <AlertCircle size={20} color="var(--accent-red)" />
            <span style={{ color: 'var(--accent-red)' }}>{error}</span>
          </div>
        )}

        {result && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <CheckCircle size={20} color="var(--accent-green)" />
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {result.isNew ? 'Item Added to Refurbishment' : 'Item Found'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>QLID</div>
                <div style={{ fontFamily: 'monospace' }}>{result.item.qlid}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Pallet</div>
                <div style={{ fontFamily: 'monospace' }}>{result.item.palletId}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Product</div>
                <div>{result.item.manufacturer} {result.item.model}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Stage</div>
                <span className={`status-badge status-${result.item.currentStage.toLowerCase()}`}>
                  {result.item.currentStage.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const updated = await api.advanceItem(result.item.qlid);
                    setResult({ ...result, item: updated });
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                disabled={result.item.currentStage === 'COMPLETE'}
              >
                Advance to Next Stage
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Barcode Format</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Scan barcodes from QuickIntakez labels:
        </p>
        <code style={{
          background: 'var(--bg-primary)',
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          display: 'block',
          fontFamily: 'monospace'
        }}>
          P1BBY-QLID000000001
        </code>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Format: [PalletID]-[QLID]
        </p>
      </div>
    </div>
  );
}
