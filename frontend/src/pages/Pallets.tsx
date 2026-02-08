import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RefreshCw, Plus, Eye } from 'lucide-react';

const RETAILERS = [
  { value: 'BESTBUY', label: 'Best Buy' },
  { value: 'TARGET', label: 'Target' },
  { value: 'AMAZON', label: 'Amazon' },
  { value: 'COSTCO', label: 'Costco' },
  { value: 'WALMART', label: 'Walmart' },
  { value: 'KOHLS', label: "Kohl's" },
  { value: 'HOMEDEPOT', label: 'Home Depot' },
  { value: 'LOWES', label: "Lowe's" },
  { value: 'SAMSCLUB', label: "Sam's Club" },
  { value: 'OTHER', label: 'Other' }
];

const SOURCES = [
  { value: 'TECHLIQUIDATORS', label: 'TechLiquidators' },
  { value: 'DIRECTLIQUIDATION', label: 'DirectLiquidation' },
  { value: 'BSTOCK', label: 'B-Stock' },
  { value: 'BULQ', label: 'BULQ' },
  { value: 'QUICKLOTZ', label: 'QuickLotz' },
  { value: 'OTHER', label: 'Other' }
];

export function Pallets() {
  const [pallets, setPallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPallet, setSelectedPallet] = useState<any>(null);
  const [formData, setFormData] = useState({
    retailer: 'BESTBUY',
    liquidationSource: 'TECHLIQUIDATORS',
    sourcePalletId: '',
    sourceOrderId: '',
    totalCogs: '',
    expectedItems: '',
    notes: ''
  });

  const loadPallets = () => {
    setLoading(true);
    api.getPallets()
      .then(setPallets)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPallets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPallet({
        ...formData,
        totalCogs: parseFloat(formData.totalCogs) || 0,
        expectedItems: parseInt(formData.expectedItems) || 0
      });
      setShowModal(false);
      setFormData({
        retailer: 'BESTBUY',
        liquidationSource: 'TECHLIQUIDATORS',
        sourcePalletId: '',
        sourceOrderId: '',
        totalCogs: '',
        expectedItems: '',
        notes: ''
      });
      loadPallets();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const viewPallet = async (id: string) => {
    try {
      const pallet = await api.getPallet(id);
      setSelectedPallet(pallet);
    } catch (error) {
      console.error('Failed to load pallet:', error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Pallets</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={loadPallets} disabled={loading}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            New Pallet
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Pallet ID</th>
                <th>Retailer</th>
                <th>Source</th>
                <th>Source Pallet</th>
                <th>Status</th>
                <th>Items</th>
                <th>COGS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pallets.map(pallet => (
                <tr key={pallet.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{pallet.palletId}</td>
                  <td>{RETAILERS.find(r => r.value === pallet.retailer)?.label || pallet.retailer}</td>
                  <td>{SOURCES.find(s => s.value === pallet.liquidationSource)?.label || pallet.liquidationSource}</td>
                  <td style={{ fontFamily: 'monospace' }}>{pallet.sourcePalletId || '-'}</td>
                  <td>
                    <span className={`status-badge status-${pallet.status.toLowerCase().replace('_', '-')}`}>
                      {pallet.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{pallet.receivedItems} / {pallet.expectedItems || '?'}</td>
                  <td>${pallet.totalCogs.toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem' }}
                      onClick={() => viewPallet(pallet.palletId)}
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {pallets.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading...' : 'No pallets found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Pallet</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Retailer (Original Store)</label>
                <select
                  className="form-select"
                  value={formData.retailer}
                  onChange={(e) => setFormData({ ...formData, retailer: e.target.value })}
                  required
                >
                  {RETAILERS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Liquidation Source</label>
                <select
                  className="form-select"
                  value={formData.liquidationSource}
                  onChange={(e) => setFormData({ ...formData, liquidationSource: e.target.value })}
                  required
                >
                  {SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Source Pallet ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., PTRF70336"
                  value={formData.sourcePalletId}
                  onChange={(e) => setFormData({ ...formData, sourcePalletId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Source Order ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., INV-12345"
                  value={formData.sourceOrderId}
                  onChange={(e) => setFormData({ ...formData, sourceOrderId: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total COGS ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={formData.totalCogs}
                    onChange={(e) => setFormData({ ...formData, totalCogs: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Items</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={formData.expectedItems}
                    onChange={(e) => setFormData({ ...formData, expectedItems: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Pallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPallet && (
        <div className="modal-overlay" onClick={() => setSelectedPallet(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedPallet.palletId}</h2>
              <button className="modal-close" onClick={() => setSelectedPallet(null)}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Retailer</div>
                <div>{RETAILERS.find(r => r.value === selectedPallet.retailer)?.label}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Source</div>
                <div>{SOURCES.find(s => s.value === selectedPallet.liquidationSource)?.label}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Status</div>
                <div>{selectedPallet.status.replace('_', ' ')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>COGS</div>
                <div>${selectedPallet.totalCogs.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Items Received</div>
                <div>{selectedPallet.receivedItems}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Items Completed</div>
                <div>{selectedPallet.completedItems}</div>
              </div>
            </div>

            {selectedPallet.items && selectedPallet.items.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem' }}>Items on Pallet</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedPallet.items.map((item: any) => (
                    <div
                      key={item.qlid}
                      style={{
                        background: 'var(--bg-primary)',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{item.qlid}</div>
                        <div style={{ fontSize: '0.875rem' }}>{item.manufacturer} {item.model}</div>
                      </div>
                      <span className={`status-badge status-${item.stage.toLowerCase()}`}>
                        {item.stage.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
