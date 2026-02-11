"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/client';
import { Badge, StageBadge } from '@/components/shared/Badge';
import { BentoStatCard } from '@/components/aceternity/bento-grid';
import { SpotlightCard, Spotlight } from '@/components/aceternity/spotlight';
import { Loader } from '@/components/aceternity/loader';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import {
  Package,
  Boxes,
  CheckCircle,
  Clock,
  Award,
  TrendingUp,
  Smartphone,
  Tablet,
  Laptop,
  Zap,
  Snowflake,
  Wind,
} from 'lucide-react';

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

interface CertificationStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentCount: number;
  revokedCount: number;
}

interface RecentCertification {
  certificationId: string;
  qlid: string;
  manufacturer: string;
  model: string;
  category: string;
  certificationLevel: string;
  certifiedAt: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  PHONE: <Smartphone size={14} />,
  TABLET: <Tablet size={14} />,
  LAPTOP: <Laptop size={14} />,
  APPLIANCE_SMALL: <Zap size={14} />,
  ICE_MAKER: <Snowflake size={14} />,
  VACUUM: <Wind size={14} />,
};

const LEVEL_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  EXCELLENT: 'success',
  GOOD: 'info',
  FAIR: 'warning',
  NOT_CERTIFIED: 'danger',
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [certStats, setCertStats] = useState<CertificationStats | null>(null);
  const [recentCerts, setRecentCerts] = useState<RecentCertification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.getCertificationStats().catch(() => null),
      api.getCertifications({ limit: '5' }).catch(() => []),
    ])
      .then(([dashData, stats, recent]) => {
        setData(dashData);
        setCertStats(stats);
        setRecentCerts(recent || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="bars" text="Loading dashboard..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-zinc-500 text-sm">
        Failed to load dashboard
      </div>
    );
  }

  const inProgress =
    (data.items.byStage['TESTING'] || 0) +
    (data.items.byStage['REPAIR'] || 0) +
    (data.items.byStage['CLEANING'] || 0) +
    (data.items.byStage['FINAL_QC'] || 0);

  const passRate =
    certStats && certStats.total > 0
      ? Math.round(
          (((certStats.byLevel?.EXCELLENT || 0) +
            (certStats.byLevel?.GOOD || 0) +
            (certStats.byLevel?.FAIR || 0)) /
            certStats.total) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <TextGenerateEffect
          words="Real-time overview of refurbishment operations"
          className="text-zinc-400 text-sm"
          duration={0.3}
        />
      </motion.div>

      {/* Primary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <BentoStatCard
          title="Total Items"
          value={data.items.total}
          icon={<Package size={20} />}
          trend={{ value: data.items.todayReceived, label: "today", direction: "up" }}
          variant="blue"
        />
        <BentoStatCard
          title="In Progress"
          value={inProgress}
          icon={<Clock size={20} />}
          variant="yellow"
        />
        <BentoStatCard
          title="Completed Today"
          value={data.items.todayCompleted}
          icon={<CheckCircle size={20} />}
          variant="green"
        />
        <BentoStatCard
          title="Active Pallets"
          value={(data.pallets.byStatus['RECEIVING'] || 0) + (data.pallets.byStatus['IN_PROGRESS'] || 0)}
          icon={<Boxes size={20} />}
          variant="default"
        />
      </motion.div>

      {/* Certification Stats */}
      {certStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <BentoStatCard
            title="Total Certified"
            value={certStats.total}
            icon={<Award size={20} />}
            variant="yellow"
          />
          <BentoStatCard
            title="Excellent Grade"
            value={certStats.byLevel?.EXCELLENT || 0}
            icon={<CheckCircle size={20} />}
            variant="green"
          />
          <BentoStatCard
            title="Good Grade"
            value={certStats.byLevel?.GOOD || 0}
            icon={<TrendingUp size={20} />}
            variant="blue"
          />
          <BentoStatCard
            title="Pass Rate"
            value={`${passRate}%`}
            icon={<TrendingUp size={20} />}
            variant={passRate >= 80 ? "green" : passRate >= 60 ? "yellow" : "red"}
          />
        </motion.div>
      )}

      {/* Category & Recent Certifications */}
      {certStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* By Category */}
          <SpotlightCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Certifications by Category</h2>
            {Object.entries(certStats.byCategory || {}).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(certStats.byCategory).map(([category, count], index) => {
                  const percentage =
                    certStats.total > 0 ? (count / certStats.total) * 100 : 0;
                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="flex items-center gap-2 text-sm text-zinc-400">
                          <span className="text-ql-yellow">
                            {CATEGORY_ICONS[category]}
                          </span>
                          {category.replace('_', ' ')}
                        </span>
                        <span className="text-sm font-semibold text-white">{count}</span>
                      </div>
                      <div className="h-2 bg-dark-tertiary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.5 + index * 0.05, duration: 0.5 }}
                          className="h-full bg-gradient-to-r from-ql-yellow to-ql-yellow/70 rounded-full"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award size={32} className="text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">No certifications yet</p>
              </div>
            )}
          </SpotlightCard>

          {/* Recent Certifications */}
          <SpotlightCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Certifications</h2>
            {recentCerts.length > 0 ? (
              <div className="space-y-2">
                {recentCerts.map((cert, index) => (
                  <motion.div
                    key={cert.certificationId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Spotlight
                      className="flex items-center gap-3 p-3 bg-dark-tertiary/50 rounded-lg"
                      spotlightColor="rgba(241, 196, 15, 0.08)"
                    >
                      <div className="text-ql-yellow">
                        {CATEGORY_ICONS[cert.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">
                          {cert.manufacturer} {cert.model}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                          {cert.qlid}
                        </div>
                      </div>
                      <Badge variant={LEVEL_VARIANTS[cert.certificationLevel]} size="sm">
                        {cert.certificationLevel}
                      </Badge>
                    </Spotlight>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award size={32} className="text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">No recent certifications</p>
              </div>
            )}
          </SpotlightCard>
        </motion.div>
      )}

      {/* Items & Pallets by Stage/Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Items by Stage */}
        <SpotlightCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Items by Stage</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-tertiary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'].map(
                  (stage, index) => (
                    <motion.tr
                      key={stage}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="hover:bg-dark-tertiary/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <StageBadge stage={stage.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {data.items.byStage[stage] || 0}
                      </td>
                    </motion.tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </SpotlightCard>

        {/* Pallets by Status */}
        <SpotlightCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pallets by Status</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-tertiary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {['RECEIVING', 'IN_PROGRESS', 'COMPLETE'].map((status, index) => (
                  <motion.tr
                    key={status}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className="hover:bg-dark-tertiary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-300">
                      {status.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {data.pallets.byStatus[status] || 0}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center"
          >
            <span className="text-sm text-zinc-500">Total COGS</span>
            <span className="text-xl font-bold text-ql-yellow">
              ${data.pallets.totalCogs.toLocaleString()}
            </span>
          </motion.div>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
