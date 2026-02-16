import { User, Clock, Package, Loader2 } from 'lucide-react';

interface TechnicianStat {
  id: string;
  name: string;
  itemsProcessed: number;
  itemsInProgress: number;
  averageTime: number;
  currentStage: string | null;
  lastActivity: string;
}

interface TechnicianStatsProps {
  technicians: TechnicianStat[];
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

function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

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

export function TechnicianStats({ technicians }: TechnicianStatsProps) {
  // Sort by items processed (most productive first)
  const sorted = [...technicians].sort((a, b) => b.itemsProcessed - a.itemsProcessed);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Technician Performance
      </h3>

      {technicians.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No technician data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Technician</th>
                <th className="pb-3 pr-4 text-right">Processed</th>
                <th className="pb-3 pr-4 text-right">In Progress</th>
                <th className="pb-3 pr-4 text-right">Avg Time</th>
                <th className="pb-3 pr-4">Current Stage</th>
                <th className="pb-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((tech, index) => {
                const isTopPerformer = index < 3;

                return (
                  <tr
                    key={tech.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                          isTopPerformer
                            ? index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                            : 'bg-gray-300'
                        }`}>
                          {tech.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {tech.name}
                          </div>
                          {isTopPerformer && (
                            <div className="text-xs text-gray-500">
                              #{index + 1} Top Performer
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {tech.itemsProcessed}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Loader2 className="w-4 h-4 text-amber-500" />
                        <span className="text-gray-900">
                          {tech.itemsInProgress}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">
                          {formatTime(tech.averageTime)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {tech.currentStage ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {STAGE_LABELS[tech.currentStage] || tech.currentStage}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500 text-sm">
                      {formatTimestamp(tech.lastActivity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
