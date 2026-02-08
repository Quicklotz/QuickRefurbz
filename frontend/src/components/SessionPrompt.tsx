import { useState } from 'react';
import { api } from '../api/client';

interface SessionPromptProps {
  onSessionStarted: (session: any) => void;
}

export function SessionPrompt({ onSessionStarted }: SessionPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    workstationId: '',
    warehouseId: '',
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await api.startSession(formData);
      onSessionStarted(session);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-prompt-overlay">
      <div className="session-prompt">
        <div className="session-header">
          <h1>QuickRefurbz</h1>
          <p className="session-date">{today}</p>
        </div>

        <div className="session-body">
          <h2>Start Your Work Session</h2>
          <p className="session-subtitle">Please enter your session details to continue</p>

          {error && (
            <div className="session-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Employee ID *</label>
              <input
                type="text"
                className="form-input"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="Enter your employee ID"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Workstation ID *</label>
              <input
                type="text"
                className="form-input"
                value={formData.workstationId}
                onChange={(e) => setFormData({ ...formData, workstationId: e.target.value })}
                placeholder="e.g., WS-001"
                required
              />
              <span className="form-hint">The workstation you are working at</span>
            </div>

            <div className="form-group">
              <label className="form-label">Warehouse ID *</label>
              <input
                type="text"
                className="form-input"
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                placeholder="e.g., WH-001"
                required
              />
              <span className="form-hint">The warehouse location</span>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Starting Session...' : 'Start Session'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .session-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .session-prompt {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 1rem;
          width: 90%;
          max-width: 420px;
          overflow: hidden;
        }

        .session-header {
          background: var(--ql-yellow);
          color: #000;
          padding: 1.5rem;
          text-align: center;
        }

        .session-header h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .session-date {
          margin: 0.5rem 0 0 0;
          font-size: 0.875rem;
          opacity: 0.8;
        }

        .session-body {
          padding: 1.5rem;
        }

        .session-body h2 {
          margin: 0;
          font-size: 1.25rem;
          text-align: center;
        }

        .session-subtitle {
          text-align: center;
          color: var(--text-muted);
          margin: 0.5rem 0 1.5rem 0;
          font-size: 0.875rem;
        }

        .session-error {
          background: rgba(235, 61, 59, 0.15);
          color: var(--accent-red);
          border: 1px solid var(--accent-red);
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--ql-yellow);
          box-shadow: 0 0 0 2px rgba(255, 199, 0, 0.2);
        }

        .form-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.25rem;
        }

        .btn-full {
          width: 100%;
          margin-top: 1rem;
        }

        .btn-primary {
          background: var(--ql-yellow);
          color: #000;
          border: none;
          padding: 0.875rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
