import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/client';
import { Loader } from '@/components/aceternity/loader';
import {
  IconCircleFilled,
  IconRefresh,
  IconClock,
  IconDeviceDesktop,
  IconCheck,
  IconAlertCircle,
  IconActivity,
} from '@tabler/icons-react';

interface StationStatus {
  station_id: string;
  user_id: string;
  name: string;
  email: string;
  status: 'online' | 'idle' | 'offline';
  last_heartbeat: string | null;
  current_page: string | null;
  current_item: string | null;
  setup_complete: boolean;
  setup_at: string | null;
  heartbeats_today: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  online: { bg: 'bg-accent-green/10', text: 'text-accent-green', dot: 'text-accent-green' },
  idle: { bg: 'bg-accent-orange/10', text: 'text-accent-orange', dot: 'text-accent-orange' },
  offline: { bg: 'bg-zinc-800', text: 'text-zinc-500', dot: 'text-zinc-600' },
};

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

export function StationMonitor() {
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStations = useCallback(async () => {
    try {
      const data = await api.getStations();
      setStations(data);
      setError(null);
    } catch (err) {
      setError('Failed to load station data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
    const interval = setInterval(fetchStations, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchStations]);

  const onlineCount = stations.filter(s => s.status === 'online').length;
  const idleCount = stations.filter(s => s.status === 'idle').length;
  const offlineCount = stations.filter(s => s.status === 'offline').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size="lg" variant="bars" text="Loading stations..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Station Monitor</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {stations.length} stations &middot; {onlineCount} online &middot; {idleCount} idle &middot; {offlineCount} offline
          </p>
        </div>
        <button
          onClick={fetchStations}
          className="p-2 rounded-lg bg-dark-secondary border border-border hover:border-ql-yellow transition-colors"
        >
          <IconRefresh size={18} className="text-zinc-400" />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-accent-red/10 text-accent-red text-sm flex items-center gap-2">
          <IconAlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Online', count: onlineCount, color: 'text-accent-green', bg: 'bg-accent-green/10' },
          { label: 'Idle', count: idleCount, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
          { label: 'Offline', count: offlineCount, color: 'text-zinc-500', bg: 'bg-zinc-800' },
        ].map(card => (
          <div key={card.label} className={`p-4 rounded-xl ${card.bg} border border-border`}>
            <p className={`text-3xl font-bold ${card.color}`}>{card.count}</p>
            <p className="text-zinc-500 text-xs mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Station Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {stations.map((station, i) => {
          const colors = STATUS_COLORS[station.status] || STATUS_COLORS.offline;
          return (
            <motion.div
              key={station.station_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-4 rounded-xl border border-border ${colors.bg} space-y-3`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconDeviceDesktop size={16} className={colors.text} />
                  <span className="font-mono text-sm font-bold text-white">{station.station_id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <IconCircleFilled size={8} className={colors.dot} />
                  <span className={`text-xs font-medium capitalize ${colors.text}`}>{station.status}</span>
                </div>
              </div>

              {/* Name */}
              <p className="text-zinc-400 text-xs truncate">{station.name}</p>

              {/* Details */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <IconClock size={12} />
                  <span>{timeAgo(station.last_heartbeat)}</span>
                </div>
                {station.current_page && (
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <IconActivity size={12} />
                    <span className="truncate">{station.current_page}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {station.setup_complete ? (
                    <><IconCheck size={12} className="text-accent-green" /><span className="text-accent-green">Setup done</span></>
                  ) : (
                    <><IconAlertCircle size={12} className="text-accent-orange" /><span className="text-accent-orange">Needs setup</span></>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {stations.length === 0 && !loading && (
        <div className="text-center py-16">
          <IconDeviceDesktop size={48} className="text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">No station accounts found</p>
          <p className="text-zinc-600 text-xs mt-1">Run the station seeder from admin settings first</p>
        </div>
      )}
    </div>
  );
}
