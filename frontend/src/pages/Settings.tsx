import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface AppSettings {
  warehouseName: string;
  warehouseId: string;
  defaultPriority: string;
  autoAssignTechnician: boolean;
  maxRetestAttempts: number;
  requirePhotoOnDiagnosis: boolean;
  requirePhotoOnRepair: boolean;
  enableNotifications: boolean;
  notificationEmail: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  warehouseName: 'Main Warehouse',
  warehouseId: 'WH001',
  defaultPriority: 'NORMAL',
  autoAssignTechnician: false,
  maxRetestAttempts: 2,
  requirePhotoOnDiagnosis: false,
  requirePhotoOnRepair: false,
  enableNotifications: false,
  notificationEmail: '',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
};

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof AppSettings, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.updateSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spin">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-sections">
        {/* Warehouse Settings */}
        <section className="settings-section">
          <h2>Warehouse</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">Warehouse Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.warehouseName}
                onChange={(e) => handleChange('warehouseName', e.target.value)}
                placeholder="Enter warehouse name"
              />
              <span className="form-hint">Display name for this refurbishment location</span>
            </div>

            <div className="form-group">
              <label className="form-label">Warehouse ID</label>
              <input
                type="text"
                className="form-input"
                value={settings.warehouseId}
                onChange={(e) => handleChange('warehouseId', e.target.value)}
                placeholder="e.g., WH001"
              />
              <span className="form-hint">Unique identifier used in barcodes and tracking</span>
            </div>
          </div>
        </section>

        {/* Workflow Settings */}
        <section className="settings-section">
          <h2>Workflow</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">Default Priority</label>
              <select
                className="form-select"
                value={settings.defaultPriority}
                onChange={(e) => handleChange('defaultPriority', e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <span className="form-hint">Default priority for new jobs</span>
            </div>

            <div className="form-group">
              <label className="form-label">Max Retest Attempts</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxRetestAttempts}
                onChange={(e) => handleChange('maxRetestAttempts', parseInt(e.target.value) || 2)}
                min={1}
                max={5}
              />
              <span className="form-hint">Maximum times a device can fail final test before disposition</span>
            </div>

            <div className="form-group">
              <label className="toggle-container">
                <input
                  type="checkbox"
                  checked={settings.autoAssignTechnician}
                  onChange={(e) => handleChange('autoAssignTechnician', e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-label">Auto-assign technician</span>
              </label>
              <span className="form-hint">Automatically assign jobs to available technicians</span>
            </div>
          </div>
        </section>

        {/* Photo Requirements */}
        <section className="settings-section">
          <h2>Photo Requirements</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label className="toggle-container">
                <input
                  type="checkbox"
                  checked={settings.requirePhotoOnDiagnosis}
                  onChange={(e) => handleChange('requirePhotoOnDiagnosis', e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-label">Require photo on diagnosis</span>
              </label>
              <span className="form-hint">Technicians must take photos when diagnosing defects</span>
            </div>

            <div className="form-group">
              <label className="toggle-container">
                <input
                  type="checkbox"
                  checked={settings.requirePhotoOnRepair}
                  onChange={(e) => handleChange('requirePhotoOnRepair', e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-label">Require photo after repair</span>
              </label>
              <span className="form-hint">Technicians must take photos after completing repairs</span>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-section">
          <h2>Notifications</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label className="toggle-container">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => handleChange('enableNotifications', e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-label">Enable email notifications</span>
              </label>
              <span className="form-hint">Send email alerts for blocked/escalated jobs</span>
            </div>

            {settings.enableNotifications && (
              <div className="form-group">
                <label className="form-label">Notification Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={settings.notificationEmail}
                  onChange={(e) => handleChange('notificationEmail', e.target.value)}
                  placeholder="manager@example.com"
                />
                <span className="form-hint">Email address for notifications</span>
              </div>
            )}
          </div>
        </section>

        {/* Working Hours */}
        <section className="settings-section">
          <h2>Working Hours</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.workingHoursStart}
                onChange={(e) => handleChange('workingHoursStart', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.workingHoursEnd}
                onChange={(e) => handleChange('workingHoursEnd', e.target.value)}
              />
            </div>
          </div>
          <span className="form-hint section-hint">Used for scheduling and reporting purposes</span>
        </section>
      </div>

      <style>{`
        .settings-page {
          max-width: 900px;
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

        .settings-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .settings-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .settings-section h2 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--ql-yellow);
          margin: 0 0 1.25rem 0;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .form-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.375rem;
        }

        .section-hint {
          margin-top: 1rem;
        }

        .toggle-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .toggle-container input {
          display: none;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          position: relative;
          transition: background 0.2s ease;
          flex-shrink: 0;
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

        .toggle-container input:checked + .toggle-switch {
          background: var(--accent-green);
        }

        .toggle-container input:checked + .toggle-switch::after {
          transform: translateX(20px);
        }

        .toggle-label {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }

          .page-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .page-header .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
