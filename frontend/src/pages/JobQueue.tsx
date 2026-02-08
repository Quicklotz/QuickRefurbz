import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Job {
  id: string;
  qlid: string;
  palletId: string;
  category: string;
  currentState: string;
  currentStepIndex: number;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  priority: string;
  createdAt: string;
}

const STATE_DISPLAY: Record<string, { label: string; color: string }> = {
  REFURBZ_QUEUED: { label: 'Queued', color: 'blue' },
  REFURBZ_ASSIGNED: { label: 'Assigned', color: 'blue' },
  REFURBZ_IN_PROGRESS: { label: 'Security Prep', color: 'yellow' },
  SECURITY_PREP_COMPLETE: { label: 'Diagnosis', color: 'yellow' },
  DIAGNOSED: { label: 'Ready for Repair', color: 'purple' },
  REPAIR_IN_PROGRESS: { label: 'Repairing', color: 'purple' },
  REPAIR_COMPLETE: { label: 'Repair Done', color: 'purple' },
  FINAL_TEST_IN_PROGRESS: { label: 'Final Testing', color: 'yellow' },
  FINAL_TEST_PASSED: { label: 'Test Passed', color: 'green' },
  CERTIFIED: { label: 'Certified', color: 'green' },
  REFURBZ_COMPLETE: { label: 'Complete', color: 'green' },
  REFURBZ_BLOCKED: { label: 'Blocked', color: 'red' },
  REFURBZ_ESCALATED: { label: 'Escalated', color: 'red' },
  FINAL_TEST_FAILED: { label: 'Test Failed', color: 'red' },
  REFURBZ_FAILED_DISPOSITION: { label: 'Failed', color: 'red' },
};

const PRIORITY_ORDER = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

export function JobQueue() {
  const [queue, setQueue] = useState<Record<string, { count: number; jobs: Job[] }>>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [queueData, statsData] = await Promise.all([
        api.getWorkflowQueue(),
        api.getWorkflowStats(),
      ]);
      setQueue(queueData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load queue data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredJobs = (): Job[] => {
    const allJobs: Job[] = [];

    Object.entries(queue).forEach(([state, data]) => {
      if (filter === 'all' || filter === state) {
        allJobs.push(...data.jobs);
      }
    });

    // Sort by priority then created date
    return allJobs.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const getStateCount = (state: string): number => {
    return queue[state]?.count || 0;
  };

  const getTotalCount = (): number => {
    return Object.values(queue).reduce((sum, data) => sum + data.count, 0);
  };

  const renderStatCards = () => {
    if (!stats) return null;

    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value yellow">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed Today</div>
          <div className="stat-value green">{stats.completedToday}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value blue">
            {(stats.byState?.REFURBZ_IN_PROGRESS || 0) +
              (stats.byState?.REPAIR_IN_PROGRESS || 0) +
              (stats.byState?.FINAL_TEST_IN_PROGRESS || 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Blocked / Escalated</div>
          <div className="stat-value red">
            {(stats.byState?.REFURBZ_BLOCKED || 0) +
              (stats.byState?.REFURBZ_ESCALATED || 0)}
          </div>
        </div>
      </div>
    );
  };

  const renderStateFilters = () => {
    const mainStates = [
      'REFURBZ_QUEUED',
      'REFURBZ_IN_PROGRESS',
      'DIAGNOSED',
      'REPAIR_IN_PROGRESS',
      'FINAL_TEST_IN_PROGRESS',
      'REFURBZ_BLOCKED',
      'REFURBZ_COMPLETE',
    ];

    return (
      <div className="state-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({getTotalCount()})
        </button>
        {mainStates.map((state) => (
          <button
            key={state}
            className={`filter-btn ${filter === state ? 'active' : ''} state-${STATE_DISPLAY[state]?.color || 'gray'}`}
            onClick={() => setFilter(state)}
          >
            {STATE_DISPLAY[state]?.label} ({getStateCount(state)})
          </button>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spin">Loading...</div>
      </div>
    );
  }

  const filteredJobs = getFilteredJobs();

  return (
    <div className="job-queue">
      <div className="page-header">
        <h1>Job Queue</h1>
        <button className="btn btn-secondary" onClick={loadData}>
          Refresh
        </button>
      </div>

      {renderStatCards()}
      {renderStateFilters()}

      <div className="jobs-table-container">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>QLID</th>
              <th>Category</th>
              <th>State</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  No jobs found
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} onClick={() => setSelectedJob(job)}>
                  <td className="qlid-cell">{job.qlid}</td>
                  <td>{job.category}</td>
                  <td>
                    <span className={`state-badge state-${STATE_DISPLAY[job.currentState]?.color || 'gray'}`}>
                      {STATE_DISPLAY[job.currentState]?.label || job.currentState}
                    </span>
                  </td>
                  <td>
                    <span className={`priority-badge priority-${job.priority.toLowerCase()}`}>
                      {job.priority}
                    </span>
                  </td>
                  <td>{job.assignedTechnicianName || '-'}</td>
                  <td>{formatDate(job.createdAt)}</td>
                  <td>
                    <a
                      href={`/workflow?qlid=${job.qlid}`}
                      className="btn btn-primary btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedJob.qlid}</h3>
              <button className="modal-close" onClick={() => setSelectedJob(null)}>&times;</button>
            </div>

            <div className="job-details">
              <div className="detail-row">
                <span className="detail-label">Category</span>
                <span className="detail-value">{selectedJob.category}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">State</span>
                <span className={`state-badge state-${STATE_DISPLAY[selectedJob.currentState]?.color}`}>
                  {STATE_DISPLAY[selectedJob.currentState]?.label}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Priority</span>
                <span className={`priority-badge priority-${selectedJob.priority.toLowerCase()}`}>
                  {selectedJob.priority}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pallet ID</span>
                <span className="detail-value">{selectedJob.palletId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Assigned To</span>
                <span className="detail-value">{selectedJob.assignedTechnicianName || 'Unassigned'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created</span>
                <span className="detail-value">{new Date(selectedJob.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedJob(null)}>
                Close
              </button>
              <a href={`/workflow?qlid=${selectedJob.qlid}`} className="btn btn-primary">
                Open in Workflow Station
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .job-queue {
          max-width: 1400px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .state-filters {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .filter-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: 9999px;
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-btn:hover {
          border-color: var(--ql-yellow);
        }

        .filter-btn.active {
          background: var(--ql-yellow);
          color: var(--ql-black);
          border-color: var(--ql-yellow);
        }

        .filter-btn.state-red.active { background: var(--accent-red); border-color: var(--accent-red); color: white; }
        .filter-btn.state-green.active { background: var(--accent-green); border-color: var(--accent-green); color: var(--ql-black); }
        .filter-btn.state-blue.active { background: var(--accent-blue); border-color: var(--accent-blue); color: white; }
        .filter-btn.state-purple.active { background: #a855f7; border-color: #a855f7; color: white; }

        .jobs-table-container {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .jobs-table {
          width: 100%;
          border-collapse: collapse;
        }

        .jobs-table th {
          background: var(--bg-tertiary);
          padding: 0.875rem 1rem;
          text-align: left;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .jobs-table td {
          padding: 0.875rem 1rem;
          border-top: 1px solid var(--border-color);
        }

        .jobs-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .jobs-table tbody tr:hover {
          background: var(--bg-tertiary);
        }

        .qlid-cell {
          font-family: 'SF Mono', 'Consolas', monospace;
          font-weight: 600;
          color: var(--ql-yellow);
        }

        .state-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .state-blue { background: rgba(67, 150, 253, 0.15); color: #4396FD; }
        .state-yellow { background: rgba(241, 196, 15, 0.15); color: #F1C40F; }
        .state-green { background: rgba(2, 219, 168, 0.15); color: #02dba8; }
        .state-red { background: rgba(235, 61, 59, 0.15); color: #eb3d3b; }
        .state-purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; }

        .priority-badge {
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .priority-urgent { background: var(--accent-red); color: white; }
        .priority-high { background: var(--ql-yellow); color: var(--ql-black); }
        .priority-normal { background: var(--bg-tertiary); color: var(--text-secondary); }
        .priority-low { background: var(--bg-tertiary); color: var(--text-muted); }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem !important;
          color: var(--text-muted);
        }

        .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          color: var(--text-muted);
        }

        .modal-lg {
          max-width: 600px;
        }

        .job-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .detail-value {
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        @media (max-width: 768px) {
          .jobs-table {
            font-size: 0.875rem;
          }

          .jobs-table th,
          .jobs-table td {
            padding: 0.625rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
