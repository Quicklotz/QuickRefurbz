"use client";
import { cn } from '@/lib/utils';
import { CardContainer, CardBody, CardItem } from '@/components/aceternity/3d-card';
import { Spotlight } from '@/components/aceternity/spotlight';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  color?: 'yellow' | 'blue' | 'green' | 'red' | 'purple';
  className?: string;
  use3D?: boolean;
}

const colorClasses = {
  yellow: 'text-ql-yellow',
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  red: 'text-accent-red',
  purple: 'text-accent-purple',
};

const iconBgClasses = {
  yellow: 'bg-ql-yellow/10',
  blue: 'bg-accent-blue/10',
  green: 'bg-accent-green/10',
  red: 'bg-accent-red/10',
  purple: 'bg-accent-purple/10',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'yellow',
  className,
  use3D = true,
}: StatCardProps) {
  const content = (
    <Spotlight
      className={cn(
        "bg-dark-card border border-border rounded-xl p-6 h-full",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            {Icon && (
              <div className={cn("p-1.5 rounded-lg", iconBgClasses[color])}>
                <Icon size={14} className={colorClasses[color]} />
              </div>
            )}
            <span>{label}</span>
          </div>
          <div className={cn("text-4xl font-bold tracking-tight", colorClasses[color])}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              <span
                className={cn(
                  trend.isPositive ? 'text-accent-green' : 'text-accent-red'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-zinc-500">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Spotlight>
  );

  if (!use3D) {
    return content;
  }

  return (
    <CardContainer containerClassName="py-0">
      <CardBody className="w-full">
        <CardItem translateZ={50} className="w-full">
          {content}
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}

// Grid wrapper for stat cards
export function StatsGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}
