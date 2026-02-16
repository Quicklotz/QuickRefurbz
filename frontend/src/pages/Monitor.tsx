import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor as MonitorIcon,
  RefreshCw,
  Wifi,
  WifiOff,
  Package,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Award,
  User,
  Activity,
  Gauge,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import { BentoGrid, BentoGridItem, BentoStatCard } from '../components/aceternity/bento-grid';
import { Tabs } from '../components/aceternity/tabs';
import { cn } from '@/lib/utils';

interface DashboardStats {
  overview: {
    totalItems: number;
    inProgress: number;
    completedToday: number;
    completedThisWeek: number;
    pendingItems: number;
    averageProcessingTime: number;
  };
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  throughput: {
    hourly: Array<{ timestamp: string; intake: number; completed: number }>;
    daily: Array<{ timestamp: string; intake: number; completed: number }>;
    weekly: Array<{ timestamp: string; intake: number; completed: number }>;
  };
  technicians: Array<{
    id: string;
    name: string;
    itemsProcessed: number;
    itemsInProgress: number;
    averageTime: number;
    currentStage: string | null;
    lastActivity: string;
  }>;
  grades: Array<{
    grade: string;
    count: number;
    percentage: number;
    averageValue: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    category: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    qlid: string;
    description: string;
    technician: string | null;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

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

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-accent-green',
  B: 'bg-accent-blue',
  C: 'bg-ql-yellow',
  D: 'bg-orange-500',
  F: 'bg-accent-red',
};

export default function Monitor() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
      console.error('Failed to fetch dashboard stats:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const eventSource = api.connectToMonitorStream();
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => setConnected(true);

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'connected') setConnected(true);
          else if (update.type === 'activity') {
            setStats((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                recentActivity: [update.data, ...prev.recentActivity.slice(0, 49)],
              };
            });
            setLastUpdate(new Date());
          }
        } catch (err) {
          console.error('Failed to parse SSE:', err);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        setTimeout(() => {
          eventSourceRef.current?.close();
          fetchStats();
        }, 5000);
      };

      const intervalId = setInterval(fetchStats, 30000);
      return () => {
        eventSource.close();
        clearInterval(intervalId);
      };
    }
  }, [fetchStats, autoRefresh]);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-ql-yellow/20" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-ql-yellow"
            />
          </div>
          <p className="text-zinc-400">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-accent-red mx-auto mb-4" />
          <p className="text-accent-red mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-2 bg-ql-yellow text-black font-medium rounded-lg hover:bg-ql-yellow/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const throughputTabs = [
    {
      title: 'Daily',
      value: 'daily',
      content: (
        <ThroughputChart data={stats?.throughput.daily || []} />
      ),
    },
    {
      title: 'Hourly',
      value: 'hourly',
      content: (
        <ThroughputChart data={stats?.throughput.hourly || []} />
      ),
    },
    {
      title: 'Weekly',
      value: 'weekly',
      content: (
        <ThroughputChart data={stats?.throughput.weekly || []} />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-dark-primary">
      {/* Header */}
      <header className="bg-dark-secondary border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ql-yellow/10 rounded-lg">
                <MonitorIcon className="w-5 h-5 text-ql-yellow" />
              </div>
              <h1 className="text-xl font-bold text-white">
                QuickRefurbz <span className="text-ql-yellow">Monitor</span>
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <AnimatePresence mode="wait">
                {connected ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent-green/10 rounded-full"
                  >
                    <Wifi className="w-4 h-4 text-accent-green" />
                    <span className="text-xs text-accent-green font-medium">Live</span>
                    <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="disconnected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full"
                  >
                    <WifiOff className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-400">Offline</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="text-xs text-zinc-500">
                Updated: {lastUpdate ? formatTimestamp(lastUpdate.toISOString()) : 'Never'}
              </span>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  autoRefresh ? "bg-ql-yellow/10 text-ql-yellow" : "bg-zinc-800 text-zinc-400"
                )}
              >
                <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stats && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <BentoStatCard
                title="Total Items"
                value={stats.overview.totalItems.toLocaleString()}
                icon={<Package className="w-5 h-5" />}
                variant="default"
              />
              <BentoStatCard
                title="In Progress"
                value={stats.overview.inProgress.toLocaleString()}
                icon={<Loader2 className="w-5 h-5" />}
                variant="yellow"
              />
              <BentoStatCard
                title="Today"
                value={stats.overview.completedToday.toLocaleString()}
                icon={<CheckCircle2 className="w-5 h-5" />}
                variant="green"
                trend={{ value: 12, label: 'vs yesterday', direction: 'up' }}
              />
              <BentoStatCard
                title="This Week"
                value={stats.overview.completedThisWeek.toLocaleString()}
                icon={<TrendingUp className="w-5 h-5" />}
                variant="blue"
              />
              <BentoStatCard
                title="Pending"
                value={stats.overview.pendingItems.toLocaleString()}
                icon={<Clock className="w-5 h-5" />}
                variant={stats.overview.pendingItems > 50 ? 'red' : 'default'}
              />
              <BentoStatCard
                title="Avg Time"
                value={formatTime(stats.overview.averageProcessingTime)}
                icon={<Gauge className="w-5 h-5" />}
                variant="default"
              />
            </div>

            {/* Bento Grid Layout */}
            <BentoGrid className="md:auto-rows-[20rem]">
              {/* Pipeline */}
              <BentoGridItem
                className="md:col-span-2"
                title="Refurbishment Pipeline"
                description="Current items at each stage"
                icon={<ArrowRight className="w-5 h-5" />}
                header={
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {stats.stages.map((stage) => (
                      <motion.div
                        key={stage.stage}
                        whileHover={{ scale: 1.05 }}
                        className="flex-shrink-0 bg-dark-tertiary rounded-lg p-3 min-w-[90px] text-center"
                      >
                        <div className="text-2xl font-bold text-white">{stage.count}</div>
                        <div className="text-xs text-zinc-400">{STAGE_LABELS[stage.stage]}</div>
                        <div className="text-xs text-zinc-500">{stage.percentage}%</div>
                      </motion.div>
                    ))}
                  </div>
                }
              />

              {/* Grade Distribution */}
              <BentoGridItem
                title="Grade Distribution"
                description="Quality breakdown"
                icon={<Award className="w-5 h-5" />}
                header={
                  <div className="space-y-2">
                    {stats.grades.map((grade) => (
                      <div key={grade.grade} className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                          GRADE_COLORS[grade.grade] || 'bg-zinc-600'
                        )}>
                          {grade.grade}
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-dark-tertiary rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${grade.percentage}%` }}
                              className={cn("h-full rounded-full", GRADE_COLORS[grade.grade] || 'bg-zinc-600')}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-white font-medium w-12 text-right">
                          {grade.count}
                        </span>
                      </div>
                    ))}
                  </div>
                }
              />

              {/* Alerts */}
              <BentoGridItem
                className="md:col-span-1"
                title={`Alerts (${stats.alerts.length})`}
                description="System notifications"
                icon={<AlertTriangle className="w-5 h-5" />}
                header={
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {stats.alerts.length === 0 ? (
                      <div className="text-center py-4 text-zinc-500">No active alerts</div>
                    ) : (
                      stats.alerts.slice(0, 5).map((alert) => (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "p-2 rounded-lg text-xs",
                            alert.type === 'error' ? 'bg-accent-red/10 text-accent-red' :
                            alert.type === 'warning' ? 'bg-ql-yellow/10 text-ql-yellow' :
                            'bg-accent-blue/10 text-accent-blue'
                          )}
                        >
                          {alert.message}
                        </motion.div>
                      ))
                    )}
                  </div>
                }
              />

              {/* Technicians */}
              <BentoGridItem
                className="md:col-span-2"
                title="Technician Performance"
                description="Top performers today"
                icon={<User className="w-5 h-5" />}
                header={
                  <div className="space-y-2">
                    {stats.technicians.slice(0, 4).map((tech, idx) => (
                      <div key={tech.id} className="flex items-center gap-3 p-2 bg-dark-tertiary rounded-lg">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                          idx === 0 ? 'bg-ql-yellow text-black' :
                          idx === 1 ? 'bg-zinc-400' :
                          idx === 2 ? 'bg-orange-400' : 'bg-zinc-600'
                        )}>
                          {tech.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-white font-medium">{tech.name}</div>
                          <div className="text-xs text-zinc-400">
                            {tech.currentStage ? STAGE_LABELS[tech.currentStage] : 'Idle'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white font-bold">{tech.itemsProcessed}</div>
                          <div className="text-xs text-zinc-400">processed</div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />

              {/* Activity Feed */}
              <BentoGridItem
                className="md:col-span-1"
                title="Live Activity"
                description="Real-time updates"
                icon={<Activity className="w-5 h-5" />}
                header={
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {stats.recentActivity.slice(0, 6).map((activity) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-2 bg-dark-tertiary rounded-lg cursor-pointer hover:bg-dark-tertiary/80"
                        onClick={() => navigate(`/workflow/${activity.qlid}`)}
                      >
                        <div className="text-xs text-white truncate">{activity.description}</div>
                        <div className="text-xs text-zinc-500">{formatTimestamp(activity.timestamp)}</div>
                      </motion.div>
                    ))}
                  </div>
                }
              />
            </BentoGrid>

            {/* Throughput Chart with Tabs */}
            <div className="bg-dark-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Throughput</h3>
              <Tabs
                tabs={throughputTabs}
                containerClassName="mb-4"
                contentClassName="mt-8"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Simple throughput chart component
function ThroughputChart({ data }: { data: Array<{ timestamp: string; intake: number; completed: number }> }) {
  const maxValue = Math.max(...data.flatMap(d => [d.intake, d.completed]), 1);

  return (
    <div className="h-48 flex items-end gap-1">
      {data.slice(-20).map((point, idx) => (
        <div key={idx} className="flex-1 flex items-end gap-0.5 group relative">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(point.intake / maxValue) * 100}%` }}
            className="w-full bg-accent-blue rounded-t"
          />
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(point.completed / maxValue) * 100}%` }}
            className="w-full bg-accent-green rounded-t"
          />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
            <div className="bg-dark-secondary text-white text-xs rounded px-2 py-1 whitespace-nowrap border border-border">
              <div>In: {point.intake}</div>
              <div>Out: {point.completed}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
