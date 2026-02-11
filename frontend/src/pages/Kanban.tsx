"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/api/client';
import { ChevronRight, RefreshCw, Package } from 'lucide-react';
import { SpotlightCard, Spotlight } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Badge, PriorityBadge } from '@/components/shared/Badge';
import { Loader } from '@/components/aceternity/loader';
import { useToast } from '@/components/aceternity/toast';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { cn } from '@/lib/utils';

const STAGES = ['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'];

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Intake',
  TESTING: 'Testing',
  REPAIR: 'Repair',
  CLEANING: 'Cleaning',
  FINAL_QC: 'Final QC',
  COMPLETE: 'Complete'
};

const STAGE_COLORS: Record<string, string> = {
  INTAKE: 'bg-accent-blue',
  TESTING: 'bg-ql-yellow',
  REPAIR: 'bg-accent-red',
  CLEANING: 'bg-accent-purple',
  FINAL_QC: 'bg-accent-green',
  COMPLETE: 'bg-accent-green'
};

interface KanbanItem {
  qlid: string;
  manufacturer: string;
  model: string;
  priority: string;
  category: string;
}

export function Kanban() {
  const [kanban, setKanban] = useState<Record<string, KanbanItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const toast = useToast();

  const loadKanban = () => {
    setLoading(true);
    api.getKanban()
      .then(setKanban)
      .catch((error) => {
        console.error(error);
        toast.error('Failed to load kanban', error.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKanban();
  }, []);

  const handleAdvance = async (item: KanbanItem) => {
    if (advancing) return;
    setAdvancing(item.qlid);

    try {
      await api.advanceItem(item.qlid);
      toast.success('Item Advanced', `${item.qlid} moved to next stage`);
      loadKanban();
    } catch (error: any) {
      toast.error('Failed to advance item', error.message);
    } finally {
      setAdvancing(null);
    }
  };

  if (loading && Object.keys(kanban).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="bars" text="Loading kanban board..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Kanban Board</h1>
          <TextGenerateEffect
            words="Drag items through workflow stages"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button
          variant="secondary"
          onClick={loadKanban}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </motion.div>

      {/* Kanban Board */}
      <div className="grid grid-cols-6 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage, stageIndex) => (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: stageIndex * 0.1 }}
            className="min-w-[220px]"
          >
            <SpotlightCard className="h-full">
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", STAGE_COLORS[stage])} />
                  <span className="font-semibold text-white text-sm">
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                <span className="bg-dark-tertiary px-2.5 py-1 rounded-full text-xs font-semibold text-zinc-300">
                  {kanban[stage]?.length || 0}
                </span>
              </div>

              {/* Items */}
              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                <AnimatePresence>
                  {(kanban[stage] || []).map((item, index) => (
                    <motion.div
                      key={item.qlid}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, x: 50 }}
                      transition={{ delay: index * 0.05 }}
                      layout
                    >
                      <Spotlight
                        className="bg-dark-primary border border-border rounded-lg p-3.5 cursor-pointer hover:border-ql-yellow transition-colors"
                        spotlightColor="rgba(241, 196, 15, 0.1)"
                      >
                        {/* Item ID */}
                        <div className="text-xs text-ql-yellow font-semibold font-mono mb-1.5">
                          {item.qlid}
                        </div>

                        {/* Item Title */}
                        <div className="text-sm font-medium text-white mb-2 leading-snug">
                          {item.manufacturer} {item.model}
                        </div>

                        {/* Tags */}
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          <PriorityBadge priority={item.priority.toLowerCase() as 'urgent' | 'high' | 'normal' | 'low'} />
                          <Badge variant="info" size="sm">
                            {item.category}
                          </Badge>
                        </div>

                        {/* Advance Button */}
                        {stage !== 'COMPLETE' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full"
                            onClick={() => handleAdvance(item)}
                            loading={advancing === item.qlid}
                          >
                            {advancing === item.qlid ? 'Moving...' : (
                              <>
                                Next <ChevronRight size={14} />
                              </>
                            )}
                          </Button>
                        )}

                        {stage === 'COMPLETE' && (
                          <div className="flex items-center justify-center gap-1.5 text-accent-green text-xs font-medium py-1.5">
                            <Package size={14} />
                            Complete
                          </div>
                        )}
                      </Spotlight>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty State */}
                {(kanban[stage] || []).length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-8 text-center text-zinc-500 text-sm"
                  >
                    No items
                  </motion.div>
                )}
              </div>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-3 gap-4"
      >
        <SpotlightCard className="p-4">
          <div className="text-sm text-zinc-400 mb-1">Total Items</div>
          <div className="text-2xl font-bold text-white">
            {Object.values(kanban).reduce((sum, items) => sum + items.length, 0)}
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-sm text-zinc-400 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-ql-yellow">
            {['TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC'].reduce(
              (sum, stage) => sum + (kanban[stage]?.length || 0),
              0
            )}
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-sm text-zinc-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-accent-green">
            {kanban['COMPLETE']?.length || 0}
          </div>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}
