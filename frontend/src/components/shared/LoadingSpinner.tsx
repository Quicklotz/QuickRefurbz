"use client";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={cn(
          "border-2 border-ql-yellow/30 border-t-ql-yellow rounded-full",
          sizeClasses[size]
        )}
      />
      {text && <span className="text-sm text-zinc-400">{text}</span>}
    </div>
  );
}

// Full page loading overlay
export function LoadingOverlay({
  visible,
  text = 'Loading...',
}: {
  visible: boolean;
  text?: string;
}) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-primary/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" />
        <span className="text-zinc-300 font-medium">{text}</span>
      </div>
    </motion.div>
  );
}

// Skeleton loader for cards
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-dark-card border border-border rounded-xl p-6 animate-pulse",
        className
      )}
    >
      <div className="h-4 bg-dark-tertiary rounded w-1/3 mb-4" />
      <div className="h-8 bg-dark-tertiary rounded w-1/2 mb-2" />
      <div className="h-3 bg-dark-tertiary rounded w-1/4" />
    </div>
  );
}

// Skeleton loader for table rows
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full">
        <thead>
          <tr className="bg-dark-secondary border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 bg-dark-tertiary rounded w-20 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-dark-card divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div
                    className="h-4 bg-dark-tertiary rounded animate-pulse"
                    style={{
                      width: `${Math.random() * 40 + 40}%`,
                      animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
