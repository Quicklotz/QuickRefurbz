"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Play,
  CheckCircle,
  XCircle,
  SkipForward,
  Clock,
  ChevronRight,
  AlertTriangle,
  Search,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import { api, TechnicianStats } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface DiagnosticTest {
  code: string;
  name: string;
  category: string;
  testType: string;
  description: string;
  instructions: string;
  passCriteria: string;
  isCritical: boolean;
  measurementUnit?: string;
  measurementMin?: number;
  measurementMax?: number;
}

interface DiagnosticSession {
  id: string;
  sessionNumber: string;
  qlid: string;
  category: string;
  technicianId: string;
  technicianName: string;
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  overallResult?: string;
}

interface TestResult {
  testCode: string;
  result: 'PASS' | 'FAIL' | 'SKIP' | 'N/A';
  measurementValue?: number;
  measurementUnit?: string;
  notes?: string;
  testedAt: string;
}

type ViewMode = 'list' | 'session';

const RESULT_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  PASS: 'success',
  FAIL: 'danger',
  SKIP: 'warning',
  'N/A': 'info',
};

export function Diagnostics() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [activeSession, setActiveSession] = useState<DiagnosticSession | null>(null);
  const [sessionResults, setSessionResults] = useState<TestResult[]>([]);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionQlid, setNewSessionQlid] = useState('');
  const [newSessionCategory, setNewSessionCategory] = useState('APPLIANCE_SMALL');

  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testResult, setTestResult] = useState<'PASS' | 'FAIL' | 'SKIP' | null>(null);
  const [measurementValue, setMeasurementValue] = useState('');
  const [testNotes, setTestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [techStats, setTechStats] = useState<{
    technicians: TechnicianStats[];
    summary: { technicianCount: number; totalSessions: number; totalCompleted: number; totalPassed: number; totalFailed: number; overallPassRate: number; };
  } | null>(null);
  const [showTechStats, setShowTechStats] = useState(false);

  useEffect(() => {
    loadSessions();
    loadTechStats();
  }, []);

  async function loadTechStats() {
    try {
      const data = await api.getTechnicianStats();
      setTechStats(data);
    } catch (err) {
      console.error('Failed to load technician stats:', err);
    }
  }

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await api.getDiagnosticSessions({ limit: '50' });
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(identifier: string) {
    try {
      setLoading(true);
      const data = await api.getDiagnosticSession(identifier);
      setActiveSession(data.session);
      setSessionResults(data.results || []);

      const testSuite = await api.getTestSuite(data.session.category);
      setTests(testSuite?.tests || []);

      const completedCodes = new Set(data.results?.map((r: TestResult) => r.testCode) || []);
      const nextIndex = testSuite?.tests?.findIndex((t: DiagnosticTest) => !completedCodes.has(t.code)) ?? 0;
      setCurrentTestIndex(Math.max(0, nextIndex));

      setViewMode('session');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startNewSession() {
    if (!newSessionQlid.trim()) {
      setError('QLID is required');
      return;
    }

    try {
      setSubmitting(true);
      const session = await api.startDiagnosticSession({
        qlid: newSessionQlid.trim(),
        category: newSessionCategory,
      });
      await loadSession(session.sessionNumber);
      setShowNewSession(false);
      setNewSessionQlid('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTestResult() {
    if (!activeSession || !testResult) return;

    const currentTest = tests[currentTestIndex];
    if (!currentTest) return;

    try {
      setSubmitting(true);
      await api.recordTestResult(activeSession.sessionNumber, {
        testCode: currentTest.code,
        result: testResult,
        measurementValue: measurementValue ? parseFloat(measurementValue) : undefined,
        measurementUnit: currentTest.measurementUnit,
        notes: testNotes || undefined,
      });

      setSessionResults(prev => [...prev, {
        testCode: currentTest.code,
        result: testResult,
        measurementValue: measurementValue ? parseFloat(measurementValue) : undefined,
        measurementUnit: currentTest.measurementUnit,
        notes: testNotes,
        testedAt: new Date().toISOString(),
      }]);

      if (currentTestIndex < tests.length - 1) {
        setCurrentTestIndex(currentTestIndex + 1);
        setTestResult(null);
        setMeasurementValue('');
        setTestNotes('');
      } else {
        await completeSession();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function completeSession() {
    if (!activeSession) return;

    try {
      setSubmitting(true);
      await api.completeDiagnosticSession(activeSession.sessionNumber);
      setViewMode('list');
      setActiveSession(null);
      loadSessions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSessions = sessions.filter(s =>
    s.qlid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sessionNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedTestCodes = new Set(sessionResults.map(r => r.testCode));
  const progressPercent = tests.length > 0 ? Math.round((completedTestCodes.size / tests.length) * 100) : 0;

  if (loading && viewMode === 'list') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading diagnostics..." />
      </div>
    );
  }

  // Session View
  if (viewMode === 'session' && activeSession) {
    const currentTest = tests[currentTestIndex];
    const allTestsComplete = completedTestCodes.size === tests.length;

    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => { setViewMode('list'); setActiveSession(null); }} className="mb-2">
            <ArrowLeft size={16} />
            Back to Sessions
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">Diagnostic Session</h1>
          <p className="text-zinc-400">
            {activeSession.sessionNumber} | {activeSession.qlid} | {activeSession.category.replace('_', ' ')}
          </p>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg flex justify-between items-center"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-accent-red hover:text-white">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress */}
        <SpotlightCard className="p-4">
          <div className="flex justify-between mb-2 text-sm text-zinc-400">
            <span>Progress: {completedTestCodes.size} / {tests.length} tests</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="bg-dark-tertiary rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-ql-yellow"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </SpotlightCard>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Passed" value={sessionResults.filter(r => r.result === 'PASS').length} icon={CheckCircle} color="green" />
          <StatCard label="Failed" value={sessionResults.filter(r => r.result === 'FAIL').length} icon={XCircle} color="red" />
          <StatCard label="Skipped" value={sessionResults.filter(r => r.result === 'SKIP').length} icon={SkipForward} color="yellow" />
          <StatCard label="Remaining" value={tests.length - completedTestCodes.size} icon={Clock} color="blue" />
        </div>

        {/* Current Test */}
        {currentTest && !allTestsComplete ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <SpotlightCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {currentTest.isCritical && <AlertTriangle className="w-5 h-5 text-ql-yellow" />}
                  <h2 className="text-xl font-semibold text-white">
                    Test {currentTestIndex + 1}: {currentTest.name}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <Badge variant="info">{currentTest.testType}</Badge>
                  {currentTest.isCritical && <Badge variant="warning">CRITICAL</Badge>}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Description</span>
                  <p className="text-zinc-300 mt-1">{currentTest.description}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Instructions</span>
                  <pre className="bg-dark-tertiary rounded-lg p-4 mt-1 text-sm text-zinc-300 whitespace-pre-wrap">
                    {currentTest.instructions}
                  </pre>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Pass Criteria</span>
                  <p className="text-accent-green mt-1">{currentTest.passCriteria}</p>
                </div>
              </div>

              {currentTest.measurementUnit && (
                <div className="mb-4">
                  <Label>
                    Measurement ({currentTest.measurementUnit})
                    {currentTest.measurementMin !== undefined && currentTest.measurementMax !== undefined && (
                      <span className="text-zinc-500 ml-2">Range: {currentTest.measurementMin} - {currentTest.measurementMax}</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    value={measurementValue}
                    onChange={e => setMeasurementValue(e.target.value)}
                    placeholder={`Enter ${currentTest.measurementUnit}`}
                  />
                </div>
              )}

              <div className="mb-6">
                <Label>Notes (optional)</Label>
                <textarea
                  value={testNotes}
                  onChange={e => setTestNotes(e.target.value)}
                  placeholder="Add any observations..."
                  className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTestResult('PASS')}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    testResult === 'PASS'
                      ? 'bg-accent-green text-black'
                      : 'bg-dark-tertiary text-zinc-400 border border-border hover:border-accent-green'
                  }`}
                >
                  <CheckCircle size={18} /> PASS
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTestResult('FAIL')}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    testResult === 'FAIL'
                      ? 'bg-accent-red text-white'
                      : 'bg-dark-tertiary text-zinc-400 border border-border hover:border-accent-red'
                  }`}
                >
                  <XCircle size={18} /> FAIL
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTestResult('SKIP')}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    testResult === 'SKIP'
                      ? 'bg-ql-yellow text-black'
                      : 'bg-dark-tertiary text-zinc-400 border border-border hover:border-ql-yellow'
                  }`}
                >
                  <SkipForward size={18} /> SKIP
                </motion.button>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={completeSession} loading={submitting}>
                  Complete Early
                </Button>
                <Button variant="primary" onClick={submitTestResult} disabled={!testResult} loading={submitting}>
                  {currentTestIndex === tests.length - 1 ? 'Complete Session' : 'Next Test'}
                  <ChevronRight size={16} />
                </Button>
              </div>
            </SpotlightCard>
          </motion.div>
        ) : (
          <SpotlightCard className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-accent-green mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">All Tests Complete!</h2>
            <p className="text-zinc-400 mb-6">Session has been completed. Results are saved.</p>
            <Button variant="primary" onClick={() => { setViewMode('list'); loadSessions(); }}>
              Return to Sessions
            </Button>
          </SpotlightCard>
        )}

        {/* Test List */}
        <SpotlightCard className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-white">All Tests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Test Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Result</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test, idx) => {
                  const result = sessionResults.find(r => r.testCode === test.code);
                  return (
                    <tr
                      key={test.code}
                      onClick={() => !result && setCurrentTestIndex(idx)}
                      className={`border-b border-border transition-colors ${
                        idx === currentTestIndex && !allTestsComplete ? 'bg-ql-yellow/10' : 'hover:bg-dark-tertiary/50'
                      } ${!result ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3 text-zinc-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {test.isCritical && <AlertTriangle size={14} className="text-ql-yellow" />}
                          <span className="font-mono text-white">{test.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">{test.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">{test.testType}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {result ? (
                          <Badge variant={RESULT_VARIANTS[result.result]} size="sm">
                            {result.result}
                            {result.measurementValue !== undefined && ` (${result.measurementValue}${result.measurementUnit || ''})`}
                          </Badge>
                        ) : (
                          <span className="text-zinc-500">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Diagnostics</h1>
          <TextGenerateEffect
            words="Run diagnostic tests and track results"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="primary" onClick={() => setShowNewSession(true)}>
          <Play size={18} />
          New Session
        </Button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Session Modal */}
      <AnimatedModal isOpen={showNewSession} onClose={() => setShowNewSession(false)} title="Start Diagnostic Session">
        <div className="space-y-4">
          <div>
            <Label htmlFor="qlid">QLID</Label>
            <Input
              id="qlid"
              value={newSessionQlid}
              onChange={e => setNewSessionQlid(e.target.value)}
              placeholder="Scan or enter QLID"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={newSessionCategory}
              onChange={e => setNewSessionCategory(e.target.value)}
              className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
            >
              <option value="PHONE">Phone/Smartphone</option>
              <option value="TABLET">Tablet</option>
              <option value="LAPTOP">Laptop</option>
              <option value="APPLIANCE_SMALL">Small Appliance</option>
              <option value="ICE_MAKER">Ice Maker</option>
              <option value="VACUUM">Vacuum</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setShowNewSession(false)}>Cancel</Button>
            <Button variant="primary" onClick={startNewSession} loading={submitting}>Start Session</Button>
          </div>
        </div>
      </AnimatedModal>

      {/* Search */}
      <SpotlightCard className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by QLID or session number..."
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </SpotlightCard>

      {/* Technician Performance */}
      {techStats && techStats.technicians.length > 0 && (
        <SpotlightCard className="overflow-hidden">
          <div
            className="p-4 border-b border-border flex justify-between items-center cursor-pointer hover:bg-dark-tertiary/50"
            onClick={() => setShowTechStats(!showTechStats)}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-ql-yellow" />
              <h2 className="font-semibold text-white">Technician Performance</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                {techStats.summary.technicianCount} technicians | {techStats.summary.totalCompleted} sessions |{' '}
                <span className="text-accent-green">{techStats.summary.overallPassRate.toFixed(1)}% pass rate</span>
              </span>
              {showTechStats ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
            </div>
          </div>

          <AnimatePresence>
            {showTechStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="grid grid-cols-4 gap-4 p-4 border-b border-border">
                  <StatCard label="Technicians" value={techStats.summary.technicianCount} icon={Users} color="yellow" />
                  <StatCard label="Total Sessions" value={techStats.summary.totalCompleted} icon={Stethoscope} color="blue" />
                  <StatCard label="Passed" value={techStats.summary.totalPassed} icon={CheckCircle} color="green" />
                  <StatCard label="Pass Rate" value={`${techStats.summary.overallPassRate.toFixed(1)}%`} icon={TrendingUp} color="green" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Technician</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Sessions</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Passed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Failed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Pass Rate</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Avg Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {techStats.technicians.sort((a, b) => b.passRate - a.passRate).map((tech) => (
                        <tr key={tech.technicianId} className="border-b border-border hover:bg-dark-tertiary/50">
                          <td className="px-4 py-3 font-semibold text-white">{tech.technicianName || tech.technicianId}</td>
                          <td className="px-4 py-3 text-zinc-300">{tech.completedSessions}</td>
                          <td className="px-4 py-3 text-accent-green">{tech.passedSessions}</td>
                          <td className="px-4 py-3 text-accent-red">{tech.failedSessions}</td>
                          <td className="px-4 py-3">
                            <Badge variant={tech.passRate >= 90 ? 'success' : tech.passRate >= 75 ? 'warning' : 'danger'} size="sm">
                              {tech.passRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{tech.avgDurationMinutes.toFixed(1)} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      )}

      {/* Sessions List */}
      <SpotlightCard className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-ql-yellow">Recent Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Session</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">QLID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Result</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                      <Stethoscope className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      No diagnostic sessions found
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session, index) => (
                    <motion.tr
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-border hover:bg-dark-tertiary/50"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-ql-yellow">{session.sessionNumber}</td>
                      <td className="px-4 py-3 text-white">{session.qlid}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">{session.category.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {session.completedAt ? (
                          <span className="text-zinc-400">{session.passedTests}/{session.totalTests} passed</span>
                        ) : (
                          <Badge variant="warning" size="sm">In Progress</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {session.overallResult ? (
                          <Badge variant={session.overallResult === 'PASS' ? 'success' : 'danger'} size="sm">
                            {session.overallResult}
                          </Badge>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{new Date(session.startedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm" onClick={() => loadSession(session.sessionNumber)}>
                          {session.completedAt ? 'View' : 'Continue'}
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </SpotlightCard>
    </div>
  );
}
