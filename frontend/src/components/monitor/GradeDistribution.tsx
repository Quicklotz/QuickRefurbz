import { Award } from 'lucide-react';

interface GradeData {
  grade: string;
  count: number;
  percentage: number;
  averageValue: number;
}

interface GradeDistributionProps {
  grades: GradeData[];
}

const GRADE_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  A: { bg: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700' },
  B: { bg: 'bg-blue-500', ring: 'ring-blue-200', text: 'text-blue-700' },
  C: { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700' },
  D: { bg: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-orange-700' },
  F: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
};

export function GradeDistribution({ grades }: GradeDistributionProps) {
  const total = grades.reduce((sum, g) => sum + g.count, 0);

  // Calculate the circumference and offsets for the donut chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Grade Distribution
      </h3>

      {grades.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No grading data available</p>
        </div>
      ) : (
        <div className="flex items-center gap-8">
          {/* Donut chart */}
          <div className="relative">
            <svg width="160" height="160" className="transform -rotate-90">
              {grades.map((grade) => {
                const colors = GRADE_COLORS[grade.grade] || GRADE_COLORS.C;
                const percentage = total > 0 ? (grade.count / total) * 100 : 0;
                const strokeDasharray = (percentage / 100) * circumference;
                const strokeDashoffset = -currentOffset;
                currentOffset += strokeDasharray;

                return (
                  <circle
                    key={grade.grade}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeDasharray={`${strokeDasharray} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    className={colors.bg.replace('bg-', 'text-')}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{total}</span>
              <span className="text-sm text-gray-500">Total</span>
            </div>
          </div>

          {/* Legend and stats */}
          <div className="flex-1 space-y-3">
            {grades.map((grade) => {
              const colors = GRADE_COLORS[grade.grade] || GRADE_COLORS.C;

              return (
                <div
                  key={grade.grade}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                      <span className="text-white font-bold text-sm">
                        {grade.grade}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Grade {grade.grade}
                      </div>
                      <div className="text-xs text-gray-500">
                        {grade.count} items ({grade.percentage}%)
                      </div>
                    </div>
                  </div>
                  {grade.averageValue > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${grade.averageValue.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">avg value</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
