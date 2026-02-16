import { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

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

interface ThroughputChartProps {
  data: ThroughputData;
}

type TimeRange = 'hourly' | 'daily' | 'weekly';

export function ThroughputChart({ data }: ThroughputChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  const chartData = data[timeRange] || [];
  const maxValue = Math.max(
    ...chartData.flatMap(d => [d.intake, d.completed]),
    1
  );

  const totalIntake = chartData.reduce((sum, d) => sum + d.intake, 0);
  const totalCompleted = chartData.reduce((sum, d) => sum + d.completed, 0);
  const netChange = totalCompleted - totalIntake;

  const formatLabel = (timestamp: string): string => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case 'hourly':
        return date.toLocaleTimeString('en-US', { hour: 'numeric' });
      case 'daily':
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case 'weekly':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      default:
        return timestamp;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Throughput</h3>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              Intake: {totalIntake}
            </span>
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-green-500" />
              Completed: {totalCompleted}
            </span>
            <span className={`flex items-center gap-1 text-sm font-medium ${
              netChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {netChange >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {netChange >= 0 ? '+' : ''}{netChange} net
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['hourly', 'daily', 'weekly'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <BarChart3 className="w-12 h-12 mb-2" />
          <p>No throughput data available</p>
        </div>
      ) : (
        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-gray-400">
            <span>{maxValue}</span>
            <span>{Math.round(maxValue / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-10 h-full flex items-end gap-1 pb-8">
            {chartData.map((point, index) => {
              const intakeHeight = (point.intake / maxValue) * 100;
              const completedHeight = (point.completed / maxValue) * 100;

              return (
                <div
                  key={index}
                  className="flex-1 flex items-end justify-center gap-0.5 group relative"
                >
                  {/* Bars */}
                  <div
                    className="w-2 bg-blue-500 rounded-t transition-all group-hover:opacity-80"
                    style={{ height: `${intakeHeight}%` }}
                    title={`Intake: ${point.intake}`}
                  />
                  <div
                    className="w-2 bg-green-500 rounded-t transition-all group-hover:opacity-80"
                    style={{ height: `${completedHeight}%` }}
                    title={`Completed: ${point.completed}`}
                  />

                  {/* X-axis label */}
                  <span className="absolute -bottom-6 text-xs text-gray-400 whitespace-nowrap">
                    {index % Math.ceil(chartData.length / 8) === 0
                      ? formatLabel(point.timestamp)
                      : ''}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <div>Intake: {point.intake}</div>
                      <div>Completed: {point.completed}</div>
                      <div className="text-gray-400 mt-1">{formatLabel(point.timestamp)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
