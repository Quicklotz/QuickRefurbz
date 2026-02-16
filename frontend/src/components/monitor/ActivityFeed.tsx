import {
  Package,
  ArrowRight,
  Award,
  CheckCircle2,
  ShieldCheck,
  Wrench,
  Clock
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'intake' | 'stage_change' | 'graded' | 'completed' | 'certified' | 'part_used';
  qlid: string;
  description: string;
  technician: string | null;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  onItemClick?: (qlid: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  intake: { icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  stage_change: { icon: ArrowRight, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  graded: { icon: Award, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  certified: { icon: ShieldCheck, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  part_used: { icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityFeed({ activities, onItemClick }: ActivityFeedProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          Live
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => {
            const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.stage_change;
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onItemClick?.(activity.qlid)}
              >
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.technician && (
                      <span className="text-xs text-gray-500">
                        by {activity.technician}
                      </span>
                    )}
                    {activity.metadata?.grade && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        activity.metadata.grade === 'A' ? 'bg-green-100 text-green-700' :
                        activity.metadata.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                        activity.metadata.grade === 'C' ? 'bg-amber-100 text-amber-700' :
                        activity.metadata.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        Grade {activity.metadata.grade}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
