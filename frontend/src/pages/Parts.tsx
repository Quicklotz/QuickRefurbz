"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Boxes,
  Recycle,
  ShoppingCart,
  AlertTriangle,
  Link2,
  MapPin,
  Upload,
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

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
  'SCREEN', 'BATTERY', 'CHARGING_PORT', 'CAMERA', 'SPEAKER',
  'MICROPHONE', 'BUTTON', 'HOUSING', 'LOGIC_BOARD', 'RAM',
  'STORAGE', 'KEYBOARD', 'TRACKPAD', 'FAN', 'POWER_SUPPLY', 'OTHER',
];

const SOURCE_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  HARVESTED: 'info',
  PURCHASED: 'warning',
  SYNCED: 'success',
};

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

  const [newPart, setNewPart] = useState({
    sku: '', name: '', category: 'SCREEN', compatible_devices: '',
    quantity: 0, min_quantity: 5, cost: 0, supplier: '',
    source: 'PURCHASED' as 'HARVESTED' | 'PURCHASED' | 'SYNCED',
    location: '', condition: 'NEW', harvested_from_qlid: '',
  });

  const [stockAdjust, setStockAdjust] = useState({ quantity: 0, reason: '' });

  const [newSupplier, setNewSupplier] = useState({
    name: '', apiUrl: '', apiKey: '', syncType: 'MANUAL' as 'API' | 'XLSX' | 'MANUAL',
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
    const matchesSearch = !searchQuery ||
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
        compatible_devices: newPart.compatible_devices.split(',').map((d) => d.trim()).filter(Boolean),
      });
      setMessage({ type: 'success', text: 'Part added successfully' });
      setShowAddPart(false);
      setNewPart({
        sku: '', name: '', category: 'SCREEN', compatible_devices: '',
        quantity: 0, min_quantity: 5, cost: 0, supplier: '',
        source: 'PURCHASED', location: '', condition: 'NEW', harvested_from_qlid: '',
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

  const getLowStockCount = () => parts.filter((p) => p.quantity <= p.min_quantity).length;
  const getHarvestedCount = () => parts.filter((p) => p.source === 'HARVESTED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading parts inventory..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Parts Inventory</h1>
          <TextGenerateEffect
            words="Manage parts, track stock levels, and sync with suppliers"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowAddPart(true)}>
            <Plus size={18} />
            Add Part
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatCard label="Total Parts" value={parts.length} icon={Boxes} color="yellow" />
        <StatCard label="Harvested" value={getHarvestedCount()} icon={Recycle} color="purple" />
        <StatCard label="Low Stock" value={getLowStockCount()} icon={AlertTriangle} color="red" />
        <StatCard label="Suppliers" value={suppliers.length} icon={ShoppingCart} color="blue" />
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-accent-green/10 border-accent-green text-accent-green'
                : 'bg-accent-red/10 border-accent-red text-accent-red'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 border-b border-border pb-2"
      >
        {(['inventory', 'suppliers'] as const).map((tab) => (
          <motion.button
            key={tab}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-ql-yellow text-black'
                : 'text-zinc-400 hover:text-white hover:bg-dark-tertiary'
            }`}
          >
            {tab === 'inventory' ? 'Inventory' : 'Suppliers & Sync'}
          </motion.button>
        ))}
      </motion.div>

      {activeTab === 'inventory' && (
        <>
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SpotlightCard className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Filter size={18} />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    placeholder="Search parts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                </div>
                <select
                  className="bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {PART_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <select
                  className="bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none text-sm"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="">All Sources</option>
                  <option value="HARVESTED">Harvested</option>
                  <option value="PURCHASED">Purchased</option>
                  <option value="SYNCED">Synced</option>
                </select>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Parts Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SpotlightCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredParts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                            <div className="flex flex-col items-center gap-2">
                              <Package className="w-8 h-8 text-zinc-600" />
                              <span>No parts found</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredParts.map((part, index) => (
                          <motion.tr
                            key={part.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.02 }}
                            className={`border-b border-border hover:bg-dark-tertiary/50 transition-colors ${
                              part.quantity <= part.min_quantity ? 'bg-accent-red/5' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono font-semibold text-ql-yellow">{part.sku}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white">{part.name}</span>
                              {part.compatible_devices?.length > 0 && (
                                <span className="block text-xs text-zinc-500">
                                  {part.compatible_devices.slice(0, 2).join(', ')}
                                  {part.compatible_devices.length > 2 && ` +${part.compatible_devices.length - 2}`}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{part.category.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3">
                              <Badge variant={SOURCE_VARIANTS[part.source]} size="sm">
                                {part.source}
                              </Badge>
                              {part.harvested_from_qlid && (
                                <span className="block text-xs text-zinc-500 mt-1">from {part.harvested_from_qlid}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${part.quantity <= part.min_quantity ? 'text-accent-red' : 'text-white'}`}>
                                {part.quantity}
                              </span>
                              {part.quantity <= part.min_quantity && (
                                <Badge variant="danger" size="sm" className="ml-2">Low</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">${part.cost.toFixed(2)}</td>
                            <td className="px-4 py-3 text-zinc-400">{part.location || '-'}</td>
                            <td className="px-4 py-3">
                              <Button variant="secondary" size="sm" onClick={() => setShowAdjustStock(part)}>
                                Adjust
                              </Button>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </SpotlightCard>
          </motion.div>
        </>
      )}

      {activeTab === 'suppliers' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-ql-yellow">Third-Party Suppliers</h2>
            <Button variant="primary" onClick={() => setShowAddSupplier(true)}>
              <Plus size={18} />
              Add Supplier
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.length === 0 ? (
              <SpotlightCard className="p-8 col-span-full text-center">
                <Link2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No suppliers configured</p>
                <p className="text-zinc-500 text-sm">Add a supplier to sync parts from external sources</p>
              </SpotlightCard>
            ) : (
              suppliers.map((supplier) => (
                <SpotlightCard key={supplier.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-white">{supplier.name}</h3>
                    <Badge
                      variant={supplier.status === 'ACTIVE' ? 'success' : supplier.status === 'ERROR' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {supplier.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-zinc-400">
                      <span className="text-zinc-500">Sync Type:</span> {supplier.sync_type}
                    </p>
                    {supplier.api_url && (
                      <p className="text-zinc-400 truncate">
                        <span className="text-zinc-500">API:</span> {supplier.api_url}
                      </p>
                    )}
                    {supplier.last_sync && (
                      <p className="text-zinc-400">
                        <span className="text-zinc-500">Last Sync:</span> {new Date(supplier.last_sync).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {supplier.sync_type === 'API' && (
                      <Button variant="secondary" size="sm" onClick={() => handleSyncSupplier(supplier.id)}>
                        Sync Now
                      </Button>
                    )}
                    {supplier.sync_type === 'XLSX' && (
                      <Button variant="secondary" size="sm">
                        <Upload size={14} />
                        Upload
                      </Button>
                    )}
                  </div>
                </SpotlightCard>
              ))
            )}
          </div>

          <SpotlightCard className="p-6">
            <h3 className="text-lg font-semibold text-ql-yellow mb-2">Import Parts</h3>
            <p className="text-zinc-400 text-sm mb-4">Import parts from an XLSX file or paste data directly.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-dark-tertiary rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">XLSX Upload</h4>
                <p className="text-xs text-zinc-500 mb-3">Upload spreadsheet with: SKU, Name, Category, Quantity, Cost</p>
                <input type="file" accept=".xlsx,.xls,.csv" className="text-sm text-zinc-400 mb-2 w-full" />
                <Button variant="secondary" size="sm">Upload</Button>
              </div>
              <div className="bg-dark-tertiary rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">API Data Feed</h4>
                <p className="text-xs text-zinc-500 mb-3">Configure a supplier to automatically sync parts data</p>
                <Button variant="secondary" size="sm" onClick={() => setShowAddSupplier(true)}>
                  Configure Supplier
                </Button>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      )}

      {/* Add Part Modal */}
      <AnimatedModal isOpen={showAddPart} onClose={() => setShowAddPart(false)} title="Add New Part">
        <form onSubmit={handleAddPart} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" value={newPart.sku} onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                value={newPart.category}
                onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
              >
                {PART_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="source">Source *</Label>
              <select
                id="source"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                value={newPart.source}
                onChange={(e) => setNewPart({ ...newPart, source: e.target.value as any })}
              >
                <option value="HARVESTED">Harvested</option>
                <option value="PURCHASED">Purchased</option>
                <option value="SYNCED">Synced</option>
              </select>
            </div>
          </div>

          {newPart.source === 'HARVESTED' && (
            <div>
              <Label htmlFor="harvestedFrom">Harvested From QLID</Label>
              <Input
                id="harvestedFrom"
                value={newPart.harvested_from_qlid}
                onChange={(e) => setNewPart({ ...newPart, harvested_from_qlid: e.target.value })}
                placeholder="e.g., QLID000000001"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="qty">Quantity *</Label>
              <Input id="qty" type="number" min={0} value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 0 })} required />
            </div>
            <div>
              <Label htmlFor="minQty">Min Quantity</Label>
              <Input id="minQty" type="number" min={0} value={newPart.min_quantity} onChange={(e) => setNewPart({ ...newPart, min_quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label htmlFor="cost">Cost ($)</Label>
              <Input id="cost" type="number" min={0} step={0.01} value={newPart.cost} onChange={(e) => setNewPart({ ...newPart, cost: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <Input id="location" value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} placeholder="e.g., Shelf A-3" className="pl-10" />
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </div>
            </div>
            <div>
              <Label htmlFor="condition">Condition</Label>
              <select
                id="condition"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
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

          <div>
            <Label htmlFor="compatible">Compatible Devices</Label>
            <Input
              id="compatible"
              value={newPart.compatible_devices}
              onChange={(e) => setNewPart({ ...newPart, compatible_devices: e.target.value })}
              placeholder="e.g., iPhone 14 Pro, iPhone 14 Pro Max"
            />
            <span className="text-xs text-zinc-500 mt-1">Comma-separated list</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setShowAddPart(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Add Part</Button>
          </div>
        </form>
      </AnimatedModal>

      {/* Adjust Stock Modal */}
      <AnimatedModal isOpen={!!showAdjustStock} onClose={() => setShowAdjustStock(null)} title="Adjust Stock">
        {showAdjustStock && (
          <div className="space-y-4">
            <div className="bg-dark-tertiary rounded-lg p-4">
              <p className="text-white"><strong>Part:</strong> {showAdjustStock.name}</p>
              <p className="text-zinc-400"><strong>SKU:</strong> {showAdjustStock.sku}</p>
              <p className="text-zinc-400"><strong>Current Qty:</strong> {showAdjustStock.quantity}</p>
            </div>

            <div>
              <Label htmlFor="adjustment">Adjustment *</Label>
              <Input
                id="adjustment"
                type="number"
                value={stockAdjust.quantity}
                onChange={(e) => setStockAdjust({ ...stockAdjust, quantity: parseInt(e.target.value) || 0 })}
                placeholder="e.g., +5 or -3"
              />
              <span className="text-xs text-zinc-500 mt-1">
                New quantity: {showAdjustStock.quantity + stockAdjust.quantity}
              </span>
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <select
                id="reason"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setShowAdjustStock(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleAdjustStock} disabled={!stockAdjust.reason}>Apply Adjustment</Button>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* Add Supplier Modal */}
      <AnimatedModal isOpen={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Add Supplier">
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <div>
            <Label htmlFor="supplierName">Supplier Name *</Label>
            <Input
              id="supplierName"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
              placeholder="e.g., iFixit, Injured Gadgets"
              required
            />
          </div>

          <div>
            <Label htmlFor="syncType">Sync Type *</Label>
            <select
              id="syncType"
              className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
              value={newSupplier.syncType}
              onChange={(e) => setNewSupplier({ ...newSupplier, syncType: e.target.value as any })}
            >
              <option value="API">API Integration - Real-time sync via REST API</option>
              <option value="XLSX">XLSX Import - Manual spreadsheet uploads</option>
              <option value="MANUAL">Manual Entry - Direct data entry</option>
            </select>
          </div>

          {newSupplier.syncType === 'API' && (
            <>
              <div>
                <Label htmlFor="apiUrl">API URL</Label>
                <Input
                  id="apiUrl"
                  type="url"
                  value={newSupplier.apiUrl}
                  onChange={(e) => setNewSupplier({ ...newSupplier, apiUrl: e.target.value })}
                  placeholder="https://api.supplier.com/v1/parts"
                />
              </div>
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={newSupplier.apiKey}
                  onChange={(e) => setNewSupplier({ ...newSupplier, apiKey: e.target.value })}
                  placeholder="Your API key"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Add Supplier</Button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
