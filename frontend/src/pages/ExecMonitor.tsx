import { useEffect, useState, useCallback, useRef } from 'react';

// ==================== Types ====================

interface OverviewStats {
  totalItems: number;
  inProgress: number;
  completedToday: number;
  completedThisWeek: number;
  pendingItems: number;
  averageProcessingTime: number;
}

interface StageData {
  stage: string;
  count: number;
  percentage: number;
}

interface ThroughputPoint {
  timestamp: string;
  intake: number;
  completed: number;
}

interface ThroughputData {
  hourly: ThroughputPoint[];
  daily: ThroughputPoint[];
  weekly: ThroughputPoint[];
}

interface TechnicianStat {
  id: string;
  name: string;
  itemsProcessed: number;
  itemsInProgress: number;
  averageTime: number;
  currentStage: string | null;
  lastActivity: string;
}

interface GradeData {
  grade: string;
  count: number;
  percentage: number;
  averageValue: number;
}

interface AlertData {
  id: string;
  type: 'warning' | 'error' | 'info';
  category: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface ActivityItem {
  id: string;
  type: string;
  qlid: string;
  description: string;
  technician: string | null;
  timestamp: string;
}

interface StationStatus {
  station_id: string;
  name: string;
  status: 'online' | 'idle' | 'offline';
  last_heartbeat: string | null;
  current_page: string | null;
  current_item: string | null;
  setup_complete: boolean;
  heartbeats_today: number;
}

// ==================== Constants ====================

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Intake',
  TESTING: 'Testing',
  DIAGNOSTICS: 'Diagnostics',
  REPAIR: 'Repair',
  CLEANING: 'Cleaning',
  DATA_WIPE: 'Data Wipe',
  FINAL_QC: 'Final QC',
  COMPLETE: 'Complete',
};

const STAGE_ORDER = ['INTAKE', 'TESTING', 'DIAGNOSTICS', 'REPAIR', 'CLEANING', 'DATA_WIPE', 'FINAL_QC', 'COMPLETE'];

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  online: { bg: 'rgba(34,197,94,0.1)', dot: '#22c55e', text: '#22c55e' },
  idle: { bg: 'rgba(249,115,22,0.1)', dot: '#f97316', text: '#f97316' },
  offline: { bg: 'rgba(63,63,70,0.3)', dot: '#52525b', text: '#71717a' },
};

// ==================== Helpers ====================

const BASE_URL = window.location.origin;

async function monitorFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function clockTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ==================== Component ====================

export default function ExecMonitor() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [stages, setStages] = useState<StageData[]>([]);
  const [throughput, setThroughput] = useState<ThroughputData | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianStat[]>([]);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [clock, setClock] = useState(clockTime());
  const [throughputTab, setThroughputTab] = useState<'daily' | 'hourly' | 'weekly'>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch all stats
  const fetchStats = useCallback(async () => {
    try {
      const [ov, st, tp, tc, gr, al, ac] = await Promise.all([
        monitorFetch<OverviewStats>('/api/monitor/overview'),
        monitorFetch<StageData[]>('/api/monitor/stages'),
        monitorFetch<ThroughputData>('/api/monitor/throughput'),
        monitorFetch<TechnicianStat[]>('/api/monitor/technicians'),
        monitorFetch<GradeData[]>('/api/monitor/grades'),
        monitorFetch<AlertData[]>('/api/monitor/alerts'),
        monitorFetch<ActivityItem[]>('/api/monitor/activity?limit=20'),
      ]);
      setOverview(ov);
      setStages(st);
      setThroughput(tp);
      setTechnicians(tc);
      setGrades(gr);
      setAlerts(al);
      setActivity(ac);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stations
  const fetchStations = useCallback(async () => {
    try {
      const data = await monitorFetch<StationStatus[]>('/api/monitor/stations');
      setStations(data);
    } catch (err) {
      console.error('Failed to fetch stations:', err);
    }
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/api/monitor/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === 'connected') setConnected(true);
        else if (update.type === 'activity' && update.data) {
          setActivity(prev => [update.data, ...prev.slice(0, 19)]);
          setLastUpdate(new Date());
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // Polling
  useEffect(() => {
    fetchStats();
    fetchStations();
    const statsInterval = setInterval(fetchStats, 30000);
    const stationsInterval = setInterval(fetchStations, 15000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(stationsInterval);
    };
  }, [fetchStats, fetchStations]);

  const onlineCount = stations.filter(s => s.status === 'online').length;
  const idleCount = stations.filter(s => s.status === 'idle').length;
  const offlineCount = stations.filter(s => s.status === 'offline').length;

  // Throughput chart data
  const chartData = throughput?.[throughputTab] || [];
  const maxThroughput = Math.max(...chartData.flatMap(d => [d.intake, d.completed]), 1);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={{ color: '#a1a1aa', marginTop: 16 }}>Loading executive dashboard...</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div style={styles.loadingScreen}>
        <p style={{ color: '#ef4444', fontSize: 18, marginBottom: 16 }}>{error}</p>
        <button onClick={fetchStats} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ===== Header ===== */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <img src="/icons/q-logo-72.png" alt="Q" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <h1 style={styles.title}>
              QuickRefurbz <span style={{ color: '#eab308' }}>Monitor</span>
            </h1>
          </div>
          <div style={styles.headerRight}>
            {/* SSE indicator */}
            <div style={{
              ...styles.sseBadge,
              background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(63,63,70,0.3)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: connected ? '#22c55e' : '#52525b',
                display: 'inline-block',
                animation: connected ? 'pulse 2s infinite' : 'none',
              }} />
              <span style={{ color: connected ? '#22c55e' : '#71717a', fontSize: 12, fontWeight: 500 }}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
            <span style={{ color: '#71717a', fontSize: 12 }}>
              Updated: {lastUpdate ? timeAgo(lastUpdate.toISOString()) : 'Never'}
            </span>
            <span style={{ color: '#a1a1aa', fontSize: 13, fontFamily: 'monospace' }}>{clock}</span>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* ===== KPI Cards ===== */}
        {overview && (
          <div style={styles.kpiGrid}>
            <KPICard label="Total Items" value={overview.totalItems.toLocaleString()} color="#a1a1aa" />
            <KPICard label="In Progress" value={overview.inProgress.toLocaleString()} color="#eab308" />
            <KPICard label="Completed Today" value={overview.completedToday.toLocaleString()} color="#22c55e" />
            <KPICard label="This Week" value={overview.completedThisWeek.toLocaleString()} color="#3b82f6" />
            <KPICard label="Pending" value={overview.pendingItems.toLocaleString()} color={overview.pendingItems > 50 ? '#ef4444' : '#a1a1aa'} />
            <KPICard label="Avg Time" value={formatTime(overview.averageProcessingTime)} color="#a1a1aa" />
          </div>
        )}

        {/* ===== Station Status ===== */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Station Status</h2>
            <div style={styles.stationSummary}>
              <span style={{ color: '#22c55e' }}>{onlineCount} online</span>
              <span style={{ color: '#71717a' }}>/</span>
              <span style={{ color: '#f97316' }}>{idleCount} idle</span>
              <span style={{ color: '#71717a' }}>/</span>
              <span style={{ color: '#71717a' }}>{offlineCount} offline</span>
            </div>
          </div>
          <div style={styles.stationGrid}>
            {stations.map(station => {
              const sc = STATUS_COLORS[station.status] || STATUS_COLORS.offline;
              return (
                <div key={station.station_id} style={{ ...styles.stationCard, background: sc.bg }}>
                  <div style={styles.stationCardHeader}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                      {station.station_id}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, color: sc.text, textTransform: 'capitalize' }}>{station.status}</span>
                    </div>
                  </div>
                  <p style={{ color: '#a1a1aa', fontSize: 11, margin: '4px 0' }}>{station.name}</p>
                  <div style={{ fontSize: 11, color: '#71717a' }}>
                    <div>{timeAgo(station.last_heartbeat)}</div>
                    {station.current_page && <div style={{ marginTop: 2 }}>Page: {station.current_page}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Pipeline ===== */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Refurbishment Pipeline</h2>
          <div style={styles.pipelineRow}>
            {STAGE_ORDER.map((stageKey, i) => {
              const stageData = stages.find(s => s.stage === stageKey);
              return (
                <div key={stageKey} style={styles.pipelineStage}>
                  {i > 0 && <div style={styles.pipelineArrow} />}
                  <div style={styles.pipelineBox}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                      {stageData?.count ?? 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#a1a1aa' }}>{STAGE_LABELS[stageKey]}</div>
                    <div style={{ fontSize: 10, color: '#71717a' }}>{stageData?.percentage ?? 0}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Two-column Layout ===== */}
        <div style={styles.twoCol}>
          {/* Left Column */}
          <div style={styles.colLeft}>
            {/* Throughput Chart */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Throughput</h3>
                <div style={styles.tabGroup}>
                  {(['daily', 'hourly', 'weekly'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setThroughputTab(tab)}
                      style={{
                        ...styles.tabBtn,
                        background: throughputTab === tab ? '#eab308' : 'transparent',
                        color: throughputTab === tab ? '#000' : '#a1a1aa',
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.chartContainer}>
                {chartData.slice(-20).map((point, idx) => (
                  <div key={idx} style={styles.chartBarGroup} title={`In: ${point.intake} / Out: ${point.completed}`}>
                    <div style={{
                      ...styles.chartBar,
                      height: `${(point.intake / maxThroughput) * 100}%`,
                      background: '#3b82f6',
                    }} />
                    <div style={{
                      ...styles.chartBar,
                      height: `${(point.completed / maxThroughput) * 100}%`,
                      background: '#22c55e',
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} />
                  <span style={{ color: '#a1a1aa', fontSize: 11 }}>Intake</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#22c55e', borderRadius: 2, display: 'inline-block' }} />
                  <span style={{ color: '#a1a1aa', fontSize: 11 }}>Completed</span>
                </div>
              </div>
            </section>

            {/* Technician Table */}
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Technician Performance</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Technician</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Processed</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>In Progress</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Avg Time</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.map((tech, idx) => (
                    <tr key={tech.id} style={{ borderBottom: '1px solid #27272a' }}>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                            background: idx === 0 ? '#eab308' : idx === 1 ? '#a1a1aa' : idx === 2 ? '#f97316' : '#3f3f46',
                            color: idx === 0 ? '#000' : '#fff',
                          }}>
                            {tech.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: '#fff', fontSize: 13 }}>{tech.name}</span>
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', color: '#fff', fontWeight: 600 }}>{tech.itemsProcessed}</td>
                      <td style={{ ...styles.td, textAlign: 'center', color: '#eab308' }}>{tech.itemsInProgress}</td>
                      <td style={{ ...styles.td, textAlign: 'center', color: '#a1a1aa' }}>{formatTime(tech.averageTime)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#71717a', fontSize: 12 }}>
                        {tech.currentStage ? STAGE_LABELS[tech.currentStage] || tech.currentStage : 'Idle'}
                      </td>
                    </tr>
                  ))}
                  {technicians.length === 0 && (
                    <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#71717a' }}>No technician data</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          {/* Right Column */}
          <div style={styles.colRight}>
            {/* Grade Distribution */}
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Grade Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grades.map(grade => (
                  <div key={grade.grade} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                      background: GRADE_COLORS[grade.grade] || '#3f3f46', color: '#fff',
                    }}>
                      {grade.grade}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 8, background: '#27272a', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          background: GRADE_COLORS[grade.grade] || '#3f3f46',
                          width: `${grade.percentage}%`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                      {grade.count}
                    </span>
                  </div>
                ))}
                {grades.length === 0 && (
                  <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 16 }}>No grade data</p>
                )}
              </div>
            </section>

            {/* Alerts */}
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Alerts ({alerts.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 16 }}>No active alerts</p>
                ) : (
                  alerts.slice(0, 8).map(alert => (
                    <div key={alert.id} style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      background: alert.type === 'error' ? 'rgba(239,68,68,0.1)' :
                        alert.type === 'warning' ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.1)',
                      color: alert.type === 'error' ? '#ef4444' :
                        alert.type === 'warning' ? '#eab308' : '#3b82f6',
                    }}>
                      {alert.message}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Live Activity Feed */}
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Live Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                {activity.length === 0 ? (
                  <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 16 }}>No recent activity</p>
                ) : (
                  activity.map(item => (
                    <div key={item.id} style={{
                      padding: '8px 10px', borderRadius: 8, background: '#18181b',
                    }}>
                      <div style={{ color: '#e4e4e7', fontSize: 12 }}>{item.description}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ color: '#71717a', fontSize: 11 }}>{item.qlid}</span>
                        <span style={{ color: '#71717a', fontSize: 11 }}>{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Pulse animation for SSE dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ==================== KPI Card Sub-component ====================

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ==================== Inline Styles ====================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#09090b',
    color: '#e4e4e7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loadingScreen: {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 48, height: 48, borderRadius: '50%',
    border: '4px solid rgba(234,179,8,0.2)',
    borderTopColor: '#eab308',
    animation: 'spin 1s linear infinite',
  },
  retryBtn: {
    padding: '10px 24px', background: '#eab308', color: '#000',
    fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14,
  },
  header: {
    background: '#18181b', borderBottom: '1px solid #27272a',
    position: 'sticky' as const, top: 0, zIndex: 50,
  },
  headerInner: {
    maxWidth: 1440, margin: '0 auto', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoBadge: { /* unused — replaced by Q logo image */ },
  title: { fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  sseBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20,
  },
  main: { maxWidth: 1440, margin: '0 auto', padding: '24px 24px 48px' },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24,
  },
  kpiCard: {
    background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 16,
    textAlign: 'center' as const,
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 12px' },
  stationSummary: { display: 'flex', gap: 6, fontSize: 13 },
  stationGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8,
  },
  stationCard: {
    border: '1px solid #27272a', borderRadius: 10, padding: 12,
  },
  stationCardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  pipelineRow: {
    display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' as const, paddingBottom: 4,
  },
  pipelineStage: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 },
  pipelineArrow: {
    width: 16, height: 2, background: '#3f3f46', flexShrink: 0, marginRight: 4,
  },
  pipelineBox: {
    flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 10,
    padding: '12px 8px', textAlign: 'center' as const, minWidth: 80,
  },
  twoCol: {
    display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20,
  },
  colLeft: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
  colRight: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
  card: {
    background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px' },
  tabGroup: { display: 'flex', gap: 4 },
  tabBtn: {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 500,
  },
  chartContainer: {
    height: 180, display: 'flex', alignItems: 'flex-end', gap: 2,
  },
  chartBarGroup: {
    flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%',
    cursor: 'pointer',
  },
  chartBar: { flex: 1, borderRadius: '3px 3px 0 0', minHeight: 2, transition: 'height 0.3s ease' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '8px 8px', fontSize: 11, fontWeight: 600,
    color: '#71717a', textTransform: 'uppercase' as const, borderBottom: '1px solid #27272a',
  },
  td: { padding: '10px 8px', fontSize: 13 },
};
