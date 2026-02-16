import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconArrowRight, IconArrowLeft } from '@tabler/icons-react';

export interface WalkthroughStep {
  target: string;  // CSS selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface WalkthroughConfig {
  id: string;
  steps: WalkthroughStep[];
}

// Pre-built walkthroughs for each page
export const WALKTHROUGHS: Record<string, WalkthroughConfig> = {
  intake: {
    id: 'intake',
    steps: [
      { target: '[data-tour="pallet-select"]', title: 'Select a Pallet', content: 'Start by choosing which pallet you are processing items from.', position: 'bottom' },
      { target: '[data-tour="scan-input"]', title: 'Scan or Enter Barcode', content: 'Use your barcode scanner to scan the item, or type the UPC manually.', position: 'bottom' },
      { target: '[data-tour="item-form"]', title: 'Fill in Details', content: 'Add the manufacturer, model, category, and condition notes.', position: 'left' },
      { target: '[data-tour="save-btn"]', title: 'Save and Print', content: 'Click Save to add the item and print its label.', position: 'top' },
    ],
  },
  scan: {
    id: 'scan',
    steps: [
      { target: '[data-tour="scan-field"]', title: 'Scan Any Item', content: 'Scan a barcode label to instantly look up any item in the system.', position: 'bottom' },
      { target: '[data-tour="scan-result"]', title: 'Item Details', content: 'View the item\'s current stage, grade, history, and all details here.', position: 'top' },
    ],
  },
  workflow: {
    id: 'workflow',
    steps: [
      { target: '[data-tour="job-list"]', title: 'Job Queue', content: 'Items assigned to your station appear here. Click one to start working.', position: 'right' },
      { target: '[data-tour="step-prompt"]', title: 'Step-by-Step Guide', content: 'Follow each step of the workflow. Complete checklists and enter measurements.', position: 'left' },
      { target: '[data-tour="advance-btn"]', title: 'Advance to Next Step', content: 'When done with all steps, advance the item to the next workflow state.', position: 'top' },
    ],
  },
  diagnostics: {
    id: 'diagnostics',
    steps: [
      { target: '[data-tour="diag-scan"]', title: 'Scan Item', content: 'Scan the item barcode to start a diagnostic session.', position: 'bottom' },
      { target: '[data-tour="diag-tests"]', title: 'Run Tests', content: 'Work through each test in the list. Mark pass, fail, or skip.', position: 'left' },
      { target: '[data-tour="diag-submit"]', title: 'Submit Results', content: 'When all tests are done, submit the session. Failed tests create repair tickets automatically.', position: 'top' },
    ],
  },
  datawipe: {
    id: 'datawipe',
    steps: [
      { target: '[data-tour="wipe-scan"]', title: 'Scan Device', content: 'Scan the device to start a data wipe session.', position: 'bottom' },
      { target: '[data-tour="wipe-method"]', title: 'Select Method', content: 'Choose the wipe method (factory reset, NIST 800-88, etc.) based on the device type.', position: 'bottom' },
      { target: '[data-tour="wipe-verify"]', title: 'Verify Wipe', content: 'After the wipe completes, verify the device is clean and generate the certificate.', position: 'top' },
    ],
  },
};

interface WalkthroughProps {
  walkthroughId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function Walkthrough({ walkthroughId, onComplete, onSkip }: WalkthroughProps) {
  const config = WALKTHROUGHS[walkthroughId];
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = config?.steps[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setSpotlightRect(null);
    }
  }, [step]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  if (!config || !step) return null;

  const isLast = currentStep === config.steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(`walkthrough_${walkthroughId}`, 'done');
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`walkthrough_${walkthroughId}`, 'done');
    onSkip();
  };

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {};
  if (spotlightRect) {
    const padding = 16;
    const pos = step.position || 'bottom';
    if (pos === 'bottom') {
      tooltipStyle.top = spotlightRect.bottom + padding;
      tooltipStyle.left = spotlightRect.left + spotlightRect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (pos === 'top') {
      tooltipStyle.bottom = window.innerHeight - spotlightRect.top + padding;
      tooltipStyle.left = spotlightRect.left + spotlightRect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (pos === 'left') {
      tooltipStyle.top = spotlightRect.top + spotlightRect.height / 2;
      tooltipStyle.right = window.innerWidth - spotlightRect.left + padding;
      tooltipStyle.transform = 'translateY(-50%)';
    } else if (pos === 'right') {
      tooltipStyle.top = spotlightRect.top + spotlightRect.height / 2;
      tooltipStyle.left = spotlightRect.right + padding;
      tooltipStyle.transform = 'translateY(-50%)';
    }
  } else {
    // Center fallback
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Dark overlay with cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <rect
                  x={spotlightRect.left - 8}
                  y={spotlightRect.top - 8}
                  width={spotlightRect.width + 16}
                  height={spotlightRect.height + 16}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute z-[101] w-72 bg-dark-secondary border border-border rounded-xl shadow-2xl p-4"
          style={tooltipStyle}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white text-sm">{step.title}</h3>
            <button
              onClick={handleSkip}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <IconX size={14} />
            </button>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed mb-4">{step.content}</p>

          <div className="flex items-center justify-between">
            <span className="text-zinc-600 text-xs">
              {currentStep + 1} / {config.steps.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white transition-colors"
                >
                  <IconArrowLeft size={14} />
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3 py-1.5 bg-ql-yellow text-dark-primary font-semibold text-xs rounded-md hover:bg-ql-yellow-hover transition-colors"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <IconArrowRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to check if a walkthrough should auto-show
export function useWalkthrough(pageId: string) {
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    const key = `walkthrough_${pageId}`;
    if (!localStorage.getItem(key) && WALKTHROUGHS[pageId]) {
      // Auto-show on first visit after a brief delay
      const timer = setTimeout(() => setShowWalkthrough(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [pageId]);

  return {
    showWalkthrough,
    startWalkthrough: () => setShowWalkthrough(true),
    dismissWalkthrough: () => setShowWalkthrough(false),
  };
}
