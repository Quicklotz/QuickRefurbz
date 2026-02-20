"use client";
import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge, StageBadge } from '@/components/shared/Badge';
import { Loader } from '@/components/aceternity/loader';
import {
  Package,
  Boxes,
  CheckCircle,
  Clock,
  Award,
  TrendingUp,
  TrendingDown,
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

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: 'default' | 'yellow' | 'green' | 'blue' | 'red';
}

function StatsCard({ title, value, icon, trend, color = 'default' }: StatsCardProps) {
  const colorClasses = {
    default: 'text-white',
    yellow: 'text-[var(--color-ql-yellow)]',
    green: 'text-[var(--color-accent-green)]',
    blue: 'text-[var(--color-accent-blue)]',
    red: 'text-[var(--color-accent-red)]',
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)] p-6 transition-colors hover:border-[var(--color-border-light)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{title}</p>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${colorClasses[color]}`}>
        {value}
      </p>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span className={`flex items-center gap-1 text-sm ${trend.isPositive ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-red)]'}`}>
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend.value)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-zinc-500">Overview of refurbishment operations</p>
      </div>

      {/* Primary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Items"
          value={data.items.total.toLocaleString()}
          icon={<Package size={18} />}
          trend={data.items.todayReceived > 0 ? { value: data.items.todayReceived, isPositive: true } : undefined}
        />
        <StatsCard
          title="In Progress"
          value={inProgress}
          icon={<Clock size={18} />}
          color="yellow"
        />
        <StatsCard
          title="Completed Today"
          value={data.items.todayCompleted}
          icon={<CheckCircle size={18} />}
          color="green"
        />
        <StatsCard
          title="Active Pallets"
          value={(data.pallets.byStatus['RECEIVING'] || 0) + (data.pallets.byStatus['IN_PROGRESS'] || 0)}
          icon={<Boxes size={18} />}
        />
      </div>

      {/* Certification Stats */}
      {certStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Certified"
            value={certStats.total}
            icon={<Award size={18} />}
            color="yellow"
          />
          <StatsCard
            title="Excellent Grade"
            value={certStats.byLevel?.EXCELLENT || 0}
            icon={<CheckCircle size={18} />}
            color="green"
          />
          <StatsCard
            title="Good Grade"
            value={certStats.byLevel?.GOOD || 0}
            icon={<TrendingUp size={18} />}
            color="blue"
          />
          <StatsCard
            title="Pass Rate"
            value={`${passRate}%`}
            icon={<TrendingUp size={18} />}
            color={passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red'}
          />
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Certifications by Category */}
        {certStats && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
            <div className="p-6">
              <h2 className="text-base font-medium text-white">Certifications by Category</h2>
            </div>
            <div className="px-6 pb-6">
              {Object.entries(certStats.byCategory || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(certStats.byCategory).map(([category, count]) => {
                    const percentage = certStats.total > 0 ? (count / certStats.total) * 100 : 0;
                    return (
                      <div key={category}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="flex items-center gap-2 text-sm text-zinc-400">
                            <span className="text-[var(--color-ql-yellow)]">
                              {CATEGORY_ICONS[category]}
                            </span>
                            {category.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-medium text-white">{count}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-dark-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-ql-yellow)] rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  No certifications yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Certifications */}
        {certStats && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
            <div className="p-6">
              <h2 className="text-base font-medium text-white">Recent Certifications</h2>
            </div>
            <div className="px-6 pb-6">
              {recentCerts.length > 0 ? (
                <div className="space-y-3">
                  {recentCerts.map((cert) => (
                    <div
                      key={cert.certificationId}
                      className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-ql-yellow)]/10 flex items-center justify-center text-[var(--color-ql-yellow)]">
                        {CATEGORY_ICONS[cert.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {cert.manufacturer} {cert.model}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {cert.qlid}
                        </p>
                      </div>
                      <Badge variant={LEVEL_VARIANTS[cert.certificationLevel]} size="sm">
                        {cert.certificationLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  No recent certifications
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Items & Pallets Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Items by Stage */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
          <div className="p-6">
            <h2 className="text-base font-medium text-white">Items by Stage</h2>
          </div>
          <div className="px-6 pb-6">
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-dark-tertiary)]/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Stage</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'].map((stage) => (
                    <tr key={stage} className="hover:bg-[var(--color-dark-tertiary)]/30 transition-colors">
                      <td className="px-4 py-3">
                        <StageBadge stage={stage.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {data.items.byStage[stage] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pallets by Status */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-dark-card)]">
          <div className="p-6">
            <h2 className="text-base font-medium text-white">Pallets by Status</h2>
          </div>
          <div className="px-6 pb-6">
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-dark-tertiary)]/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {['RECEIVING', 'IN_PROGRESS', 'COMPLETE'].map((status) => (
                    <tr key={status} className="hover:bg-[var(--color-dark-tertiary)]/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-300 font-medium">
                        {status.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {data.pallets.byStatus[status] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]/30 flex justify-between items-center">
                <span className="text-sm text-zinc-500">Total COGS</span>
                <span className="text-2xl font-semibold text-[var(--color-ql-yellow)]">
                  ${data.pallets.totalCogs.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
