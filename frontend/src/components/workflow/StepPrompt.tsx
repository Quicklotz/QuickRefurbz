"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, HelpCircle, FileText, Ruler, Camera, CheckCircle } from 'lucide-react';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { Badge } from '@/components/shared/Badge';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  code: string;
  name: string;
  type: 'CHECKLIST' | 'INPUT' | 'MEASUREMENT' | 'PHOTO' | 'CONFIRMATION';
  prompt: string;
  helpText?: string;
  required: boolean;
  order: number;
  checklistItems?: string[];
  inputSchema?: any;
}

interface StepPromptProps {
  step: WorkflowStep;
  onComplete: (data: any) => void;
  loading?: boolean;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  CHECKLIST: <Check className="w-4 h-4" />,
  INPUT: <FileText className="w-4 h-4" />,
  MEASUREMENT: <Ruler className="w-4 h-4" />,
  PHOTO: <Camera className="w-4 h-4" />,
  CONFIRMATION: <CheckCircle className="w-4 h-4" />,
};

export function StepPrompt({ step, onComplete, loading }: StepPromptProps) {
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleChecklistChange = (item: string, checked: boolean) => {
    setChecklistState(prev => ({ ...prev, [item]: checked }));
  };

  const handleInputChange = (key: string, value: any) => {
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const data: any = { notes };

    if (step.type === 'CHECKLIST' && step.checklistItems) {
      data.checklistResults = checklistState;
    } else if (step.type === 'INPUT' || step.type === 'MEASUREMENT') {
      data.inputValues = inputValues;
      if (step.type === 'MEASUREMENT') {
        data.measurements = inputValues;
      }
    } else if (step.type === 'CONFIRMATION') {
      data.confirmed = confirmed;
    }

    onComplete(data);
  };

  const isComplete = () => {
    if (step.type === 'CHECKLIST' && step.checklistItems) {
      return step.checklistItems.every(item => checklistState[item] === true);
    }
    if (step.type === 'INPUT' || step.type === 'MEASUREMENT') {
      const schema = step.inputSchema;
      if (schema?.required) {
        return schema.required.every((key: string) => inputValues[key] !== undefined && inputValues[key] !== '');
      }
      return true;
    }
    if (step.type === 'CONFIRMATION') {
      return confirmed;
    }
    return true;
  };

  const renderStepContent = () => {
    switch (step.type) {
      case 'CHECKLIST':
        return (
          <div className="space-y-3">
            {step.checklistItems?.map((item, index) => (
              <motion.label
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-4 bg-dark-primary border rounded-lg cursor-pointer transition-all",
                  checklistState[item]
                    ? "border-accent-green bg-accent-green/5"
                    : "border-border hover:border-ql-yellow"
                )}
              >
                <input
                  type="checkbox"
                  checked={checklistState[item] || false}
                  onChange={(e) => handleChecklistChange(item, e.target.checked)}
                  className="sr-only"
                />
                <motion.div
                  animate={{
                    scale: checklistState[item] ? 1 : 1,
                    backgroundColor: checklistState[item] ? '#02dba8' : 'transparent',
                    borderColor: checklistState[item] ? '#02dba8' : '#27272a'
                  }}
                  className="w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0"
                >
                  <AnimatePresence>
                    {checklistState[item] && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <span className={cn(
                  "text-sm flex-1",
                  checklistState[item] ? "text-accent-green" : "text-zinc-300"
                )}>
                  {item}
                </span>
              </motion.label>
            ))}
          </div>
        );

      case 'INPUT':
      case 'MEASUREMENT':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {step.inputSchema?.properties && Object.entries(step.inputSchema.properties).map(([key, prop]: [string, any], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-2"
              >
                <Label htmlFor={key}>
                  {prop.title || key}
                  {step.inputSchema.required?.includes(key) && (
                    <span className="text-accent-red ml-1">*</span>
                  )}
                </Label>
                {prop.type === 'boolean' ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inputValues[key] || false}
                      onChange={(e) => handleInputChange(key, e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-11 h-6 rounded-full relative transition-colors",
                      inputValues[key] ? "bg-accent-green" : "bg-dark-tertiary"
                    )}>
                      <motion.div
                        animate={{ x: inputValues[key] ? 20 : 2 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full"
                      />
                    </div>
                    <span className="text-sm text-zinc-300">
                      {inputValues[key] ? 'Yes' : 'No'}
                    </span>
                  </label>
                ) : prop.enum ? (
                  <select
                    className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none transition-colors"
                    value={inputValues[key] || ''}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {prop.enum.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={key}
                    type={prop.type === 'number' ? 'number' : 'text'}
                    value={inputValues[key] || ''}
                    onChange={(e) => handleInputChange(key, prop.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    placeholder={prop.description || `Enter ${prop.title || key}`}
                  />
                )}
              </motion.div>
            ))}
          </div>
        );

      case 'CONFIRMATION':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-dark-primary rounded-lg text-center"
          >
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="sr-only"
              />
              <motion.div
                animate={{
                  scale: confirmed ? 1 : 1,
                  backgroundColor: confirmed ? '#02dba8' : 'transparent',
                  borderColor: confirmed ? '#02dba8' : '#27272a'
                }}
                className="w-6 h-6 border-2 rounded flex items-center justify-center"
              >
                <AnimatePresence>
                  {confirmed && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-white font-medium">I confirm this step is complete</span>
            </label>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <SpotlightCard className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="warning" size="sm" className="flex items-center gap-1.5">
          {STEP_ICONS[step.type]}
          {step.type}
        </Badge>
        <h3 className="text-lg font-semibold text-white">{step.name}</h3>
      </div>

      {/* Prompt */}
      <p className="text-zinc-400 mb-4">{step.prompt}</p>

      {/* Help Text */}
      {step.helpText && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-start gap-2 p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-lg mb-5 text-sm text-accent-blue"
        >
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{step.helpText}</span>
        </motion.div>
      )}

      {/* Step Content */}
      <div className="mb-5">
        {renderStepContent()}
      </div>

      {/* Notes */}
      <div className="mb-5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          className="w-full mt-2 bg-dark-tertiary border border-border rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:border-ql-yellow focus:outline-none resize-y min-h-[80px] transition-colors"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this step..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isComplete()}
          loading={loading}
        >
          {loading ? 'Saving...' : 'Complete Step'}
        </Button>
      </div>
    </SpotlightCard>
  );
}
