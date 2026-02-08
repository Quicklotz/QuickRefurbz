
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
    <div className="progress-indicator">
      <div className="progress-header">
        <span className="progress-label">Progress</span>
        <span className="progress-percent">{progress.overallPercent}%</span>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress.overallPercent}%` }}
        />
      </div>

      <div className="progress-steps">
        {MAIN_STATES.map((state, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = state === currentState;
          const isPending = index > currentIndex;

          return (
            <div
              key={state}
              className={`progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="step-dot">
                {isCompleted ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="step-number">{index + 1}</span>
                )}
              </div>
              <span className="step-label">{STATE_LABELS[state]}</span>
            </div>
          );
        })}
      </div>

      {isEscapeState && (
        <div className={`escape-state-banner ${currentState.toLowerCase().replace('refurbz_', '').replace('final_test_', '')}`}>
          {STATE_LABELS[currentState]}
        </div>
      )}

      <style>{`
        .progress-indicator {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .progress-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .progress-percent {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ql-yellow);
        }

        .progress-bar-container {
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 1.25rem;
        }

        .progress-bar-fill {
          height: 100%;
          background: var(--ql-yellow);
          border-radius: 9999px;
          transition: width 0.3s ease;
        }

        .progress-steps {
          display: flex;
          justify-content: space-between;
          position: relative;
        }

        .progress-steps::before {
          content: '';
          position: absolute;
          top: 12px;
          left: 20px;
          right: 20px;
          height: 2px;
          background: var(--border-color);
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .step-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }

        .step-number {
          font-size: 0.625rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .check-icon {
          width: 14px;
          height: 14px;
        }

        .step-label {
          font-size: 0.625rem;
          color: var(--text-muted);
          text-align: center;
          max-width: 60px;
        }

        .progress-step.completed .step-dot {
          background: var(--accent-green);
          border-color: var(--accent-green);
          color: white;
        }

        .progress-step.completed .step-label {
          color: var(--accent-green);
        }

        .progress-step.current .step-dot {
          background: var(--ql-yellow);
          border-color: var(--ql-yellow);
          color: var(--ql-black);
        }

        .progress-step.current .step-label {
          color: var(--ql-yellow);
          font-weight: 600;
        }

        .escape-state-banner {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          text-align: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .escape-state-banner.blocked {
          background: rgba(241, 196, 15, 0.15);
          color: var(--ql-yellow);
        }

        .escape-state-banner.escalated {
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
        }

        .escape-state-banner.failed {
          background: rgba(235, 61, 59, 0.15);
          color: var(--accent-red);
        }

        @media (max-width: 768px) {
          .progress-steps {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .progress-steps::before {
            display: none;
          }

          .progress-step {
            flex: 0 0 calc(25% - 0.5rem);
          }
        }
      `}</style>
    </div>
  );
}
