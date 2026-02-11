"use client";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  ListTodo,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Filter
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { StatCard } from '@/components/shared/StatCard';
import { Badge, PriorityBadge } from '@/components/shared/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';

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

const STATE_DISPLAY: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }> = {
  REFURBZ_QUEUED: { label: 'Queued', variant: 'info' },
  REFURBZ_ASSIGNED: { label: 'Assigned', variant: 'info' },
  REFURBZ_IN_PROGRESS: { label: 'Security Prep', variant: 'warning' },
  SECURITY_PREP_COMPLETE: { label: 'Diagnosis', variant: 'warning' },
  DIAGNOSED: { label: 'Ready for Repair', variant: 'warning' },
  REPAIR_IN_PROGRESS: { label: 'Repairing', variant: 'warning' },
  REPAIR_COMPLETE: { label: 'Repair Done', variant: 'warning' },
  FINAL_TEST_IN_PROGRESS: { label: 'Final Testing', variant: 'warning' },
  FINAL_TEST_PASSED: { label: 'Test Passed', variant: 'success' },
  CERTIFIED: { label: 'Certified', variant: 'success' },
  REFURBZ_COMPLETE: { label: 'Complete', variant: 'success' },
  REFURBZ_BLOCKED: { label: 'Blocked', variant: 'danger' },
  REFURBZ_ESCALATED: { label: 'Escalated', variant: 'danger' },
  FINAL_TEST_FAILED: { label: 'Test Failed', variant: 'danger' },
  REFURBZ_FAILED_DISPOSITION: { label: 'Failed', variant: 'danger' },
};

const PRIORITY_ORDER = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

const MAIN_STATES = [
  'REFURBZ_QUEUED',
  'REFURBZ_IN_PROGRESS',
  'DIAGNOSED',
  'REPAIR_IN_PROGRESS',
  'FINAL_TEST_IN_PROGRESS',
  'REFURBZ_BLOCKED',
  'REFURBZ_COMPLETE',
];

export function JobQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Record<string, { count: number; jobs: Job[] }>>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
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

  const openJobDetails = (job: Job) => {
    setSelectedJob(job);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading job queue..." />
      </div>
    );
  }

  const filteredJobs = getFilteredJobs();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Job Queue</h1>
          <TextGenerateEffect
            words="Monitor and manage refurbishment jobs"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="secondary" onClick={loadData}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total Jobs"
            value={stats.total}
            icon={ListTodo}
            color="yellow"
          />
          <StatCard
            label="Completed Today"
            value={stats.completedToday}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            label="In Progress"
            value={
              (stats.byState?.REFURBZ_IN_PROGRESS || 0) +
              (stats.byState?.REPAIR_IN_PROGRESS || 0) +
              (stats.byState?.FINAL_TEST_IN_PROGRESS || 0)
            }
            icon={Clock}
            color="blue"
          />
          <StatCard
            label="Blocked / Escalated"
            value={
              (stats.byState?.REFURBZ_BLOCKED || 0) +
              (stats.byState?.REFURBZ_ESCALATED || 0)
            }
            icon={AlertTriangle}
            color="red"
          />
        </motion.div>
      )}

      {/* State Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <div className="flex items-center gap-2 text-zinc-400 mr-2">
          <Filter size={16} />
          <span className="text-sm">Filter:</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setFilter('all')}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
            filter === 'all'
              ? "bg-ql-yellow text-black border-ql-yellow"
              : "bg-dark-card border-border text-zinc-400 hover:border-ql-yellow"
          )}
        >
          All ({getTotalCount()})
        </motion.button>
        {MAIN_STATES.map((state) => {
          const display = STATE_DISPLAY[state];
          const isActive = filter === state;
          const count = getStateCount(state);

          return (
            <motion.button
              key={state}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilter(state)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                isActive
                  ? cn(
                      "border-transparent",
                      display.variant === 'info' && "bg-accent-blue text-white",
                      display.variant === 'warning' && "bg-ql-yellow text-black",
                      display.variant === 'success' && "bg-accent-green text-black",
                      display.variant === 'danger' && "bg-accent-red text-white"
                    )
                  : "bg-dark-card border-border text-zinc-400 hover:border-zinc-600"
              )}
            >
              {display?.label} ({count})
            </motion.button>
          );
        })}
      </motion.div>

      {/* Jobs Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">QLID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <ListTodo className="w-8 h-8 text-zinc-600" />
                          <span>No jobs found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job, index) => (
                      <motion.tr
                        key={job.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => openJobDetails(job)}
                        className="border-b border-border hover:bg-dark-tertiary/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-ql-yellow">{job.qlid}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{job.category}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={STATE_DISPLAY[job.currentState]?.variant || 'info'}
                            size="sm"
                          >
                            {STATE_DISPLAY[job.currentState]?.label || job.currentState}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={job.priority.toLowerCase() as 'urgent' | 'high' | 'normal' | 'low'} />
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {job.assignedTechnicianName || <span className="text-zinc-600">-</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{formatDate(job.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/workflow?qlid=${job.qlid}`);
                            }}
                          >
                            <ExternalLink size={14} />
                            Open
                          </Button>
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

      {/* Job Details Modal */}
      <AnimatedModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedJob?.qlid}
      >
        {selectedJob && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Priority</span>
              <PriorityBadge priority={selectedJob.priority.toLowerCase() as 'urgent' | 'high' | 'normal' | 'low'} />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-zinc-400">Category</span>
                <span className="text-white font-medium">{selectedJob.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-zinc-400">State</span>
                <Badge variant={STATE_DISPLAY[selectedJob.currentState]?.variant || 'info'}>
                  {STATE_DISPLAY[selectedJob.currentState]?.label}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-zinc-400">Pallet ID</span>
                <span className="text-white font-medium">{selectedJob.palletId}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-zinc-400">Assigned To</span>
                <span className="text-white font-medium">{selectedJob.assignedTechnicianName || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400">Created</span>
                <span className="text-white font-medium">{new Date(selectedJob.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowDetailModal(false);
                  navigate(`/workflow?qlid=${selectedJob?.qlid}`);
                }}
              >
                <ExternalLink size={16} />
                Open in Workflow Station
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
