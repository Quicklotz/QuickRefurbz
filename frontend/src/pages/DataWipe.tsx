import { useState, useEffect } from 'react';
import { api } from '../api/client';

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

export function DataWipePage() {
  const [reports, setReports] = useState<DataWipeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQlid, setSearchQlid] = useState('');
  const [selectedReport, setSelectedReport] = useState<DataWipeReport | null>(null);
  const [showNewWipe, setShowNewWipe] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  // New wipe form state
  const [newWipe, setNewWipe] = useState({
    qlid: '',
    deviceInfo: {
      make: '',
      model: '',
      serial: '',
      imei: '',
      storage: '',
    },
    wipeMethod: 'FACTORY_RESET',
  });

  // Complete wipe form state
  const [completeForm, setCompleteForm] = useState({
    verificationMethod: 'VISUAL',
    notes: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleCompleteWipe = async (report: DataWipeReport) => {
    setMessage(null);

    try {
      await api.completeDataWipe(report.id, {
        verificationMethod: completeForm.verificationMethod,
        notes: completeForm.notes,
      });
      setMessage({ type: 'success', text: 'Data wipe completed and verified' });
      setSelectedReport(null);
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
    const certWindow = window.open(`/datawipe/reports/${report.qlid}`, '_blank');
    if (!certWindow) {
      // Fallback - generate and download as text
      const certContent = generateCertificateText(report);
      const blob = new Blob([certContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DataWipe_Certificate_${report.qlid}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      IN_PROGRESS: { color: 'yellow', label: 'In Progress' },
      COMPLETED: { color: 'green', label: 'Completed' },
      VERIFIED: { color: 'blue', label: 'Verified' },
      FAILED: { color: 'red', label: 'Failed' },
    };
    const config = statusConfig[status] || { color: 'gray', label: status };
    return <span className={`status-badge status-${config.color}`}>{config.label}</span>;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spin">Loading data wipe reports...</div>
      </div>
    );
  }

  return (
    <div className="datawipe-page">
      <div className="page-header">
        <h1>Data Wipe Management</h1>
        <button className="btn btn-primary" onClick={() => setShowNewWipe(true)}>
          + Start New Wipe
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            className="form-input"
            placeholder="Search by QLID (e.g., QLID000000001)"
            value={searchQlid}
            onChange={(e) => setSearchQlid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-secondary" onClick={handleSearch}>
            Search
          </button>
          {searchQlid && (
            <button className="btn btn-outline" onClick={() => { setSearchQlid(''); loadReports(); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className="reports-section">
        <h2>Wipe Reports</h2>
        {reports.length === 0 ? (
          <div className="empty-state">
            <p>No data wipe reports found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>QLID</th>
                <th>Device</th>
                <th>Method</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="qlid-cell">{report.qlid}</td>
                  <td>
                    {report.device_info?.make} {report.device_info?.model}
                    {report.device_info?.serial && (
                      <span className="serial-badge">S/N: {report.device_info.serial}</span>
                    )}
                  </td>
                  <td>{report.wipe_method}</td>
                  <td>{getStatusBadge(report.wipe_status)}</td>
                  <td>{new Date(report.started_at).toLocaleDateString()}</td>
                  <td>{report.completed_at ? new Date(report.completed_at).toLocaleDateString() : '-'}</td>
                  <td className="actions-cell">
                    {report.wipe_status === 'IN_PROGRESS' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => setSelectedReport(report)}
                      >
                        Complete
                      </button>
                    )}
                    {(report.wipe_status === 'COMPLETED' || report.wipe_status === 'VERIFIED') && (
                      <>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleViewCertificate(report)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleDownloadCertificate(report)}
                        >
                          Download
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Wipe Modal */}
      {showNewWipe && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Start Data Wipe</h2>
              <button className="modal-close" onClick={() => setShowNewWipe(false)}>&times;</button>
            </div>
            <form onSubmit={handleStartWipe}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">QLID *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newWipe.qlid}
                    onChange={(e) => setNewWipe({ ...newWipe, qlid: e.target.value })}
                    placeholder="e.g., QLID000000001"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Make</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newWipe.deviceInfo.make}
                      onChange={(e) => setNewWipe({
                        ...newWipe,
                        deviceInfo: { ...newWipe.deviceInfo, make: e.target.value }
                      })}
                      placeholder="e.g., Apple"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newWipe.deviceInfo.model}
                      onChange={(e) => setNewWipe({
                        ...newWipe,
                        deviceInfo: { ...newWipe.deviceInfo, model: e.target.value }
                      })}
                      placeholder="e.g., iPhone 14 Pro"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newWipe.deviceInfo.serial}
                      onChange={(e) => setNewWipe({
                        ...newWipe,
                        deviceInfo: { ...newWipe.deviceInfo, serial: e.target.value }
                      })}
                      placeholder="Device serial number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IMEI</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newWipe.deviceInfo.imei}
                      onChange={(e) => setNewWipe({
                        ...newWipe,
                        deviceInfo: { ...newWipe.deviceInfo, imei: e.target.value }
                      })}
                      placeholder="IMEI number (phones)"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Storage Capacity</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newWipe.deviceInfo.storage}
                    onChange={(e) => setNewWipe({
                      ...newWipe,
                      deviceInfo: { ...newWipe.deviceInfo, storage: e.target.value }
                    })}
                    placeholder="e.g., 256GB"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Wipe Method *</label>
                  <select
                    className="form-select"
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowNewWipe(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Start Wipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Wipe Modal */}
      {selectedReport && !showCertificate && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Complete Data Wipe</h2>
              <button className="modal-close" onClick={() => setSelectedReport(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="report-summary">
                <p><strong>QLID:</strong> {selectedReport.qlid}</p>
                <p><strong>Device:</strong> {selectedReport.device_info?.make} {selectedReport.device_info?.model}</p>
                <p><strong>Method:</strong> {selectedReport.wipe_method}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Verification Method *</label>
                <select
                  className="form-select"
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

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  placeholder="Any additional notes about the wipe process..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedReport(null)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={() => handleCompleteWipe(selectedReport)}>
                Verify & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate View Modal */}
      {showCertificate && selectedReport && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Data Wipe Certificate</h2>
              <button className="modal-close" onClick={() => { setShowCertificate(false); setSelectedReport(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="certificate">
                <div className="certificate-header">
                  <h3>DATA WIPE CERTIFICATE</h3>
                  <p className="certificate-id">Certificate ID: {selectedReport.id}</p>
                </div>

                <div className="certificate-section">
                  <h4>Device Information</h4>
                  <div className="certificate-grid">
                    <div><strong>QLID:</strong> {selectedReport.qlid}</div>
                    <div><strong>Make:</strong> {selectedReport.device_info?.make || 'N/A'}</div>
                    <div><strong>Model:</strong> {selectedReport.device_info?.model || 'N/A'}</div>
                    <div><strong>Serial:</strong> {selectedReport.device_info?.serial || 'N/A'}</div>
                    <div><strong>IMEI:</strong> {selectedReport.device_info?.imei || 'N/A'}</div>
                    <div><strong>Storage:</strong> {selectedReport.device_info?.storage || 'N/A'}</div>
                  </div>
                </div>

                <div className="certificate-section">
                  <h4>Wipe Details</h4>
                  <div className="certificate-grid">
                    <div><strong>Method:</strong> {selectedReport.wipe_method}</div>
                    <div><strong>Status:</strong> {selectedReport.wipe_status}</div>
                    <div><strong>Started:</strong> {new Date(selectedReport.started_at).toLocaleString()}</div>
                    <div><strong>Completed:</strong> {selectedReport.completed_at ? new Date(selectedReport.completed_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Verified:</strong> {selectedReport.verified_at ? new Date(selectedReport.verified_at).toLocaleString() : 'N/A'}</div>
                    <div><strong>Verification:</strong> {selectedReport.verification_method || 'N/A'}</div>
                  </div>
                </div>

                {selectedReport.notes && (
                  <div className="certificate-section">
                    <h4>Notes</h4>
                    <p>{selectedReport.notes}</p>
                  </div>
                )}

                <div className="certificate-footer">
                  <p>This certificate confirms that all data has been securely erased from the above device using the specified method in compliance with industry standards.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setShowCertificate(false); setSelectedReport(null); }}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => handleDownloadCertificate(selectedReport)}>
                Download Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .datawipe-page {
          max-width: 1200px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
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

        .search-section {
          margin-bottom: 1.5rem;
        }

        .search-bar {
          display: flex;
          gap: 0.5rem;
        }

        .search-bar .form-input {
          flex: 1;
          max-width: 400px;
        }

        .reports-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .reports-section h2 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--ql-yellow);
          margin: 0 0 1rem 0;
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
        }

        .data-table td {
          font-size: 0.875rem;
        }

        .qlid-cell {
          font-family: monospace;
          font-weight: 600;
        }

        .serial-badge {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.25rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-yellow {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .status-green {
          background: rgba(2, 219, 168, 0.2);
          color: var(--accent-green);
        }

        .status-blue {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .status-red {
          background: rgba(235, 61, 59, 0.2);
          color: var(--accent-red);
        }

        .status-gray {
          background: rgba(107, 114, 128, 0.2);
          color: #6b7280;
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
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .report-summary {
          background: var(--bg-tertiary);
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }

        .report-summary p {
          margin: 0.25rem 0;
        }

        .certificate {
          background: #fff;
          color: #1a1a1a;
          padding: 2rem;
          border-radius: 0.5rem;
        }

        .certificate-header {
          text-align: center;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 1rem;
          margin-bottom: 1.5rem;
        }

        .certificate-header h3 {
          margin: 0;
          font-size: 1.5rem;
        }

        .certificate-id {
          color: #666;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .certificate-section {
          margin-bottom: 1.5rem;
        }

        .certificate-section h4 {
          font-size: 1rem;
          margin: 0 0 0.75rem 0;
          color: #333;
          border-bottom: 1px solid #ddd;
          padding-bottom: 0.5rem;
        }

        .certificate-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .certificate-footer {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 0.875rem;
          color: #666;
        }

        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .search-bar {
            flex-direction: column;
          }

          .search-bar .form-input {
            max-width: 100%;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .data-table {
            font-size: 0.75rem;
          }

          .actions-cell {
            flex-direction: column;
          }

          .certificate-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
