import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ChevronRight, RefreshCw } from 'lucide-react';

const STAGES = ['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'];

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Intake',
  TESTING: 'Testing',
  REPAIR: 'Repair',
  CLEANING: 'Cleaning',
  FINAL_QC: 'Final QC',
  COMPLETE: 'Complete'
};

export function Kanban() {
  const [kanban, setKanban] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const loadKanban = () => {
    setLoading(true);
    api.getKanban()
      .then(setKanban)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKanban();
  }, []);

  const handleAdvance = async (item: any) => {
    if (advancing) return;
    setAdvancing(item.qlid);

    try {
      await api.advanceItem(item.qlid);
      loadKanban();
    } catch (error) {
      console.error('Failed to advance:', error);
    } finally {
      setAdvancing(null);
    }
  };

  if (loading && Object.keys(kanban).length === 0) {
    return <div>Loading kanban board...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Kanban Board</h1>
        <button className="btn btn-secondary" onClick={loadKanban} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="kanban-board">
        {STAGES.map(stage => (
          <div key={stage} className="kanban-column">
            <div className="kanban-header">
              <span className="kanban-title">{STAGE_LABELS[stage]}</span>
              <span className="kanban-count">{kanban[stage]?.length || 0}</span>
            </div>
            <div className="kanban-items">
              {(kanban[stage] || []).map(item => (
                <div key={item.qlid} className="kanban-item">
                  <div className="kanban-item-id">{item.qlid}</div>
                  <div className="kanban-item-title">
                    {item.manufacturer} {item.model}
                  </div>
                  <div className="kanban-item-meta">
                    <span className={`tag tag-priority-${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                    <span className="tag tag-category">{item.category}</span>
                  </div>
                  {stage !== 'COMPLETE' && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', padding: '0.375rem' }}
                      onClick={() => handleAdvance(item)}
                      disabled={advancing === item.qlid}
                    >
                      {advancing === item.qlid ? 'Moving...' : (
                        <>
                          Next <ChevronRight size={14} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
              {(kanban[stage] || []).length === 0 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
