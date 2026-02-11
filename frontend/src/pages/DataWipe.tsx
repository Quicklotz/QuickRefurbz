"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  RefreshCw,
  Plus,
  Search,
  Eye,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  HardDrive,
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

interface DataWipeReport {
  id: string;
  qlid: string;
  job_id?: string;
  device_info: {
    make?: string;
    model?: string;
    serial?: string;
    imei?: string;
    storage?: string;
  };
  wipe_method: string;
  wipe_status: string;
  started_at: string;
  completed_at?: string;
  verified_at?: string;
  verified_by?: string;
  verification_method?: string;
  certificate_data?: any;
  notes?: string;
}

const WIPE_METHODS = [
  { value: 'FACTORY_RESET', label: 'Factory Reset', description: 'Standard device factory reset' },
  { value: 'SECURE_ERASE', label: 'Secure Erase', description: 'DOD 5220.22-M compliant erase' },
  { value: 'BLANCCO', label: 'Blancco', description: 'Blancco certified data erasure' },
  { value: 'NIST_CLEAR', label: 'NIST Clear', description: 'NIST SP 800-88 Clear method' },
  { value: 'NIST_PURGE', label: 'NIST Purge', description: 'NIST SP 800-88 Purge method' },
];

const VERIFICATION_METHODS = [
  { value: 'VISUAL', label: 'Visual Verification', description: 'Manual visual confirmation' },
  { value: 'SOFTWARE', label: 'Software Verification', description: 'Automated software check' },
  { value: 'CERTIFICATE', label: 'Third-Party Certificate', description: 'External certification' },
];

const STATUS_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  VERIFIED: 'info',
  FAILED: 'danger',
};

export function DataWipePage() {
  const [reports, setReports] = useState<DataWipeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQlid, setSearchQlid] = useState('');
  const [selectedReport, setSelectedReport] = useState<DataWipeReport | null>(null);
  const [showNewWipe, setShowNewWipe] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newWipe, setNewWipe] = useState({
    qlid: '',
    deviceInfo: { make: '', model: '', serial: '', imei: '', storage: '' },
    wipeMethod: 'FACTORY_RESET',
  });

  const [completeForm, setCompleteForm] = useState({
    verificationMethod: 'VISUAL',
    notes: '',
  });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await api.getDataWipeReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQlid.trim()) {
      loadReports();
      return;
    }
    try {
      const report = await api.getDataWipeReport(searchQlid.trim());
      if (report) {
        setReports([report]);
      } else {
        setReports([]);
        setMessage({ type: 'error', text: 'No report found for this QLID' });
      }
    } catch (err) {
      setReports([]);
      setMessage({ type: 'error', text: 'No report found for this QLID' });
    }
  };

  const handleStartWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.startDataWipe({
        qlid: newWipe.qlid,
        deviceInfo: newWipe.deviceInfo,
        wipeMethod: newWipe.wipeMethod,
      });
      setMessage({ type: 'success', text: 'Data wipe started successfully' });
      setShowNewWipe(false);
      setNewWipe({
        qlid: '',
        deviceInfo: { make: '', model: '', serial: '', imei: '', storage: '' },
        wipeMethod: 'FACTORY_RESET',
      });
      loadReports();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to start data wipe' });
    }
  };

  const handleCompleteWipe = async () => {
    if (!selectedReport) return;
    setMessage(null);
    try {
      await api.completeDataWipe(selectedReport.id, {
        verificationMethod: completeForm.verificationMethod,
        notes: completeForm.notes,
      });
      setMessage({ type: 'success', text: 'Data wipe completed and verified' });
      setSelectedReport(null);
      setShowCompleteModal(false);
      setCompleteForm({ verificationMethod: 'VISUAL', notes: '' });
      loadReports();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to complete data wipe' });
    }
  };

  const handleViewCertificate = (report: DataWipeReport) => {
    setSelectedReport(report);
    setShowCertificate(true);
  };

  const handleDownloadCertificate = (report: DataWipeReport) => {
    const certContent = generateCertificateText(report);
    const blob = new Blob([certContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DataWipe_Certificate_${report.qlid}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateCertificateText = (report: DataWipeReport) => {
    return `
================================================================================
                        DATA WIPE CERTIFICATE
================================================================================

Certificate ID: ${report.id}
QLID: ${report.qlid}

DEVICE INFORMATION
------------------
Make: ${report.device_info?.make || 'N/A'}
Model: ${report.device_info?.model || 'N/A'}
Serial: ${report.device_info?.serial || 'N/A'}
IMEI: ${report.device_info?.imei || 'N/A'}
Storage: ${report.device_info?.storage || 'N/A'}

WIPE DETAILS
------------
Method: ${report.wipe_method}
Status: ${report.wipe_status}
Started: ${new Date(report.started_at).toLocaleString()}
Completed: ${report.completed_at ? new Date(report.completed_at).toLocaleString() : 'In Progress'}
Verified: ${report.verified_at ? new Date(report.verified_at).toLocaleString() : 'Pending'}
Verification Method: ${report.verification_method || 'N/A'}

NOTES
-----
${report.notes || 'None'}

================================================================================
This certificate confirms that all data has been securely erased from the
above device using the specified method in compliance with industry standards.
================================================================================
    `.trim();
  };

  const getStats = () => {
    const inProgress = reports.filter(r => r.wipe_status === 'IN_PROGRESS').length;
    const completed = reports.filter(r => r.wipe_status === 'COMPLETED' || r.wipe_status === 'VERIFIED').length;
    const verified = reports.filter(r => r.wipe_status === 'VERIFIED').length;
    return { total: reports.length, inProgress, completed, verified };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading data wipe reports..." />
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
          <h1 className="text-3xl font-bold text-white mb-2">Data Wipe Management</h1>
          <TextGenerateEffect
            words="Secure data erasure and certification tracking"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={loadReports}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowNewWipe(true)}>
            <Plus size={18} />
            Start New Wipe
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
        <StatCard label="Total Reports" value={stats.total} icon={FileText} color="yellow" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} color="blue" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label="Verified" value={stats.verified} icon={Shield} color="purple" />
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-lg border flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-accent-green/10 border-accent-green text-accent-green'
                : 'bg-accent-red/10 border-accent-red text-accent-red'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Search by QLID (e.g., QLID000000001)"
                value={searchQlid}
                onChange={(e) => setSearchQlid(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
            {searchQlid && (
              <Button variant="ghost" onClick={() => { setSearchQlid(''); loadReports(); }}>
                Clear
              </Button>
            )}
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Reports Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-ql-yellow">Wipe Reports</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">QLID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Started</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <Shield className="w-8 h-8 text-zinc-600" />
                          <span>No data wipe reports found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reports.map((report, index) => (
                      <motion.tr
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b border-border hover:bg-dark-tertiary/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-ql-yellow">{report.qlid}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white">{report.device_info?.make} {report.device_info?.model}</span>
                          {report.device_info?.serial && (
                            <span className="block text-xs text-zinc-500">S/N: {report.device_info.serial}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{report.wipe_method.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANTS[report.wipe_status] || 'info'} size="sm">
                            {report.wipe_status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {new Date(report.started_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {report.completed_at ? new Date(report.completed_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {report.wipe_status === 'IN_PROGRESS' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setShowCompleteModal(true);
                                }}
                              >
                                Complete
                              </Button>
                            )}
                            {(report.wipe_status === 'COMPLETED' || report.wipe_status === 'VERIFIED') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewCertificate(report)}
                                  title="View Certificate"
                                >
                                  <Eye size={16} />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDownloadCertificate(report)}
                                  title="Download Certificate"
                                >
                                  <Download size={16} />
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* New Wipe Modal */}
      <AnimatedModal isOpen={showNewWipe} onClose={() => setShowNewWipe(false)} title="Start Data Wipe">
        <form onSubmit={handleStartWipe} className="space-y-4">
          <div>
            <Label htmlFor="qlid">QLID *</Label>
            <Input
              id="qlid"
              value={newWipe.qlid}
              onChange={(e) => setNewWipe({ ...newWipe, qlid: e.target.value })}
              placeholder="e.g., QLID000000001"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={newWipe.deviceInfo.make}
                onChange={(e) => setNewWipe({
                  ...newWipe,
                  deviceInfo: { ...newWipe.deviceInfo, make: e.target.value }
                })}
                placeholder="e.g., Apple"
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={newWipe.deviceInfo.model}
                onChange={(e) => setNewWipe({
                  ...newWipe,
                  deviceInfo: { ...newWipe.deviceInfo, model: e.target.value }
                })}
                placeholder="e.g., iPhone 14 Pro"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={newWipe.deviceInfo.serial}
                onChange={(e) => setNewWipe({
                  ...newWipe,
                  deviceInfo: { ...newWipe.deviceInfo, serial: e.target.value }
                })}
                placeholder="Device serial number"
              />
            </div>
            <div>
              <Label htmlFor="imei">IMEI</Label>
              <Input
                id="imei"
                value={newWipe.deviceInfo.imei}
                onChange={(e) => setNewWipe({
                  ...newWipe,
                  deviceInfo: { ...newWipe.deviceInfo, imei: e.target.value }
                })}
                placeholder="IMEI (phones)"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="storage">Storage Capacity</Label>
            <div className="relative">
              <Input
                id="storage"
                value={newWipe.deviceInfo.storage}
                onChange={(e) => setNewWipe({
                  ...newWipe,
                  deviceInfo: { ...newWipe.deviceInfo, storage: e.target.value }
                })}
                placeholder="e.g., 256GB"
                className="pl-10"
              />
              <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
          </div>

          <div>
            <Label htmlFor="wipeMethod">Wipe Method *</Label>
            <select
              id="wipeMethod"
              className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
              value={newWipe.wipeMethod}
              onChange={(e) => setNewWipe({ ...newWipe, wipeMethod: e.target.value })}
              required
            >
              {WIPE_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label} - {method.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setShowNewWipe(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Start Wipe</Button>
          </div>
        </form>
      </AnimatedModal>

      {/* Complete Wipe Modal */}
      <AnimatedModal
        isOpen={showCompleteModal}
        onClose={() => { setShowCompleteModal(false); setSelectedReport(null); }}
        title="Complete Data Wipe"
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="bg-dark-tertiary rounded-lg p-4">
              <p className="text-white"><strong>QLID:</strong> {selectedReport.qlid}</p>
              <p className="text-zinc-400"><strong>Device:</strong> {selectedReport.device_info?.make} {selectedReport.device_info?.model}</p>
              <p className="text-zinc-400"><strong>Method:</strong> {selectedReport.wipe_method.replace(/_/g, ' ')}</p>
            </div>

            <div>
              <Label htmlFor="verificationMethod">Verification Method *</Label>
              <select
                id="verificationMethod"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
                value={completeForm.verificationMethod}
                onChange={(e) => setCompleteForm({ ...completeForm, verificationMethod: e.target.value })}
              >
                {VERIFICATION_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label} - {method.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none resize-none"
                rows={3}
                value={completeForm.notes}
                onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                placeholder="Any additional notes about the wipe process..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => { setShowCompleteModal(false); setSelectedReport(null); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCompleteWipe}>
                <CheckCircle size={16} />
                Verify & Complete
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* Certificate View Modal */}
      <AnimatedModal
        isOpen={showCertificate}
        onClose={() => { setShowCertificate(false); setSelectedReport(null); }}
        title="Data Wipe Certificate"
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="bg-white text-black rounded-lg p-6">
              <div className="text-center border-b-2 border-black pb-4 mb-4">
                <h3 className="text-xl font-bold">DATA WIPE CERTIFICATE</h3>
                <p className="text-gray-600 text-sm mt-1">Certificate ID: {selectedReport.id}</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold border-b border-gray-300 pb-2 mb-2">Device Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>QLID:</strong> {selectedReport.qlid}</div>
                  <div><strong>Make:</strong> {selectedReport.device_info?.make || 'N/A'}</div>
                  <div><strong>Model:</strong> {selectedReport.device_info?.model || 'N/A'}</div>
                  <div><strong>Serial:</strong> {selectedReport.device_info?.serial || 'N/A'}</div>
                  <div><strong>IMEI:</strong> {selectedReport.device_info?.imei || 'N/A'}</div>
                  <div><strong>Storage:</strong> {selectedReport.device_info?.storage || 'N/A'}</div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold border-b border-gray-300 pb-2 mb-2">Wipe Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Method:</strong> {selectedReport.wipe_method.replace(/_/g, ' ')}</div>
                  <div><strong>Status:</strong> {selectedReport.wipe_status}</div>
                  <div><strong>Started:</strong> {new Date(selectedReport.started_at).toLocaleString()}</div>
                  <div><strong>Completed:</strong> {selectedReport.completed_at ? new Date(selectedReport.completed_at).toLocaleString() : 'N/A'}</div>
                  <div><strong>Verified:</strong> {selectedReport.verified_at ? new Date(selectedReport.verified_at).toLocaleString() : 'N/A'}</div>
                  <div><strong>Verification:</strong> {selectedReport.verification_method || 'N/A'}</div>
                </div>
              </div>

              {selectedReport.notes && (
                <div className="mb-4">
                  <h4 className="font-semibold border-b border-gray-300 pb-2 mb-2">Notes</h4>
                  <p className="text-sm">{selectedReport.notes}</p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
                <p>This certificate confirms that all data has been securely erased from the above device using the specified method in compliance with industry standards.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setShowCertificate(false); setSelectedReport(null); }}>
                Close
              </Button>
              <Button variant="primary" onClick={() => handleDownloadCertificate(selectedReport)}>
                <Download size={16} />
                Download Certificate
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
