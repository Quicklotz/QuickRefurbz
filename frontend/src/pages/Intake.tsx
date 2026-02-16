"use client";
import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Boxes,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/api/client';
import { usePalletSession } from '@/contexts/PalletSessionContext';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { Loader } from '@/components/aceternity/loader';
import { Badge } from '@/components/shared/Badge';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { PalletSessionCard } from '@/components/pallet-session/PalletSessionCard';
import { PalletLabelModal } from '@/components/pallet-session/PalletLabelModal';

interface Pallet {
  palletId: string;
  status: string;
  retailer: string;
  receivedAt: string;
  totalCogs: number;
  expectedCount: number;
  actualCount: number;
}

interface IntakeItem {
  qlid: string;
  palletId: string;
  manufacturer: string;
  model: string;
  category: string;
  currentStage: string;
  createdAt: string;
}

const CATEGORIES = [
  'PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'MONITOR',
  'APPLIANCE_SMALL', 'APPLIANCE_LARGE', 'ICE_MAKER', 'VACUUM', 'OTHER',
];

export function Intake() {
  const { session, isActive } = usePalletSession();

  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [recentItems, setRecentItems] = useState<IntakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreatePallet, setShowCreatePallet] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Create pallet form
  const [newPallet, setNewPallet] = useState({
    palletId: '',
    retailer: 'BEST_BUY',
    totalCogs: 0,
    expectedCount: 0,
  });

  // Add item form
  const [newItem, setNewItem] = useState({
    manufacturer: '',
    model: '',
    category: 'PHONE',
    upc: '',
    serialNumber: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [palletsData, itemsData] = await Promise.all([
        api.getPallets({ status: 'RECEIVING,IN_PROGRESS' }),
        api.getItems({ stage: 'INTAKE', limit: '10' }),
      ]);
      setPallets(palletsData);
      setRecentItems(itemsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await api.createPallet(newPallet);
      setMessage({ type: 'success', text: `Pallet ${newPallet.palletId} created successfully` });
      setShowCreatePallet(false);
      setNewPallet({ palletId: '', retailer: 'BEST_BUY', totalCogs: 0, expectedCount: 0 });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create pallet' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.palletId) {
      setMessage({ type: 'error', text: 'Please select a pallet first' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const item = await api.createItem({
        palletId: session.palletId,
        ...newItem,
      });
      setMessage({ type: 'success', text: `Item ${item.qlid} added successfully` });
      setShowAddItem(false);
      setNewItem({ manufacturer: '', model: '', category: 'PHONE', upc: '', serialNumber: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add item' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPallets = pallets.filter((p) =>
    !searchQuery || p.palletId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = pallets.filter((p) => p.status === 'IN_PROGRESS').length;
  const receivingCount = pallets.filter((p) => p.status === 'RECEIVING').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="bars" text="Loading intake data..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-white">Intake</h1>
          <p className="mt-1 text-zinc-500">Receive pallets and add items to the system</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw size={18} />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowCreatePallet(true)}>
            <Plus size={18} />
            New Pallet
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6 transition-colors hover:border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Total Pallets</p>
            <Boxes size={18} className="text-zinc-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{pallets.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6 transition-colors hover:border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Receiving</p>
            <Package size={18} className="text-zinc-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ql-yellow)]">{receivingCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6 transition-colors hover:border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">In Progress</p>
            <RefreshCw size={18} className="text-zinc-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-accent-blue)]">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6 transition-colors hover:border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Recent Items</p>
            <CheckCircle size={18} className="text-zinc-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-accent-green)]">{recentItems.length}</p>
        </div>
      </div>

      {/* Pallet Session Card */}
      <PalletSessionCard onPrintLabel={() => setShowPrintLabel(true)} />

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-[var(--color-accent-green)]/10 border-[var(--color-accent-green)]/30 text-[var(--color-accent-green)]'
              : 'bg-[var(--color-accent-red)]/10 border-[var(--color-accent-red)]/30 text-[var(--color-accent-red)]'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pallets List */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
          <div className="p-6 flex justify-between items-center">
            <h2 className="text-base font-medium text-white">Active Pallets</h2>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search pallets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-48"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
          </div>
          <div className="px-6 pb-6">
            {filteredPallets.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                <Boxes size={32} className="mx-auto mb-3 text-zinc-600" />
                <p>No active pallets</p>
                <p className="text-sm text-zinc-600">Create a new pallet to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPallets.map((pallet) => (
                  <div
                    key={pallet.palletId}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-4 hover:border-[var(--color-border-light)] transition-colors"
                  >
                    <div>
                      <p className="font-mono font-semibold text-[var(--color-ql-yellow)]">{pallet.palletId}</p>
                      <p className="text-sm text-zinc-500">
                        {pallet.retailer} | {pallet.actualCount}/{pallet.expectedCount} items
                      </p>
                    </div>
                    <Badge
                      variant={pallet.status === 'RECEIVING' ? 'warning' : 'info'}
                      size="sm"
                    >
                      {pallet.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Add Item */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
          <div className="p-6">
            <h2 className="text-base font-medium text-white">Quick Add Item</h2>
            <p className="text-sm text-zinc-500 mt-1">Add an item to the current pallet session</p>
          </div>
          <div className="px-6 pb-6">
            {!isActive ? (
              <div className="py-12 text-center text-zinc-500">
                <Package size={32} className="mx-auto mb-3 text-zinc-600" />
                <p>No active pallet session</p>
                <p className="text-sm text-zinc-600">Start a pallet session to add items</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-dark-tertiary)]">
                  <CheckCircle size={16} className="text-[var(--color-accent-green)]" />
                  <span className="text-sm text-zinc-300">Active: <span className="font-mono text-[var(--color-ql-yellow)]">{session?.palletId}</span></span>
                </div>
                <Button variant="primary" className="w-full" onClick={() => setShowAddItem(true)}>
                  <Plus size={18} />
                  Add Item to Pallet
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Items */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
        <div className="p-6">
          <h2 className="text-base font-medium text-white">Recent Intake Items</h2>
        </div>
        <div className="px-6 pb-6">
          {recentItems.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">No recent items</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-dark-tertiary)]/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">QLID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Pallet</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {recentItems.map((item) => (
                    <tr key={item.qlid} className="hover:bg-[var(--color-dark-tertiary)]/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[var(--color-ql-yellow)]">{item.qlid}</td>
                      <td className="px-4 py-3 text-white">{item.manufacturer} {item.model}</td>
                      <td className="px-4 py-3 text-zinc-400">{item.category}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{item.palletId}</td>
                      <td className="px-4 py-3 text-zinc-500 text-sm">{new Date(item.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Pallet Modal */}
      <AnimatedModal isOpen={showCreatePallet} onClose={() => setShowCreatePallet(false)} title="Create New Pallet">
        <form onSubmit={handleCreatePallet} className="space-y-4">
          <div>
            <Label htmlFor="palletId">Pallet ID *</Label>
            <Input
              id="palletId"
              value={newPallet.palletId}
              onChange={(e) => setNewPallet({ ...newPallet, palletId: e.target.value.toUpperCase() })}
              placeholder="e.g., P1BBY"
              className="font-mono"
              required
            />
          </div>
          <div>
            <Label htmlFor="retailer">Retailer</Label>
            <select
              id="retailer"
              className="w-full bg-[var(--color-dark-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white focus:border-[var(--color-ql-yellow)] focus:outline-none"
              value={newPallet.retailer}
              onChange={(e) => setNewPallet({ ...newPallet, retailer: e.target.value })}
            >
              <option value="BEST_BUY">Best Buy</option>
              <option value="TARGET">Target</option>
              <option value="AMAZON">Amazon</option>
              <option value="COSTCO">Costco</option>
              <option value="WALMART">Walmart</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalCogs">Total COGS ($)</Label>
              <Input
                id="totalCogs"
                type="number"
                min={0}
                step={0.01}
                value={newPallet.totalCogs}
                onChange={(e) => setNewPallet({ ...newPallet, totalCogs: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="expectedCount">Expected Count</Label>
              <Input
                id="expectedCount"
                type="number"
                min={0}
                value={newPallet.expectedCount}
                onChange={(e) => setNewPallet({ ...newPallet, expectedCount: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setShowCreatePallet(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Create Pallet</Button>
          </div>
        </form>
      </AnimatedModal>

      {/* Add Item Modal */}
      <AnimatedModal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Add Item to Pallet">
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-dark-tertiary)]">
            <Boxes size={16} className="text-[var(--color-ql-yellow)]" />
            <span className="text-sm text-zinc-300">Adding to: <span className="font-mono text-[var(--color-ql-yellow)]">{session?.palletId}</span></span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={newItem.manufacturer}
                onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
                placeholder="e.g., Apple"
                required
              />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={newItem.model}
                onChange={(e) => setNewItem({ ...newItem, model: e.target.value })}
                placeholder="e.g., iPhone 14 Pro"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="w-full bg-[var(--color-dark-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white focus:border-[var(--color-ql-yellow)] focus:outline-none"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="upc">UPC (optional)</Label>
              <Input
                id="upc"
                value={newItem.upc}
                onChange={(e) => setNewItem({ ...newItem, upc: e.target.value })}
                placeholder="Barcode"
              />
            </div>
            <div>
              <Label htmlFor="serialNumber">Serial (optional)</Label>
              <Input
                id="serialNumber"
                value={newItem.serialNumber}
                onChange={(e) => setNewItem({ ...newItem, serialNumber: e.target.value })}
                placeholder="Serial number"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>
              <Plus size={18} />
              Add Item
            </Button>
          </div>
        </form>
      </AnimatedModal>

      {/* Pallet Label Modal */}
      <PalletLabelModal
        isOpen={showPrintLabel}
        onClose={() => setShowPrintLabel(false)}
        session={session}
      />
    </div>
  );
}
