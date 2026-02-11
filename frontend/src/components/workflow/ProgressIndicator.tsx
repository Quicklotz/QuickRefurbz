"use client";
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  currentState: string;
  progress: {
    statesCompleted: number;
    totalStates: number;
    overallPercent: number;
  };
}

const STATE_LABELS: Record<string, string> = {
  REFURBZ_QUEUED: 'Queued',
  REFURBZ_ASSIGNED: 'Assigned',
  REFURBZ_IN_PROGRESS: 'Security Prep',
  SECURITY_PREP_COMPLETE: 'Diagnosis',
  DIAGNOSED: 'Repair',
  REPAIR_IN_PROGRESS: 'Repairing',
  REPAIR_COMPLETE: 'Final Test',
  FINAL_TEST_IN_PROGRESS: 'Testing',
  FINAL_TEST_PASSED: 'Certification',
  CERTIFIED: 'Complete',
  REFURBZ_COMPLETE: 'Done',
  REFURBZ_BLOCKED: 'Blocked',
  REFURBZ_ESCALATED: 'Escalated',
  FINAL_TEST_FAILED: 'Test Failed',
  REFURBZ_FAILED_DISPOSITION: 'Failed',
};

const MAIN_STATES = [
  'REFURBZ_QUEUED',
  'REFURBZ_ASSIGNED',
  'REFURBZ_IN_PROGRESS',
  'DIAGNOSED',
  'REPAIR_IN_PROGRESS',
  'FINAL_TEST_IN_PROGRESS',
  'CERTIFIED',
  'REFURBZ_COMPLETE',
];

export function ProgressIndicator({ currentState, progress }: ProgressIndicatorProps) {
  const currentIndex = MAIN_STATES.indexOf(currentState);
  const isEscapeState = ['REFURBZ_BLOCKED', 'REFURBZ_ESCALATED', 'FINAL_TEST_FAILED', 'REFURBZ_FAILED_DISPOSITION'].includes(currentState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card border border-border rounded-xl p-5 mb-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-ql-yellow" />
          <span className="text-sm font-semibold text-zinc-400">Progress</span>
        </div>
        <motion.span
          key={progress.overallPercent}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-xl font-bold text-ql-yellow"
        >
          {progress.overallPercent}%
        </motion.span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-dark-tertiary rounded-full overflow-hidden mb-5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress.overallPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-ql-yellow to-accent-green rounded-full"
        />
      </div>

      {/* Steps */}
      <div className="flex justify-between relative">
        {/* Connector Line */}
        <div className="absolute top-3 left-6 right-6 h-0.5 bg-border" />

        {MAIN_STATES.map((state, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = state === currentState;
          const isPending = index > currentIndex;

          return (
            <motion.div
              key={state}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center relative z-10"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 transition-all",
                  isCompleted && "bg-accent-green border-accent-green",
                  isCurrent && "bg-ql-yellow border-ql-yellow",
                  isPending && "bg-dark-tertiary border-border"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : isCurrent ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 bg-dark-primary rounded-full"
                  />
                ) : (
                  <span className="text-[10px] font-semibold text-zinc-500">{index + 1}</span>
                )}
              </motion.div>
              <span className={cn(
                "text-[10px] text-center max-w-[50px] leading-tight",
                isCompleted && "text-accent-green",
                isCurrent && "text-ql-yellow font-semibold",
                isPending && "text-zinc-500"
              )}>
                {STATE_LABELS[state]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Escape State Banner */}
      {isEscapeState && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={cn(
            "mt-4 px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm",
            currentState === 'REFURBZ_BLOCKED' && "bg-ql-yellow/15 text-ql-yellow",
            currentState === 'REFURBZ_ESCALATED' && "bg-accent-purple/15 text-accent-purple",
            (currentState === 'FINAL_TEST_FAILED' || currentState === 'REFURBZ_FAILED_DISPOSITION') && "bg-accent-red/15 text-accent-red"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          {STATE_LABELS[currentState]}
        </motion.div>
      )}
    </motion.div>
  );
}
