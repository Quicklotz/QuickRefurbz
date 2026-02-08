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
  .requiredOption('-s, --source <source>', 'Liquidation source (TECHLIQUIDATORS, BSTOCK, DIRECTLIQUIDATION, etc.)')
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
