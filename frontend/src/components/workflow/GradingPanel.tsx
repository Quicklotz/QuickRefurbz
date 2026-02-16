"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck,
  CheckCircle,
  AlertCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/aceternity/button';
import { Badge } from '@/components/shared/Badge';

type GradeLevel = 'A' | 'B' | 'C' | 'D' | 'F';

interface GradingCriterion {
  code: string;
  name: string;
  description: string;
  type: 'cosmetic' | 'functional';
  weight: number;
  options: Array<{
    value: number;
    label: string;
    description?: string;
  }>;
}

interface GradingRubric {
  id: string;
  category: string;
  criteria: GradingCriterion[];
  gradeThresholds: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
}

interface GradingAssessment {
  id: string;
  qlid: string;
  category: string;
  cosmeticScore: number;
  functionalScore: number;
  overallScore: number;
  calculatedGrade: string;
  finalGrade: string;
  criteriaResults: Record<string, { score: number; notes?: string }>;
  assessedBy: string;
  assessedAt: string;
}

interface GradingPanelProps {
  qlid: string;
  category: string;
  onGradeSubmitted?: (assessment: GradingAssessment) => void;
  readOnly?: boolean;
}

const GRADE_COLORS: Record<GradeLevel, string> = {
  A: 'bg-accent-green text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-yellow-500 text-black',
  D: 'bg-orange-500 text-white',
  F: 'bg-accent-red text-white'
};

const GRADE_DESCRIPTIONS: Record<GradeLevel, string> = {
  A: 'Like new, no defects, full warranty eligible',
  B: 'Minor cosmetic wear, fully functional',
  C: 'Visible wear, fully functional',
  D: 'Significant wear, functional with notes',
  F: 'Parts only / not sellable'
};

export function GradingPanel({
  qlid,
  category,
  onGradeSubmitted,
  readOnly = false
}: GradingPanelProps) {
  const [rubric, setRubric] = useState<GradingRubric | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingAssessment, setExistingAssessment] = useState<GradingAssessment | null>(null);

  // Criteria responses
  const [responses, setResponses] = useState<Record<string, { score: number; notes?: string }>>({});
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [gradeOverride, setGradeOverride] = useState<GradeLevel | null>(null);

  // Calculated scores
  const [previewScore, setPreviewScore] = useState<{
    cosmetic: number;
    functional: number;
    overall: number;
    grade: GradeLevel;
  } | null>(null);

  // Load rubric and existing assessment
  useEffect(() => {
    loadData();
  }, [qlid, category]);

  // Calculate preview score when responses change
  useEffect(() => {
    if (!rubric) return;
    calculatePreviewScore();
  }, [responses, rubric]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load rubric and existing assessment in parallel
      const [rubricData, assessmentData] = await Promise.all([
        api.getGradingRubric(category),
        api.getGradingAssessment(qlid).catch(() => null)
      ]);

      setRubric(rubricData);

      if (assessmentData) {
        setExistingAssessment(assessmentData);
        setResponses(assessmentData.criteriaResults);
        setGradeOverride(
          assessmentData.finalGrade !== assessmentData.calculatedGrade
            ? assessmentData.finalGrade as GradeLevel
            : null
        );
      } else {
        // Initialize responses with empty values
        const initialResponses: Record<string, { score: number; notes?: string }> = {};
        rubricData.criteria.forEach(c => {
          initialResponses[c.code] = { score: -1 }; // -1 means not answered
        });
        setResponses(initialResponses);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load grading data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePreviewScore = () => {
    if (!rubric) return;

    let cosmeticTotal = 0;
    let cosmeticWeight = 0;
    let functionalTotal = 0;
    let functionalWeight = 0;

    for (const criterion of rubric.criteria) {
      const response = responses[criterion.code];
      if (response && response.score >= 0) {
        if (criterion.type === 'cosmetic') {
          cosmeticTotal += response.score * criterion.weight;
          cosmeticWeight += criterion.weight;
        } else {
          functionalTotal += response.score * criterion.weight;
          functionalWeight += criterion.weight;
        }
      }
    }

    const cosmetic = cosmeticWeight > 0 ? Math.round(cosmeticTotal / cosmeticWeight) : 0;
    const functional = functionalWeight > 0 ? Math.round(functionalTotal / functionalWeight) : 0;
    const overall = Math.round(cosmetic * 0.4 + functional * 0.6);

    let grade: GradeLevel = 'F';
    if (overall >= rubric.gradeThresholds.A) grade = 'A';
    else if (overall >= rubric.gradeThresholds.B) grade = 'B';
    else if (overall >= rubric.gradeThresholds.C) grade = 'C';
    else if (overall >= rubric.gradeThresholds.D) grade = 'D';

    setPreviewScore({ cosmetic, functional, overall, grade });
  };

  const handleScoreSelect = (criterionCode: string, score: number) => {
    setResponses(prev => ({
      ...prev,
      [criterionCode]: { ...prev[criterionCode], score }
    }));
  };

  const handleNotesChange = (criterionCode: string, notes: string) => {
    setResponses(prev => ({
      ...prev,
      [criterionCode]: { ...prev[criterionCode], notes }
    }));
  };

  const toggleCriterion = (code: string) => {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const isComplete = () => {
    if (!rubric) return false;
    return rubric.criteria.every(c => responses[c.code]?.score >= 0);
  };

  const submitAssessment = async () => {
    if (!isComplete()) {
      setError('Please complete all grading criteria before submitting');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const assessment = await api.createGradingAssessment({
        qlid,
        category,
        criteriaResults: responses,
        gradeOverride: gradeOverride || undefined
      });

      setExistingAssessment(assessment);
      onGradeSubmitted?.(assessment);
    } catch (err: any) {
      setError(err.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAssessment = () => {
    setExistingAssessment(null);
    setGradeOverride(null);
    if (rubric) {
      const initialResponses: Record<string, { score: number; notes?: string }> = {};
      rubric.criteria.forEach(c => {
        initialResponses[c.code] = { score: -1 };
      });
      setResponses(initialResponses);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-ql-yellow" />
      </div>
    );
  }

  if (!rubric) {
    return (
      <div className="bg-accent-red/10 border border-accent-red rounded-lg p-4">
        <p className="text-accent-red">No grading rubric available for {category}</p>
      </div>
    );
  }

  // Show completed assessment
  if (existingAssessment && readOnly) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Award size={18} className="text-ql-yellow" />
            Grading Assessment
          </h3>
          <div className={`px-4 py-2 rounded-lg text-lg font-bold ${GRADE_COLORS[existingAssessment.finalGrade as GradeLevel]}`}>
            Grade {existingAssessment.finalGrade}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-dark-tertiary rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Cosmetic</p>
            <p className="text-xl font-bold text-white">{existingAssessment.cosmeticScore}%</p>
          </div>
          <div className="bg-dark-tertiary rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Functional</p>
            <p className="text-xl font-bold text-white">{existingAssessment.functionalScore}%</p>
          </div>
          <div className="bg-dark-tertiary rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Overall</p>
            <p className="text-xl font-bold text-ql-yellow">{existingAssessment.overallScore}%</p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Assessed by {existingAssessment.assessedBy} on{' '}
          {new Date(existingAssessment.assessedAt).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <ClipboardCheck size={18} className="text-ql-yellow" />
          Grade Item ({category})
        </h3>
        {existingAssessment && (
          <Button variant="ghost" size="sm" onClick={resetAssessment}>
            <RotateCcw size={14} />
            Re-grade
          </Button>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-accent-red text-sm bg-accent-red/10 p-2 rounded"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score Preview */}
      {previewScore && (
        <div className="bg-dark-primary border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">Preview Grade</span>
            <div className={`px-3 py-1 rounded text-sm font-bold ${GRADE_COLORS[gradeOverride || previewScore.grade]}`}>
              Grade {gradeOverride || previewScore.grade}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-xs text-zinc-500">Cosmetic (40%)</p>
              <p className="text-lg font-semibold text-white">{previewScore.cosmetic}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Functional (60%)</p>
              <p className="text-lg font-semibold text-white">{previewScore.functional}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overall</p>
              <p className="text-lg font-semibold text-ql-yellow">{previewScore.overall}%</p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 italic">
            {GRADE_DESCRIPTIONS[gradeOverride || previewScore.grade]}
          </p>
        </div>
      )}

      {/* Criteria List */}
      <div className="space-y-2">
        {rubric.criteria.map((criterion, index) => {
          const isExpanded = expandedCriteria.has(criterion.code);
          const response = responses[criterion.code];
          const isAnswered = response?.score >= 0;
          const selectedOption = criterion.options.find(o => o.value === response?.score);

          return (
            <motion.div
              key={criterion.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-dark-tertiary border rounded-lg overflow-hidden ${
                isAnswered ? 'border-accent-green/30' : 'border-border'
              }`}
            >
              {/* Criterion Header */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => toggleCriterion(criterion.code)}
              >
                <div className="flex items-center gap-3">
                  {isAnswered ? (
                    <CheckCircle size={16} className="text-accent-green" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-600" />
                  )}
                  <div>
                    <p className="text-white font-medium">{criterion.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant={criterion.type === 'cosmetic' ? 'default' : 'info'}
                        size="sm"
                      >
                        {criterion.type}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        Weight: {criterion.weight}
                      </span>
                      {selectedOption && (
                        <span className="text-xs text-accent-green">
                          {selectedOption.label} ({selectedOption.value}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp size={18} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-400" />
                )}
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-border">
                      <p className="text-sm text-zinc-400 mb-3 flex items-start gap-2">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        {criterion.description}
                      </p>

                      {/* Options */}
                      <div className="space-y-2">
                        {criterion.options.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleScoreSelect(criterion.code, option.value)}
                            disabled={readOnly}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                              response?.score === option.value
                                ? 'border-ql-yellow bg-ql-yellow/10'
                                : 'border-border hover:border-zinc-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white">{option.label}</span>
                              <span className={`text-sm ${
                                option.value >= 80 ? 'text-accent-green' :
                                option.value >= 50 ? 'text-yellow-500' :
                                'text-accent-red'
                              }`}>
                                {option.value}%
                              </span>
                            </div>
                            {option.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {option.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Notes */}
                      <div className="mt-3">
                        <label className="text-xs text-zinc-500 mb-1 block">Notes (optional)</label>
                        <input
                          type="text"
                          placeholder="Add notes..."
                          value={response?.notes || ''}
                          onChange={(e) => handleNotesChange(criterion.code, e.target.value)}
                          disabled={readOnly}
                          className="w-full bg-dark-primary border border-border rounded px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Grade Override */}
      {previewScore && (
        <div className="bg-dark-primary border border-border rounded-lg p-4">
          <label className="text-sm text-zinc-400 mb-2 block">
            Override Grade (optional)
          </label>
          <div className="flex gap-2">
            {(['A', 'B', 'C', 'D', 'F'] as GradeLevel[]).map(grade => (
              <button
                key={grade}
                onClick={() => setGradeOverride(gradeOverride === grade ? null : grade)}
                disabled={readOnly}
                className={`flex-1 py-2 rounded font-bold transition-colors ${
                  gradeOverride === grade
                    ? GRADE_COLORS[grade]
                    : 'bg-dark-tertiary text-zinc-400 hover:text-white'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>
          {gradeOverride && (
            <p className="text-xs text-zinc-500 mt-2">
              Overriding calculated grade ({previewScore.grade}) with {gradeOverride}
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      {!readOnly && (
        <Button
          variant="primary"
          className="w-full"
          onClick={submitAssessment}
          loading={submitting}
          disabled={!isComplete()}
        >
          <Award size={16} />
          {existingAssessment ? 'Update Grade' : 'Submit Grade'}
        </Button>
      )}

      {/* Progress indicator */}
      {!readOnly && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="flex-1 bg-dark-tertiary rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-ql-yellow transition-all"
              style={{
                width: `${(Object.values(responses).filter(r => r.score >= 0).length / rubric.criteria.length) * 100}%`
              }}
            />
          </div>
          <span>
            {Object.values(responses).filter(r => r.score >= 0).length} / {rubric.criteria.length} complete
          </span>
        </div>
      )}
    </div>
  );
}

export default GradingPanel;
