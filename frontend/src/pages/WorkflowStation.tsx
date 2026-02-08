import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { ProgressIndicator } from '../components/workflow/ProgressIndicator';
import { StepPrompt } from '../components/workflow/StepPrompt';

interface Job {
  id: string;
  qlid: string;
  palletId: string;
  category: string;
  currentState: string;
  currentStepIndex: number;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  attemptCount: number;
  maxAttempts: number;
  priority: string;
  finalGrade?: string;
  warrantyEligible?: boolean;
}

interface Prompt {
  job: Job;
  state: string;
  stateName: string;
  totalSteps: number;
  currentStepIndex: number;
  currentStep?: any;
  completedSteps: any[];
  progress: {
    statesCompleted: number;
    totalStates: number;
    overallPercent: number;
  };
  canAdvance: boolean;
  canBlock: boolean;
  canEscalate: boolean;
  canRetry: boolean;
}

export function WorkflowStation() {
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [certifyData, setCertifyData] = useState({ finalGrade: 'B', warrantyEligible: true, notes: '' });

  const loadPrompt = useCallback(async (qlid: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJobPrompt(qlid);
      setPrompt(data);
    } catch (err: any) {
      setError(err.message);
      setPrompt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // First try to get existing job
      try {
        await loadPrompt(scanInput.trim());
        setScanInput('');
        return;
      } catch {
        // Job doesn't exist, try to create it
      }

      // Create new job
      await api.createJob({ qlid: scanInput.trim() });
      await loadPrompt(scanInput.trim());
      setScanInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async (data: any) => {
    if (!prompt?.currentStep) return;

    setActionLoading(true);
    try {
      await api.completeStep(prompt.job.qlid, prompt.currentStep.code, data);
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'ADVANCE');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!prompt || !blockReason.trim()) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'BLOCK', { reason: blockReason });
      setShowBlockModal(false);
      setBlockReason('');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'RESOLVE');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'RETRY');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCertify = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.certifyJob(prompt.job.qlid, {
        finalGrade: certifyData.finalGrade,
        warrantyEligible: certifyData.warrantyEligible,
        notes: certifyData.notes
      });
      setShowCertifyModal(false);
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt(null);
    setError(null);
    setScanInput('');
  };

  const renderJobHeader = () => {
    if (!prompt) return null;

    return (
      <div className="job-header">
        <div className="job-id-section">
          <span className="job-qlid">{prompt.job.qlid}</span>
          <span className={`priority-badge priority-${prompt.job.priority.toLowerCase()}`}>
            {prompt.job.priority}
          </span>
        </div>
        <div className="job-meta">
          <span className="meta-item">
            <strong>Category:</strong> {prompt.job.category}
          </span>
          <span className="meta-item">
            <strong>State:</strong> {prompt.stateName}
          </span>
          <span className="meta-item">
            <strong>Attempt:</strong> {prompt.job.attemptCount + 1} / {prompt.job.maxAttempts + 1}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={handleClear}>
          Close Job
        </button>
      </div>
    );
  };

  const renderCurrentPrompt = () => {
    if (!prompt) return null;

    // Special states
    if (prompt.job.currentState === 'REFURBZ_COMPLETE') {
      return (
        <div className="completion-message success">
          <svg className="completion-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <h2>Refurbishment Complete!</h2>
          <p>This item has been certified and is ready for the next stage.</p>
          {prompt.job.finalGrade && (
            <div className="final-grade">Final Grade: <strong>{prompt.job.finalGrade}</strong></div>
          )}
        </div>
      );
    }

    if (prompt.job.currentState === 'REFURBZ_BLOCKED') {
      return (
        <div className="blocked-message">
          <svg className="blocked-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h2>Job Blocked</h2>
          <p>This job has been blocked and requires resolution.</p>
          <button className="btn btn-primary" onClick={handleResolve} disabled={actionLoading}>
            {actionLoading ? 'Processing...' : 'Resolve & Continue'}
          </button>
        </div>
      );
    }

    if (prompt.job.currentState === 'FINAL_TEST_FAILED') {
      return (
        <div className="failed-message">
          <svg className="failed-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <h2>Final Test Failed</h2>
          <p>Attempt {prompt.job.attemptCount} of {prompt.job.maxAttempts} failed. {prompt.job.attemptCount < prompt.job.maxAttempts ? 'You can retry the repair process.' : 'Maximum attempts reached.'}</p>
          {prompt.canRetry && (
            <button className="btn btn-primary" onClick={handleRetry} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : 'Retry Repair'}
            </button>
          )}
        </div>
      );
    }

    if (prompt.job.currentState === 'FINAL_TEST_PASSED') {
      return (
        <div className="certification-prompt">
          <h2>Ready for Certification</h2>
          <p>All tests passed! Certify this item with a final grade.</p>
          <button className="btn btn-primary" onClick={() => setShowCertifyModal(true)}>
            Certify Item
          </button>
        </div>
      );
    }

    // Current step prompt
    if (prompt.currentStep) {
      return (
        <div className="current-step-section">
          <div className="step-counter">
            Step {prompt.currentStepIndex + 1} of {prompt.totalSteps}
          </div>
          <StepPrompt
            step={prompt.currentStep}
            onComplete={handleStepComplete}
            loading={actionLoading}
          />
        </div>
      );
    }

    // All steps complete for this state
    return (
      <div className="advance-prompt">
        <h3>All steps complete!</h3>
        <p>Ready to advance to the next stage.</p>
        <button className="btn btn-primary" onClick={handleAdvance} disabled={actionLoading}>
          {actionLoading ? 'Advancing...' : 'Advance to Next Stage'}
        </button>
      </div>
    );
  };

  return (
    <div className="workflow-station">
      <div className="page-header">
        <h1>Workflow Station</h1>
      </div>

      {!prompt && (
        <div className="scan-section">
          <form onSubmit={handleScan} className="scan-form">
            <input
              type="text"
              className="form-input scan-input"
              placeholder="Scan or enter QLID (e.g., P1BBY-QLID000000001)"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Loading...' : 'Load Job'}
            </button>
          </form>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
          <button className="dismiss-btn" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {prompt && (
        <>
          {renderJobHeader()}
          <ProgressIndicator
            currentState={prompt.job.currentState}
            progress={prompt.progress}
          />
          {renderCurrentPrompt()}

          {/* Escape Actions */}
          {prompt.canBlock && !['REFURBZ_BLOCKED', 'REFURBZ_COMPLETE', 'FINAL_TEST_PASSED'].includes(prompt.job.currentState) && (
            <div className="escape-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowBlockModal(true)}
              >
                Block Job
              </button>
            </div>
          )}
        </>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Block Job</h3>
              <button className="modal-close" onClick={() => setShowBlockModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Reason for blocking</label>
              <textarea
                className="form-input"
                rows={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Describe why this job needs to be blocked..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowBlockModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleBlock}
                disabled={!blockReason.trim() || actionLoading}
              >
                {actionLoading ? 'Blocking...' : 'Block Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certify Modal */}
      {showCertifyModal && (
        <div className="modal-overlay" onClick={() => setShowCertifyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Certify Item</h3>
              <button className="modal-close" onClick={() => setShowCertifyModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Final Grade</label>
              <select
                className="form-select"
                value={certifyData.finalGrade}
                onChange={(e) => setCertifyData(prev => ({ ...prev, finalGrade: e.target.value }))}
              >
                <option value="A">Grade A - Like New</option>
                <option value="B">Grade B - Minor Wear</option>
                <option value="C">Grade C - Visible Wear</option>
              </select>
            </div>
            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={certifyData.warrantyEligible}
                  onChange={(e) => setCertifyData(prev => ({ ...prev, warrantyEligible: e.target.checked }))}
                />
                <span className="toggle-switch" />
                <span>Warranty Eligible</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Certification Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={certifyData.notes}
                onChange={(e) => setCertifyData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any notes about certification..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCertifyModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCertify}
                disabled={actionLoading}
              >
                {actionLoading ? 'Certifying...' : 'Certify Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .workflow-station {
          max-width: 900px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .scan-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 2rem;
          text-align: center;
        }

        .scan-form {
          display: flex;
          gap: 1rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .scan-input {
          flex: 1;
          font-size: 1.125rem;
          text-align: center;
          font-family: 'SF Mono', 'Consolas', monospace;
        }

        .error-banner {
          background: rgba(235, 61, 59, 0.1);
          border: 1px solid var(--accent-red);
          color: var(--accent-red);
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .dismiss-btn {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .job-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .job-id-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .job-qlid {
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ql-yellow);
        }

        .priority-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .priority-urgent { background: var(--accent-red); color: white; }
        .priority-high { background: var(--ql-yellow); color: var(--ql-black); }
        .priority-normal { background: var(--bg-tertiary); color: var(--text-secondary); }
        .priority-low { background: var(--bg-tertiary); color: var(--text-muted); }

        .job-meta {
          display: flex;
          gap: 1.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .current-step-section {
          margin-bottom: 1.5rem;
        }

        .step-counter {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .advance-prompt, .certification-prompt {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 2rem;
          text-align: center;
        }

        .advance-prompt h3, .certification-prompt h2 {
          margin-bottom: 0.5rem;
        }

        .advance-prompt p, .certification-prompt p {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .completion-message, .blocked-message, .failed-message {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 2rem;
          text-align: center;
        }

        .completion-message.success {
          border-color: var(--accent-green);
        }

        .completion-icon, .blocked-icon, .failed-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 1rem;
        }

        .completion-icon { color: var(--accent-green); }
        .blocked-icon { color: var(--ql-yellow); }
        .failed-icon { color: var(--accent-red); }

        .final-grade {
          margin-top: 1rem;
          font-size: 1.25rem;
        }

        .escape-actions {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .toggle-label input {
          display: none;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          position: relative;
          transition: background 0.2s ease;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: transform 0.2s ease;
        }

        .toggle-label input:checked + .toggle-switch {
          background: var(--accent-green);
        }

        .toggle-label input:checked + .toggle-switch::after {
          transform: translateX(20px);
        }

        @media (max-width: 768px) {
          .scan-form {
            flex-direction: column;
          }

          .job-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .job-meta {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
