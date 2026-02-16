/**
 * Batch Export Service
 * Exports data to CSV and XLSX files in batches of 50 records
 * Supports: items, pallets, certificates, grading, parts usage, labor, costs
 */

import { getPool, generateUUID } from '../database.js';
import ExcelJS from 'exceljs';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';

// ==================== TYPES ====================

export type ExportFormat = 'csv' | 'xlsx';
export type ExportType =
  | 'items'
  | 'pallets'
  | 'certificates'
  | 'grading'
  | 'parts_usage'
  | 'labor'
  | 'costs'
  | 'full_report';

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  batchSize?: number; // Default 50
  filters?: {
    startDate?: string;
    endDate?: string;
    palletId?: string;
    stage?: string;
    grade?: string;
  };
  outputDir?: string;
}

export interface ExportResult {
  id: string;
  type: ExportType;
  format: ExportFormat;
  totalRecords: number;
  batchCount: number;
  files: string[];
  exportedAt: string;
  duration: number;
}

export interface BatchExportJob {
  id: string;
  type: ExportType;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalBatches: number;
  completedBatches: number;
  files: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ==================== CONSTANTS ====================

const DEFAULT_BATCH_SIZE = 50;
const EXPORTS_DIR = process.env.EXPORTS_DIR || './exports';

// Column definition type
interface ColumnDef {
  header: string;
  key: string;
}

// Column definitions for each export type (excluding full_report which uses items)
type ColumnExportType = Exclude<ExportType, 'full_report'>;

const COLUMN_DEFS: Record<ColumnExportType, ColumnDef[]> = {
  items: [
    { header: 'QLID', key: 'qlid' },
    { header: 'Pallet ID', key: 'pallet_id' },
    { header: 'Manufacturer', key: 'manufacturer' },
    { header: 'Model', key: 'model' },
    { header: 'Category', key: 'category' },
    { header: 'UPC', key: 'upc' },
    { header: 'Serial Number', key: 'serial_number' },
    { header: 'Current Stage', key: 'current_stage' },
    { header: 'Final Grade', key: 'final_grade' },
    { header: 'Unit COGS', key: 'unit_cogs' },
    { header: 'Estimated Value', key: 'estimated_value' },
    { header: 'Condition Notes', key: 'condition_notes' },
    { header: 'Intake Employee', key: 'intake_employee_id' },
    { header: 'Warehouse', key: 'warehouse_id' },
    { header: 'Intake Date', key: 'intake_ts' },
    { header: 'Completed Date', key: 'completed_at' },
    { header: 'Created At', key: 'created_at' },
  ],
  pallets: [
    { header: 'Pallet ID', key: 'pallet_id' },
    { header: 'Retailer', key: 'retailer' },
    { header: 'Liquidation Source', key: 'liquidation_source' },
    { header: 'Source Pallet ID', key: 'source_pallet_id' },
    { header: 'Source Order ID', key: 'source_order_id' },
    { header: 'Purchase Date', key: 'purchase_date' },
    { header: 'Total COGS', key: 'total_cogs' },
    { header: 'Expected Items', key: 'expected_items' },
    { header: 'Received Items', key: 'received_items' },
    { header: 'Completed Items', key: 'completed_items' },
    { header: 'Status', key: 'status' },
    { header: 'Warehouse', key: 'warehouse_id' },
    { header: 'Received At', key: 'received_at' },
    { header: 'Completed At', key: 'completed_at' },
    { header: 'Notes', key: 'notes' },
  ],
  certificates: [
    { header: 'Certificate Number', key: 'certificate_number' },
    { header: 'QLID', key: 'qlid' },
    { header: 'Manufacturer', key: 'manufacturer' },
    { header: 'Model', key: 'model' },
    { header: 'Serial Number', key: 'serial_number' },
    { header: 'IMEI', key: 'imei' },
    { header: 'Storage Type', key: 'storage_type' },
    { header: 'Storage Capacity', key: 'storage_capacity' },
    { header: 'Wipe Method', key: 'wipe_method' },
    { header: 'Wipe Started', key: 'wipe_started_at' },
    { header: 'Wipe Completed', key: 'wipe_completed_at' },
    { header: 'Verification Method', key: 'verification_method' },
    { header: 'Verification Passed', key: 'verification_passed' },
    { header: 'Technician', key: 'technician_name' },
    { header: 'Verification Code', key: 'verification_code' },
    { header: 'Notes', key: 'notes' },
    { header: 'Created At', key: 'created_at' },
  ],
  grading: [
    { header: 'QLID', key: 'qlid' },
    { header: 'Category', key: 'category' },
    { header: 'Cosmetic Score', key: 'cosmetic_score' },
    { header: 'Functional Score', key: 'functional_score' },
    { header: 'Overall Score', key: 'overall_score' },
    { header: 'Calculated Grade', key: 'calculated_grade' },
    { header: 'Final Grade', key: 'final_grade' },
    { header: 'Override Reason', key: 'override_reason' },
    { header: 'Assessed By', key: 'assessed_by' },
    { header: 'Assessed At', key: 'assessed_at' },
  ],
  parts_usage: [
    { header: 'QLID', key: 'qlid' },
    { header: 'Part SKU', key: 'part_sku' },
    { header: 'Part Name', key: 'part_name' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Unit Cost', key: 'unit_cost' },
    { header: 'Total Cost', key: 'total_cost' },
    { header: 'Reason', key: 'reason' },
    { header: 'Used By', key: 'used_by' },
    { header: 'Used At', key: 'used_at' },
  ],
  labor: [
    { header: 'QLID', key: 'qlid' },
    { header: 'Technician ID', key: 'technician_id' },
    { header: 'Technician Name', key: 'technician_name' },
    { header: 'Stage', key: 'stage' },
    { header: 'Task Type', key: 'task_type' },
    { header: 'Start Time', key: 'start_time' },
    { header: 'End Time', key: 'end_time' },
    { header: 'Duration (min)', key: 'duration_minutes' },
    { header: 'Labor Rate', key: 'labor_rate' },
    { header: 'Labor Cost', key: 'labor_cost' },
    { header: 'Notes', key: 'notes' },
  ],
  costs: [
    { header: 'QLID', key: 'qlid' },
    { header: 'Unit COGS', key: 'unit_cogs' },
    { header: 'Parts Cost', key: 'parts_cost' },
    { header: 'Labor Cost', key: 'labor_cost' },
    { header: 'Overhead Cost', key: 'overhead_cost' },
    { header: 'Total Cost', key: 'total_cost' },
    { header: 'Estimated Value', key: 'estimated_value' },
    { header: 'Profit Margin %', key: 'profit_margin' },
    { header: 'Last Calculated', key: 'last_calculated_at' },
  ],
};

// ==================== HELPER FUNCTIONS ====================

async function ensureExportsDir(subdir?: string): Promise<string> {
  const dir = subdir ? path.join(EXPORTS_DIR, subdir) : EXPORTS_DIR;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function generateExportFilename(type: ExportType, format: ExportFormat, batchNum: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${type}_batch${batchNum.toString().padStart(3, '0')}_${timestamp}.${format}`;
}

function buildWhereClause(filters?: ExportOptions['filters']): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }
  if (filters?.palletId) {
    conditions.push(`pallet_id = $${paramIndex++}`);
    params.push(filters.palletId);
  }
  if (filters?.stage) {
    conditions.push(`current_stage = $${paramIndex++}`);
    params.push(filters.stage);
  }
  if (filters?.grade) {
    conditions.push(`final_grade = $${paramIndex++}`);
    params.push(filters.grade);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

// ==================== DATA FETCHERS ====================

async function fetchItems(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM refurb_items
    ${clause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function fetchPallets(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM refurb_pallets
    ${clause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function fetchCertificates(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM data_wipe_certificates
    ${clause.replace('pallet_id', 'qlid').replace('current_stage', 'wipe_method').replace('final_grade', 'verification_method')}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  // Parse device_info JSON and flatten
  return result.rows.map(row => {
    const deviceInfo = typeof row.device_info === 'string'
      ? JSON.parse(row.device_info)
      : row.device_info || {};
    return {
      ...row,
      manufacturer: deviceInfo.manufacturer || '',
      model: deviceInfo.model || '',
      serial_number: deviceInfo.serialNumber || '',
      imei: deviceInfo.imei || '',
      storage_type: deviceInfo.storageType || '',
      storage_capacity: deviceInfo.storageCapacity || '',
    };
  });
}

async function fetchGrading(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM grading_assessments
    ${clause.replace('pallet_id', 'qlid').replace('current_stage', 'category')}
    ORDER BY assessed_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function fetchPartsUsage(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM parts_usage
    ${clause.replace('pallet_id', 'qlid').replace('current_stage', 'part_sku')}
    ORDER BY used_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function fetchLabor(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM labor_entries
    ${clause.replace('pallet_id', 'qlid').replace('current_stage', 'stage')}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function fetchCosts(offset: number, limit: number, filters?: ExportOptions['filters']): Promise<any[]> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const result = await db.query(`
    SELECT * FROM refurb_costs
    ${clause.replace('pallet_id', 'qlid')}
    ORDER BY last_calculated_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  return result.rows;
}

async function getTotalCount(type: ExportType, filters?: ExportOptions['filters']): Promise<number> {
  const db = getPool();
  const { clause, params } = buildWhereClause(filters);

  const tableMap: Record<ExportType, string> = {
    items: 'refurb_items',
    pallets: 'refurb_pallets',
    certificates: 'data_wipe_certificates',
    grading: 'grading_assessments',
    parts_usage: 'parts_usage',
    labor: 'labor_entries',
    costs: 'refurb_costs',
    full_report: 'refurb_items',
  };

  const table = tableMap[type];
  const adjustedClause = type === 'certificates'
    ? clause.replace('pallet_id', 'qlid').replace('current_stage', 'wipe_method')
    : type === 'grading'
    ? clause.replace('pallet_id', 'qlid').replace('current_stage', 'category')
    : type === 'parts_usage' || type === 'labor' || type === 'costs'
    ? clause.replace('pallet_id', 'qlid')
    : clause;

  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${table} ${adjustedClause}`,
    params
  );

  return parseInt(result.rows[0].count);
}

// ==================== EXPORT WRITERS ====================

async function writeCSVBatch(
  data: any[],
  columns: { header: string; key: string }[],
  filepath: string
): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: columns.map(c => ({ id: c.key, title: c.header }))
  });

  await csvWriter.writeRecords(data);
}

async function writeXLSXBatch(
  data: any[],
  columns: { header: string; key: string }[],
  filepath: string,
  sheetName: string = 'Data'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QuickRefurbz';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  // Set up columns
  worksheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: 15
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFD700' } // Gold color for QuickRefurbz branding
  };

  // Add data rows
  data.forEach(row => {
    const rowData: Record<string, any> = {};
    columns.forEach(c => {
      rowData[c.key] = row[c.key] ?? '';
    });
    worksheet.addRow(rowData);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (column.values) {
      const maxLength = column.values.reduce((max: number, val: any) => {
        const len = val ? String(val).length : 0;
        return Math.max(max, len);
      }, 10);
      column.width = Math.min(maxLength + 2, 50);
    }
  });

  await workbook.xlsx.writeFile(filepath);
}

// ==================== PUBLIC API ====================

/**
 * Export data in batches of 50 to CSV or XLSX files
 */
export async function exportBatch(options: ExportOptions): Promise<ExportResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const exportId = generateUUID();

  // Create export directory with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const exportDir = await ensureExportsDir(`${options.type}_${timestamp}_${exportId.slice(0, 8)}`);

  const files: string[] = [];
  let totalRecords = 0;
  let batchNum = 0;

  // Get total count for progress tracking
  const total = await getTotalCount(options.type, options.filters);

  if (total === 0) {
    return {
      id: exportId,
      type: options.type,
      format: options.format,
      totalRecords: 0,
      batchCount: 0,
      files: [],
      exportedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    };
  }

  // Get the appropriate fetcher and columns
  const fetchers: Record<ExportType, (offset: number, limit: number, filters?: ExportOptions['filters']) => Promise<any[]>> = {
    items: fetchItems,
    pallets: fetchPallets,
    certificates: fetchCertificates,
    grading: fetchGrading,
    parts_usage: fetchPartsUsage,
    labor: fetchLabor,
    costs: fetchCosts,
    full_report: fetchItems, // Full report uses items as base
  };

  const columns = COLUMN_DEFS[options.type === 'full_report' ? 'items' : options.type];
  const fetcher = fetchers[options.type];

  // Process in batches
  let offset = 0;
  while (offset < total) {
    batchNum++;
    const data = await fetcher(offset, batchSize, options.filters);

    if (data.length === 0) break;

    const filename = generateExportFilename(options.type, options.format, batchNum);
    const filepath = path.join(exportDir, filename);

    if (options.format === 'csv') {
      await writeCSVBatch(data, columns, filepath);
    } else {
      await writeXLSXBatch(data, columns, filepath, `${options.type} Batch ${batchNum}`);
    }

    files.push(filepath);
    totalRecords += data.length;
    offset += batchSize;
  }

  return {
    id: exportId,
    type: options.type,
    format: options.format,
    totalRecords,
    batchCount: batchNum,
    files,
    exportedAt: new Date().toISOString(),
    duration: Date.now() - startTime
  };
}

/**
 * Export all data types to a single XLSX workbook with multiple sheets
 */
export async function exportFullReport(options: Omit<ExportOptions, 'type'>): Promise<ExportResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const exportId = generateUUID();

  const timestamp = new Date().toISOString().slice(0, 10);
  const exportDir = await ensureExportsDir(`full_report_${timestamp}_${exportId.slice(0, 8)}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QuickRefurbz';
  workbook.created = new Date();

  const types: ColumnExportType[] = ['items', 'pallets', 'certificates', 'grading', 'parts_usage', 'labor', 'costs'];
  const sheetNames: Record<ColumnExportType, string> = {
    items: 'Items',
    pallets: 'Pallets',
    certificates: 'Wipe Certificates',
    grading: 'Grading',
    parts_usage: 'Parts Usage',
    labor: 'Labor',
    costs: 'Costs'
  };

  let totalRecords = 0;
  const files: string[] = [];

  for (const type of types) {
    const columns = COLUMN_DEFS[type];
    const total = await getTotalCount(type, options.filters);

    if (total === 0) continue;

    const worksheet = workbook.addWorksheet(sheetNames[type]);

    // Set up columns
    worksheet.columns = columns.map((c: ColumnDef) => ({
      header: c.header,
      key: c.key,
      width: 15
    }));

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' }
    };

    // Fetch all data in batches and add to worksheet
    let offset = 0;
    const fetchers: Record<string, (offset: number, limit: number, filters?: ExportOptions['filters']) => Promise<any[]>> = {
      items: fetchItems,
      pallets: fetchPallets,
      certificates: fetchCertificates,
      grading: fetchGrading,
      parts_usage: fetchPartsUsage,
      labor: fetchLabor,
      costs: fetchCosts,
    };

    while (offset < total) {
      const data = await fetchers[type](offset, batchSize, options.filters);
      if (data.length === 0) break;

      data.forEach(row => {
        const rowData: Record<string, any> = {};
        columns.forEach((c: ColumnDef) => {
          rowData[c.key] = row[c.key] ?? '';
        });
        worksheet.addRow(rowData);
      });

      totalRecords += data.length;
      offset += batchSize;
    }
  }

  // Save workbook
  const filename = `full_report_${timestamp}.xlsx`;
  const filepath = path.join(exportDir, filename);
  await workbook.xlsx.writeFile(filepath);
  files.push(filepath);

  // Also create individual CSVs for each type
  for (const type of types) {
    const columns = COLUMN_DEFS[type];
    const total = await getTotalCount(type, options.filters);

    if (total === 0) continue;

    let offset = 0;
    let batchNum = 0;
    const fetchers: Record<string, (offset: number, limit: number, filters?: ExportOptions['filters']) => Promise<any[]>> = {
      items: fetchItems,
      pallets: fetchPallets,
      certificates: fetchCertificates,
      grading: fetchGrading,
      parts_usage: fetchPartsUsage,
      labor: fetchLabor,
      costs: fetchCosts,
    };

    while (offset < total) {
      batchNum++;
      const data = await fetchers[type](offset, batchSize, options.filters);
      if (data.length === 0) break;

      const csvFilename = generateExportFilename(type, 'csv', batchNum);
      const csvFilepath = path.join(exportDir, csvFilename);
      await writeCSVBatch(data, columns, csvFilepath);
      files.push(csvFilepath);

      offset += batchSize;
    }
  }

  return {
    id: exportId,
    type: 'full_report',
    format: 'xlsx',
    totalRecords,
    batchCount: files.length,
    files,
    exportedAt: new Date().toISOString(),
    duration: Date.now() - startTime
  };
}

/**
 * Get list of available exports
 */
export async function listExports(): Promise<Array<{ name: string; path: string; createdAt: Date }>> {
  await ensureExportsDir();

  const entries = await fs.readdir(EXPORTS_DIR, { withFileTypes: true });
  const exports: Array<{ name: string; path: string; createdAt: Date }> = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirPath = path.join(EXPORTS_DIR, entry.name);
      const stat = await fs.stat(dirPath);
      exports.push({
        name: entry.name,
        path: dirPath,
        createdAt: stat.birthtime
      });
    }
  }

  return exports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get files in an export directory
 */
export async function getExportFiles(exportName: string): Promise<string[]> {
  const dirPath = path.join(EXPORTS_DIR, exportName);

  try {
    const files = await fs.readdir(dirPath);
    return files.map(f => path.join(dirPath, f));
  } catch {
    return [];
  }
}

/**
 * Delete an export directory
 */
export async function deleteExport(exportName: string): Promise<boolean> {
  const dirPath = path.join(EXPORTS_DIR, exportName);

  try {
    await fs.rm(dirPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get export statistics
 */
export async function getExportStats(): Promise<{
  totalExports: number;
  totalSize: number;
  byType: Record<string, number>;
}> {
  const exports = await listExports();
  let totalSize = 0;
  const byType: Record<string, number> = {};

  for (const exp of exports) {
    const files = await fs.readdir(exp.path);
    for (const file of files) {
      const stat = await fs.stat(path.join(exp.path, file));
      totalSize += stat.size;
    }

    // Extract type from directory name
    const typeMatch = exp.name.match(/^(items|pallets|certificates|grading|parts_usage|labor|costs|full_report)/);
    if (typeMatch) {
      byType[typeMatch[1]] = (byType[typeMatch[1]] || 0) + 1;
    }
  }

  return {
    totalExports: exports.length,
    totalSize,
    byType
  };
}
