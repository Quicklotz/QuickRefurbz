/**
 * QuickRefurbz - Technician Manager
 * Team management using Postgres or SQLite
 */

import type { Technician, ProductCategory } from './types.js';
import { getPool, generateUUID } from './database.js';

const isPostgres = () => (process.env.DB_TYPE || 'sqlite') === 'postgres';

// ==================== CREATE ====================

export interface AddTechnicianOptions {
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  specialties?: ProductCategory[];
}

export async function addTechnician(options: AddTechnicianOptions): Promise<Technician> {
  const db = getPool();

  // Check for duplicate employee ID
  const existing = await db.query(
    'SELECT id FROM technicians WHERE employee_id = $1',
    [options.employeeId]
  );
  if (existing.rows.length > 0) {
    throw new Error(`Employee ID ${options.employeeId} already exists`);
  }

  const id = generateUUID();
  // For SQLite, store arrays as JSON strings
  const specialties = isPostgres()
    ? (options.specialties || [])
    : JSON.stringify(options.specialties || []);

  const result = await db.query(`
    INSERT INTO technicians (id, employee_id, name, specialties)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [
    id,
    options.employeeId,
    options.name,
    specialties
  ]);

  return rowToTechnician(result.rows[0]);
}

// ==================== READ ====================

export async function getTechnicianById(techId: string): Promise<Technician | null> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM technicians
    WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)
  `, [techId]);

  if (result.rows.length === 0) return null;
  return rowToTechnician(result.rows[0]);
}

export interface ListTechniciansOptions {
  activeOnly?: boolean;
  specialty?: ProductCategory;
  limit?: number;
}

export async function listTechnicians(options: ListTechniciansOptions = {}): Promise<Technician[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.activeOnly !== false) {
    // SQLite uses 1/0 for boolean
    conditions.push(isPostgres() ? 'is_active = true' : 'is_active = 1');
  }

  if (options.specialty) {
    if (isPostgres()) {
      conditions.push(`$${paramIndex} = ANY(specialties)`);
    } else {
      // SQLite: search in JSON array string
      conditions.push(`specialties LIKE '%' || $${paramIndex} || '%'`);
    }
    params.push(options.specialty);
    paramIndex++;
  }

  let query = 'SELECT * FROM technicians';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name ASC';

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);
  return result.rows.map(rowToTechnician);
}

// ==================== UPDATE ====================

export async function updateTechnician(
  techId: string,
  updates: Partial<Technician>
): Promise<Technician | null> {
  const tech = await getTechnicianById(techId);
  if (!tech) return null;

  const db = getPool();
  const setClause: string[] = [isPostgres() ? 'updated_at = now()' : "updated_at = datetime('now')"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClause.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }

  if (updates.specialties !== undefined) {
    setClause.push(`specialties = $${paramIndex++}`);
    // For SQLite, store as JSON string
    params.push(isPostgres() ? updates.specialties : JSON.stringify(updates.specialties));
  }

  if (updates.isActive !== undefined) {
    setClause.push(`is_active = $${paramIndex++}`);
    // For SQLite, use 1/0 for boolean
    params.push(isPostgres() ? updates.isActive : (updates.isActive ? 1 : 0));
  }

  params.push(tech.id);
  const result = await db.query(
    `UPDATE technicians SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return rowToTechnician(result.rows[0]);
}

export async function deactivateTechnician(techId: string): Promise<Technician | null> {
  return updateTechnician(techId, { isActive: false });
}

export async function reactivateTechnician(techId: string): Promise<Technician | null> {
  return updateTechnician(techId, { isActive: true });
}

// ==================== DELETE ====================

export async function deleteTechnician(techId: string): Promise<boolean> {
  const tech = await getTechnicianById(techId);
  if (!tech) return false;

  const db = getPool();

  // Check if technician has any assigned items or tickets
  const itemsResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM refurb_items WHERE assigned_technician_id = $1',
    [tech.id]
  );
  const ticketsResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM repair_tickets WHERE assigned_technician_id = $1 OR created_by_technician_id = $1',
    [tech.id]
  );

  const itemCount = parseInt(itemsResult.rows[0].count);
  const ticketCount = parseInt(ticketsResult.rows[0].count);

  if (itemCount > 0 || ticketCount > 0) {
    throw new Error(`Cannot delete technician with ${itemCount} items and ${ticketCount} tickets. Deactivate instead.`);
  }

  const result = await db.query('DELETE FROM technicians WHERE id = $1', [tech.id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== WORKLOAD ====================

export interface TechnicianWorkload {
  technician: Technician;
  assignedItems: number;
  itemsByStage: Record<string, number>;
  openTickets: number;
  completedToday: number;
}

export async function getTechnicianWorkload(techId: string): Promise<TechnicianWorkload | null> {
  const tech = await getTechnicianById(techId);
  if (!tech) return null;

  const db = getPool();

  // Get assigned items by stage
  const itemsResult = await db.query<{ current_stage: string; count: string }>(`
    SELECT current_stage, COUNT(*) as count
    FROM refurb_items
    WHERE assigned_technician_id = $1
    GROUP BY current_stage
  `, [tech.id]);

  const itemsByStage: Record<string, number> = {};
  let assignedItems = 0;
  for (const row of itemsResult.rows) {
    itemsByStage[row.current_stage] = parseInt(row.count);
    assignedItems += parseInt(row.count);
  }

  // Get open tickets
  const ticketsResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM repair_tickets
    WHERE assigned_technician_id = $1
    AND status IN ('OPEN', 'IN_PROGRESS')
  `, [tech.id]);
  const openTickets = parseInt(ticketsResult.rows[0].count);

  // Get completed today (SQLite compatible)
  const completedResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM refurb_items
    WHERE assigned_technician_id = $1
    AND date(completed_at) = date('now')
  `, [tech.id]);
  const completedToday = parseInt(completedResult.rows[0].count);

  return {
    technician: tech,
    assignedItems,
    itemsByStage,
    openTickets,
    completedToday
  };
}

export async function getAllWorkloads(): Promise<TechnicianWorkload[]> {
  const technicians = await listTechnicians({ activeOnly: true });
  const workloads: TechnicianWorkload[] = [];

  for (const tech of technicians) {
    const workload = await getTechnicianWorkload(tech.id);
    if (workload) {
      workloads.push(workload);
    }
  }

  // Sort by assigned items (busiest first)
  workloads.sort((a, b) => b.assignedItems - a.assignedItems);

  return workloads;
}

// ==================== STATS ====================

export interface TechnicianStats {
  total: number;
  active: number;
  bySpecialty: Record<string, number>;
}

export async function getTechnicianStats(): Promise<TechnicianStats> {
  const db = getPool();

  const stats: TechnicianStats = {
    total: 0,
    active: 0,
    bySpecialty: {}
  };

  // Total count
  const totalResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM technicians');
  stats.total = parseInt(totalResult.rows[0].count);

  // Active count
  const activeCondition = isPostgres() ? 'is_active = true' : 'is_active = 1';
  const activeResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM technicians WHERE ${activeCondition}`
  );
  stats.active = parseInt(activeResult.rows[0].count);

  // By specialty - handle differently for Postgres vs SQLite
  if (isPostgres()) {
    const specialtyResult = await db.query<{ specialty: string; count: string }>(`
      SELECT specialty, COUNT(*) as count
      FROM technicians, unnest(specialties) as specialty
      WHERE is_active = true
      GROUP BY specialty
    `);
    for (const row of specialtyResult.rows) {
      stats.bySpecialty[row.specialty] = parseInt(row.count);
    }
  } else {
    // For SQLite, manually parse JSON and count specialties
    const techsResult = await db.query<{ specialties: string }>(`SELECT specialties FROM technicians WHERE is_active = 1`);
    for (const row of techsResult.rows) {
      if (row.specialties) {
        try {
          const specialties = typeof row.specialties === 'string'
            ? JSON.parse(row.specialties)
            : row.specialties;
          for (const spec of specialties) {
            stats.bySpecialty[spec] = (stats.bySpecialty[spec] || 0) + 1;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  return stats;
}

// ==================== HELPERS ====================

function rowToTechnician(row: Record<string, unknown>): Technician {
  // Handle specialties: could be array (Postgres) or JSON string (SQLite)
  let specialties: ProductCategory[] = [];
  if (row.specialties) {
    if (typeof row.specialties === 'string') {
      try {
        specialties = JSON.parse(row.specialties);
      } catch {
        specialties = [];
      }
    } else {
      specialties = row.specialties as ProductCategory[];
    }
  }

  // Handle is_active: could be boolean (Postgres) or integer (SQLite)
  const isActive = typeof row.is_active === 'number'
    ? row.is_active === 1
    : Boolean(row.is_active);

  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    name: row.name as string,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    specialties,
    isActive,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}
