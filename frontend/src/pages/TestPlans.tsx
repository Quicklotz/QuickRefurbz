"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Tablet,
  Laptop,
  Zap,
  Snowflake,
  Wind,
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
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
  displayOrder: number;
}

interface TestSuite {
  category: string;
  categoryName: string;
  tests: DiagnosticTest[];
  totalTestCount: number;
  criticalTestCount: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  PHONE: <Smartphone size={20} />,
  TABLET: <Tablet size={20} />,
  LAPTOP: <Laptop size={20} />,
  APPLIANCE_SMALL: <Zap size={20} />,
  ICE_MAKER: <Snowflake size={20} />,
  VACUUM: <Wind size={20} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  PHONE: '#3b82f6',
  TABLET: '#8b5cf6',
  LAPTOP: '#6366f1',
  APPLIANCE_SMALL: '#f59e0b',
  ICE_MAKER: '#06b6d4',
  VACUUM: '#10b981',
};

const TEST_TYPE_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  FUNCTIONAL: 'success',
  MEASUREMENT: 'info',
  VISUAL: 'warning',
  SAFETY: 'danger',
};

export function TestPlans() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedTest, setSelectedTest] = useState<DiagnosticTest | null>(null);

  useEffect(() => {
    loadTestSuites();
  }, []);

  async function loadTestSuites() {
    try {
      setLoading(true);
      const data = await api.getAllTestSuites();
      setSuites(data);
      if (data.length > 0) {
        setExpandedCategories(new Set([data[0].category]));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function filterTests(tests: DiagnosticTest[]): DiagnosticTest[] {
    if (!searchTerm) return tests;
    const term = searchTerm.toLowerCase();
    return tests.filter(t =>
      t.code.toLowerCase().includes(term) ||
      t.name.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  }

  const totalTests = suites.reduce((sum, s) => sum + s.totalTestCount, 0);
  const totalCritical = suites.reduce((sum, s) => sum + s.criticalTestCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading test plans..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-ql-yellow" />
          Test Plans
        </h1>
        <TextGenerateEffect
          words="Browse diagnostic test suites and test definitions"
          className="text-zinc-400 text-sm"
          duration={0.3}
        />
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

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatCard label="Categories" value={suites.length} icon={ClipboardList} color="yellow" />
        <StatCard label="Total Tests" value={totalTests} icon={CheckCircle} color="blue" />
        <StatCard label="Critical Tests" value={totalCritical} icon={AlertTriangle} color="red" />
        <StatCard label="Test Types" value={4} icon={Settings} color="green" />
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="p-4">
          <div className="flex items-center gap-4">
            <Search className="w-5 h-5 text-zinc-500" />
            <div className="flex-1 relative">
              <Input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search tests by code, name, or description..."
              />
            </div>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Test Type Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-6 flex-wrap"
      >
        {Object.entries(TEST_TYPE_VARIANTS).map(([type, variant]) => (
          <div key={type} className="flex items-center gap-2">
            <Badge variant={variant} size="sm">{type}</Badge>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-ql-yellow" />
          <span className="text-sm text-zinc-400">Critical (must pass)</span>
        </div>
      </motion.div>

      {/* Category Accordions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        {suites.map((suite, suiteIndex) => {
          const isExpanded = expandedCategories.has(suite.category);
          const filteredTests = filterTests(suite.tests);
          const hasResults = searchTerm ? filteredTests.length > 0 : true;

          if (searchTerm && !hasResults) return null;

          return (
            <motion.div
              key={suite.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: suiteIndex * 0.05 }}
            >
              <SpotlightCard className="overflow-hidden">
                {/* Category Header */}
                <div
                  onClick={() => toggleCategory(suite.category)}
                  className={`flex justify-between items-center p-4 cursor-pointer transition-colors hover:bg-dark-tertiary/50 ${isExpanded ? 'bg-dark-tertiary/30' : ''}`}
                  style={{ borderLeft: `4px solid ${CATEGORY_COLORS[suite.category] || 'var(--ql-yellow)'}` }}
                >
                  <div className="flex items-center gap-4">
                    <span style={{ color: CATEGORY_COLORS[suite.category] }}>
                      {CATEGORY_ICONS[suite.category] || <Settings size={20} />}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{suite.categoryName}</h3>
                      <p className="text-sm text-zinc-400">
                        {suite.totalTestCount} tests ({suite.criticalTestCount} critical)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {searchTerm && (
                      <span className="text-sm text-zinc-400">{filteredTests.length} matches</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                  </div>
                </div>

                {/* Tests Table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-t border-border">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Code</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Test Name</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Measurement</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Critical</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTests.map((test, index) => (
                              <motion.tr
                                key={test.code}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                onClick={() => setSelectedTest(test)}
                                className="border-t border-border hover:bg-dark-tertiary/50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <code className="text-sm font-mono text-ql-yellow">{test.code}</code>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-medium text-white">{test.name}</span>
                                  <p className="text-xs text-zinc-500 mt-0.5">
                                    {test.description.slice(0, 80)}...
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={TEST_TYPE_VARIANTS[test.testType] || 'info'} size="sm">
                                    {test.testType}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-zinc-400 text-sm">
                                  {test.measurementUnit ? (
                                    test.measurementMin !== undefined && test.measurementMax !== undefined
                                      ? `${test.measurementMin}-${test.measurementMax} ${test.measurementUnit}`
                                      : test.measurementUnit
                                  ) : (
                                    <span className="text-zinc-600">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {test.isCritical ? (
                                    <AlertTriangle size={18} className="text-ql-yellow" />
                                  ) : (
                                    <CheckCircle size={18} className="text-accent-green/50" />
                                  )}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Test Detail Modal */}
      <AnimatedModal
        isOpen={!!selectedTest}
        onClose={() => setSelectedTest(null)}
        title={selectedTest?.name}
      >
        {selectedTest && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              {selectedTest.isCritical && (
                <Badge variant="warning">
                  <AlertTriangle size={14} className="mr-1" />
                  Critical Test
                </Badge>
              )}
              <Badge variant={TEST_TYPE_VARIANTS[selectedTest.testType] || 'info'}>
                {selectedTest.testType}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Test Code</span>
                <code className="block text-ql-yellow font-mono mt-1">{selectedTest.code}</code>
              </div>
              {selectedTest.measurementUnit && (
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">
                    Measurement {selectedTest.measurementMin !== undefined ? 'Range' : 'Unit'}
                  </span>
                  <p className="text-white mt-1">
                    {selectedTest.measurementMin !== undefined && selectedTest.measurementMax !== undefined
                      ? `${selectedTest.measurementMin} - ${selectedTest.measurementMax} ${selectedTest.measurementUnit}`
                      : selectedTest.measurementUnit}
                  </p>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Description</span>
              <p className="text-zinc-300 mt-1">{selectedTest.description}</p>
            </div>

            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Instructions</span>
              <pre className="bg-dark-tertiary rounded-lg p-4 mt-2 text-sm text-zinc-300 whitespace-pre-wrap overflow-auto">
                {selectedTest.instructions}
              </pre>
            </div>

            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Pass Criteria</span>
              <div className="bg-accent-green/10 border border-accent-green rounded-lg p-4 mt-2 text-accent-green flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{selectedTest.passCriteria}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setSelectedTest(null)}>Close</Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
