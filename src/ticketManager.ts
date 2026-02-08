/**
 * QuickRefurbz - Ticket Manager
 * Repair ticket CRUD operations using QLID identity
 */

import type {
  RepairTicket,
  TicketStatus,
  IssueSeverity
} from './types.js';
import { getPool, getNextTicketNumber, parseIdentifier, generateUUID, nowFn } from './database.js';
import { getItem } from './itemManager.js';

// ==================== CREATE ====================

export interface CreateTicketOptions {
  identifier: string;                  // QLID or barcode
  issueType: string;
  issueDescription: string;
  severity: IssueSeverity;
  createdByTechnicianId: string;
  assignedTechnicianId?: string;
}

export async function createTicket(options: CreateTicketOptions): Promise<RepairTicket> {
  // Verify item exists and get QLID
  const item = await getItem(options.identifier);
  if (!item) {
    throw new Error(`Item not found: ${options.identifier}`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query(
    'SELECT id, name FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
    [options.createdByTechnicianId]
  );
  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${options.createdByTechnicianId}`);
  }

  const ticketNumber = await getNextTicketNumber();
  const id = generateUUID();

  const result = await db.query(`
    INSERT INTO repair_tickets (
      id, ticket_number, qlid,
      issue_type, issue_description, severity,
      created_by_technician_id, assigned_technician_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    id,
    ticketNumber,
    item.qlid,
    options.issueType,
    options.issueDescription,
    options.severity,
    techResult.rows[0].id,
    options.assignedTechnicianId || null
  ]);

  return rowToTicket(result.rows[0]);
}

// ==================== READ ====================

export async function getTicketById(ticketId: string): Promise<RepairTicket | null> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM repair_tickets
    WHERE id = $1 OR ticket_number = $1
  `, [ticketId]);

  if (result.rows.length === 0) return null;
  return rowToTicket(result.rows[0]);
}

export interface ListTicketsOptions {
  qlid?: string;
  status?: TicketStatus;
  severity?: IssueSeverity;
  technicianId?: string;
  limit?: number;
}

export async function listTickets(options: ListTicketsOptions = {}): Promise<RepairTicket[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.qlid) {
    try {
      const parsed = parseIdentifier(options.qlid);
      conditions.push(`qlid = $${paramIndex++}`);
      params.push(parsed.qlid);
    } catch {
      conditions.push(`qlid = $${paramIndex++}`);
      params.push(options.qlid);
    }
  }

  if (options.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  if (options.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(options.severity);
  }

  if (options.technicianId) {
    // Find technician first
    const techResult = await db.query(
      'SELECT id FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
      [options.technicianId]
    );
    if (techResult.rows.length > 0) {
      conditions.push(`(assigned_technician_id = $${paramIndex} OR created_by_technician_id = $${paramIndex})`);
      params.push(techResult.rows[0].id);
      paramIndex++;
    }
  }

  let query = 'SELECT * FROM repair_tickets';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);
  return result.rows.map(rowToTicket);
}

export async function getTicketsForItem(identifier: string): Promise<RepairTicket[]> {
  const parsed = parseIdentifier(identifier);
  return listTickets({ qlid: parsed.qlid });
}

export async function getOpenTickets(): Promise<RepairTicket[]> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM repair_tickets
    WHERE status IN ('OPEN', 'IN_PROGRESS')
    ORDER BY created_at DESC
  `);
  return result.rows.map(rowToTicket);
}

// ==================== UPDATE ====================

export async function updateTicket(
  ticketId: string,
  updates: Partial<RepairTicket>
): Promise<RepairTicket | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;

  const db = getPool();
  const setClause: string[] = [`updated_at = ${nowFn()}`];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClause.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }

  if (updates.assignedTechnicianId !== undefined) {
    setClause.push(`assigned_technician_id = $${paramIndex++}`);
    params.push(updates.assignedTechnicianId);
  }

  if (updates.repairAction !== undefined) {
    setClause.push(`repair_action = $${paramIndex++}`);
    params.push(updates.repairAction);
  }

  if (updates.repairNotes !== undefined) {
    setClause.push(`repair_notes = $${paramIndex++}`);
    params.push(updates.repairNotes);
  }

  if (updates.resolvedByTechnicianId !== undefined) {
    setClause.push(`resolved_by_technician_id = $${paramIndex++}`);
    params.push(updates.resolvedByTechnicianId);
  }

  if (updates.resolvedAt !== undefined) {
    setClause.push(`resolved_at = $${paramIndex++}`);
    // Convert Date to ISO string for SQLite compatibility
    params.push(updates.resolvedAt instanceof Date ? updates.resolvedAt.toISOString() : updates.resolvedAt);
  }

  params.push(ticket.id);
  const result = await db.query(
    `UPDATE repair_tickets SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return rowToTicket(result.rows[0]);
}

export async function assignTicket(
  ticketId: string,
  technicianId: string
): Promise<RepairTicket | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query<{ id: string }>(
    'SELECT id FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
    [technicianId]
  );
  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${technicianId}`);
  }

  return updateTicket(ticketId, {
    assignedTechnicianId: techResult.rows[0].id,
    status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status
  });
}

export async function startTicket(ticketId: string): Promise<RepairTicket | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  if (ticket.status !== 'OPEN') {
    throw new Error(`Ticket ${ticket.ticketNumber} is not in OPEN status`);
  }

  return updateTicket(ticketId, { status: 'IN_PROGRESS' });
}

export interface ResolveTicketOptions {
  repairAction: string;
  repairNotes?: string;
  resolvedByTechnicianId: string;
}

export async function resolveTicket(
  ticketId: string,
  options: ResolveTicketOptions
): Promise<RepairTicket | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  if (ticket.status === 'RESOLVED' || ticket.status === 'CANNOT_REPAIR') {
    throw new Error(`Ticket ${ticket.ticketNumber} is already closed`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query<{ id: string }>(
    'SELECT id FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
    [options.resolvedByTechnicianId]
  );
  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${options.resolvedByTechnicianId}`);
  }

  return updateTicket(ticketId, {
    status: 'RESOLVED',
    repairAction: options.repairAction,
    repairNotes: options.repairNotes,
    resolvedByTechnicianId: techResult.rows[0].id,
    resolvedAt: new Date()
  });
}

export async function markCannotRepair(
  ticketId: string,
  technicianId: string,
  notes?: string
): Promise<RepairTicket | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query<{ id: string }>(
    'SELECT id FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
    [technicianId]
  );
  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${technicianId}`);
  }

  return updateTicket(ticketId, {
    status: 'CANNOT_REPAIR',
    repairNotes: notes,
    resolvedByTechnicianId: techResult.rows[0].id,
    resolvedAt: new Date()
  });
}

// ==================== DELETE ====================

export async function deleteTicket(ticketId: string): Promise<boolean> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return false;

  const db = getPool();
  const result = await db.query('DELETE FROM repair_tickets WHERE id = $1', [ticket.id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== STATS ====================

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  bySeverity: Record<IssueSeverity, number>;
  openCount: number;
  resolvedToday: number;
  avgResolutionTimeMinutes: number;
}

export async function getTicketStats(): Promise<TicketStats> {
  const db = getPool();

  const stats: TicketStats = {
    total: 0,
    byStatus: {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CANNOT_REPAIR: 0
    },
    bySeverity: {
      CRITICAL: 0,
      MAJOR: 0,
      MINOR: 0,
      COSMETIC: 0
    },
    openCount: 0,
    resolvedToday: 0,
    avgResolutionTimeMinutes: 0
  };

  // Total
  const totalResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM repair_tickets');
  stats.total = parseInt(totalResult.rows[0].count);

  // By status
  const statusResult = await db.query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) as count
    FROM repair_tickets
    GROUP BY status
  `);
  for (const row of statusResult.rows) {
    stats.byStatus[row.status as TicketStatus] = parseInt(row.count);
  }

  // By severity
  const severityResult = await db.query<{ severity: string; count: string }>(`
    SELECT severity, COUNT(*) as count
    FROM repair_tickets
    GROUP BY severity
  `);
  for (const row of severityResult.rows) {
    stats.bySeverity[row.severity as IssueSeverity] = parseInt(row.count);
  }

  // Open count
  stats.openCount = stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS;

  // Resolved today (SQLite compatible)
  const todayResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM repair_tickets
    WHERE date(resolved_at) = date('now')
  `);
  stats.resolvedToday = parseInt(todayResult.rows[0].count);

  // Average resolution time (simplified, SQLite compatible)
  // For SQLite, we need to calculate differently
  const resolvedTickets = await db.query<{ created_at: string; resolved_at: string }>(`
    SELECT created_at, resolved_at
    FROM repair_tickets
    WHERE resolved_at IS NOT NULL
  `);
  if (resolvedTickets.rows.length > 0) {
    let totalMinutes = 0;
    for (const row of resolvedTickets.rows) {
      const created = new Date(row.created_at).getTime();
      const resolved = new Date(row.resolved_at).getTime();
      totalMinutes += (resolved - created) / 60000;
    }
    stats.avgResolutionTimeMinutes = Math.round(totalMinutes / resolvedTickets.rows.length);
  }

  return stats;
}

// ==================== HELPERS ====================

function rowToTicket(row: Record<string, unknown>): RepairTicket {
  return {
    id: row.id as string,
    ticketNumber: row.ticket_number as string,
    qlid: row.qlid as string,
    issueType: row.issue_type as string,
    issueDescription: row.issue_description as string,
    severity: row.severity as IssueSeverity,
    repairAction: row.repair_action as string | undefined,
    repairNotes: row.repair_notes as string | undefined,
    status: row.status as TicketStatus,
    createdByTechnicianId: row.created_by_technician_id as string,
    assignedTechnicianId: row.assigned_technician_id as string | undefined,
    resolvedByTechnicianId: row.resolved_by_technician_id as string | undefined,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    resolvedAt: row.resolved_at as Date | undefined
  };
}
