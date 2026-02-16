"use client";
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Award,
  ChevronRight,
  Ban,
  RotateCcw,
  Printer,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import { api } from '@/api/client';
import { ProgressIndicator } from '@/components/workflow/ProgressIndicator';
import { StepPrompt } from '@/components/workflow/StepPrompt';
import { RefurbLabelModal } from '@/components/workflow/RefurbLabelModal';
import { SpotlightCard, Spotlight } from '@/components/aceternity/spotlight';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Button } from '@/components/aceternity/button';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { PriorityBadge } from '@/components/shared/Badge';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  qlid: string;
  palletId: string;
  category: string;
  manufacturer?: string;
  model?: string;
  currentState: string;
  currentStepIndex: number;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  attemptCount: number;
  maxAttempts: number;
  priority: string;
  finalGrade?: string;
  warrantyEligible?: boolean;
}

interface Prompt {
  job: Job;
  state: string;
  stateName: string;
  totalSteps: number;
  currentStepIndex: number;
  currentStep?: any;
  completedSteps: any[];
  progress: {
    statesCompleted: number;
    totalStates: number;
    overallPercent: number;
  };
  canAdvance: boolean;
  canBlock: boolean;
  canEscalate: boolean;
  canRetry: boolean;
}

export function WorkflowStation() {
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [certifyData, setCertifyData] = useState({ finalGrade: 'B', warrantyEligible: true, notes: '' });
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [refurbPhotos, setRefurbPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showRefurbLabelModal, setShowRefurbLabelModal] = useState(false);

  const loadPrompt = useCallback(async (qlid: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJobPrompt(qlid);
      setPrompt(data);
    } catch (err: any) {
      setError(err.message);
      setPrompt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      try {
        await loadPrompt(scanInput.trim());
        setScanInput('');
        return;
      } catch {
        // Job doesn't exist, try to create it
      }

      await api.createJob({ qlid: scanInput.trim() });
      await loadPrompt(scanInput.trim());
      setScanInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async (data: any) => {
    if (!prompt?.currentStep) return;

    setActionLoading(true);
    try {
      await api.completeStep(prompt.job.qlid, prompt.currentStep.code, data);
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'ADVANCE');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!prompt || !blockReason.trim()) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'BLOCK', { reason: blockReason });
      setShowBlockModal(false);
      setBlockReason('');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'RESOLVE');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      await api.transitionJob(prompt.job.qlid, 'RETRY');
      await loadPrompt(prompt.job.qlid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setRefurbPhotos(prev => [...prev, ...files]);
    const urls = files.map(f => URL.createObjectURL(f));
    setPhotoPreviewUrls(prev => [...prev, ...urls]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setRefurbPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleCertify = async () => {
    if (!prompt) return;

    setActionLoading(true);
    try {
      // Upload photos first if any
      if (refurbPhotos.length > 0) {
        setUploadingPhotos(true);
        await api.uploadRefurbPhotos(prompt.job.qlid, refurbPhotos);
        setUploadingPhotos(false);
      }

      await api.certifyJob(prompt.job.qlid, {
        finalGrade: certifyData.finalGrade,
        warrantyEligible: certifyData.warrantyEligible,
        notes: certifyData.notes
      });

      // Clean up photo previews
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setRefurbPhotos([]);
      setPhotoPreviewUrls([]);

      setShowCertifyModal(false);
      await loadPrompt(prompt.job.qlid);
      // Show the refurb label modal after certification completes
      setShowRefurbLabelModal(true);
    } catch (err: any) {
      setError(err.message);
      setUploadingPhotos(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt(null);
    setError(null);
    setScanInput('');
  };

  const renderJobHeader = () => {
    if (!prompt) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SpotlightCard className="p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-ql-yellow">
                  {prompt.job.qlid}
                </span>
                <PriorityBadge priority={prompt.job.priority.toLowerCase() as 'urgent' | 'high' | 'normal' | 'low'} />
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-zinc-400">
              <div>
                <span className="text-zinc-500">Category:</span>{' '}
                <span className="text-white font-medium">{prompt.job.category}</span>
              </div>
              <div>
                <span className="text-zinc-500">State:</span>{' '}
                <span className="text-ql-yellow font-medium">{prompt.stateName}</span>
              </div>
              <div>
                <span className="text-zinc-500">Attempt:</span>{' '}
                <span className="text-white font-medium">{prompt.job.attemptCount + 1} / {prompt.job.maxAttempts + 1}</span>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={handleClear}>
              <X size={16} />
              Close Job
            </Button>
          </div>
        </SpotlightCard>
      </motion.div>
    );
  };

  const renderCurrentPrompt = () => {
    if (!prompt) return null;

    // Completed state
    if (prompt.job.currentState === 'REFURBZ_COMPLETE') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <SpotlightCard className="p-8 text-center border-accent-green">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-green/20 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-accent-green" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Refurbishment Complete!</h2>
            <p className="text-zinc-400 mb-4">This item has been certified and is ready for the next stage.</p>
            {prompt.job.finalGrade && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-green/10 rounded-lg mb-4">
                <Award className="w-5 h-5 text-accent-green" />
                <span className="text-lg font-bold text-accent-green">Grade {prompt.job.finalGrade}</span>
              </div>
            )}
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => setShowRefurbLabelModal(true)}
                className="bg-accent-green hover:bg-accent-green/90"
              >
                <Printer size={16} />
                Print RFB Label
              </Button>
            </div>
          </SpotlightCard>
        </motion.div>
      );
    }

    // Blocked state
    if (prompt.job.currentState === 'REFURBZ_BLOCKED') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <SpotlightCard className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-ql-yellow/20 flex items-center justify-center"
            >
              <AlertTriangle className="w-10 h-10 text-ql-yellow" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Job Blocked</h2>
            <p className="text-zinc-400 mb-6">This job has been blocked and requires resolution.</p>
            <Button variant="primary" onClick={handleResolve} loading={actionLoading}>
              <RefreshCw size={16} />
              Resolve & Continue
            </Button>
          </SpotlightCard>
        </motion.div>
      );
    }

    // Failed state
    if (prompt.job.currentState === 'FINAL_TEST_FAILED') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <SpotlightCard className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-red/20 flex items-center justify-center"
            >
              <XCircle className="w-10 h-10 text-accent-red" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Final Test Failed</h2>
            <p className="text-zinc-400 mb-6">
              Attempt {prompt.job.attemptCount} of {prompt.job.maxAttempts} failed.
              {prompt.job.attemptCount < prompt.job.maxAttempts ? ' You can retry the repair process.' : ' Maximum attempts reached.'}
            </p>
            {prompt.canRetry && (
              <Button variant="primary" onClick={handleRetry} loading={actionLoading}>
                <RotateCcw size={16} />
                Retry Repair
              </Button>
            )}
          </SpotlightCard>
        </motion.div>
      );
    }

    // Ready for certification
    if (prompt.job.currentState === 'FINAL_TEST_PASSED') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <SpotlightCard className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-green/20 flex items-center justify-center"
            >
              <Award className="w-10 h-10 text-accent-green" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready for Certification</h2>
            <p className="text-zinc-400 mb-6">All tests passed! Certify this item with a final grade.</p>
            <Button variant="primary" onClick={() => setShowCertifyModal(true)}>
              <Award size={16} />
              Certify Item
            </Button>
          </SpotlightCard>
        </motion.div>
      );
    }

    // Current step
    if (prompt.currentStep) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-zinc-400 mb-3">
            Step {prompt.currentStepIndex + 1} of {prompt.totalSteps}
          </div>
          <StepPrompt
            step={prompt.currentStep}
            onComplete={handleStepComplete}
            loading={actionLoading}
          />
        </motion.div>
      );
    }

    // All steps complete, ready to advance
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <SpotlightCard className="p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-ql-yellow/20 flex items-center justify-center"
          >
            <CheckCircle className="w-8 h-8 text-ql-yellow" />
          </motion.div>
          <h3 className="text-xl font-bold text-white mb-2">All steps complete!</h3>
          <p className="text-zinc-400 mb-6">Ready to advance to the next stage.</p>
          <Button variant="primary" onClick={handleAdvance} loading={actionLoading}>
            Advance to Next Stage
            <ChevronRight size={16} />
          </Button>
        </SpotlightCard>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Workflow Station</h1>
        <p className="text-zinc-400 text-sm mt-1">Scan an item to begin refurbishment</p>
      </div>

      {/* Scan Input */}
      <AnimatePresence>
        {!prompt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Spotlight
              className="bg-dark-card border border-border rounded-xl p-8"
              spotlightColor="rgba(241, 196, 15, 0.15)"
            >
              <form onSubmit={handleScan} className="max-w-xl mx-auto">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Scan or enter QLID (e.g., P1BBY-QLID000000001)"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className="text-center font-mono text-lg"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" variant="primary" loading={loading}>
                    <Scan size={18} />
                    Load Job
                  </Button>
                </div>
              </form>
            </Spotlight>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-accent-red">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-accent-red hover:text-white transition-colors">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Content */}
      <AnimatePresence mode="wait">
        {prompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderJobHeader()}
            <ProgressIndicator
              currentState={prompt.job.currentState}
              progress={prompt.progress}
            />
            {renderCurrentPrompt()}

            {/* Escape Actions */}
            {prompt.canBlock && !['REFURBZ_BLOCKED', 'REFURBZ_COMPLETE', 'FINAL_TEST_PASSED'].includes(prompt.job.currentState) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 pt-6 border-t border-border flex justify-end"
              >
                <Button variant="secondary" onClick={() => setShowBlockModal(true)}>
                  <Ban size={16} />
                  Block Job
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block Modal */}
      <AnimatedModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title="Block Job"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="blockReason">Reason for blocking</Label>
            <textarea
              id="blockReason"
              className="w-full mt-2 bg-dark-tertiary border border-border rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:border-ql-yellow focus:outline-none resize-y min-h-[100px]"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Describe why this job needs to be blocked..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowBlockModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBlock}
              disabled={!blockReason.trim()}
              loading={actionLoading}
            >
              Block Job
            </Button>
          </div>
        </div>
      </AnimatedModal>

      {/* Certify Modal */}
      <AnimatedModal
        isOpen={showCertifyModal}
        onClose={() => setShowCertifyModal(false)}
        title="Certify Item"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="finalGrade">Final Grade</Label>
            <select
              id="finalGrade"
              className="w-full mt-2 bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
              value={certifyData.finalGrade}
              onChange={(e) => setCertifyData(prev => ({ ...prev, finalGrade: e.target.value }))}
            >
              <option value="A">Grade A - Like New</option>
              <option value="B">Grade B - Minor Wear</option>
              <option value="C">Grade C - Visible Wear</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={certifyData.warrantyEligible}
                onChange={(e) => setCertifyData(prev => ({ ...prev, warrantyEligible: e.target.checked }))}
                className="sr-only"
              />
              <div className={cn(
                "w-11 h-6 rounded-full relative transition-colors",
                certifyData.warrantyEligible ? "bg-accent-green" : "bg-dark-tertiary"
              )}>
                <motion.div
                  animate={{ x: certifyData.warrantyEligible ? 20 : 2 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                />
              </div>
              <span className="text-white">Warranty Eligible</span>
            </label>
          </div>

          <div>
            <Label htmlFor="certNotes">Certification Notes</Label>
            <textarea
              id="certNotes"
              className="w-full mt-2 bg-dark-tertiary border border-border rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:border-ql-yellow focus:outline-none resize-y min-h-[80px]"
              value={certifyData.notes}
              onChange={(e) => setCertifyData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes about certification..."
            />
          </div>

          {/* Refurb Photos */}
          <div>
            <Label className="mb-2 block">Refurbished Product Photos</Label>
            <p className="text-xs text-zinc-500 mb-3">Take photos of the completed refurbishment (front, back, any notable details)</p>

            {/* Photo grid */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-ql-yellow/50 cursor-pointer transition-colors bg-dark-tertiary/50">
              <Camera size={18} className="text-zinc-400" />
              <span className="text-sm text-zinc-400">
                {photoPreviewUrls.length > 0 ? 'Add more photos' : 'Take or upload photos'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handlePhotoSelect}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCertifyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCertify} loading={actionLoading || uploadingPhotos}>
              {uploadingPhotos ? (
                <>
                  <Upload size={16} />
                  Uploading photos...
                </>
              ) : (
                <>
                  <Award size={16} />
                  Certify Item{refurbPhotos.length > 0 ? ` (${refurbPhotos.length} photos)` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </AnimatedModal>

      {/* Refurb Label Modal (shows on completion) */}
      <RefurbLabelModal
        isOpen={showRefurbLabelModal}
        onClose={() => setShowRefurbLabelModal(false)}
        qlid={prompt?.job?.qlid || null}
        manufacturer={prompt?.job?.manufacturer}
        model={prompt?.job?.model}
        finalGrade={prompt?.job?.finalGrade}
        warrantyEligible={prompt?.job?.warrantyEligible}
      />
    </div>
  );
}
