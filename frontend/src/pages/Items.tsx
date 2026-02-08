import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RefreshCw, ChevronRight, Eye } from 'lucide-react';

export function Items() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ stage: '', category: '' });
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const loadItems = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filter.stage) params.stage = filter.stage;
    if (filter.category) params.category = filter.category;

    api.getItems(params)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [filter]);

  const handleAdvance = async (item: any) => {
    try {
      await api.advanceItem(item.qlid);
      loadItems();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const viewItem = async (qlid: string) => {
    try {
      const item = await api.getItem(qlid);
      setSelectedItem(item);
    } catch (error) {
      console.error('Failed to load item:', error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Items</h1>
        <button className="btn btn-secondary" onClick={loadItems} disabled={loading}>
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Stage</label>
            <select
              className="form-select"
              value={filter.stage}
              onChange={(e) => setFilter({ ...filter, stage: e.target.value })}
            >
              <option value="">All Stages</option>
              <option value="INTAKE">Intake</option>
              <option value="TESTING">Testing</option>
              <option value="REPAIR">Repair</option>
              <option value="CLEANING">Cleaning</option>
              <option value="FINAL_QC">Final QC</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            >
              <option value="">All Categories</option>
              <option value="PHONE">Phone</option>
              <option value="TABLET">Tablet</option>
              <option value="LAPTOP">Laptop</option>
              <option value="DESKTOP">Desktop</option>
              <option value="TV">TV</option>
              <option value="MONITOR">Monitor</option>
              <option value="AUDIO">Audio</option>
              <option value="GAMING">Gaming</option>
              <option value="WEARABLE">Wearable</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>QLID</th>
                <th>Product</th>
                <th>Category</th>
                <th>Pallet</th>
                <th>Stage</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.qlid}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{item.qlid}</td>
                  <td>{item.manufacturer} {item.model}</td>
                  <td>{item.category}</td>
                  <td style={{ fontFamily: 'monospace' }}>{item.palletId}</td>
                  <td>
                    <span className={`status-badge status-${item.currentStage.toLowerCase()}`}>
                      {item.currentStage.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`tag tag-priority-${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.375rem' }}
                        onClick={() => viewItem(item.qlid)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {item.currentStage !== 'COMPLETE' && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.375rem' }}
                          onClick={() => handleAdvance(item)}
                          title="Advance Stage"
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading...' : 'No items found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedItem.qlid}</h2>
              <button className="modal-close" onClick={() => setSelectedItem(null)}>&times;</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                {selectedItem.manufacturer} {selectedItem.model}
              </h3>
              <span className={`status-badge status-${selectedItem.currentStage.toLowerCase()}`}>
                {selectedItem.currentStage.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Category</div>
                <div>{selectedItem.category}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Pallet</div>
                <div style={{ fontFamily: 'monospace' }}>{selectedItem.palletId}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Serial Number</div>
                <div>{selectedItem.serialNumber || 'N/A'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Priority</div>
                <div>{selectedItem.priority}</div>
              </div>
            </div>

            {selectedItem.history && selectedItem.history.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem' }}>Stage History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedItem.history.map((h: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--bg-primary)',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {h.fromStage || 'NEW'} → {h.toStage}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {h.technicianName && (
                        <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          By: {h.technicianName}
                        </div>
                      )}
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
