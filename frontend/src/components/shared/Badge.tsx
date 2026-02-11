"use client";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'intake'
  | 'testing'
  | 'repair'
  | 'cleaning'
  | 'final_qc'
  | 'complete';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-dark-tertiary text-zinc-400',
  primary: 'bg-ql-yellow/15 text-ql-yellow',
  secondary: 'bg-dark-tertiary text-zinc-300',
  success: 'bg-accent-green/15 text-accent-green',
  warning: 'bg-amber-500/15 text-amber-500',
  danger: 'bg-accent-red/15 text-accent-red',
  info: 'bg-accent-blue/15 text-accent-blue',
  purple: 'bg-accent-purple/15 text-accent-purple',
  intake: 'bg-accent-blue/15 text-accent-blue',
  testing: 'bg-ql-yellow/15 text-ql-yellow',
  repair: 'bg-accent-red/15 text-accent-red',
  cleaning: 'bg-accent-purple/15 text-accent-purple',
  final_qc: 'bg-accent-green/15 text-accent-green',
  complete: 'bg-accent-green text-black',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  animated = false,
}: BadgeProps) {
  const Component = animated ? motion.span : 'span';
  const animationProps = animated
    ? {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        whileHover: { scale: 1.05 },
      }
    : {};

  return (
    <Component
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-wide',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...animationProps}
    >
      {children}
    </Component>
  );
}

// Priority badge with specific styling
export function PriorityBadge({
  priority,
  className,
}: {
  priority: 'urgent' | 'high' | 'normal' | 'low';
  className?: string;
}) {
  const priorityVariants: Record<string, BadgeVariant> = {
    urgent: 'danger',
    high: 'warning',
    normal: 'default',
    low: 'secondary',
  };

  return (
    <Badge variant={priorityVariants[priority]} size="sm" className={className}>
      {priority}
    </Badge>
  );
}

// Stage badge for workflow stages
export function StageBadge({
  stage,
  className,
}: {
  stage: string;
  className?: string;
}) {
  const stageVariants: Record<string, BadgeVariant> = {
    intake: 'intake',
    testing: 'testing',
    repair: 'repair',
    cleaning: 'cleaning',
    final_qc: 'final_qc',
    complete: 'complete',
  };

  const variant = stageVariants[stage] || 'default';
  const label = stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  );
}
