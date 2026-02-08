import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Part {
  id: string;
  sku: string;
  name: string;
  category: string;
  compatible_devices: string[];
  quantity: number;
  min_quantity: number;
  cost: number;
  supplier?: string;
  source: 'HARVESTED' | 'PURCHASED' | 'SYNCED';
  location?: string;
  condition?: string;
  harvested_from_qlid?: string;
  created_at: string;
  updated_at: string;
}

interface Supplier {
  id: string;
  name: string;
  api_url?: string;
  sync_type: 'API' | 'XLSX' | 'MANUAL';
  last_sync?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
}

const PART_CATEGORIES = [
  'SCREEN',
  'BATTERY',
  'CHARGING_PORT',
  'CAMERA',
  'SPEAKER',
  'MICROPHONE',
  'BUTTON',
  'HOUSING',
  'LOGIC_BOARD',
  'RAM',
  'STORAGE',
  'KEYBOARD',
  'TRACKPAD',
  'FAN',
  'POWER_SUPPLY',
  'OTHER',
];

const SYNC_TYPES = [
  { value: 'API', label: 'API Integration', description: 'Real-time sync via REST API' },
  { value: 'XLSX', label: 'XLSX Import', description: 'Manual spreadsheet uploads' },
  { value: 'MANUAL', label: 'Manual Entry', description: 'Direct data entry' },
];

export function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'suppliers'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showAddPart, setShowAddPart] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState<Part | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New part form state
  const [newPart, setNewPart] = useState({
    sku: '',
    name: '',
    category: 'SCREEN',
    compatible_devices: '',
    quantity: 0,
    min_quantity: 5,
    cost: 0,
    supplier: '',
    source: 'PURCHASED' as 'HARVESTED' | 'PURCHASED' | 'SYNCED',
    location: '',
    condition: 'NEW',
    harvested_from_qlid: '',
  });

  // Stock adjustment form
  const [stockAdjust, setStockAdjust] = useState({
    quantity: 0,
    reason: '',
  });

  // New supplier form
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    apiUrl: '',
    apiKey: '',
    syncType: 'MANUAL' as 'API' | 'XLSX' | 'MANUAL',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [partsData, suppliersData] = await Promise.all([
        api.getParts(),
        api.getPartsSuppliers().catch(() => []),
      ]);
      setParts(partsData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter((part) => {
    const matchesSearch =
      !searchQuery ||
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || part.category === categoryFilter;
    const matchesSource = !sourceFilter || part.source === sourceFilter;
    return matchesSearch && matchesCategory && matchesSource;
  });

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await api.createPart({
        ...newPart,
        compatible_devices: newPart.compatible_devices
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      });
      setMessage({ type: 'success', text: 'Part added successfully' });
      setShowAddPart(false);
      setNewPart({
        sku: '',
        name: '',
        category: 'SCREEN',
        compatible_devices: '',
        quantity: 0,
        min_quantity: 5,
        cost: 0,
        supplier: '',
        source: 'PURCHASED',
        location: '',
        condition: 'NEW',
        harvested_from_qlid: '',
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add part' });
    }
  };

  const handleAdjustStock = async () => {
    if (!showAdjustStock) return;
    setMessage(null);

    try {
      await api.adjustPartStock(showAdjustStock.id, stockAdjust.quantity, stockAdjust.reason);
      setMessage({ type: 'success', text: 'Stock adjusted successfully' });
      setShowAdjustStock(null);
      setStockAdjust({ quantity: 0, reason: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to adjust stock' });
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await api.addPartsSupplier(newSupplier);
      setMessage({ type: 'success', text: 'Supplier added successfully' });
      setShowAddSupplier(false);
      setNewSupplier({ name: '', apiUrl: '', apiKey: '', syncType: 'MANUAL' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add supplier' });
    }
  };

  const handleSyncSupplier = async (supplierId: string) => {
    setMessage(null);
    try {
      await api.syncPartsSupplier(supplierId);
      setMessage({ type: 'success', text: 'Sync started successfully' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync supplier' });
    }
  };

  const getLowStockCount = () => {
    return parts.filter((p) => p.quantity <= p.min_quantity).length;
  };

  const getSourceBadge = (source: string) => {
    const config: Record<string, { color: string; label: string }> = {
      HARVESTED: { color: 'purple', label: 'Harvested' },
      PURCHASED: { color: 'blue', label: 'Purchased' },
      SYNCED: { color: 'green', label: 'Synced' },
    };
    const c = config[source] || { color: 'gray', label: source };
    return <span className={`source-badge source-${c.color}`}>{c.label}</span>;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spin">Loading parts inventory...</div>
      </div>
    );
  }

  return (
    <div className="parts-page">
      <div className="page-header">
        <h1>Parts Inventory</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{parts.length}</span>
            <span className="stat-label">Total Parts</span>
          </div>
          <div className="stat">
            <span className="stat-value">{parts.filter((p) => p.source === 'HARVESTED').length}</span>
            <span className="stat-label">Harvested</span>
          </div>
          {getLowStockCount() > 0 && (
            <div className="stat stat-warning">
              <span className="stat-value">{getLowStockCount()}</span>
              <span className="stat-label">Low Stock</span>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={`tab ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Suppliers & Sync
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          {/* Filters & Actions */}
          <div className="filters-section">
            <div className="filters">
              <input
                type="text"
                className="form-input"
                placeholder="Search parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {PART_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="">All Sources</option>
                <option value="HARVESTED">Harvested</option>
                <option value="PURCHASED">Purchased</option>
                <option value="SYNCED">Synced</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddPart(true)}>
              + Add Part
            </button>
          </div>

          {/* Parts Table */}
          <div className="table-container">
            {filteredParts.length === 0 ? (
              <div className="empty-state">
                <p>No parts found</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Source</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((part) => (
                    <tr key={part.id} className={part.quantity <= part.min_quantity ? 'low-stock' : ''}>
                      <td className="sku-cell">{part.sku}</td>
                      <td>
                        {part.name}
                        {part.compatible_devices?.length > 0 && (
                          <span className="compatible-hint">
                            {part.compatible_devices.slice(0, 2).join(', ')}
                            {part.compatible_devices.length > 2 && ` +${part.compatible_devices.length - 2}`}
                          </span>
                        )}
                      </td>
                      <td>{part.category.replace(/_/g, ' ')}</td>
                      <td>
                        {getSourceBadge(part.source)}
                        {part.harvested_from_qlid && (
                          <span className="harvested-from">from {part.harvested_from_qlid}</span>
                        )}
                      </td>
                      <td className={part.quantity <= part.min_quantity ? 'qty-warning' : ''}>
                        {part.quantity}
                        {part.quantity <= part.min_quantity && (
                          <span className="low-stock-badge">Low</span>
                        )}
                      </td>
                      <td>${part.cost.toFixed(2)}</td>
                      <td>{part.location || '-'}</td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setShowAdjustStock(part)}
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'suppliers' && (
        <>
          <div className="suppliers-header">
            <h2>Third-Party Suppliers</h2>
            <button className="btn btn-primary" onClick={() => setShowAddSupplier(true)}>
              + Add Supplier
            </button>
          </div>

          <div className="suppliers-grid">
            {suppliers.length === 0 ? (
              <div className="empty-state">
                <p>No suppliers configured</p>
                <p className="hint">Add a supplier to sync parts from external sources</p>
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="supplier-card">
                  <div className="supplier-header">
                    <h3>{supplier.name}</h3>
                    <span className={`status-badge status-${supplier.status.toLowerCase()}`}>
                      {supplier.status}
                    </span>
                  </div>
                  <div className="supplier-details">
                    <p><strong>Sync Type:</strong> {supplier.sync_type}</p>
                    {supplier.api_url && <p><strong>API URL:</strong> {supplier.api_url}</p>}
                    {supplier.last_sync && (
                      <p><strong>Last Sync:</strong> {new Date(supplier.last_sync).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="supplier-actions">
                    {supplier.sync_type === 'API' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleSyncSupplier(supplier.id)}
                      >
                        Sync Now
                      </button>
                    )}
                    {supplier.sync_type === 'XLSX' && (
                      <button className="btn btn-sm btn-secondary">
                        Upload XLSX
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="import-section">
            <h3>Import Parts</h3>
            <p>Import parts from an XLSX file or paste data directly.</p>
            <div className="import-options">
              <div className="import-option">
                <h4>XLSX Upload</h4>
                <p>Upload a spreadsheet with columns: SKU, Name, Category, Quantity, Cost</p>
                <input type="file" accept=".xlsx,.xls,.csv" className="file-input" />
                <button className="btn btn-secondary">Upload</button>
              </div>
              <div className="import-option">
                <h4>API Data Feed</h4>
                <p>Configure a supplier to automatically sync parts data</p>
                <button className="btn btn-secondary" onClick={() => setShowAddSupplier(true)}>
                  Configure Supplier
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Part Modal */}
      {showAddPart && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Add New Part</h2>
              <button className="modal-close" onClick={() => setShowAddPart(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddPart}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">SKU *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPart.sku}
                      onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPart.name}
                      onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={newPart.category}
                      onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
                      required
                    >
                      {PART_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Source *</label>
                    <select
                      className="form-select"
                      value={newPart.source}
                      onChange={(e) => setNewPart({ ...newPart, source: e.target.value as any })}
                      required
                    >
                      <option value="HARVESTED">Harvested</option>
                      <option value="PURCHASED">Purchased</option>
                      <option value="SYNCED">Synced</option>
                    </select>
                  </div>
                </div>

                {newPart.source === 'HARVESTED' && (
                  <div className="form-group">
                    <label className="form-label">Harvested From QLID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPart.harvested_from_qlid}
                      onChange={(e) => setNewPart({ ...newPart, harvested_from_qlid: e.target.value })}
                      placeholder="e.g., QLID000000001"
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newPart.quantity}
                      onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 0 })}
                      min={0}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Quantity (Alert)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newPart.min_quantity}
                      onChange={(e) => setNewPart({ ...newPart, min_quantity: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newPart.cost}
                      onChange={(e) => setNewPart({ ...newPart, cost: parseFloat(e.target.value) || 0 })}
                      min={0}
                      step={0.01}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPart.location}
                      onChange={(e) => setNewPart({ ...newPart, location: e.target.value })}
                      placeholder="e.g., Shelf A-3"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select
                      className="form-select"
                      value={newPart.condition}
                      onChange={(e) => setNewPart({ ...newPart, condition: e.target.value })}
                    >
                      <option value="NEW">New</option>
                      <option value="LIKE_NEW">Like New</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Compatible Devices</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPart.compatible_devices}
                    onChange={(e) => setNewPart({ ...newPart, compatible_devices: e.target.value })}
                    placeholder="e.g., iPhone 14 Pro, iPhone 14 Pro Max"
                  />
                  <span className="form-hint">Comma-separated list of compatible device models</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddPart(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustStock && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Adjust Stock</h2>
              <button className="modal-close" onClick={() => setShowAdjustStock(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="part-summary">
                <p><strong>Part:</strong> {showAdjustStock.name}</p>
                <p><strong>SKU:</strong> {showAdjustStock.sku}</p>
                <p><strong>Current Qty:</strong> {showAdjustStock.quantity}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Adjustment *</label>
                <input
                  type="number"
                  className="form-input"
                  value={stockAdjust.quantity}
                  onChange={(e) => setStockAdjust({ ...stockAdjust, quantity: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., +5 or -3"
                />
                <span className="form-hint">
                  New quantity: {showAdjustStock.quantity + stockAdjust.quantity}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Reason *</label>
                <select
                  className="form-select"
                  value={stockAdjust.reason}
                  onChange={(e) => setStockAdjust({ ...stockAdjust, reason: e.target.value })}
                >
                  <option value="">Select reason...</option>
                  <option value="REPAIR_USE">Used for repair</option>
                  <option value="RECEIVED">Received shipment</option>
                  <option value="HARVESTED">Harvested from device</option>
                  <option value="DAMAGED">Damaged/Defective</option>
                  <option value="INVENTORY_COUNT">Inventory count adjustment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAdjustStock(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdjustStock}
                disabled={!stockAdjust.reason}
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add Supplier</h2>
              <button className="modal-close" onClick={() => setShowAddSupplier(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="e.g., iFixit, Injured Gadgets"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sync Type *</label>
                  <select
                    className="form-select"
                    value={newSupplier.syncType}
                    onChange={(e) => setNewSupplier({ ...newSupplier, syncType: e.target.value as any })}
                  >
                    {SYNC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                {newSupplier.syncType === 'API' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">API URL</label>
                      <input
                        type="url"
                        className="form-input"
                        value={newSupplier.apiUrl}
                        onChange={(e) => setNewSupplier({ ...newSupplier, apiUrl: e.target.value })}
                        placeholder="https://api.supplier.com/v1/parts"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">API Key</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newSupplier.apiKey}
                        onChange={(e) => setNewSupplier({ ...newSupplier, apiKey: e.target.value })}
                        placeholder="Your API key"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddSupplier(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .parts-page {
          max-width: 1400px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .header-stats {
          display: flex;
          gap: 1.5rem;
        }

        .stat {
          text-align: center;
          padding: 0.5rem 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ql-yellow);
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .stat-warning .stat-value {
          color: var(--accent-red);
        }

        .alert {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .alert-success {
          background: rgba(2, 219, 168, 0.15);
          color: var(--accent-green);
          border: 1px solid var(--accent-green);
        }

        .alert-error {
          background: rgba(235, 61, 59, 0.15);
          color: var(--accent-red);
          border: 1px solid var(--accent-red);
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .tab {
          padding: 0.5rem 1rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.25rem;
        }

        .tab:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .tab.active {
          color: var(--ql-yellow);
          background: rgba(255, 199, 0, 0.1);
        }

        .filters-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .filters {
          display: flex;
          gap: 0.5rem;
          flex: 1;
        }

        .filters .form-input,
        .filters .form-select {
          max-width: 200px;
        }

        .table-container {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th,
        .data-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .data-table th {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          background: var(--bg-tertiary);
        }

        .data-table td {
          font-size: 0.875rem;
        }

        .data-table tr.low-stock {
          background: rgba(235, 61, 59, 0.05);
        }

        .sku-cell {
          font-family: monospace;
          font-weight: 600;
        }

        .compatible-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .source-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .source-purple {
          background: rgba(139, 92, 246, 0.2);
          color: #8b5cf6;
        }

        .source-blue {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .source-green {
          background: rgba(2, 219, 168, 0.2);
          color: var(--accent-green);
        }

        .harvested-from {
          display: block;
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 0.125rem;
        }

        .qty-warning {
          color: var(--accent-red);
          font-weight: 600;
        }

        .low-stock-badge {
          display: inline-block;
          margin-left: 0.5rem;
          padding: 0.125rem 0.375rem;
          background: rgba(235, 61, 59, 0.2);
          color: var(--accent-red);
          border-radius: 0.25rem;
          font-size: 0.7rem;
        }

        .actions-cell {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--text-muted);
        }

        .empty-state .hint {
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .suppliers-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .suppliers-header h2 {
          margin: 0;
          font-size: 1rem;
          color: var(--ql-yellow);
        }

        .suppliers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .supplier-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .supplier-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .supplier-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .status-badge {
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .status-active {
          background: rgba(2, 219, 168, 0.2);
          color: var(--accent-green);
        }

        .status-inactive {
          background: rgba(107, 114, 128, 0.2);
          color: #6b7280;
        }

        .status-error {
          background: rgba(235, 61, 59, 0.2);
          color: var(--accent-red);
        }

        .supplier-details {
          font-size: 0.875rem;
          margin-bottom: 0.75rem;
        }

        .supplier-details p {
          margin: 0.25rem 0;
        }

        .supplier-actions {
          display: flex;
          gap: 0.5rem;
        }

        .import-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .import-section h3 {
          margin: 0 0 0.5rem 0;
          color: var(--ql-yellow);
        }

        .import-section > p {
          color: var(--text-muted);
          margin-bottom: 1rem;
        }

        .import-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .import-option {
          padding: 1rem;
          background: var(--bg-tertiary);
          border-radius: 0.5rem;
        }

        .import-option h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
        }

        .import-option p {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .file-input {
          display: block;
          width: 100%;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-lg {
          max-width: 700px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.125rem;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: var(--text-muted);
          cursor: pointer;
        }

        .modal-close:hover {
          color: var(--text-primary);
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .form-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.25rem;
        }

        .part-summary {
          background: var(--bg-tertiary);
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }

        .part-summary p {
          margin: 0.25rem 0;
        }

        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: 1rem;
          }

          .header-stats {
            width: 100%;
            justify-content: space-around;
          }

          .filters-section {
            flex-direction: column;
          }

          .filters {
            flex-direction: column;
          }

          .filters .form-input,
          .filters .form-select {
            max-width: 100%;
          }

          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
