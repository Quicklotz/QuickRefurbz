"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  FileText,
  QrCode,
  Download,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Printer,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
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

interface WarrantyInfo {
  type: 'MANUFACTURER' | 'EXTENDED' | 'RETAILER' | 'UPSCALED' | 'NONE';
  status: 'ACTIVE' | 'EXPIRED' | 'VOIDED' | 'UNKNOWN' | 'NOT_APPLICABLE';
  provider?: string;
  startDate?: string;
  endDate?: string;
  daysRemaining?: number;
  coverageType?: string;
}

interface Certification {
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
  revokedReason?: string;
  reportPdfUrl?: string;
  labelPngUrl?: string;
  publicReportUrl?: string;
  warrantyInfo?: WarrantyInfo;
}

interface CertificationStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentCount: number;
  revokedCount: number;
}

type ViewMode = 'list' | 'detail' | 'new';

const LEVEL_COLORS: Record<string, string> = {
  EXCELLENT: '#22c55e',
  GOOD: '#3b82f6',
  FAIR: '#f59e0b',
  NOT_CERTIFIED: '#ef4444',
};

const LEVEL_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  EXCELLENT: 'success',
  GOOD: 'info',
  FAIR: 'warning',
  NOT_CERTIFIED: 'danger',
};

const LEVEL_LABELS: Record<string, string> = {
  EXCELLENT: 'Certified Excellent',
  GOOD: 'Certified Good',
  FAIR: 'Certified Fair',
  NOT_CERTIFIED: 'Not Certified',
};

export function Certifications() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [stats, setStats] = useState<CertificationStats | null>(null);
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const [newCert, setNewCert] = useState({
    qlid: '',
    category: 'APPLIANCE_SMALL',
    manufacturer: '',
    model: '',
    serialNumber: '',
    certificationLevel: 'GOOD' as 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NOT_CERTIFIED',
    notes: '',
    warrantyType: '' as '' | 'MANUFACTURER' | 'EXTENDED' | 'RETAILER' | 'UPSCALED' | 'NONE',
    warrantyStatus: '' as '' | 'ACTIVE' | 'EXPIRED' | 'VOIDED' | 'UNKNOWN',
    warrantyProvider: '',
    warrantyEndDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState(false);

  const [externalChecks, setExternalChecks] = useState<{
    checks: any[];
    flags: { hasFlags: boolean; isStolen: boolean; isBlacklisted: boolean; hasFinancialHold: boolean; };
    summary: { total: number; clear: number; flagged: number; error: number; };
  } | null>(null);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterLevel, filterCategory]);

  async function loadData() {
    try {
      setLoading(true);
      const params: Record<string, string> = { limit: '100' };
      if (filterLevel) params.level = filterLevel;
      if (filterCategory) params.category = filterCategory;

      const [certsData, statsData] = await Promise.all([
        api.getCertifications(params),
        api.getCertificationStats(),
      ]);

      setCertifications(certsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function viewCertification(cert: Certification) {
    setSelectedCert(cert);
    setViewMode('detail');
    setLabelUrl(null);
    setExternalChecks(null);
    loadExternalChecks(cert.qlid);
  }

  async function loadLabel(certId: string) {
    try {
      setLoadingLabel(true);
      const url = await api.getCertificationLabel(certId);
      setLabelUrl(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingLabel(false);
    }
  }

  async function issueCertification() {
    if (!newCert.qlid || !newCert.manufacturer || !newCert.model) {
      setError('QLID, Manufacturer, and Model are required');
      return;
    }

    try {
      setSubmitting(true);
      const cert = await api.issueCertification({
        qlid: newCert.qlid,
        category: newCert.category,
        manufacturer: newCert.manufacturer,
        model: newCert.model,
        serialNumber: newCert.serialNumber || undefined,
        certificationLevel: newCert.certificationLevel,
        notes: newCert.notes || undefined,
        warrantyType: newCert.warrantyType || undefined,
        warrantyStatus: newCert.warrantyStatus || undefined,
        warrantyProvider: newCert.warrantyProvider || undefined,
        warrantyEndDate: newCert.warrantyEndDate || undefined,
      });

      setViewMode('detail');
      setSelectedCert(cert);
      setNewCert({
        qlid: '',
        category: 'APPLIANCE_SMALL',
        manufacturer: '',
        model: '',
        serialNumber: '',
        certificationLevel: 'GOOD',
        notes: '',
        warrantyType: '',
        warrantyStatus: '',
        warrantyProvider: '',
        warrantyEndDate: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeCertification(certId: string) {
    const reason = prompt('Enter revocation reason:');
    if (!reason) return;

    try {
      setSubmitting(true);
      await api.revokeCertification(certId, reason);
      loadData();
      if (selectedCert?.certificationId === certId) {
        setViewMode('list');
        setSelectedCert(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadExternalChecks(qlid: string) {
    try {
      setLoadingChecks(true);
      const data = await api.getExternalChecks(qlid);
      setExternalChecks(data);
    } catch (err: any) {
      console.error('Failed to load external checks:', err);
      setExternalChecks(null);
    } finally {
      setLoadingChecks(false);
    }
  }

  async function runExternalChecks(qlid: string, serial?: string) {
    try {
      setRunningChecks(true);
      const data = await api.runAllExternalChecks({
        qlid,
        serial: serial,
        certificationId: selectedCert?.certificationId,
      });
      setExternalChecks(data);
    } catch (err: any) {
      setError('Failed to run external checks: ' + err.message);
    } finally {
      setRunningChecks(false);
    }
  }

  const filteredCerts = certifications.filter(c =>
    c.qlid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.certificationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && viewMode === 'list') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading certifications..." />
      </div>
    );
  }

  // New Certification View
  if (viewMode === 'new') {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => setViewMode('list')} className="mb-2">
            <ArrowLeft size={16} />
            Back to Certifications
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">Issue New Certification</h1>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <SpotlightCard className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-ql-yellow">Device Information</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="qlid">QLID *</Label>
              <Input
                id="qlid"
                value={newCert.qlid}
                onChange={e => setNewCert({ ...newCert, qlid: e.target.value })}
                placeholder="Scan or enter QLID"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={newCert.category}
                onChange={e => setNewCert({ ...newCert, category: e.target.value })}
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
              >
                <option value="PHONE">Phone/Smartphone</option>
                <option value="TABLET">Tablet</option>
                <option value="LAPTOP">Laptop</option>
                <option value="APPLIANCE_SMALL">Small Appliance</option>
                <option value="ICE_MAKER">Ice Maker</option>
                <option value="VACUUM">Vacuum</option>
              </select>
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={newCert.manufacturer}
                onChange={e => setNewCert({ ...newCert, manufacturer: e.target.value })}
                placeholder="e.g., Ninja, Dyson, GE"
              />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={newCert.model}
                onChange={e => setNewCert({ ...newCert, model: e.target.value })}
                placeholder="e.g., Professional Blender BL660"
              />
            </div>
            <div>
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={newCert.serialNumber}
                onChange={e => setNewCert({ ...newCert, serialNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="level">Certification Level *</Label>
              <select
                id="level"
                value={newCert.certificationLevel}
                onChange={e => setNewCert({ ...newCert, certificationLevel: e.target.value as any })}
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                style={{ borderLeft: `4px solid ${LEVEL_COLORS[newCert.certificationLevel]}` }}
              >
                <option value="EXCELLENT">Excellent - Like New</option>
                <option value="GOOD">Good - Minor Wear</option>
                <option value="FAIR">Fair - Visible Wear</option>
                <option value="NOT_CERTIFIED">Not Certified - Failed Tests</option>
              </select>
            </div>
          </div>

          {/* Warranty Section */}
          <div className="bg-dark-tertiary rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-4">Warranty Information (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warrantyType">Warranty Type</Label>
                <select
                  id="warrantyType"
                  value={newCert.warrantyType}
                  onChange={e => setNewCert({ ...newCert, warrantyType: e.target.value as any })}
                  className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                >
                  <option value="">-- Select --</option>
                  <option value="MANUFACTURER">Manufacturer Warranty</option>
                  <option value="EXTENDED">Extended Warranty (AppleCare, etc.)</option>
                  <option value="RETAILER">Retailer Warranty</option>
                  <option value="UPSCALED">Upscaled Warranty</option>
                  <option value="NONE">No Warranty</option>
                </select>
              </div>
              <div>
                <Label htmlFor="warrantyStatus">Warranty Status</Label>
                <select
                  id="warrantyStatus"
                  value={newCert.warrantyStatus}
                  onChange={e => setNewCert({ ...newCert, warrantyStatus: e.target.value as any })}
                  className="w-full bg-dark-primary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                >
                  <option value="">-- Select --</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="VOIDED">Voided</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              <div>
                <Label htmlFor="warrantyProvider">Warranty Provider</Label>
                <Input
                  id="warrantyProvider"
                  value={newCert.warrantyProvider}
                  onChange={e => setNewCert({ ...newCert, warrantyProvider: e.target.value })}
                  placeholder="e.g., Apple, Asurion, Best Buy"
                />
              </div>
              <div>
                <Label htmlFor="warrantyEnd">Warranty End Date</Label>
                <Input
                  id="warrantyEnd"
                  type="date"
                  value={newCert.warrantyEndDate}
                  onChange={e => setNewCert({ ...newCert, warrantyEndDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={newCert.notes}
              onChange={e => setNewCert({ ...newCert, notes: e.target.value })}
              placeholder="Optional notes about the certification"
              className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setViewMode('list')}>Cancel</Button>
            <Button variant="primary" onClick={issueCertification} loading={submitting}>Issue Certification</Button>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  // Detail View
  if (viewMode === 'detail' && selectedCert) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => { setViewMode('list'); setSelectedCert(null); setLabelUrl(null); }} className="mb-2">
            <ArrowLeft size={16} />
            Back to Certifications
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">Certification Details</h1>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <SpotlightCard className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-mono font-semibold text-ql-yellow">{selectedCert.certificationId}</h2>
                <Badge variant={LEVEL_VARIANTS[selectedCert.certificationLevel]} className="text-base px-4 py-1.5">
                  {LEVEL_LABELS[selectedCert.certificationLevel]}
                </Badge>
              </div>

              {selectedCert.isRevoked && (
                <div className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg mb-6 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  <span><strong>REVOKED:</strong> {selectedCert.revokedReason}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 mb-4">Device Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">QLID</span>
                      <span className="font-semibold text-white">{selectedCert.qlid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Manufacturer</span>
                      <span className="text-white">{selectedCert.manufacturer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Model</span>
                      <span className="text-white">{selectedCert.model}</span>
                    </div>
                    {selectedCert.serialNumber && (
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Serial Number</span>
                        <span className="text-white">{selectedCert.serialNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Category</span>
                      <span className="text-white">{selectedCert.category.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 mb-4">Certification Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Certified By</span>
                      <span className="text-white">{selectedCert.certifiedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Certified At</span>
                      <span className="text-white">{new Date(selectedCert.certifiedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Status</span>
                      {selectedCert.isRevoked ? (
                        <Badge variant="danger"><XCircle size={12} className="mr-1" /> Revoked</Badge>
                      ) : (
                        <Badge variant="success"><CheckCircle size={12} className="mr-1" /> Valid</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warranty Info */}
              {selectedCert.warrantyInfo && (
                <div className="mt-6 p-4 bg-dark-tertiary rounded-lg">
                  <h3 className="text-sm font-semibold text-zinc-500 mb-4">Warranty Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-zinc-500">Type</span>
                      <p className="text-white">{selectedCert.warrantyInfo.type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">Status</span>
                      <Badge
                        variant={selectedCert.warrantyInfo.status === 'ACTIVE' ? 'success' : selectedCert.warrantyInfo.status === 'EXPIRED' ? 'danger' : 'warning'}
                        className="mt-1"
                      >
                        {selectedCert.warrantyInfo.status}
                      </Badge>
                    </div>
                    {selectedCert.warrantyInfo.provider && (
                      <div>
                        <span className="text-xs text-zinc-500">Provider</span>
                        <p className="text-white">{selectedCert.warrantyInfo.provider}</p>
                      </div>
                    )}
                    {selectedCert.warrantyInfo.endDate && (
                      <div>
                        <span className="text-xs text-zinc-500">End Date</span>
                        <p className="text-white">{new Date(selectedCert.warrantyInfo.endDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {selectedCert.warrantyInfo.daysRemaining !== undefined && selectedCert.warrantyInfo.daysRemaining > 0 && (
                      <div>
                        <span className="text-xs text-zinc-500">Days Remaining</span>
                        <p className="text-accent-green font-semibold">{selectedCert.warrantyInfo.daysRemaining}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3 flex-wrap">
                <Button variant="primary" onClick={() => loadLabel(selectedCert.certificationId)} loading={loadingLabel}>
                  <QrCode size={16} />
                  View Label
                </Button>
                <Button variant="secondary">
                  <FileText size={16} />
                  Download Report
                </Button>
                {!selectedCert.isRevoked && (
                  <Button variant="ghost" onClick={() => revokeCertification(selectedCert.certificationId)} loading={submitting} className="text-accent-red border-accent-red hover:bg-accent-red/10">
                    <XCircle size={16} />
                    Revoke
                  </Button>
                )}
              </div>
            </SpotlightCard>

            {/* External Checks */}
            <SpotlightCard className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-ql-yellow" />
                  <h3 className="font-semibold text-white">External Device Checks</h3>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runExternalChecks(selectedCert.qlid, selectedCert.serialNumber)}
                  loading={runningChecks}
                >
                  <RefreshCw size={14} />
                  Run Checks
                </Button>
              </div>

              {loadingChecks ? (
                <div className="text-center py-8 text-zinc-400">Loading checks...</div>
              ) : externalChecks ? (
                <>
                  {externalChecks.flags.hasFlags && (
                    <div className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg mb-4 flex items-center gap-2">
                      <ShieldAlert size={18} />
                      <span><strong>WARNING:</strong> Device has flags!</span>
                      {externalChecks.flags.isStolen && <Badge variant="danger" size="sm">STOLEN</Badge>}
                      {externalChecks.flags.isBlacklisted && <Badge variant="danger" size="sm">BLACKLISTED</Badge>}
                      {externalChecks.flags.hasFinancialHold && <Badge variant="warning" size="sm">FINANCIAL HOLD</Badge>}
                    </div>
                  )}

                  {externalChecks.checks.length > 0 ? (
                    <div className="space-y-2">
                      {externalChecks.checks.map((check: any) => (
                        <div
                          key={check.id}
                          className={`flex justify-between items-center p-3 bg-dark-tertiary rounded-lg border-l-4 ${
                            check.status === 'CLEAR' ? 'border-accent-green' : check.status === 'FLAGGED' ? 'border-accent-red' : 'border-ql-yellow'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-white">{check.checkType}</p>
                            <p className="text-xs text-zinc-500">via {check.provider} • {new Date(check.checkedAt).toLocaleString()}</p>
                          </div>
                          <Badge variant={check.status === 'CLEAR' ? 'success' : check.status === 'FLAGGED' ? 'danger' : 'warning'}>
                            {check.status === 'CLEAR' && <ShieldCheck size={12} className="mr-1" />}
                            {check.status === 'FLAGGED' && <ShieldAlert size={12} className="mr-1" />}
                            {check.status}
                          </Badge>
                        </div>
                      ))}
                      <p className="text-xs text-zinc-500 text-center mt-4">
                        {externalChecks.summary.total} checks: {externalChecks.summary.clear} clear, {externalChecks.summary.flagged} flagged, {externalChecks.summary.error} errors
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-zinc-400">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      <p>No checks recorded. Click "Run Checks" to verify device.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-zinc-400">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                  <p>Click "Run Checks" to verify IMEI/serial status</p>
                </div>
              )}
            </SpotlightCard>
          </div>

          {/* Label Preview */}
          <div className="space-y-6">
            <SpotlightCard className="p-6">
              <h3 className="font-semibold text-white mb-4">Certification Label</h3>
              {labelUrl ? (
                <div className="text-center">
                  <img
                    src={labelUrl}
                    alt="Certification Label"
                    className="max-w-full border border-border rounded-lg mb-4"
                  />
                  <div className="flex gap-2 justify-center">
                    <a href={labelUrl} download={`${selectedCert.certificationId}-label.png`}>
                      <Button variant="secondary" size="sm">
                        <Download size={14} />
                        Download
                      </Button>
                    </a>
                    <Button variant="secondary" size="sm" onClick={() => window.print()}>
                      <Printer size={14} />
                      Print
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-400">
                  <QrCode className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                  <p>Click "View Label" to generate</p>
                </div>
              )}
            </SpotlightCard>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Certifications</h1>
          <TextGenerateEffect
            words="Issue and manage device certifications"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="primary" onClick={() => setViewMode('new')}>
          <Plus size={18} />
          New Certification
        </Button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <StatCard label="Total Certified" value={stats.total} icon={Award} color="blue" />
          <StatCard label="Excellent" value={stats.byLevel?.EXCELLENT || 0} icon={CheckCircle} color="green" />
          <StatCard label="Good" value={stats.byLevel?.GOOD || 0} icon={CheckCircle} color="blue" />
          <StatCard label="Fair" value={stats.byLevel?.FAIR || 0} icon={AlertTriangle} color="yellow" />
        </motion.div>
      )}

      {/* Filters */}
      <SpotlightCard className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by QLID, cert ID, manufacturer, model..."
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          </div>
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
          >
            <option value="">All Levels</option>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="NOT_CERTIFIED">Not Certified</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="PHONE">Phone/Smartphone</option>
            <option value="TABLET">Tablet</option>
            <option value="LAPTOP">Laptop</option>
            <option value="APPLIANCE_SMALL">Small Appliance</option>
            <option value="ICE_MAKER">Ice Maker</option>
            <option value="VACUUM">Vacuum</option>
          </select>
        </div>
      </SpotlightCard>

      {/* Certifications Table */}
      <SpotlightCard className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-ql-yellow">Recent Certifications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Cert ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">QLID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Device</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredCerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                      <Award className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      No certifications found
                    </td>
                  </tr>
                ) : (
                  filteredCerts.map((cert, index) => (
                    <motion.tr
                      key={cert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-border hover:bg-dark-tertiary/50"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-ql-yellow">{cert.certificationId}</td>
                      <td className="px-4 py-3 text-white">{cert.qlid}</td>
                      <td className="px-4 py-3 text-zinc-300">{cert.manufacturer} {cert.model}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">{cert.category.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={LEVEL_VARIANTS[cert.certificationLevel]} size="sm">
                          {cert.certificationLevel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{new Date(cert.certifiedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {cert.isRevoked ? (
                          <Badge variant="danger" size="sm">Revoked</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Valid</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm" onClick={() => viewCertification(cert)}>
                          <Eye size={14} />
                          View
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
    </div>
  );
}
