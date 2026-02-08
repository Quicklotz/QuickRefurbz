import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Package, Boxes, CheckCircle, Clock } from 'lucide-react';

interface DashboardData {
  items: {
    total: number;
    byStage: Record<string, number>;
    todayReceived: number;
    todayCompleted: number;
  };
  pallets: {
    total: number;
    byStatus: Record<string, number>;
    totalCogs: number;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  if (!data) {
    return <div>Failed to load dashboard</div>;
  }

  const inProgress = (data.items.byStage['TESTING'] || 0) +
    (data.items.byStage['REPAIR'] || 0) +
    (data.items.byStage['CLEANING'] || 0) +
    (data.items.byStage['FINAL_QC'] || 0);

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <Package size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Total Items
          </div>
          <div className="stat-value blue">{data.items.total}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Clock size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            In Progress
          </div>
          <div className="stat-value yellow">{inProgress}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <CheckCircle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Completed Today
          </div>
          <div className="stat-value green">{data.items.todayCompleted}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Boxes size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Active Pallets
          </div>
          <div className="stat-value blue">
            {(data.pallets.byStatus['RECEIVING'] || 0) + (data.pallets.byStatus['IN_PROGRESS'] || 0)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Items by Stage</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'].map(stage => (
                  <tr key={stage}>
                    <td>
                      <span className={`status-badge status-${stage.toLowerCase()}`}>
                        {stage.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{data.items.byStage[stage] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pallets by Status</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {['RECEIVING', 'IN_PROGRESS', 'COMPLETE'].map(status => (
                  <tr key={status}>
                    <td>{status.replace('_', ' ')}</td>
                    <td style={{ textAlign: 'right' }}>{data.pallets.byStatus[status] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total COGS</span>
              <span style={{ fontWeight: 600 }}>${data.pallets.totalCogs.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
