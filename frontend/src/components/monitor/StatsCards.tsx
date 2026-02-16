import {
  Package,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp
} from 'lucide-react';

interface StatsCardsProps {
  overview: {
    totalItems: number;
    inProgress: number;
    completedToday: number;
    completedThisWeek: number;
    pendingItems: number;
    averageProcessingTime: number;
  };
}

export function StatsCards({ overview }: StatsCardsProps) {
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const cards = [
    {
      title: 'Total Items',
      value: overview.totalItems.toLocaleString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      trend: null,
    },
    {
      title: 'In Progress',
      value: overview.inProgress.toLocaleString(),
      icon: Loader2,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      trend: null,
    },
    {
      title: 'Completed Today',
      value: overview.completedToday.toLocaleString(),
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      trend: { direction: 'up' as const, value: '+12%' },
    },
    {
      title: 'Completed This Week',
      value: overview.completedThisWeek.toLocaleString(),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      trend: { direction: 'up' as const, value: '+8%' },
    },
    {
      title: 'Pending',
      value: overview.pendingItems.toLocaleString(),
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      trend: overview.pendingItems > 50
        ? { direction: 'down' as const, value: 'High' }
        : null,
    },
    {
      title: 'Avg Processing Time',
      value: formatTime(overview.averageProcessingTime),
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              {card.trend && (
                <div className={`flex items-center text-xs font-medium ${
                  card.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.trend.direction === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {card.trend.value}
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
