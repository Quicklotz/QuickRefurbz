"use client";
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Search,
  Filter,
  Download,
  Eye,
  Smartphone,
  Tablet,
  Laptop,
  Zap,
  Snowflake,
  Wind,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface CertifiedDevice {
  id: string;
  certificationId: string;
  qlid: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  certificationLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NOT_CERTIFIED';
  certifiedBy: string;
  certifiedAt: string;
  isRevoked: boolean;
  warrantyInfo?: {
    type: string;
    status: string;
    endDate?: string;
  };
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  PHONE: <Smartphone size={16} />,
  TABLET: <Tablet size={16} />,
  LAPTOP: <Laptop size={16} />,
  APPLIANCE_SMALL: <Zap size={16} />,
  ICE_MAKER: <Snowflake size={16} />,
  VACUUM: <Wind size={16} />,
};

const LEVEL_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  EXCELLENT: 'success',
  GOOD: 'info',
  FAIR: 'warning',
  NOT_CERTIFIED: 'danger',
};

export function DeviceDatabase() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<CertifiedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const [stats, setStats] = useState({
    total: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    notCertified: 0,
  });

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      };

      if (searchTerm) params.search = searchTerm;
      if (filterCategory) params.category = filterCategory;
      if (filterLevel) params.level = filterLevel;
      if (filterDateFrom) params.fromDate = filterDateFrom;
      if (filterDateTo) params.toDate = filterDateTo;

      const data = await api.getCertifications(params);
      setDevices(data);
      setTotalCount(data.length === pageSize ? (page * pageSize) + 1 : page * pageSize);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterCategory, filterLevel, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.getCertificationStats();
        if (data) {
          setStats({
            total: data.total || 0,
            excellent: data.byLevel?.EXCELLENT || 0,
            good: data.byLevel?.GOOD || 0,
            fair: data.byLevel?.FAIR || 0,
            notCertified: data.byLevel?.NOT_CERTIFIED || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadDevices();
  }

  function clearFilters() {
    setSearchTerm('');
    setFilterCategory('');
    setFilterLevel('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }

  async function exportToCsv() {
    try {
      const params: Record<string, string> = { limit: '10000' };
      if (searchTerm) params.search = searchTerm;
      if (filterCategory) params.category = filterCategory;
      if (filterLevel) params.level = filterLevel;
      if (filterDateFrom) params.fromDate = filterDateFrom;
      if (filterDateTo) params.toDate = filterDateTo;

      const data = await api.getCertifications(params);

      const headers = ['Certification ID', 'QLID', 'Category', 'Manufacturer', 'Model', 'Serial', 'Level', 'Certified By', 'Certified At', 'Status'];
      const rows = data.map((d: CertifiedDevice) => [
        d.certificationId,
        d.qlid,
        d.category,
        d.manufacturer,
        d.model,
        d.serialNumber || '',
        d.certificationLevel,
        d.certifiedBy,
        new Date(d.certifiedAt).toISOString(),
        d.isRevoked ? 'REVOKED' : 'VALID',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `device-database-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to export: ' + err.message);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasFilters = searchTerm || filterCategory || filterLevel || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Database className="w-8 h-8 text-ql-yellow" />
            Device Database
          </h1>
          <TextGenerateEffect
            words="Search and browse all certified devices"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="secondary" onClick={exportToCsv}>
          <Download size={18} />
          Export CSV
        </Button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg flex justify-between items-center"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-accent-red hover:text-white">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatCard label="Total Devices" value={stats.total} icon={Database} color="yellow" />
        <StatCard label="Excellent" value={stats.excellent} icon={Smartphone} color="green" />
        <StatCard label="Good" value={stats.good} icon={Tablet} color="blue" />
        <StatCard label="Fair" value={stats.fair} icon={Laptop} color="yellow" />
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="p-4">
          <form onSubmit={handleSearch}>
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by QLID, certification ID, manufacturer, model, serial..."
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </div>
              <Button
                type="button"
                variant={showFilters ? 'primary' : 'secondary'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={18} />
              </Button>
              <Button type="submit" variant="primary">
                Search
              </Button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-4 bg-dark-tertiary rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Category</Label>
                        <select
                          value={filterCategory}
                          onChange={e => setFilterCategory(e.target.value)}
                          className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                        >
                          <option value="">All Categories</option>
                          <option value="PHONE">Phone</option>
                          <option value="TABLET">Tablet</option>
                          <option value="LAPTOP">Laptop</option>
                          <option value="APPLIANCE_SMALL">Small Appliance</option>
                          <option value="ICE_MAKER">Ice Maker</option>
                          <option value="VACUUM">Vacuum</option>
                        </select>
                      </div>
                      <div>
                        <Label>Level</Label>
                        <select
                          value={filterLevel}
                          onChange={e => setFilterLevel(e.target.value)}
                          className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                        >
                          <option value="">All Levels</option>
                          <option value="EXCELLENT">Excellent</option>
                          <option value="GOOD">Good</option>
                          <option value="FAIR">Fair</option>
                          <option value="NOT_CERTIFIED">Not Certified</option>
                        </select>
                      </div>
                      <div>
                        <Label>From Date</Label>
                        <Input
                          type="date"
                          value={filterDateFrom}
                          onChange={e => setFilterDateFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>To Date</Label>
                        <Input
                          type="date"
                          value={filterDateTo}
                          onChange={e => setFilterDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                    {hasFilters && (
                      <div className="mt-4 text-right">
                        <Button type="button" variant="secondary" onClick={clearFilters}>
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </SpotlightCard>
      </motion.div>

      {/* Results Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Certification</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">QLID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Certified</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <LoadingSpinner size="lg" text="Loading devices..." />
                    </td>
                  </tr>
                ) : devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                      <Database className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      No devices found
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {devices.map((device, index) => (
                      <motion.tr
                        key={device.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b border-border hover:bg-dark-tertiary/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <code className="text-sm font-mono text-ql-yellow">{device.certificationId}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white">{device.qlid}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white">{device.manufacturer} {device.model}</span>
                          {device.serialNumber && (
                            <span className="block text-xs text-zinc-500">S/N: {device.serialNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">{CATEGORY_ICONS[device.category]}</span>
                            <span className="text-zinc-300">{device.category.replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={LEVEL_VARIANTS[device.certificationLevel]} size="sm">
                            {device.certificationLevel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-zinc-400 text-sm">
                            <Calendar size={14} />
                            {new Date(device.certifiedAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {device.isRevoked ? (
                            <Badge variant="danger" size="sm">Revoked</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Valid</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/certifications?id=${device.certificationId}`)}
                              title="View Details"
                            >
                              <Eye size={14} />
                            </Button>
                            <a
                              href={`/verify/${device.certificationId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm" title="Public Report">
                                <ExternalLink size={14} />
                              </Button>
                            </a>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-border">
              <span className="text-sm text-zinc-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={devices.length < pageSize}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
