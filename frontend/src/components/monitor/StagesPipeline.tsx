import { Fragment } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

interface StageData {
  stage: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

interface StagesPipelineProps {
  stages: StageData[];
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

const STAGE_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  INTAKE: { bg: 'bg-blue-50', bar: 'bg-blue-500', text: 'text-blue-700' },
  TESTING: { bg: 'bg-purple-50', bar: 'bg-purple-500', text: 'text-purple-700' },
  DIAGNOSTICS: { bg: 'bg-indigo-50', bar: 'bg-indigo-500', text: 'text-indigo-700' },
  REPAIR: { bg: 'bg-orange-50', bar: 'bg-orange-500', text: 'text-orange-700' },
  CLEANING: { bg: 'bg-cyan-50', bar: 'bg-cyan-500', text: 'text-cyan-700' },
  DATA_WIPE: { bg: 'bg-red-50', bar: 'bg-red-500', text: 'text-red-700' },
  FINAL_QC: { bg: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-700' },
  COMPLETE: { bg: 'bg-green-50', bar: 'bg-green-500', text: 'text-green-700' },
};

export function StagesPipeline({ stages }: StagesPipelineProps) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Refurbishment Pipeline
      </h3>

      {/* Pipeline visualization */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
        {stages.map((stage, index) => {
          const colors = STAGE_COLORS[stage.stage] || STAGE_COLORS.INTAKE;
          return (
            <Fragment key={stage.stage}>
              <div className={`flex-shrink-0 ${colors.bg} rounded-lg p-3 min-w-[100px]`}>
                <div className={`text-xs font-medium ${colors.text}`}>
                  {STAGE_LABELS[stage.stage] || stage.stage}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stage.count}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <TrendIcon trend={stage.trend} />
                  <span>{stage.percentage}%</span>
                </div>
              </div>
              {index < stages.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Bar chart representation */}
      <div className="space-y-3">
        {stages.map((stage) => {
          const colors = STAGE_COLORS[stage.stage] || STAGE_COLORS.INTAKE;
          const width = Math.max((stage.count / maxCount) * 100, 2);

          return (
            <div key={stage.stage} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-gray-700">
                {STAGE_LABELS[stage.stage] || stage.stage}
              </div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${width}%` }}
                >
                  {stage.count > 0 && (
                    <span className="text-xs font-medium text-white">
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 text-right text-sm text-gray-500">
                {stage.percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
