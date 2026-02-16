import {
  AlertTriangle,
  AlertCircle,
  Info,
  Package,
  Gauge,
  ShieldAlert,
  Settings,
  X
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  category: 'inventory' | 'performance' | 'quality' | 'system';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bgColor: string; borderColor: string; textColor: string }> = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
  },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  inventory: Package,
  performance: Gauge,
  quality: ShieldAlert,
  system: Settings,
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function AlertsPanel({ alerts, onAcknowledge, onDismiss }: AlertsPanelProps) {
  const errorCount = alerts.filter(a => a.type === 'error').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Alerts</h3>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              <AlertCircle className="w-3 h-3" />
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {warningCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = TYPE_CONFIG[alert.type];
            const TypeIcon = config.icon;
            const CategoryIcon = CATEGORY_ICONS[alert.category] || Settings;

            return (
              <div
                key={alert.id}
                className={`relative p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <TypeIcon className={`w-5 h-5 ${config.textColor} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryIcon className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500 capitalize">
                        {alert.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(alert.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm ${config.textColor}`}>
                      {alert.message}
                    </p>
                    {!alert.acknowledged && onAcknowledge && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(alert.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
