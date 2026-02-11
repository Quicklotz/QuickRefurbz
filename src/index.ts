#!/usr/bin/env node
/**
 * QuickRefurbz CLI
 * Refurbishment tracking with QLID identity
 *
 * Part of QuickWMS - Works seamlessly with QuickIntakez
 *
 * QLID: Globally unique identifier for every unit
 * Barcode: {PalletID}-{QLID} (e.g., P1BBY-QLID000000001)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  initializeDatabase,
  closePool
} from './database.js';
import {
  receiveItem,
  scanItem,
  getItem,
  listItems,
  advanceStage,
  getStageHistory,
  getItemStats
} from './itemManager.js';
import {
  getRetailerFromPalletId
} from './types.js';
import {
  addTechnician,
  listTechnicians,
  getTechnicianById,
  getTechnicianWorkload,
  getAllWorkloads
} from './technicianManager.js';
import {
  createTicket,
  listTickets,
  resolveTicket,
  getTicketStats
} from './ticketManager.js';
import {
  addPart,
  listParts,
  adjustInventory,
  getPartsStats
} from './partsInventory.js';
import {
  createPallet,
  getPalletById,
  listPallets,
  getPalletItems,
  getPalletStats
} from './palletManager.js';
import { printLabelPreview } from './labelGenerator.js';
import {
  STAGE_DISPLAY,
  CATEGORY_DISPLAY,
  GRADE_DISPLAY,
  SEVERITY_DISPLAY,
  PRIORITY_DISPLAY,
  RETAILER_CODE_DISPLAY,
  RETAILER_DISPLAY,
  SOURCE_DISPLAY
} from './types.js';
import type { ProductCategory, JobPriority, IssueSeverity, FinalGrade, PartCategory, Retailer, LiquidationSource } from './types.js';

const program = new Command();

program
  .name('qr')
  .description('QuickRefurbz - Refurbishment tracking CLI with QLID identity')
  .version('2.0.0');

// ==================== DATABASE INIT ====================

program
  .command('init')
  .description('Initialize database (create tables and sequences)')
  .action(async () => {
    try {
      await initializeDatabase();
      console.log(chalk.green('Database initialized successfully'));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    } finally {
      await closePool();
    }
  });

// ==================== PALLET COMMANDS ====================

const palletCmd = program.command('pallet').description('Pallet management');

palletCmd
  .command('create')
  .description('Create a new pallet')
  .requiredOption('-r, --retailer <retailer>', 'Retailer (BESTBUY, TARGET, AMAZON, WALMART, etc.)')
  .requiredOption('-s, --source <source>', 'Liquidation source (QUICKLOTZ, BSTOCK, DIRECTLIQUIDATION, etc.)')
  .option('-i, --source-id <id>', 'Source pallet ID (e.g., PTRF70336)')
  .option('-o, --order-id <id>', 'Source order/invoice ID')
  .option('-c, --cogs <amount>', 'Total COGS for pallet')
  .option('-e, --expected <count>', 'Expected item count')
  .option('-w, --warehouse <id>', 'Warehouse ID')
  .option('-n, --notes <notes>', 'Notes')
  .action(async (opts) => {
    try {
      const pallet = await createPallet({
        retailer: opts.retailer.toUpperCase() as Retailer,
        liquidationSource: opts.source.toUpperCase() as LiquidationSource,
        sourcePalletId: opts.sourceId,
        sourceOrderId: opts.orderId,
        totalCogs: opts.cogs ? parseFloat(opts.cogs) : 0,
        expectedItems: opts.expected ? parseInt(opts.expected) : 0,
        warehouseId: opts.warehouse,
        notes: opts.notes
      });

      console.log(chalk.green(`\n✓ Pallet created: ${pallet.palletId}`));
      console.log(`  Retailer: ${RETAILER_DISPLAY[pallet.retailer]}`);
      console.log(`  Source: ${SOURCE_DISPLAY[pallet.liquidationSource]}`);
      if (pallet.sourcePalletId) {
        console.log(`  Source Pallet: ${pallet.sourcePalletId}`);
      }
      if (pallet.totalCogs > 0) {
        console.log(`  COGS: $${pallet.totalCogs.toFixed(2)}`);
      }
      console.log(`  Status: ${pallet.status}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

palletCmd
  .command('show <palletId>')
  .description('Show pallet details with items')
  .action(async (palletId) => {
    try {
      const pallet = await getPalletById(palletId);
      if (!pallet) {
        console.error(chalk.red(`Pallet not found: ${palletId}`));
        return;
      }

      console.log(chalk.bold(`\nPallet: ${pallet.palletId}\n`));
      console.log(`  Retailer: ${RETAILER_DISPLAY[pallet.retailer]}`);
      console.log(`  Source: ${SOURCE_DISPLAY[pallet.liquidationSource]}`);
      if (pallet.sourcePalletId) {
        console.log(`  Source Pallet: ${pallet.sourcePalletId}`);
      }
      if (pallet.sourceOrderId) {
        console.log(`  Order ID: ${pallet.sourceOrderId}`);
      }
      console.log(`  Status: ${pallet.status}`);
      console.log(`  COGS: $${pallet.totalCogs.toFixed(2)}`);
      console.log(`  Items: ${pallet.receivedItems}/${pallet.expectedItems} received, ${pallet.completedItems} completed`);
      console.log(`  Received: ${pallet.receivedAt.toLocaleDateString()}`);

      // Get items
      const items = await getPalletItems(pallet.palletId);
      if (items.length > 0) {
        console.log(chalk.yellow(`\nItems (${items.length}):`));
        for (const item of items) {
          console.log(`  ${chalk.cyan(item.qlid)} - ${item.manufacturer} ${item.model} [${STAGE_DISPLAY[item.stage as keyof typeof STAGE_DISPLAY]}]`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

palletCmd
  .command('list')
  .description('List pallets')
  .option('-s, --status <status>', 'Filter by status (RECEIVING, IN_PROGRESS, COMPLETE)')
  .option('-r, --retailer <retailer>', 'Filter by retailer')
  .option('-o, --source <source>', 'Filter by liquidation source')
  .option('-l, --limit <n>', 'Limit results')
  .action(async (opts) => {
    try {
      const pallets = await listPallets({
        status: opts.status?.toUpperCase(),
        retailer: opts.retailer?.toUpperCase(),
        source: opts.source?.toUpperCase(),
        limit: opts.limit ? parseInt(opts.limit) : undefined
      });

      console.log(chalk.bold(`\nPallets (${pallets.length}):\n`));

      for (const p of pallets) {
        const statusColor = p.status === 'COMPLETE' ? chalk.green : p.status === 'IN_PROGRESS' ? chalk.yellow : chalk.blue;
        console.log(`${chalk.cyan(p.palletId)} - ${RETAILER_DISPLAY[p.retailer]} via ${SOURCE_DISPLAY[p.liquidationSource]}`);
        console.log(`  Status: ${statusColor(p.status)} | Items: ${p.receivedItems}/${p.expectedItems} | COGS: $${p.totalCogs.toFixed(2)}`);
        if (p.sourcePalletId) {
          console.log(`  Source: ${p.sourcePalletId}`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== ITEM COMMANDS ====================

const itemCmd = program.command('item').description('Item management');

// Primary workflow: Scan barcode from QuickIntakez
itemCmd
  .command('scan <barcode>')
  .description('Scan item barcode from QuickIntakez to start refurbishment (P1BBY-QLID000000001)')
  .requiredOption('-e, --employee <id>', 'Employee ID')
  .requiredOption('-w, --warehouse <id>', 'Warehouse ID')
  .action(async (barcode, opts) => {
    try {
      const result = await scanItem({
        barcode,
        employeeId: opts.employee,
        warehouseId: opts.warehouse
      });

      const item = result.item;
      const retailer = getRetailerFromPalletId(item.palletId);

      if (result.isNew) {
        console.log(chalk.green(`\n✓ Item scanned and added to refurb: ${item.qlid}`));
        console.log(chalk.dim(`  (Imported from QuickIntakez)`));
      } else {
        console.log(chalk.green(`\n✓ Item found: ${item.qlid}`));
        console.log(chalk.dim(`  (Already in refurb tracking)`));
      }

      console.log(`  Barcode: ${chalk.cyan(item.barcodeValue)}`);
      console.log(`  Pallet: ${item.palletId} (${RETAILER_DISPLAY[retailer] || retailer})`);
      console.log(`  ${item.manufacturer} ${item.model}`);
      console.log(`  Category: ${item.category ? CATEGORY_DISPLAY[item.category] : 'Uncategorized'}`);
      console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]}`);

      console.log(`\nAdvance with: ${chalk.cyan(`qr item advance ${item.qlid}`)}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// Manual receive (for items not in QuickIntakez)
itemCmd
  .command('receive')
  .description('Manually receive a new item (allocates QLID) - use "scan" for QuickIntakez items')
  .requiredOption('-p, --pallet <palletId>', 'Internal Pallet ID (e.g., P1BBY)')
  .requiredOption('-m, --manufacturer <name>', 'Manufacturer')
  .requiredOption('-o, --model <name>', 'Model')
  .requiredOption('-c, --category <cat>', 'Category (PHONE, TABLET, LAPTOP, etc.)')
  .requiredOption('-e, --employee <id>', 'Employee ID (who is intaking)')
  .requiredOption('-w, --warehouse <id>', 'Warehouse ID')
  .option('-r, --priority <priority>', 'Priority (LOW, NORMAL, HIGH, URGENT)')
  .option('-s, --serial <serial>', 'Serial number')
  .option('-n, --notes <notes>', 'Notes')
  .action(async (opts) => {
    try {
      const result = await receiveItem({
        palletId: opts.pallet,
        manufacturer: opts.manufacturer,
        model: opts.model,
        category: opts.category?.toUpperCase() as ProductCategory,
        employeeId: opts.employee,
        warehouseId: opts.warehouse,
        priority: opts.priority?.toUpperCase() as JobPriority,
        serialNumber: opts.serial,
        notes: opts.notes
      });

      const item = result.item;
      const retailer = getRetailerFromPalletId(item.palletId);

      console.log(chalk.green(`\n✓ Item received: ${item.qlid}`));
      console.log(`  Barcode: ${chalk.cyan(item.barcodeValue)}`);
      console.log(`  Pallet: ${item.palletId} (${RETAILER_DISPLAY[retailer] || retailer})`);
      console.log(`  ${item.manufacturer} ${item.model}`);
      console.log(`  Category: ${item.category ? CATEGORY_DISPLAY[item.category] : 'Uncategorized'}`);
      console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]}`);

      console.log(chalk.yellow('\nLabel Preview:'));
      printLabelPreview(result.labelData);

      console.log(`\nAdvance with: ${chalk.cyan(`qr item advance ${item.qlid}`)}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

itemCmd
  .command('show <identifier>')
  .description('Show item details (accepts QLID or barcode)')
  .action(async (identifier) => {
    try {
      const item = await getItem(identifier);
      if (!item) {
        console.error(chalk.red(`Item not found: ${identifier}`));
        return;
      }

      const retailer = getRetailerFromPalletId(item.palletId);

      console.log(chalk.bold(`\nItem: ${item.qlid}\n`));
      console.log(`  Barcode: ${chalk.cyan(item.barcodeValue)}`);
      console.log(`  Pallet: ${item.palletId} (${RETAILER_DISPLAY[retailer]})`);
      console.log(`  Product: ${item.manufacturer} ${item.model}`);
      console.log(`  Category: ${item.category ? CATEGORY_DISPLAY[item.category] : 'Uncategorized'}`);
      console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]}`);
      console.log(`  Priority: ${PRIORITY_DISPLAY[item.priority]}`);

      if (item.serialNumber) {
        console.log(`  Serial: ${item.serialNumber}`);
      }

      if (item.finalGrade) {
        console.log(`  Grade: ${GRADE_DISPLAY[item.finalGrade]}`);
      }

      if (item.estimatedValue) {
        console.log(`  Est. Value: $${item.estimatedValue}`);
      }

      if (item.nextWorkflow) {
        console.log(`  Next: ${item.nextWorkflow}`);
      }

      console.log(`  Intake: ${item.intakeTs.toISOString()}`);
      console.log(`  Employee: ${item.intakeEmployeeId}`);
      console.log(`  Warehouse: ${item.warehouseId}`);

      // Stage history
      const history = await getStageHistory(item.qlid);
      if (history.length > 0) {
        console.log(chalk.bold('\nStage History:'));
        for (const h of history) {
          const from = h.fromStage ? STAGE_DISPLAY[h.fromStage] : 'New';
          const to = STAGE_DISPLAY[h.toStage];
          const date = h.createdAt.toISOString().split('T')[0];
          console.log(`  ${from} → ${to} (${date})`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

itemCmd
  .command('list')
  .description('List items')
  .option('-p, --pallet <palletId>', 'Filter by pallet')
  .option('-s, --stage <stage>', 'Filter by stage')
  .option('-c, --category <category>', 'Filter by category')
  .option('-w, --warehouse <id>', 'Filter by warehouse')
  .option('-l, --limit <n>', 'Limit results')
  .action(async (opts) => {
    try {
      const items = await listItems({
        palletId: opts.pallet,
        stage: opts.stage?.toUpperCase(),
        category: opts.category?.toUpperCase(),
        warehouseId: opts.warehouse,
        limit: opts.limit ? parseInt(opts.limit) : undefined
      });

      console.log(chalk.bold(`\nItems (${items.length}):\n`));

      for (const item of items) {
        console.log(`${chalk.cyan(item.qlid)} - ${item.manufacturer} ${item.model}`);
        console.log(`  Barcode: ${item.barcodeValue}`);
        console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]} | Category: ${item.category ? CATEGORY_DISPLAY[item.category] : 'Uncategorized'} | Priority: ${item.priority}\n`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

itemCmd
  .command('advance <identifier>')
  .description('Advance item to next stage')
  .option('-t, --technician <id>', 'Technician ID or name')
  .option('-n, --notes <notes>', 'Notes')
  .option('-s, --serial <serial>', 'Serial number (for testing stage)')
  .option('-g, --grade <grade>', 'Final grade (A, B, C, D, F, SALVAGE)')
  .option('-v, --value <value>', 'Estimated value')
  .option('-w, --workflow <name>', 'Next workflow (QuickListingz, QuickSalvage, etc.)')
  .action(async (identifier, opts) => {
    try {
      const item = await advanceStage(identifier, {
        technicianId: opts.technician,
        notes: opts.notes,
        serialNumber: opts.serial,
        finalGrade: opts.grade as FinalGrade,
        estimatedValue: opts.value ? parseFloat(opts.value) : undefined,
        nextWorkflow: opts.workflow
      });

      console.log(chalk.green(`✓ ${item.qlid} advanced to ${STAGE_DISPLAY[item.currentStage]}`));

      if (item.currentStage === 'COMPLETE') {
        console.log(chalk.green('  Item complete! Ready for next workflow.'));
        if (item.finalGrade) {
          console.log(`  Grade: ${GRADE_DISPLAY[item.finalGrade]}`);
        }
        if (item.nextWorkflow) {
          console.log(`  Next: ${item.nextWorkflow}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

itemCmd
  .command('assign <identifier>')
  .description('Assign technician to item')
  .requiredOption('-t, --technician <id>', 'Technician ID or name')
  .action(async (identifier, opts) => {
    try {
      const item = await getItem(identifier);
      if (!item) {
        console.error(chalk.red(`Item not found: ${identifier}`));
        return;
      }

      // Update item with technician assignment
      const db = await import('./database.js');
      const pool = db.getPool();
      await pool.query(
        'UPDATE refurb_items SET assigned_technician_id = $1, updated_at = datetime(\'now\') WHERE qlid = $2',
        [opts.technician, item.qlid]
      );

      console.log(chalk.green(`✓ ${item.qlid} assigned to technician ${opts.technician}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== TECHNICIAN COMMANDS ====================

const techCmd = program.command('tech').description('Technician management');

techCmd
  .command('add')
  .description('Add a new technician')
  .requiredOption('-i, --id <employeeId>', 'Employee ID')
  .requiredOption('-n, --name <name>', 'Full name')
  .option('-s, --specialties <list>', 'Comma-separated specialties')
  .action(async (opts) => {
    try {
      const specialties = opts.specialties
        ? opts.specialties.split(',').map((s: string) => s.trim().toUpperCase())
        : [];

      const tech = await addTechnician({
        employeeId: opts.id,
        name: opts.name,
        specialties: specialties as ProductCategory[]
      });

      console.log(chalk.green(`\n✓ Technician added: ${tech.employeeId} - ${tech.name}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

techCmd
  .command('list')
  .description('List technicians')
  .action(async () => {
    try {
      const technicians = await listTechnicians();

      console.log(chalk.bold(`\nTechnicians (${technicians.length}):\n`));

      for (const t of technicians) {
        const status = t.isActive ? chalk.green('[Active]') : chalk.red('[Inactive]');
        console.log(`${t.employeeId} - ${t.name} ${status}`);
        if (t.specialties.length > 0) {
          console.log(`  Specialties: ${t.specialties.map(s => CATEGORY_DISPLAY[s]).join(', ')}`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

techCmd
  .command('workload [technicianId]')
  .description('Show technician workload')
  .action(async (technicianId) => {
    try {
      if (technicianId) {
        const workload = await getTechnicianWorkload(technicianId);
        if (!workload) {
          console.error(chalk.red(`Technician not found: ${technicianId}`));
          return;
        }
        console.log(chalk.bold(`\nWorkload for ${workload.technician.name}:\n`));
        console.log(`  Assigned Items: ${workload.assignedItems}`);
        console.log(`  Open Tickets: ${workload.openTickets}`);
        console.log(`  Completed Today: ${workload.completedToday}`);
      } else {
        const workloads = await getAllWorkloads();
        console.log(chalk.bold(`\nTeam Workload:\n`));
        for (const w of workloads) {
          console.log(`${w.technician.name}: ${w.assignedItems} items, ${w.openTickets} tickets, ${w.completedToday} done today`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== TICKET COMMANDS ====================

const ticketCmd = program.command('ticket').description('Repair ticket management');

ticketCmd
  .command('create <identifier>')
  .description('Create a repair ticket (accepts QLID or barcode)')
  .requiredOption('-i, --issue <type>', 'Issue type')
  .requiredOption('-d, --description <desc>', 'Issue description')
  .requiredOption('-v, --severity <sev>', 'Severity (CRITICAL, MAJOR, MINOR, COSMETIC)')
  .requiredOption('-t, --technician <id>', 'Created by technician')
  .action(async (identifier, opts) => {
    try {
      const ticket = await createTicket({
        identifier,
        issueType: opts.issue,
        issueDescription: opts.description,
        severity: opts.severity.toUpperCase() as IssueSeverity,
        createdByTechnicianId: opts.technician
      });

      console.log(chalk.green(`\n✓ Ticket created: ${ticket.ticketNumber}`));
      console.log(`  QLID: ${ticket.qlid}`);
      console.log(`  Issue: ${ticket.issueType}`);
      console.log(`  Severity: ${SEVERITY_DISPLAY[ticket.severity]}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

ticketCmd
  .command('list')
  .description('List tickets')
  .option('-s, --status <status>', 'Filter by status')
  .option('-t, --technician <id>', 'Filter by technician')
  .action(async (opts) => {
    try {
      const tickets = await listTickets({
        status: opts.status,
        technicianId: opts.technician
      });

      console.log(chalk.bold(`\nTickets (${tickets.length}):\n`));

      for (const t of tickets) {
        console.log(`${chalk.cyan(t.ticketNumber)} - ${t.qlid}`);
        console.log(`  ${t.issueType}: ${t.issueDescription}`);
        console.log(`  Status: ${t.status} | Severity: ${SEVERITY_DISPLAY[t.severity]}\n`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

ticketCmd
  .command('resolve <ticketId>')
  .description('Resolve a ticket')
  .requiredOption('-a, --action <action>', 'Repair action taken')
  .requiredOption('-t, --technician <id>', 'Resolved by technician')
  .option('-n, --notes <notes>', 'Repair notes')
  .action(async (ticketId, opts) => {
    try {
      await resolveTicket(ticketId, {
        repairAction: opts.action,
        resolvedByTechnicianId: opts.technician,
        repairNotes: opts.notes
      });

      console.log(chalk.green(`✓ Ticket ${ticketId} resolved`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

ticketCmd
  .command('show <ticketId>')
  .description('Show ticket details')
  .action(async (ticketId) => {
    try {
      const { getTicketById } = await import('./ticketManager.js');
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        console.error(chalk.red(`Ticket not found: ${ticketId}`));
        return;
      }

      console.log(chalk.bold(`\nTicket: ${ticket.ticketNumber}\n`));
      console.log(`  QLID: ${ticket.qlid}`);
      console.log(`  Issue: ${ticket.issueType}`);
      console.log(`  Description: ${ticket.issueDescription}`);
      console.log(`  Severity: ${SEVERITY_DISPLAY[ticket.severity]}`);
      console.log(`  Status: ${ticket.status}`);
      console.log(`  Created: ${ticket.createdAt.toLocaleString()}`);

      if (ticket.repairAction) {
        console.log(chalk.yellow('\nRepair:'));
        console.log(`  Action: ${ticket.repairAction}`);
        if (ticket.repairNotes) {
          console.log(`  Notes: ${ticket.repairNotes}`);
        }
      }

      if (ticket.resolvedAt) {
        console.log(`  Resolved: ${ticket.resolvedAt.toLocaleString()}`);
      }

      // Show parts used for this ticket
      const { getPartsUsageForItem } = await import('./partsInventory.js');
      const partsUsage = await getPartsUsageForItem(ticket.qlid);
      const ticketParts = partsUsage.filter(p => p.ticketId === ticket.id);
      if (ticketParts.length > 0) {
        console.log(chalk.yellow('\nParts Used:'));
        for (const part of ticketParts) {
          console.log(`  ${part.partNumber}: ${part.partName} x${part.quantity} ($${part.totalCost.toFixed(2)})`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

ticketCmd
  .command('add-parts <ticketId>')
  .description('Add parts to a ticket')
  .requiredOption('-p, --part <partId>', 'Part ID or number')
  .requiredOption('-q, --quantity <qty>', 'Quantity used')
  .requiredOption('-t, --technician <id>', 'Technician ID')
  .option('-n, --notes <notes>', 'Notes')
  .action(async (ticketId, opts) => {
    try {
      const { getTicketById } = await import('./ticketManager.js');
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        console.error(chalk.red(`Ticket not found: ${ticketId}`));
        return;
      }

      const { useParts } = await import('./partsInventory.js');
      const usage = await useParts({
        identifier: ticket.qlid,
        ticketId: ticket.id,
        parts: [{
          partId: opts.part,
          quantity: parseInt(opts.quantity),
          notes: opts.notes
        }],
        technicianId: opts.technician
      });

      console.log(chalk.green(`✓ Parts added to ticket ${ticket.ticketNumber}`));
      for (const u of usage) {
        console.log(`  ${u.partNumber}: ${u.partName} x${u.quantity} ($${u.totalCost.toFixed(2)})`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== PARTS COMMANDS ====================

const partsCmd = program.command('parts').description('Parts inventory management');

partsCmd
  .command('add')
  .description('Add a new part type')
  .requiredOption('-p, --part <number>', 'Part number')
  .requiredOption('-n, --name <name>', 'Part name')
  .requiredOption('-c, --category <cat>', 'Category')
  .requiredOption('-u, --cost <cost>', 'Unit cost')
  .option('-q, --quantity <qty>', 'Initial quantity')
  .action(async (opts) => {
    try {
      const part = await addPart({
        partNumber: opts.part,
        name: opts.name,
        category: opts.category as PartCategory,
        unitCost: parseFloat(opts.cost),
        quantityOnHand: opts.quantity ? parseInt(opts.quantity) : 0
      });

      console.log(chalk.green(`\n✓ Part added: ${part.partNumber} - ${part.name}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

partsCmd
  .command('list')
  .description('List parts inventory')
  .option('--low-stock', 'Show only low stock items')
  .action(async (opts) => {
    try {
      const parts = await listParts({ lowStockOnly: opts.lowStock });

      console.log(chalk.bold(`\nParts Inventory (${parts.length}):\n`));

      for (const p of parts) {
        const stockStatus = p.quantityOnHand <= p.reorderPoint
          ? chalk.red(`${p.quantityOnHand} LOW`)
          : chalk.green(p.quantityOnHand.toString());
        console.log(`${p.partNumber} - ${p.name}`);
        console.log(`  Stock: ${stockStatus} | Cost: $${p.unitCost.toFixed(2)} | Category: ${p.category}\n`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

partsCmd
  .command('adjust <partId>')
  .description('Adjust part inventory')
  .requiredOption('-q, --quantity <adj>', 'Adjustment (+/- number)')
  .requiredOption('-r, --reason <reason>', 'Reason for adjustment')
  .action(async (partId, opts) => {
    try {
      const part = await adjustInventory(partId, {
        adjustment: parseInt(opts.quantity),
        reason: opts.reason
      });

      if (part) {
        console.log(chalk.green(`✓ ${part.partNumber} adjusted. New quantity: ${part.quantityOnHand}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== STATS COMMAND ====================

program
  .command('stats')
  .description('Show dashboard statistics')
  .option('--items', 'Show item stats')
  .option('--tickets', 'Show ticket stats')
  .option('--parts', 'Show parts stats')
  .action(async (opts) => {
    try {
      console.log(chalk.bold('\n📊 QuickRefurbz Dashboard\n'));

      const showAll = !opts.items && !opts.tickets && !opts.parts;

      if (showAll || opts.items) {
        const itemStats = await getItemStats();
        console.log(chalk.cyan('Items:'));
        console.log(`  Total: ${itemStats.total}`);
        console.log(`  Today Received: ${itemStats.todayReceived}`);
        console.log(`  Today Completed: ${itemStats.todayCompleted}`);
        console.log(`\nItems by Stage:`);
        for (const [stage, count] of Object.entries(itemStats.byStage)) {
          if (count > 0) {
            console.log(`  ${STAGE_DISPLAY[stage as keyof typeof STAGE_DISPLAY]}: ${count}`);
          }
        }
        console.log();
      }

      if (showAll || opts.tickets) {
        const ticketStats = await getTicketStats();
        console.log(chalk.cyan('Tickets:'));
        console.log(`  Total: ${ticketStats.total}`);
        console.log(`  Open: ${ticketStats.openCount}`);
        console.log(`  Resolved Today: ${ticketStats.resolvedToday}`);
        if (ticketStats.avgResolutionTimeMinutes > 0) {
          console.log(`  Avg Resolution: ${ticketStats.avgResolutionTimeMinutes} min`);
        }
        console.log();
      }

      if (showAll || opts.parts) {
        const partsStats = await getPartsStats();
        console.log(chalk.cyan('Parts:'));
        console.log(`  Total Types: ${partsStats.totalParts}`);
        console.log(`  Total Value: $${partsStats.totalValue.toFixed(2)}`);
        console.log(`  Low Stock: ${partsStats.lowStockCount}`);
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== DIAGNOSTICS COMMANDS (QuickDiagnosticz) ====================

import {
  startSession,
  getSession,
  getActiveSession,
  recordTestResult,
  completeSession,
  getSessionSummary,
  listSessions,
  getAllTestSuites,
  getTestSuite,
  getTestByCode,
  getTechnicianDiagnosticStats,
  getAllTechnicianDiagnosticStats,
} from './diagnostics/index.js';

import {
  issueCertification,
  getCertification,
  revokeCertification,
  listCertifications,
  getCertificationStats,
  verifyCertification,
  generateReportPdf,
  generateCertificationLabel,
  CERTIFICATION_LEVEL_DISPLAY,
} from './certification/index.js';

const diagCmd = program.command('diag').description('QuickDiagnosticz - Device diagnostics');

diagCmd
  .command('start <qlid>')
  .description('Start a diagnostic session for an item')
  .requiredOption('-c, --category <category>', 'Product category (APPLIANCE_SMALL, ICE_MAKER, VACUUM)')
  .requiredOption('-t, --technician <id>', 'Technician ID')
  .option('-n, --name <name>', 'Technician name')
  .option('-j, --job <jobId>', 'Link to refurb job')
  .action(async (qlid, opts) => {
    try {
      const { session, tests } = await startSession({
        qlid,
        category: opts.category.toUpperCase() as ProductCategory,
        technicianId: opts.technician,
        technicianName: opts.name,
        jobId: opts.job,
      });

      console.log(chalk.green(`\n✓ Diagnostic session started: ${session.sessionNumber}`));
      console.log(`  QLID: ${session.qlid}`);
      console.log(`  Category: ${CATEGORY_DISPLAY[session.category]}`);
      console.log(`  Total Tests: ${tests.length}`);
      console.log(chalk.yellow(`\nTests to perform:`));
      for (const test of tests) {
        const marker = test.isCritical ? chalk.red('*') : ' ';
        console.log(`  ${marker} ${test.code} - ${test.name}`);
      }
      console.log(chalk.gray(`\n* = Critical test (must pass for certification)`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('test <qlid> <testCode>')
  .description('Record a test result')
  .requiredOption('-r, --result <result>', 'Result (PASS, FAIL, SKIP)')
  .option('-m, --measurement <value>', 'Measurement value')
  .option('-n, --notes <notes>', 'Notes')
  .option('-t, --technician <id>', 'Technician ID')
  .action(async (qlid, testCode, opts) => {
    try {
      const session = await getActiveSession(qlid);
      if (!session) {
        console.error(chalk.red(`No active session found for: ${qlid}`));
        return;
      }

      const result = await recordTestResult(session.id, {
        sessionId: session.id,
        testId: testCode,
        testCode: testCode,
        result: opts.result.toUpperCase() as any,
        measurementValue: opts.measurement ? parseFloat(opts.measurement) : undefined,
        notes: opts.notes,
        testedBy: opts.technician || session.technicianId,
      });

      const color = result.result === 'PASS' ? chalk.green : result.result === 'FAIL' ? chalk.red : chalk.yellow;
      console.log(color(`\n✓ Test recorded: ${result.testCode} = ${result.result}`));
      if (result.measurementValue !== undefined) {
        console.log(`  Measurement: ${result.measurementValue}${result.measurementUnit || ''}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('complete <qlid>')
  .description('Complete a diagnostic session')
  .option('-n, --notes <notes>', 'Session notes')
  .action(async (qlid, opts) => {
    try {
      const session = await getActiveSession(qlid);
      if (!session) {
        console.error(chalk.red(`No active session found for: ${qlid}`));
        return;
      }

      const summary = await completeSession(session.id, {
        notes: opts.notes,
      });

      const resultColor = summary.session.overallResult === 'PASS' ? chalk.green :
        summary.session.overallResult === 'FAIL' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n✓ Session completed: ${summary.session.sessionNumber}`));
      console.log(`  Result: ${resultColor(summary.session.overallResult || 'N/A')}`);
      console.log(`  Pass Rate: ${summary.passRate.toFixed(1)}%`);
      console.log(`  Critical Failures: ${summary.criticalFailures}`);
      console.log(`  Can Certify: ${summary.canCertify ? chalk.green('Yes') : chalk.red('No')}`);
      if (summary.recommendedCertification) {
        console.log(`  Recommended Level: ${CERTIFICATION_LEVEL_DISPLAY[summary.recommendedCertification]}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('show <identifier>')
  .description('Show diagnostic session details')
  .action(async (identifier) => {
    try {
      const summary = await getSessionSummary(identifier);
      if (!summary) {
        console.error(chalk.red(`Session not found: ${identifier}`));
        return;
      }

      const s = summary.session;
      console.log(chalk.bold(`\nDiagnostic Session: ${s.sessionNumber}\n`));
      console.log(`  QLID: ${s.qlid}`);
      console.log(`  Category: ${CATEGORY_DISPLAY[s.category]}`);
      console.log(`  Technician: ${s.technicianName || s.technicianId}`);
      console.log(`  Status: ${s.completedAt ? 'Completed' : 'In Progress'}`);
      if (s.overallResult) {
        const color = s.overallResult === 'PASS' ? chalk.green : chalk.red;
        console.log(`  Result: ${color(s.overallResult)}`);
      }
      console.log(`  Tests: ${s.passedTests}/${s.totalTests} passed`);
      console.log(`  Pass Rate: ${summary.passRate.toFixed(1)}%`);

      if (summary.results.length > 0) {
        console.log(chalk.yellow(`\nTest Results:`));
        for (const r of summary.results) {
          const color = r.result === 'PASS' ? chalk.green : r.result === 'FAIL' ? chalk.red : chalk.gray;
          let line = `  ${color(r.result.padEnd(4))} ${r.testCode}`;
          if (r.measurementValue !== undefined) {
            line += ` = ${r.measurementValue}${r.measurementUnit || ''}`;
          }
          console.log(line);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('list')
  .description('List diagnostic sessions')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --technician <id>', 'Filter by technician')
  .option('-l, --limit <n>', 'Limit results', '25')
  .option('--completed', 'Include completed sessions')
  .action(async (opts) => {
    try {
      const sessions = await listSessions({
        category: opts.category?.toUpperCase() as ProductCategory,
        technicianId: opts.technician,
        limit: parseInt(opts.limit),
        includeCompleted: opts.completed,
      });

      console.log(chalk.bold(`\nDiagnostic Sessions (${sessions.length}):\n`));

      for (const s of sessions) {
        const status = s.completedAt ? s.overallResult || 'DONE' : 'IN PROGRESS';
        const statusColor = status === 'PASS' ? chalk.green :
          status === 'FAIL' ? chalk.red :
          status === 'IN PROGRESS' ? chalk.yellow : chalk.gray;

        console.log(`${chalk.cyan(s.sessionNumber)} - ${s.qlid} [${CATEGORY_DISPLAY[s.category]}]`);
        console.log(`  Status: ${statusColor(status)} | Tests: ${s.passedTests}/${s.totalTests}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('tests [category]')
  .description('Show available diagnostic tests')
  .action(async (category) => {
    try {
      if (category) {
        const suite = getTestSuite(category.toUpperCase() as ProductCategory);
        if (!suite) {
          console.error(chalk.red(`No tests defined for category: ${category}`));
          return;
        }

        console.log(chalk.bold(`\n${suite.categoryName} Tests (${suite.totalTestCount}):\n`));
        for (const test of suite.tests) {
          const marker = test.isCritical ? chalk.red('*') : ' ';
          console.log(`${marker} ${chalk.cyan(test.code)} - ${test.name}`);
          console.log(`    Type: ${test.testType} | ${test.isCritical ? 'CRITICAL' : 'Standard'}`);
        }
        console.log(chalk.gray(`\n* = Critical test`));
      } else {
        const suites = getAllTestSuites();
        console.log(chalk.bold(`\nAvailable Test Suites:\n`));
        for (const suite of suites) {
          console.log(`${chalk.cyan(suite.category)} - ${suite.categoryName}`);
          console.log(`  Tests: ${suite.totalTestCount} (${suite.criticalTestCount} critical)`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    }
  });

diagCmd
  .command('quick <qlid>')
  .description('Quick diagnostic - run all tests with default PASS results')
  .requiredOption('-c, --category <category>', 'Product category (APPLIANCE_SMALL, ICE_MAKER, VACUUM)')
  .requiredOption('-t, --technician <id>', 'Technician ID')
  .option('-n, --name <name>', 'Technician name')
  .option('--all-pass', 'Mark all tests as PASS (default)', true)
  .option('--interactive', 'Prompt for each critical test')
  .action(async (qlid, opts) => {
    try {
      // Start session
      const { session, tests } = await startSession({
        qlid,
        category: opts.category.toUpperCase() as ProductCategory,
        technicianId: opts.technician,
        technicianName: opts.name,
      });

      console.log(chalk.green(`\n✓ Quick diagnostic started: ${session.sessionNumber}`));
      console.log(`  Running ${tests.length} tests...`);

      // Record all tests as PASS
      let passed = 0;
      for (const test of tests) {
        await recordTestResult(session.id, {
          sessionId: session.id,
          testId: test.code,
          testCode: test.code,
          result: 'PASS',
          testedBy: opts.technician,
        });
        passed++;
        process.stdout.write(`\r  Progress: ${passed}/${tests.length} tests completed`);
      }
      console.log();

      // Complete session
      const summary = await completeSession(session.id, {
        notes: 'Quick diagnostic - all tests passed',
      });

      console.log(chalk.green(`\n✓ Quick diagnostic complete!`));
      console.log(`  Session: ${summary.session.sessionNumber}`);
      console.log(`  Result: ${chalk.green(summary.session.overallResult || 'PASS')}`);
      console.log(`  Pass Rate: 100%`);
      console.log(`  Can Certify: ${chalk.green('Yes')}`);
      console.log(`  Recommended Level: ${CERTIFICATION_LEVEL_DISPLAY[summary.recommendedCertification || 'EXCELLENT']}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('export')
  .description('Export diagnostic sessions to CSV')
  .option('-f, --from <date>', 'From date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'To date (YYYY-MM-DD)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-o, --output <file>', 'Output file', 'diagnostics-export.csv')
  .action(async (opts) => {
    try {
      const sessions = await listSessions({
        category: opts.category?.toUpperCase() as ProductCategory,
        limit: 1000,
        includeCompleted: true,
      });

      // Filter by date if specified
      let filtered = sessions;
      if (opts.from) {
        const fromDate = new Date(opts.from);
        filtered = filtered.filter(s => new Date(s.startedAt) >= fromDate);
      }
      if (opts.to) {
        const toDate = new Date(opts.to);
        filtered = filtered.filter(s => new Date(s.startedAt) <= toDate);
      }

      // Build CSV
      const headers = [
        'Session Number',
        'QLID',
        'Category',
        'Technician',
        'Started At',
        'Completed At',
        'Total Tests',
        'Passed',
        'Failed',
        'Skipped',
        'Result',
      ];

      const rows = filtered.map(s => [
        s.sessionNumber,
        s.qlid,
        s.category,
        s.technicianId,
        s.startedAt,
        s.completedAt || '',
        s.totalTests,
        s.passedTests,
        s.failedTests,
        s.skippedTests,
        s.overallResult || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v}"`).join(',')),
      ].join('\n');

      // Write file
      const fs = await import('fs');
      fs.writeFileSync(opts.output, csv);

      console.log(chalk.green(`\n✓ Exported ${filtered.length} sessions to ${opts.output}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

diagCmd
  .command('stats')
  .description('Show technician diagnostic performance stats')
  .option('-t, --technician <id>', 'Specific technician ID')
  .option('-a, --all', 'Show all technicians')
  .action(async (opts) => {
    try {
      if (opts.technician) {
        // Show stats for specific technician
        const stats = await getTechnicianDiagnosticStats(opts.technician);
        if (!stats) {
          console.error(chalk.red(`No diagnostic data found for technician: ${opts.technician}`));
          return;
        }

        console.log(chalk.bold(`\nTechnician Performance: ${stats.technicianName || stats.technicianId}\n`));
        console.log(`  Total Sessions: ${stats.totalSessions}`);
        console.log(`  Completed: ${stats.completedSessions}`);
        console.log(`  Pass Rate: ${chalk.green(stats.passRate.toFixed(1) + '%')}`);
        console.log(`  Passed: ${chalk.green(stats.passedSessions.toString())} | Failed: ${chalk.red(stats.failedSessions.toString())}`);
        console.log(`  Avg Tests/Session: ${stats.avgTestsPerSession.toFixed(1)}`);
        console.log(`  Avg Duration: ${stats.avgDurationMinutes.toFixed(1)} min`);

        if (Object.keys(stats.categoryCounts).length > 0) {
          console.log(chalk.yellow(`\nCategories Tested:`));
          for (const [cat, count] of Object.entries(stats.categoryCounts)) {
            console.log(`  ${CATEGORY_DISPLAY[cat as ProductCategory] || cat}: ${count}`);
          }
        }

        if (stats.recentSessions.length > 0) {
          console.log(chalk.yellow(`\nRecent Sessions (${stats.recentSessions.length}):`));
          for (const s of stats.recentSessions.slice(0, 5)) {
            const resultColor = s.overallResult === 'PASS' ? chalk.green : chalk.red;
            console.log(`  ${s.sessionNumber} - ${s.qlid} [${resultColor(s.overallResult || 'IN PROGRESS')}]`);
          }
        }
      } else {
        // Show stats for all technicians
        const allStats = await getAllTechnicianDiagnosticStats();
        if (allStats.length === 0) {
          console.log(chalk.yellow('No diagnostic sessions found.'));
          return;
        }

        console.log(chalk.bold(`\nTechnician Diagnostic Performance (${allStats.length} technicians):\n`));

        // Header
        console.log(chalk.gray('Technician'.padEnd(20) + 'Sessions'.padEnd(10) + 'Pass Rate'.padEnd(12) + 'Avg Duration'));
        console.log(chalk.gray('-'.repeat(60)));

        // Sort by pass rate descending
        allStats.sort((a, b) => b.passRate - a.passRate);

        for (const stats of allStats) {
          const name = (stats.technicianName || stats.technicianId).slice(0, 18).padEnd(20);
          const sessions = stats.completedSessions.toString().padEnd(10);
          const passRate = stats.passRate.toFixed(1) + '%';
          const passRateColored = stats.passRate >= 90 ? chalk.green(passRate.padEnd(12)) :
            stats.passRate >= 75 ? chalk.yellow(passRate.padEnd(12)) : chalk.red(passRate.padEnd(12));
          const avgDur = stats.avgDurationMinutes.toFixed(1) + ' min';

          console.log(`${chalk.cyan(name)}${sessions}${passRateColored}${avgDur}`);
        }

        // Summary stats
        const totalSessions = allStats.reduce((sum, s) => sum + s.totalSessions, 0);
        const totalPassed = allStats.reduce((sum, s) => sum + s.passedSessions, 0);
        const overallPassRate = totalSessions > 0 ? (totalPassed / totalSessions) * 100 : 0;

        console.log(chalk.gray('\n' + '-'.repeat(60)));
        console.log(`Total: ${totalSessions} sessions | Overall Pass Rate: ${chalk.green(overallPassRate.toFixed(1) + '%')}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== CERTIFICATION COMMANDS ====================

const certCmd = program.command('cert').description('QuickDiagnosticz - Device certification');

certCmd
  .command('issue <qlid>')
  .description('Issue a certification for a diagnosed item')
  .requiredOption('-l, --level <level>', 'Certification level (EXCELLENT, GOOD, FAIR)')
  .requiredOption('-m, --manufacturer <name>', 'Manufacturer')
  .requiredOption('-o, --model <name>', 'Model')
  .requiredOption('-c, --category <category>', 'Product category')
  .requiredOption('-t, --technician <id>', 'Certifier ID')
  .option('-s, --session <id>', 'Link to diagnostic session')
  .option('-j, --job <id>', 'Link to refurb job')
  .option('--serial <number>', 'Serial number')
  .option('--imei <number>', 'IMEI')
  .option('--warranty-type <type>', 'Warranty type (MANUFACTURER, EXTENDED, RETAILER, UPSCALED, NONE)')
  .option('--warranty-status <status>', 'Warranty status (ACTIVE, EXPIRED, VOIDED, UNKNOWN)')
  .option('--warranty-provider <provider>', 'Warranty provider name')
  .option('--warranty-end <date>', 'Warranty end date (YYYY-MM-DD)')
  .action(async (qlid, opts) => {
    try {
      const certification = await issueCertification({
        qlid,
        sessionId: opts.session,
        jobId: opts.job,
        category: opts.category.toUpperCase() as ProductCategory,
        manufacturer: opts.manufacturer,
        model: opts.model,
        serialNumber: opts.serial,
        certificationLevel: opts.level.toUpperCase() as any,
        imei: opts.imei,
        certifiedBy: opts.technician,
        warrantyType: opts.warrantyType?.toUpperCase() as any,
        warrantyStatus: opts.warrantyStatus?.toUpperCase() as any,
        warrantyProvider: opts.warrantyProvider,
        warrantyEndDate: opts.warrantyEnd,
      });

      console.log(chalk.green(`\n✓ Certification issued: ${certification.certificationId}`));
      console.log(`  QLID: ${certification.qlid}`);
      console.log(`  Device: ${certification.manufacturer} ${certification.model}`);
      console.log(`  Level: ${CERTIFICATION_LEVEL_DISPLAY[certification.certificationLevel]}`);
      console.log(`  Valid Until: ${certification.validUntil?.toLocaleDateString()}`);
      console.log(`  Report URL: ${certification.publicReportUrl}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('show <identifier>')
  .description('Show certification details')
  .action(async (identifier) => {
    try {
      const cert = await getCertification(identifier);
      if (!cert) {
        console.error(chalk.red(`Certification not found: ${identifier}`));
        return;
      }

      const levelColor = cert.certificationLevel === 'EXCELLENT' ? chalk.green :
        cert.certificationLevel === 'GOOD' ? chalk.blue :
        cert.certificationLevel === 'FAIR' ? chalk.yellow : chalk.red;

      console.log(chalk.bold(`\nCertification: ${cert.certificationId}\n`));
      console.log(`  QLID: ${cert.qlid}`);
      console.log(`  Device: ${cert.manufacturer} ${cert.model}`);
      console.log(`  Category: ${CATEGORY_DISPLAY[cert.category]}`);
      console.log(`  Level: ${levelColor(CERTIFICATION_LEVEL_DISPLAY[cert.certificationLevel])}`);
      console.log(`  Certified: ${cert.certifiedAt.toLocaleDateString()}`);
      console.log(`  Valid Until: ${cert.validUntil?.toLocaleDateString()}`);
      console.log(`  Status: ${cert.isRevoked ? chalk.red('REVOKED') : chalk.green('VALID')}`);
      if (cert.isRevoked && cert.revokedReason) {
        console.log(`  Revoked Reason: ${cert.revokedReason}`);
      }

      // Warranty info
      if (cert.warrantyInfo) {
        const w = cert.warrantyInfo;
        const warrantyStatusColor = w.status === 'ACTIVE' ? chalk.green :
          w.status === 'EXPIRED' ? chalk.red : chalk.yellow;
        console.log(chalk.yellow(`\n  Warranty:`));
        console.log(`    Type: ${w.type}`);
        console.log(`    Status: ${warrantyStatusColor(w.status)}`);
        if (w.provider) console.log(`    Provider: ${w.provider}`);
        if (w.endDate) console.log(`    End Date: ${new Date(w.endDate).toLocaleDateString()}`);
        if (w.daysRemaining !== undefined && w.daysRemaining > 0) {
          console.log(`    Days Remaining: ${w.daysRemaining}`);
        }
        if (w.coverageType) console.log(`    Coverage: ${w.coverageType}`);
      }

      console.log(`\n  Report URL: ${cert.publicReportUrl}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('report <certId>')
  .description('Generate PDF report for certification')
  .option('-o, --output <path>', 'Output path')
  .action(async (certId, opts) => {
    try {
      const outputPath = await generateReportPdf(certId, {
        outputPath: opts.output,
      });

      console.log(chalk.green(`\n✓ Report generated: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('label <certId>')
  .description('Generate certification label')
  .option('-o, --output <path>', 'Output path')
  .action(async (certId, opts) => {
    try {
      const outputPath = await generateCertificationLabel(certId, {
        outputPath: opts.output,
      });

      console.log(chalk.green(`\n✓ Label generated: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('revoke <certId>')
  .description('Revoke a certification')
  .requiredOption('-r, --reason <reason>', 'Reason for revocation')
  .requiredOption('-b, --by <id>', 'Revoking user ID')
  .action(async (certId, opts) => {
    try {
      const cert = await revokeCertification(certId, {
        reason: opts.reason,
        revokedBy: opts.by,
      });

      console.log(chalk.yellow(`\n✓ Certification revoked: ${cert.certificationId}`));
      console.log(`  Reason: ${opts.reason}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('list')
  .description('List certifications')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --level <level>', 'Filter by level')
  .option('-t, --technician <id>', 'Filter by certifier')
  .option('--limit <n>', 'Limit results', '25')
  .option('--revoked', 'Include revoked certifications')
  .action(async (opts) => {
    try {
      const certs = await listCertifications({
        category: opts.category?.toUpperCase() as ProductCategory,
        level: opts.level?.toUpperCase() as any,
        certifiedBy: opts.technician,
        limit: parseInt(opts.limit),
        includeRevoked: opts.revoked,
      });

      console.log(chalk.bold(`\nCertifications (${certs.length}):\n`));

      for (const c of certs) {
        const levelColor = c.certificationLevel === 'EXCELLENT' ? chalk.green :
          c.certificationLevel === 'GOOD' ? chalk.blue :
          c.certificationLevel === 'FAIR' ? chalk.yellow : chalk.red;

        console.log(`${chalk.cyan(c.certificationId)} - ${c.manufacturer} ${c.model}`);
        console.log(`  Level: ${levelColor(c.certificationLevel)} | ${c.isRevoked ? chalk.red('REVOKED') : chalk.green('VALID')}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('verify <certId>')
  .description('Verify a certification (public check)')
  .action(async (certId) => {
    try {
      const result = await verifyCertification(certId);

      if (result.valid) {
        console.log(chalk.green(`\n✓ ${result.message}`));
      } else {
        console.log(chalk.red(`\n✗ ${result.message}`));
      }

      if (result.certification) {
        const c = result.certification;
        console.log(`\n  ID: ${c.certificationId}`);
        console.log(`  Device: ${c.manufacturer} ${c.model}`);
        console.log(`  Level: ${CERTIFICATION_LEVEL_DISPLAY[c.certificationLevel]}`);
        console.log(`  Certified: ${c.certifiedAt.toLocaleDateString()}`);
      }

      if (result.checks.length > 0) {
        console.log(chalk.yellow(`\nChecks:`));
        for (const check of result.checks) {
          const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${icon} ${check.name}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('stats')
  .description('Show certification statistics')
  .option('-p, --period <period>', 'Period (today, week, month, all)', 'all')
  .action(async (opts) => {
    try {
      const stats = await getCertificationStats(opts.period as any);

      console.log(chalk.bold(`\nCertification Statistics (${opts.period}):\n`));
      console.log(`  Total Certifications: ${stats.totalCertifications}`);
      console.log(`  Certification Rate: ${stats.certificationRate.toFixed(1)}%`);
      console.log(`\nBy Level:`);
      console.log(`  Excellent: ${stats.byLevel.EXCELLENT}`);
      console.log(`  Good: ${stats.byLevel.GOOD}`);
      console.log(`  Fair: ${stats.byLevel.FAIR}`);
      console.log(`  Not Certified: ${stats.byLevel.NOT_CERTIFIED}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('bulk')
  .description('Bulk certify from completed diagnostic sessions')
  .requiredOption('-t, --technician <id>', 'Certifier ID')
  .option('-c, --category <category>', 'Filter by category')
  .option('--dry-run', 'Show what would be certified without actually issuing')
  .action(async (opts) => {
    try {
      // Get completed sessions that can be certified
      const sessions = await listSessions({
        category: opts.category?.toUpperCase() as ProductCategory,
        limit: 100,
        includeCompleted: true,
      });

      // Filter to only completed sessions that passed
      const eligibleSessions = sessions.filter(s =>
        s.completedAt && s.overallResult === 'PASS'
      );

      if (eligibleSessions.length === 0) {
        console.log(chalk.yellow('\nNo eligible sessions found for bulk certification.'));
        console.log('Sessions must be completed with PASS result.');
        return;
      }

      console.log(chalk.bold(`\nEligible Sessions for Certification: ${eligibleSessions.length}\n`));

      let certified = 0;
      let skipped = 0;

      for (const session of eligibleSessions) {
        // Check if already certified
        const existingCerts = await listCertifications({
          qlid: session.qlid,
          limit: 1,
        });

        if (existingCerts.length > 0) {
          console.log(chalk.gray(`  Skipped ${session.qlid} - already certified`));
          skipped++;
          continue;
        }

        // Calculate certification level based on pass rate
        const summary = await getSessionSummary(session.id);
        let level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NOT_CERTIFIED' = 'NOT_CERTIFIED';
        if (summary && summary.passRate >= 95) {
          level = 'EXCELLENT';
        } else if (summary && summary.passRate >= 85) {
          level = 'GOOD';
        } else if (summary && summary.passRate >= 70) {
          level = 'FAIR';
        }

        if (opts.dryRun) {
          console.log(chalk.cyan(`  Would certify ${session.qlid} as ${level}`));
        } else {
          try {
            const cert = await issueCertification({
              qlid: session.qlid,
              sessionId: session.id,
              category: session.category as ProductCategory,
              manufacturer: 'Unknown', // Would need to be provided or looked up
              model: `${session.category} Unit`,
              certificationLevel: level,
              certifiedBy: opts.technician,
            });
            console.log(chalk.green(`  ✓ Certified ${session.qlid} - ${cert.certificationId} [${level}]`));
            certified++;
          } catch (err) {
            console.log(chalk.red(`  ✗ Failed to certify ${session.qlid}: ${(err as Error).message}`));
          }
        }
      }

      console.log(chalk.bold(`\nSummary:`));
      if (opts.dryRun) {
        console.log(`  Would certify: ${eligibleSessions.length - skipped}`);
        console.log(`  Already certified: ${skipped}`);
      } else {
        console.log(`  Certified: ${certified}`);
        console.log(`  Skipped: ${skipped}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

certCmd
  .command('export')
  .description('Export certifications to CSV')
  .option('-f, --from <date>', 'From date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'To date (YYYY-MM-DD)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-o, --output <file>', 'Output file', 'certifications-export.csv')
  .action(async (opts) => {
    try {
      const certs = await listCertifications({
        category: opts.category?.toUpperCase() as ProductCategory,
        fromDate: opts.from ? new Date(opts.from) : undefined,
        toDate: opts.to ? new Date(opts.to) : undefined,
        limit: 1000,
        includeRevoked: true,
      });

      // Build CSV
      const headers = [
        'Certification ID',
        'QLID',
        'Manufacturer',
        'Model',
        'Category',
        'Level',
        'Certified By',
        'Certified At',
        'Valid Until',
        'Status',
        'Public URL',
      ];

      const rows = certs.map(c => [
        c.certificationId,
        c.qlid,
        c.manufacturer,
        c.model,
        c.category,
        c.certificationLevel,
        c.certifiedBy,
        c.certifiedAt,
        c.validUntil || '',
        c.isRevoked ? 'REVOKED' : 'VALID',
        c.publicReportUrl || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v}"`).join(',')),
      ].join('\n');

      // Write file
      const fs = await import('fs');
      fs.writeFileSync(opts.output, csv);

      console.log(chalk.green(`\n✓ Exported ${certs.length} certifications to ${opts.output}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== TEST PLAN COMMANDS ====================

const testplanCmd = program.command('testplan').description('Manage diagnostic test plans');

testplanCmd
  .command('list')
  .description('List available test suites by category')
  .action(async () => {
    try {
      const suites = getAllTestSuites();
      console.log(chalk.bold(`\nAvailable Test Plans:\n`));
      for (const suite of suites) {
        console.log(`${chalk.cyan(suite.category)} - ${suite.categoryName}`);
        console.log(`  Total Tests: ${suite.totalTestCount}`);
        console.log(`  Critical Tests: ${suite.criticalTestCount}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    }
  });

testplanCmd
  .command('show <category>')
  .description('Show tests for a category')
  .action(async (category) => {
    try {
      const suite = getTestSuite(category.toUpperCase() as ProductCategory);
      if (!suite) {
        console.error(chalk.red(`No test plan found for category: ${category}`));
        return;
      }

      console.log(chalk.bold(`\n${suite.categoryName} Test Plan\n`));
      console.log(`Total Tests: ${suite.totalTestCount}`);
      console.log(`Critical Tests: ${suite.criticalTestCount}\n`);

      for (const test of suite.tests) {
        const marker = test.isCritical ? chalk.red('[CRITICAL]') : chalk.gray('[Standard]');
        console.log(`${chalk.cyan(test.code)} ${marker}`);
        console.log(`  ${test.name}`);
        console.log(`  Type: ${test.testType}`);
        if (test.measurementUnit) {
          console.log(`  Measurement: ${test.measurementUnit} (${test.measurementMin}-${test.measurementMax})`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    }
  });

// ==================== EXTERNAL CHECK COMMANDS ====================

import {
  performExternalCheck,
  getExternalChecks,
  hasFlags,
  runAllChecks,
} from './diagnostics/index.js';
import type { ExternalCheckType, ExternalCheckProvider } from './diagnostics/types.js';

const checkCmd = program.command('check').description('External device checks (IMEI, serial, warranty, stolen)');

checkCmd
  .command('imei <qlid> <imei>')
  .description('Check IMEI against blacklist databases')
  .option('-p, --provider <provider>', 'Provider (IMEI_INFO, CHECKMEND, MANUAL)', 'MANUAL')
  .option('-c, --cert <certId>', 'Link to certification')
  .option('-s, --session <sessionId>', 'Link to diagnostic session')
  .action(async (qlid, imei, opts) => {
    try {
      const check = await performExternalCheck({
        qlid,
        checkType: 'IMEI',
        provider: opts.provider.toUpperCase() as ExternalCheckProvider,
        identifier: imei,
        identifierType: 'imei',
        certificationId: opts.cert,
        sessionId: opts.session,
      });

      const statusColor = check.status === 'CLEAR' ? chalk.green :
        check.status === 'FLAGGED' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n✓ IMEI Check Complete\n`));
      console.log(`  QLID: ${check.qlid}`);
      console.log(`  IMEI: ${imei}`);
      console.log(`  Provider: ${check.provider}`);
      console.log(`  Status: ${statusColor(check.status)}`);
      console.log(`  Blacklisted: ${check.isBlacklisted ? chalk.red('YES') : chalk.green('No')}`);
      console.log(`  Financial Hold: ${check.hasFinancialHold ? chalk.red('YES') : chalk.green('No')}`);
      console.log(`  Checked: ${check.checkedAt.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

checkCmd
  .command('serial <qlid> <serial>')
  .description('Check serial number with manufacturer')
  .option('-p, --provider <provider>', 'Provider (APPLE_GSX, SAMSUNG_CHECK, MANUAL)', 'MANUAL')
  .option('-c, --cert <certId>', 'Link to certification')
  .option('-s, --session <sessionId>', 'Link to diagnostic session')
  .action(async (qlid, serial, opts) => {
    try {
      const check = await performExternalCheck({
        qlid,
        checkType: 'SERIAL',
        provider: opts.provider.toUpperCase() as ExternalCheckProvider,
        identifier: serial,
        identifierType: 'serial',
        certificationId: opts.cert,
        sessionId: opts.session,
      });

      const statusColor = check.status === 'CLEAR' ? chalk.green :
        check.status === 'FLAGGED' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n✓ Serial Check Complete\n`));
      console.log(`  QLID: ${check.qlid}`);
      console.log(`  Serial: ${serial}`);
      console.log(`  Provider: ${check.provider}`);
      console.log(`  Status: ${statusColor(check.status)}`);
      console.log(`  Checked: ${check.checkedAt.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

checkCmd
  .command('warranty <qlid> <identifier>')
  .description('Check warranty status')
  .option('-t, --type <type>', 'Identifier type (imei, serial)', 'serial')
  .option('-p, --provider <provider>', 'Provider (APPLE_GSX, SAMSUNG_CHECK, MANUAL)', 'MANUAL')
  .option('-c, --cert <certId>', 'Link to certification')
  .action(async (qlid, identifier, opts) => {
    try {
      const check = await performExternalCheck({
        qlid,
        checkType: 'WARRANTY',
        provider: opts.provider.toUpperCase() as ExternalCheckProvider,
        identifier,
        identifierType: opts.type,
        certificationId: opts.cert,
      });

      const statusColor = check.status === 'CLEAR' ? chalk.green :
        check.status === 'FLAGGED' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n✓ Warranty Check Complete\n`));
      console.log(`  QLID: ${check.qlid}`);
      console.log(`  Identifier: ${identifier}`);
      console.log(`  Provider: ${check.provider}`);
      console.log(`  Status: ${statusColor(check.status)}`);
      console.log(`  Warranty Status: ${check.warrantyStatus || 'Unknown'}`);
      console.log(`  Checked: ${check.checkedAt.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

checkCmd
  .command('stolen <qlid> <identifier>')
  .description('Check stolen device database')
  .option('-t, --type <type>', 'Identifier type (imei, serial)', 'imei')
  .option('-p, --provider <provider>', 'Provider (CHECKMEND, MANUAL)', 'MANUAL')
  .option('-c, --cert <certId>', 'Link to certification')
  .action(async (qlid, identifier, opts) => {
    try {
      const check = await performExternalCheck({
        qlid,
        checkType: 'STOLEN',
        provider: opts.provider.toUpperCase() as ExternalCheckProvider,
        identifier,
        identifierType: opts.type,
        certificationId: opts.cert,
      });

      const statusColor = check.status === 'CLEAR' ? chalk.green :
        check.status === 'FLAGGED' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n✓ Stolen Check Complete\n`));
      console.log(`  QLID: ${check.qlid}`);
      console.log(`  Identifier: ${identifier}`);
      console.log(`  Provider: ${check.provider}`);
      console.log(`  Status: ${statusColor(check.status)}`);
      console.log(`  Reported Stolen: ${check.isStolen ? chalk.red('YES - DO NOT PURCHASE') : chalk.green('No')}`);
      console.log(`  Checked: ${check.checkedAt.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

checkCmd
  .command('all <qlid>')
  .description('Run all standard checks for a device')
  .option('-i, --imei <imei>', 'IMEI to check')
  .option('-s, --serial <serial>', 'Serial number to check')
  .option('-c, --cert <certId>', 'Link to certification')
  .option('--session <sessionId>', 'Link to diagnostic session')
  .action(async (qlid, opts) => {
    try {
      if (!opts.imei && !opts.serial) {
        console.error(chalk.red('Error: At least one of --imei or --serial is required'));
        return;
      }

      console.log(chalk.bold(`\nRunning all checks for ${qlid}...\n`));

      const checks = await runAllChecks({
        qlid,
        imei: opts.imei,
        serial: opts.serial,
        certificationId: opts.cert,
        sessionId: opts.session,
      });

      // Display results
      console.log(chalk.bold(`Results (${checks.length} checks):\n`));

      for (const check of checks) {
        const statusColor = check.status === 'CLEAR' ? chalk.green :
          check.status === 'FLAGGED' ? chalk.red : chalk.yellow;
        const icon = check.status === 'CLEAR' ? '✓' : check.status === 'FLAGGED' ? '✗' : '?';

        console.log(`  ${statusColor(icon)} ${check.checkType} (${check.provider}): ${statusColor(check.status)}`);
        if (check.isStolen) console.log(chalk.red(`      ⚠ REPORTED STOLEN`));
        if (check.isBlacklisted) console.log(chalk.red(`      ⚠ BLACKLISTED`));
        if (check.hasFinancialHold) console.log(chalk.yellow(`      ⚠ Financial Hold`));
      }

      // Summary
      const flags = await hasFlags(qlid);
      console.log();
      if (flags.hasFlags) {
        console.log(chalk.red.bold(`⚠ WARNING: Device has flags!`));
        if (flags.isStolen) console.log(chalk.red(`  - Reported stolen`));
        if (flags.isBlacklisted) console.log(chalk.red(`  - Blacklisted`));
        if (flags.hasFinancialHold) console.log(chalk.yellow(`  - Financial hold`));
      } else {
        console.log(chalk.green.bold(`✓ All checks clear - safe to proceed`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

checkCmd
  .command('show <qlid>')
  .description('Show all external checks for a device')
  .action(async (qlid) => {
    try {
      const checks = await getExternalChecks(qlid);
      const flags = await hasFlags(qlid);

      console.log(chalk.bold(`\nExternal Checks for ${qlid}\n`));

      if (checks.length === 0) {
        console.log(chalk.gray('  No checks recorded'));
        return;
      }

      for (const check of checks) {
        const statusColor = check.status === 'CLEAR' ? chalk.green :
          check.status === 'FLAGGED' ? chalk.red : chalk.yellow;

        console.log(`${chalk.cyan(check.checkType)} via ${check.provider}`);
        console.log(`  Status: ${statusColor(check.status)}`);
        console.log(`  Checked: ${check.checkedAt.toLocaleString()}`);
        if (check.expiresAt) {
          const expired = new Date() > check.expiresAt;
          console.log(`  Expires: ${expired ? chalk.red('EXPIRED') : check.expiresAt.toLocaleDateString()}`);
        }
        console.log();
      }

      // Summary
      console.log(chalk.bold('Summary:'));
      console.log(`  Has Flags: ${flags.hasFlags ? chalk.red('Yes') : chalk.green('No')}`);
      console.log(`  Stolen: ${flags.isStolen ? chalk.red('Yes') : chalk.green('No')}`);
      console.log(`  Blacklisted: ${flags.isBlacklisted ? chalk.red('Yes') : chalk.green('No')}`);
      console.log(`  Financial Hold: ${flags.hasFinancialHold ? chalk.red('Yes') : chalk.green('No')}`);
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    } finally {
      await closePool();
    }
  });

// ==================== MENU COMMAND ====================

program
  .command('menu')
  .description('Launch interactive menu')
  .action(async () => {
    try {
      const { runMenu } = await import('./menu.js');
      await runMenu();
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    }
  });

// Parse and run
program.parse();
