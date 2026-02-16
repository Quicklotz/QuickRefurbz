/**
 * Monitoring Service - Real-time refurbishment monitoring and analytics
 *
 * Provides comprehensive metrics, activity feeds, and alerts for the
 * monitoring dashboard at monitor.quickrefurbz.com
 */

import { getPool } from '../database.js';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  overview: {
    totalItems: number;
    inProgress: number;
    completedToday: number;
    completedThisWeek: number;
    pendingItems: number;
    averageProcessingTime: number; // in minutes
  };
  stages: StageCount[];
  throughput: ThroughputData;
  technicians: TechnicianStats[];
  grades: GradeDistribution[];
  alerts: Alert[];
  recentActivity: ActivityItem[];
}

export interface StageCount {
  stage: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ThroughputData {
  hourly: ThroughputPoint[];
  daily: ThroughputPoint[];
  weekly: ThroughputPoint[];
}

export interface ThroughputPoint {
  timestamp: string;
  intake: number;
  completed: number;
}

export interface TechnicianStats {
  id: string;
  name: string;
  itemsProcessed: number;
  itemsInProgress: number;
  averageTime: number; // minutes
  currentStage: string | null;
  lastActivity: string;
}

export interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
  averageValue: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  category: 'inventory' | 'performance' | 'quality' | 'system';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'intake' | 'stage_change' | 'graded' | 'completed' | 'certified' | 'part_used';
  qlid: string;
  description: string;
  technician: string | null;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LiveUpdate {
  type: 'stats' | 'activity' | 'alert' | 'stage_change';
  data: any;
  timestamp: string;
}

// Event emitter for real-time updates
export const monitoringEvents = new EventEmitter();

// ============================================================================
// Core Dashboard Statistics
// ============================================================================

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    overview,
    stages,
    throughput,
    technicians,
    grades,
    alerts,
    recentActivity
  ] = await Promise.all([
    getOverviewStats(),
    getStageDistribution(),
    getThroughputData(),
    getTechnicianStats(),
    getGradeDistribution(),
    getActiveAlerts(),
    getRecentActivity(50)
  ]);

  return {
    overview,
    stages,
    throughput,
    technicians,
    grades,
    alerts,
    recentActivity
  };
}

export async function getOverviewStats(): Promise<DashboardStats['overview']> {
  const db = getPool();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  type CountResult = { count: string };
  type AvgResult = { avg_time: string | null };

  const [totalResult, inProgressResult, completedTodayResult, completedWeekResult, pendingResult, avgTimeResult] = await Promise.all([
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items`),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')`),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE current_stage = 'COMPLETE' AND completed_at >= $1`, [todayStr]),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE current_stage = 'COMPLETE' AND completed_at >= $1`, [weekAgoStr]),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE current_stage = 'INTAKE'`),
    db.query<AvgResult>(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at::timestamp - intake_timestamp::timestamp)) / 60) as avg_time
      FROM refurb_items
      WHERE current_stage = 'COMPLETE'
      AND completed_at >= $1
    `, [weekAgoStr])
  ]);

  return {
    totalItems: parseInt(totalResult.rows[0].count) || 0,
    inProgress: parseInt(inProgressResult.rows[0].count) || 0,
    completedToday: parseInt(completedTodayResult.rows[0].count) || 0,
    completedThisWeek: parseInt(completedWeekResult.rows[0].count) || 0,
    pendingItems: parseInt(pendingResult.rows[0].count) || 0,
    averageProcessingTime: parseFloat(avgTimeResult.rows[0].avg_time || '0') || 0
  };
}

export async function getStageDistribution(): Promise<StageCount[]> {
  const db = getPool();

  type StageResult = { stage: string; count: string };
  type TotalResult = { total: string };

  const [stagesResult, totalResult] = await Promise.all([
    db.query<StageResult>(`
      SELECT current_stage as stage, COUNT(*) as count
      FROM refurb_items
      WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')
      GROUP BY current_stage
      ORDER BY
        CASE current_stage
          WHEN 'INTAKE' THEN 1
          WHEN 'TESTING' THEN 2
          WHEN 'DIAGNOSTICS' THEN 3
          WHEN 'REPAIR' THEN 4
          WHEN 'CLEANING' THEN 5
          WHEN 'DATA_WIPE' THEN 6
          WHEN 'FINAL_QC' THEN 7
          ELSE 8
        END
    `),
    db.query<TotalResult>(`SELECT COUNT(*) as total FROM refurb_items WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')`)
  ]);

  const total = parseInt(totalResult.rows[0].total) || 1;

  // Get yesterday's counts for trend calculation
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  // For now, return stable trend (would need historical data for real trends)
  return stagesResult.rows.map((row: { stage: string; count: string }) => ({
    stage: row.stage,
    count: parseInt(row.count),
    percentage: Math.round((parseInt(row.count) / total) * 100),
    trend: 'stable' as const
  }));
}

export async function getThroughputData(): Promise<ThroughputData> {
  const db = getPool();

  // Hourly data (last 24 hours)
  const hourlyResult = await db.query<{
    hour: string;
    intake_count: string;
    completed_count: string;
  }>(`
    WITH hours AS (
      SELECT generate_series(
        date_trunc('hour', NOW() - INTERVAL '24 hours'),
        date_trunc('hour', NOW()),
        INTERVAL '1 hour'
      ) as hour
    )
    SELECT
      hours.hour::text,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('hour', intake_timestamp::timestamp) = hours.hour
      ), 0) as intake_count,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('hour', completed_at::timestamp) = hours.hour
      ), 0) as completed_count
    FROM hours
    ORDER BY hours.hour
  `);

  // Daily data (last 30 days)
  const dailyResult = await db.query<{
    day: string;
    intake_count: string;
    completed_count: string;
  }>(`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', NOW() - INTERVAL '30 days'),
        date_trunc('day', NOW()),
        INTERVAL '1 day'
      ) as day
    )
    SELECT
      days.day::text,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('day', intake_timestamp::timestamp) = days.day
      ), 0) as intake_count,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('day', completed_at::timestamp) = days.day
      ), 0) as completed_count
    FROM days
    ORDER BY days.day
  `);

  // Weekly data (last 12 weeks)
  const weeklyResult = await db.query<{
    week: string;
    intake_count: string;
    completed_count: string;
  }>(`
    WITH weeks AS (
      SELECT generate_series(
        date_trunc('week', NOW() - INTERVAL '12 weeks'),
        date_trunc('week', NOW()),
        INTERVAL '1 week'
      ) as week
    )
    SELECT
      weeks.week::text,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('week', intake_timestamp::timestamp) = weeks.week
      ), 0) as intake_count,
      COALESCE((
        SELECT COUNT(*) FROM refurb_items
        WHERE date_trunc('week', completed_at::timestamp) = weeks.week
      ), 0) as completed_count
    FROM weeks
    ORDER BY weeks.week
  `);

  type ThroughputRow = { hour?: string; day?: string; week?: string; intake_count: string; completed_count: string };
  return {
    hourly: hourlyResult.rows.map((row: ThroughputRow) => ({
      timestamp: row.hour || '',
      intake: parseInt(row.intake_count),
      completed: parseInt(row.completed_count)
    })),
    daily: dailyResult.rows.map((row: ThroughputRow) => ({
      timestamp: row.day || '',
      intake: parseInt(row.intake_count),
      completed: parseInt(row.completed_count)
    })),
    weekly: weeklyResult.rows.map((row: ThroughputRow) => ({
      timestamp: row.week || '',
      intake: parseInt(row.intake_count),
      completed: parseInt(row.completed_count)
    }))
  };
}

export async function getTechnicianStats(): Promise<TechnicianStats[]> {
  const db = getPool();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Get technician activity from stage history and labor entries
  const result = await db.query<{
    technician_id: string;
    items_processed: string;
    items_in_progress: string;
    avg_time: string | null;
    current_stage: string | null;
    last_activity: string | null;
  }>(`
    WITH tech_stats AS (
      SELECT
        COALESCE(sh.performed_by, le.technician_id) as technician_id,
        COUNT(DISTINCT CASE WHEN ri.current_stage = 'COMPLETE' THEN ri.qlid END) as items_processed,
        COUNT(DISTINCT CASE WHEN ri.current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED') THEN ri.qlid END) as items_in_progress,
        AVG(le.duration_minutes) as avg_time,
        MAX(ri.current_stage) as current_stage,
        MAX(COALESCE(sh.changed_at, le.started_at)) as last_activity
      FROM refurb_items ri
      LEFT JOIN stage_history sh ON ri.qlid = sh.qlid
      LEFT JOIN labor_entries le ON ri.qlid = le.qlid
      WHERE COALESCE(sh.performed_by, le.technician_id) IS NOT NULL
      GROUP BY COALESCE(sh.performed_by, le.technician_id)
    )
    SELECT
      technician_id,
      items_processed::text,
      items_in_progress::text,
      avg_time::text,
      current_stage,
      last_activity::text
    FROM tech_stats
    ORDER BY items_processed DESC
    LIMIT 20
  `);

  type TechRow = { technician_id: string; items_processed: string; items_in_progress: string; avg_time: string | null; current_stage: string | null; last_activity: string | null };
  return result.rows.map((row: TechRow) => ({
    id: row.technician_id,
    name: row.technician_id, // Would be joined with users table if available
    itemsProcessed: parseInt(row.items_processed),
    itemsInProgress: parseInt(row.items_in_progress),
    averageTime: parseFloat(row.avg_time || '0'),
    currentStage: row.current_stage,
    lastActivity: row.last_activity || new Date().toISOString()
  }));
}

export async function getGradeDistribution(): Promise<GradeDistribution[]> {
  const db = getPool();

  const result = await db.query<{
    grade: string;
    count: string;
    avg_value: string | null;
  }>(`
    SELECT
      ga.final_grade as grade,
      COUNT(*) as count,
      AVG(rc.estimated_value) as avg_value
    FROM grading_assessments ga
    LEFT JOIN refurb_costs rc ON ga.qlid = rc.qlid
    WHERE ga.final_grade IS NOT NULL
    GROUP BY ga.final_grade
    ORDER BY
      CASE ga.final_grade
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'C' THEN 3
        WHEN 'D' THEN 4
        WHEN 'F' THEN 5
        ELSE 6
      END
  `);

  type GradeRow = { grade: string; count: string; avg_value: string | null };
  const total = result.rows.reduce((sum: number, row: GradeRow) => sum + parseInt(row.count), 0) || 1;

  return result.rows.map((row: GradeRow) => ({
    grade: row.grade,
    count: parseInt(row.count),
    percentage: Math.round((parseInt(row.count) / total) * 100),
    averageValue: parseFloat(row.avg_value || '0')
  }));
}

// ============================================================================
// Alerts System
// ============================================================================

export async function getActiveAlerts(): Promise<Alert[]> {
  const db = getPool();
  const alerts: Alert[] = [];

  // Check for items stuck in a stage for too long (> 24 hours)
  const stuckResult = await db.query<{ count: string; stage: string }>(`
    SELECT current_stage as stage, COUNT(*) as count
    FROM refurb_items
    WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')
    AND updated_at < NOW() - INTERVAL '24 hours'
    GROUP BY current_stage
    HAVING COUNT(*) > 0
  `);

  for (const row of stuckResult.rows) {
    alerts.push({
      id: `stuck-${row.stage}-${Date.now()}`,
      type: 'warning',
      category: 'performance',
      message: `${row.count} items stuck in ${row.stage} for over 24 hours`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  // Check for low parts inventory
  const lowPartsResult = await db.query<{ name: string; quantity: string }>(`
    SELECT name, quantity::text
    FROM parts
    WHERE quantity < 5 AND quantity > 0
  `);

  for (const row of lowPartsResult.rows) {
    alerts.push({
      id: `low-parts-${row.name}-${Date.now()}`,
      type: 'warning',
      category: 'inventory',
      message: `Low stock: ${row.name} (${row.quantity} remaining)`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  // Check for parts out of stock
  const outOfStockResult = await db.query<{ name: string }>(`
    SELECT name FROM parts WHERE quantity = 0
  `);

  for (const row of outOfStockResult.rows) {
    alerts.push({
      id: `out-of-stock-${row.name}-${Date.now()}`,
      type: 'error',
      category: 'inventory',
      message: `Out of stock: ${row.name}`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  // Check for items with low grades (D or F) in last 24 hours
  const lowGradeResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM grading_assessments
    WHERE final_grade IN ('D', 'F')
    AND assessed_at >= NOW() - INTERVAL '24 hours'
  `);

  const lowGradeCount = parseInt(lowGradeResult.rows[0]?.count || '0');
  if (lowGradeCount > 5) {
    alerts.push({
      id: `quality-${Date.now()}`,
      type: 'warning',
      category: 'quality',
      message: `${lowGradeCount} items graded D or F in the last 24 hours`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  return alerts.sort((a, b) => {
    const typeOrder = { error: 0, warning: 1, info: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

// ============================================================================
// Activity Feed
// ============================================================================

export async function getRecentActivity(limit: number = 50): Promise<ActivityItem[]> {
  const db = getPool();

  // Get recent stage changes
  const stageChanges = await db.query<{
    id: string;
    qlid: string;
    from_stage: string;
    to_stage: string;
    performed_by: string | null;
    changed_at: string;
  }>(`
    SELECT id, qlid, from_stage, to_stage, performed_by, changed_at::text
    FROM stage_history
    ORDER BY changed_at DESC
    LIMIT $1
  `, [limit]);

  type StageChangeRow = { id: string; qlid: string; from_stage: string; to_stage: string; performed_by: string | null; changed_at: string };
  const activities: ActivityItem[] = stageChanges.rows.map((row: StageChangeRow) => ({
    id: row.id,
    type: row.to_stage === 'COMPLETE' ? 'completed' as const :
          row.to_stage === 'INTAKE' ? 'intake' as const : 'stage_change' as const,
    qlid: row.qlid,
    description: row.to_stage === 'INTAKE'
      ? `Item ${row.qlid} received into inventory`
      : row.to_stage === 'COMPLETE'
      ? `Item ${row.qlid} completed refurbishment`
      : `Item ${row.qlid} moved from ${row.from_stage} to ${row.to_stage}`,
    technician: row.performed_by,
    timestamp: row.changed_at
  }));

  // Get recent gradings
  const gradings = await db.query<{
    id: string;
    qlid: string;
    final_grade: string;
    assessed_by: string;
    assessed_at: string;
  }>(`
    SELECT id, qlid, final_grade, assessed_by, assessed_at::text
    FROM grading_assessments
    ORDER BY assessed_at DESC
    LIMIT $1
  `, [limit]);

  for (const row of gradings.rows) {
    activities.push({
      id: row.id,
      type: 'graded',
      qlid: row.qlid,
      description: `Item ${row.qlid} graded as ${row.final_grade}`,
      technician: row.assessed_by,
      timestamp: row.assessed_at,
      metadata: { grade: row.final_grade }
    });
  }

  // Get recent certifications
  const certs = await db.query<{
    id: string;
    qlid: string;
    wipe_method: string;
    technician_id: string;
    created_at: string;
  }>(`
    SELECT id, qlid, wipe_method, technician_id, created_at::text
    FROM data_wipe_certificates
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  for (const row of certs.rows) {
    activities.push({
      id: row.id,
      type: 'certified',
      qlid: row.qlid,
      description: `Item ${row.qlid} certified with ${row.wipe_method} data wipe`,
      technician: row.technician_id,
      timestamp: row.created_at,
      metadata: { wipeMethod: row.wipe_method }
    });
  }

  // Get recent parts usage
  const parts = await db.query<{
    id: string;
    qlid: string;
    part_name: string;
    quantity: string;
    used_by: string;
    used_at: string;
  }>(`
    SELECT id, qlid, part_name, quantity::text, used_by, used_at::text
    FROM parts_usage
    ORDER BY used_at DESC
    LIMIT $1
  `, [limit]);

  for (const row of parts.rows) {
    activities.push({
      id: row.id,
      type: 'part_used',
      qlid: row.qlid,
      description: `${row.quantity}x ${row.part_name} used on ${row.qlid}`,
      technician: row.used_by,
      timestamp: row.used_at,
      metadata: { partName: row.part_name, quantity: parseInt(row.quantity) }
    });
  }

  // Sort by timestamp and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ============================================================================
// Real-time Updates
// ============================================================================

export function emitUpdate(update: LiveUpdate): void {
  monitoringEvents.emit('update', update);
}

export function emitStageChange(qlid: string, fromStage: string, toStage: string, technician?: string): void {
  emitUpdate({
    type: 'stage_change',
    data: {
      qlid,
      fromStage,
      toStage,
      technician
    },
    timestamp: new Date().toISOString()
  });
}

export function emitActivity(activity: ActivityItem): void {
  emitUpdate({
    type: 'activity',
    data: activity,
    timestamp: new Date().toISOString()
  });
}

export function emitAlert(alert: Alert): void {
  emitUpdate({
    type: 'alert',
    data: alert,
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// Custom Reports
// ============================================================================

export async function getProductivityReport(startDate: string, endDate: string): Promise<{
  summary: {
    totalProcessed: number;
    avgProcessingTime: number;
    gradeARate: number;
    technicianCount: number;
  };
  byTechnician: TechnicianStats[];
  byDay: { date: string; processed: number; avgTime: number }[];
  byGrade: GradeDistribution[];
}> {
  const db = getPool();

  type SummaryResult = {
    total_processed: string;
    avg_time: string | null;
    grade_a_count: string;
    tech_count: string;
  };

  const summaryResult = await db.query<SummaryResult>(`
    SELECT
      COUNT(DISTINCT ri.qlid) as total_processed,
      AVG(EXTRACT(EPOCH FROM (ri.completed_at::timestamp - ri.intake_timestamp::timestamp)) / 60) as avg_time,
      COUNT(DISTINCT CASE WHEN ga.final_grade = 'A' THEN ri.qlid END) as grade_a_count,
      COUNT(DISTINCT sh.performed_by) as tech_count
    FROM refurb_items ri
    LEFT JOIN grading_assessments ga ON ri.qlid = ga.qlid
    LEFT JOIN stage_history sh ON ri.qlid = sh.qlid
    WHERE ri.completed_at >= $1 AND ri.completed_at <= $2
  `, [startDate, endDate]);

  const row = summaryResult.rows[0];
  const totalProcessed = parseInt(row.total_processed) || 0;

  const technicians = await getTechnicianStats();
  const grades = await getGradeDistribution();

  // Get daily breakdown
  const dailyResult = await db.query<{
    date: string;
    processed: string;
    avg_time: string | null;
  }>(`
    SELECT
      date_trunc('day', completed_at)::text as date,
      COUNT(*) as processed,
      AVG(EXTRACT(EPOCH FROM (completed_at::timestamp - intake_timestamp::timestamp)) / 60) as avg_time
    FROM refurb_items
    WHERE completed_at >= $1 AND completed_at <= $2
    GROUP BY date_trunc('day', completed_at)
    ORDER BY date
  `, [startDate, endDate]);

  return {
    summary: {
      totalProcessed,
      avgProcessingTime: parseFloat(row.avg_time || '0'),
      gradeARate: totalProcessed > 0
        ? Math.round((parseInt(row.grade_a_count) / totalProcessed) * 100)
        : 0,
      technicianCount: parseInt(row.tech_count) || 0
    },
    byTechnician: technicians,
    byDay: dailyResult.rows.map((r: { date: string; processed: string; avg_time: string | null }) => ({
      date: r.date,
      processed: parseInt(r.processed),
      avgTime: parseFloat(r.avg_time || '0')
    })),
    byGrade: grades
  };
}

export async function getInventoryHealth(): Promise<{
  stages: { stage: string; count: number; avgAge: number }[];
  oldestItems: { qlid: string; stage: string; daysInStage: number }[];
  bottlenecks: { stage: string; backlog: number; throughput: number }[];
}> {
  const db = getPool();

  // Get stage statistics with age
  const stagesResult = await db.query<{
    stage: string;
    count: string;
    avg_age: string | null;
  }>(`
    SELECT
      current_stage as stage,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400) as avg_age
    FROM refurb_items
    WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')
    GROUP BY current_stage
  `);

  // Get oldest items
  const oldestResult = await db.query<{
    qlid: string;
    stage: string;
    days_in_stage: string;
  }>(`
    SELECT
      qlid,
      current_stage as stage,
      EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400 as days_in_stage
    FROM refurb_items
    WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')
    ORDER BY updated_at ASC
    LIMIT 10
  `);

  // Calculate bottlenecks (stages with high backlog relative to throughput)
  const bottleneckResult = await db.query<{
    stage: string;
    backlog: string;
    daily_throughput: string;
  }>(`
    WITH stage_backlog AS (
      SELECT current_stage as stage, COUNT(*) as backlog
      FROM refurb_items
      WHERE current_stage NOT IN ('COMPLETE', 'DISPOSED', 'RETURNED')
      GROUP BY current_stage
    ),
    stage_throughput AS (
      SELECT to_stage as stage, COUNT(*) / 7.0 as daily_throughput
      FROM stage_history
      WHERE changed_at >= NOW() - INTERVAL '7 days'
      GROUP BY to_stage
    )
    SELECT
      sb.stage,
      sb.backlog::text,
      COALESCE(st.daily_throughput, 0)::text as daily_throughput
    FROM stage_backlog sb
    LEFT JOIN stage_throughput st ON sb.stage = st.stage
    WHERE sb.backlog > 5
    ORDER BY sb.backlog / NULLIF(st.daily_throughput, 0) DESC NULLS FIRST
  `);

  return {
    stages: stagesResult.rows.map((r: { stage: string; count: string; avg_age: string | null }) => ({
      stage: r.stage,
      count: parseInt(r.count),
      avgAge: parseFloat(r.avg_age || '0')
    })),
    oldestItems: oldestResult.rows.map((r: { qlid: string; stage: string; days_in_stage: string }) => ({
      qlid: r.qlid,
      stage: r.stage,
      daysInStage: parseFloat(r.days_in_stage)
    })),
    bottlenecks: bottleneckResult.rows.map((r: { stage: string; backlog: string; daily_throughput: string }) => ({
      stage: r.stage,
      backlog: parseInt(r.backlog),
      throughput: parseFloat(r.daily_throughput)
    }))
  };
}
