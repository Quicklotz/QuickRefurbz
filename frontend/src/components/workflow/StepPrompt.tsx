import { useState } from 'react';

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
          <div className="checklist-items">
            {step.checklistItems?.map((item, index) => (
              <label key={index} className="checklist-item">
                <input
                  type="checkbox"
                  checked={checklistState[item] || false}
                  onChange={(e) => handleChecklistChange(item, e.target.checked)}
                />
                <span className="checkmark" />
                <span className="item-text">{item}</span>
              </label>
            ))}
          </div>
        );

      case 'INPUT':
      case 'MEASUREMENT':
        return (
          <div className="input-fields">
            {step.inputSchema?.properties && Object.entries(step.inputSchema.properties).map(([key, prop]: [string, any]) => (
              <div key={key} className="form-group">
                <label className="form-label">
                  {prop.title || key}
                  {step.inputSchema.required?.includes(key) && <span className="required">*</span>}
                </label>
                {prop.type === 'boolean' ? (
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={inputValues[key] || false}
                      onChange={(e) => handleInputChange(key, e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    <span>{inputValues[key] ? 'Yes' : 'No'}</span>
                  </label>
                ) : prop.enum ? (
                  <select
                    className="form-select"
                    value={inputValues[key] || ''}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {prop.enum.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : prop.type === 'number' ? (
                  <input
                    type="number"
                    className="form-input"
                    value={inputValues[key] || ''}
                    onChange={(e) => handleInputChange(key, parseFloat(e.target.value) || 0)}
                    min={prop.minimum}
                    max={prop.maximum}
                  />
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={inputValues[key] || ''}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        );

      case 'CONFIRMATION':
        return (
          <div className="confirmation-section">
            <label className="confirm-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="checkmark" />
              <span>I confirm this step is complete</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="step-prompt">
      <div className="step-header">
        <span className="step-type-badge">{step.type}</span>
        <h3 className="step-name">{step.name}</h3>
      </div>

      <p className="step-prompt-text">{step.prompt}</p>

      {step.helpText && (
        <div className="step-help">
          <svg className="help-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>{step.helpText}</span>
        </div>
      )}

      <div className="step-content">
        {renderStepContent()}
      </div>

      <div className="step-notes">
        <label className="form-label">Notes (optional)</label>
        <textarea
          className="form-input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this step..."
        />
      </div>

      <div className="step-actions">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!isComplete() || loading}
        >
          {loading ? 'Saving...' : 'Complete Step'}
        </button>
      </div>

      <style>{`
        .step-prompt {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .step-type-badge {
          background: var(--ql-yellow);
          color: var(--ql-black);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .step-name {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .step-prompt-text {
          font-size: 1rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .step-help {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(67, 150, 253, 0.1);
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
          color: var(--accent-blue);
        }

        .help-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-top: 0.125rem;
        }

        .step-content {
          margin-bottom: 1.5rem;
        }

        .checklist-items {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          padding: 0.75rem 1rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          transition: all 0.15s ease;
        }

        .checklist-item:hover {
          border-color: var(--ql-yellow);
        }

        .checklist-item input {
          display: none;
        }

        .checkmark {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .checklist-item input:checked + .checkmark {
          background: var(--accent-green);
          border-color: var(--accent-green);
        }

        .checklist-item input:checked + .checkmark::after {
          content: '';
          width: 6px;
          height: 10px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .item-text {
          flex: 1;
          font-size: 0.875rem;
        }

        .input-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .toggle-label input {
          display: none;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          position: relative;
          transition: background 0.2s ease;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: transform 0.2s ease;
        }

        .toggle-label input:checked + .toggle-switch {
          background: var(--accent-green);
        }

        .toggle-label input:checked + .toggle-switch::after {
          transform: translateX(20px);
        }

        .required {
          color: var(--accent-red);
          margin-left: 0.25rem;
        }

        .confirmation-section {
          padding: 1.5rem;
          background: var(--bg-primary);
          border-radius: 0.5rem;
          text-align: center;
        }

        .confirm-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          font-size: 1rem;
        }

        .confirm-checkbox input {
          display: none;
        }

        .step-notes {
          margin-bottom: 1.5rem;
        }

        .step-notes textarea {
          resize: vertical;
          min-height: 60px;
        }

        .step-actions {
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
