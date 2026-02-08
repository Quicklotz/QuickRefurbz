/**
 * QuickRefurbz - Interactive Menu
 * QLID-based refurbishment workflow
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import {
  closePool
} from './database.js';
import {
  receiveItem,
  getItem,
  listItems,
  advanceStage,
  getItemStats
} from './itemManager.js';
import {
  getRetailerFromPalletId,
  RETAILER_DISPLAY
} from './types.js';
import {
  addTechnician,
  listTechnicians,
  getAllWorkloads
} from './technicianManager.js';
import {
  getTicketStats
} from './ticketManager.js';
import {
  getPartsStats
} from './partsInventory.js';
import { printLabelPreview } from './labelGenerator.js';
import {
  STAGE_DISPLAY,
  CATEGORY_DISPLAY,
  GRADE_DISPLAY,
  PRIORITY_DISPLAY
} from './types.js';
import type { ProductCategory, JobPriority, FinalGrade } from './types.js';

// ==================== BANNER ====================

function showBanner(): void {
  console.clear();
  console.log(chalk.cyan(`
   ___        _      _    ____       __            _
  / _ \\ _   _(_) ___| | _|  _ \\ ___ / _|_   _ _ __| |__ ____
 | | | | | | | |/ __| |/ / |_) / _ \\ |_| | | | '__| '_ \\_  /
 | |_| | |_| | | (__|   <|  _ <  __/  _| |_| | |  | |_) / /
  \\__\\_\\\\__,_|_|\\___|_|\\_\\_| \\_\\___|_|  \\__,_|_|  |_.__/___|

`));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.white('  Refurbishment Workflow System with QLID Identity'));
  console.log(chalk.gray('  Barcode: {PalletID}-QLID{SERIES}{10-digit}'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log();
}

// ==================== MAIN MENU ====================

type MainMenuChoice = 'dashboard' | 'items' | 'techs' | 'exit';

async function mainMenu(): Promise<MainMenuChoice> {
  const { choice } = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: 'Main Menu',
    choices: [
      { name: '📊 Dashboard', value: 'dashboard' },
      new inquirer.Separator('──────────────'),
      { name: '🔧 Item Management', value: 'items' },
      { name: '👥 Technician Management', value: 'techs' },
      new inquirer.Separator('──────────────'),
      { name: '🚪 Exit', value: 'exit' }
    ]
  }]);
  return choice;
}

// ==================== DASHBOARD ====================

async function showDashboard(): Promise<void> {
  const spinner = ora('Loading dashboard...').start();

  try {
    const itemStats = await getItemStats();
    const ticketStats = await getTicketStats();
    const partsStats = await getPartsStats();

    spinner.stop();

    console.log(chalk.bold('\n  📊 DASHBOARD OVERVIEW\n'));

    // Summary table
    const summaryTable = new Table({
      head: ['🔧 Items', '🎫 Tickets', '🔩 Parts'],
      style: { head: ['cyan'], border: ['gray'] }
    });

    summaryTable.push([
      `${itemStats.total} total\n${itemStats.todayCompleted} done today`,
      `${ticketStats.openCount} open\n${ticketStats.resolvedToday} resolved`,
      `${partsStats.totalParts} types\n${partsStats.lowStockCount > 0 ? chalk.red(`${partsStats.lowStockCount} low`) : 'Stock OK'}`
    ]);

    console.log(summaryTable.toString());

    // Pipeline table
    console.log(chalk.bold('\n  🔄 REFURBISHMENT PIPELINE\n'));

    const pipelineTable = new Table({
      head: ['Stage', 'Count', 'Progress'],
      style: { head: ['cyan'], border: ['gray'] }
    });

    const stages = ['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'] as const;
    const maxCount = Math.max(...Object.values(itemStats.byStage), 1);

    for (const stage of stages) {
      const count = itemStats.byStage[stage];
      const barLength = Math.round((count / maxCount) * 15);
      const bar = count > 0
        ? '█'.repeat(barLength) + '░'.repeat(15 - barLength)
        : '░'.repeat(15);
      pipelineTable.push([
        STAGE_DISPLAY[stage],
        count.toString(),
        bar
      ]);
    }

    console.log(pipelineTable.toString());

  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

// ==================== ITEMS ====================

type ItemMenuChoice = 'receive' | 'list' | 'advance' | 'show' | 'back';

async function itemsMenu(): Promise<ItemMenuChoice> {
  const { choice } = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: 'Item Management',
    choices: [
      { name: '📥 Receive New Item', value: 'receive' },
      { name: '📋 List Items', value: 'list' },
      { name: '⏭️  Advance Item Stage', value: 'advance' },
      { name: '🔍 Show Item Details', value: 'show' },
      new inquirer.Separator('──────────────'),
      { name: '← Back to Main Menu', value: 'back' }
    ]
  }]);
  return choice;
}

async function receiveItemMenu(): Promise<void> {
  console.log(chalk.bold('\n📥 Receive New Item\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'palletId',
      message: 'Pallet ID (e.g., P1BBY):',
      validate: (v) => /^P\d+[A-Z]{2,3}$/.test(v) || 'Invalid format. Use P1BBY, P2AMZ, etc.'
    },
    {
      type: 'input',
      name: 'manufacturer',
      message: 'Manufacturer:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: Object.entries(CATEGORY_DISPLAY).map(([k, v]) => ({ name: v, value: k }))
    },
    {
      type: 'input',
      name: 'employeeId',
      message: 'Your Employee ID:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'input',
      name: 'warehouseId',
      message: 'Warehouse ID:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: Object.entries(PRIORITY_DISPLAY).map(([k, v]) => ({ name: v, value: k })),
      default: 'NORMAL'
    },
    {
      type: 'input',
      name: 'serialNumber',
      message: 'Serial Number (optional):'
    }
  ]);

  const spinner = ora('Allocating QLID and creating item...').start();

  try {
    const result = await receiveItem({
      palletId: answers.palletId,
      manufacturer: answers.manufacturer,
      model: answers.model,
      category: answers.category as ProductCategory,
      employeeId: answers.employeeId,
      warehouseId: answers.warehouseId,
      priority: answers.priority as JobPriority,
      serialNumber: answers.serialNumber || undefined
    });

    spinner.succeed(chalk.green(`Item received: ${result.item.qlid}`));

    console.log(`\n  Barcode: ${chalk.cyan(result.item.barcodeValue)}`);
    console.log(`  Pallet: ${result.item.palletId}`);
    console.log(`  Stage: ${STAGE_DISPLAY[result.item.currentStage]}`);

    console.log(chalk.yellow('\nLabel Preview:'));
    printLabelPreview(result.labelData);

  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

async function listItemsMenu(): Promise<void> {
  const spinner = ora('Loading items...').start();

  try {
    const items = await listItems({ limit: 20 });
    spinner.stop();

    if (items.length === 0) {
      console.log(chalk.yellow('\nNo items found.'));
    } else {
      console.log(chalk.bold(`\nItems (${items.length}):\n`));

      const table = new Table({
        head: ['QLID', 'Barcode', 'Product', 'Stage', 'Priority'],
        style: { head: ['cyan'], border: ['gray'] },
        colWidths: [20, 30, 25, 12, 10]
      });

      for (const item of items) {
        table.push([
          item.qlid,
          item.barcodeValue,
          `${item.manufacturer} ${item.model}`.slice(0, 23),
          STAGE_DISPLAY[item.currentStage],
          item.priority
        ]);
      }

      console.log(table.toString());
    }
  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

async function advanceItemMenu(): Promise<void> {
  console.log(chalk.bold('\n⏭️  Advance Item Stage\n'));

  const { identifier } = await inquirer.prompt([{
    type: 'input',
    name: 'identifier',
    message: 'Enter QLID or scan barcode:',
    validate: (v) => v.length > 0 || 'Required'
  }]);

  const spinner = ora('Loading item...').start();

  try {
    const item = await getItem(identifier);
    if (!item) {
      spinner.fail(chalk.red('Item not found'));
      await inquirer.prompt([{ type: 'input', name: 'c', message: 'Press Enter...' }]);
      return;
    }

    spinner.stop();

    console.log(`\n  Current: ${chalk.cyan(item.qlid)}`);
    console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]}`);
    console.log(`  Product: ${item.manufacturer} ${item.model}`);

    if (item.currentStage === 'COMPLETE') {
      console.log(chalk.yellow('\n  Item is already complete.'));
      await inquirer.prompt([{ type: 'input', name: 'c', message: 'Press Enter...' }]);
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Advance to next stage?',
        default: true
      }
    ]);

    if (answers.proceed) {
      // Extra prompts for FINAL_QC -> COMPLETE
      let finalGrade: FinalGrade | undefined;
      let estimatedValue: number | undefined;
      let nextWorkflow: string | undefined;

      if (item.currentStage === 'FINAL_QC') {
        const completion = await inquirer.prompt([
          {
            type: 'list',
            name: 'grade',
            message: 'Final Grade:',
            choices: Object.entries(GRADE_DISPLAY).map(([k, v]) => ({ name: v, value: k }))
          },
          {
            type: 'input',
            name: 'value',
            message: 'Estimated Value ($):',
            filter: (v) => v ? parseFloat(v) : undefined
          },
          {
            type: 'list',
            name: 'workflow',
            message: 'Next Workflow:',
            choices: [
              { name: 'QuickListingz (eBay/Amazon)', value: 'QuickListingz' },
              { name: 'QuickSalvage (Parts)', value: 'QuickSalvage' },
              { name: 'QuickConsignmentz', value: 'QuickConsignmentz' },
              { name: 'Other', value: 'Other' }
            ]
          }
        ]);

        finalGrade = completion.grade;
        estimatedValue = completion.value;
        nextWorkflow = completion.workflow;
      }

      const advanceSpinner = ora('Advancing stage...').start();

      const updated = await advanceStage(identifier, {
        finalGrade,
        estimatedValue,
        nextWorkflow
      });

      advanceSpinner.succeed(chalk.green(`Advanced to ${STAGE_DISPLAY[updated.currentStage]}`));

      if (updated.currentStage === 'COMPLETE') {
        console.log(chalk.green('\n  Item complete!'));
        if (updated.finalGrade) {
          console.log(`  Grade: ${GRADE_DISPLAY[updated.finalGrade]}`);
        }
        if (updated.nextWorkflow) {
          console.log(`  Next: ${updated.nextWorkflow}`);
        }
      }
    }
  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

async function showItemMenu(): Promise<void> {
  console.log(chalk.bold('\n🔍 Show Item Details\n'));

  const { identifier } = await inquirer.prompt([{
    type: 'input',
    name: 'identifier',
    message: 'Enter QLID or scan barcode:',
    validate: (v) => v.length > 0 || 'Required'
  }]);

  const spinner = ora('Loading item...').start();

  try {
    const item = await getItem(identifier);
    if (!item) {
      spinner.fail(chalk.red('Item not found'));
      await inquirer.prompt([{ type: 'input', name: 'c', message: 'Press Enter...' }]);
      return;
    }

    spinner.stop();

    const retailer = getRetailerFromPalletId(item.palletId);

    console.log(chalk.bold(`\nItem: ${item.qlid}\n`));
    console.log(`  Barcode: ${chalk.cyan(item.barcodeValue)}`);
    console.log(`  Pallet: ${item.palletId} (${RETAILER_DISPLAY[retailer]})`);
    console.log(`  Product: ${item.manufacturer} ${item.model}`);
    console.log(`  Category: ${CATEGORY_DISPLAY[item.category]}`);
    console.log(`  Stage: ${STAGE_DISPLAY[item.currentStage]}`);
    console.log(`  Priority: ${PRIORITY_DISPLAY[item.priority]}`);
    console.log(`  Intake: ${item.intakeTs.toISOString()}`);
    console.log(`  Employee: ${item.intakeEmployeeId}`);
    console.log(`  Warehouse: ${item.warehouseId}`);

    if (item.finalGrade) {
      console.log(`  Grade: ${GRADE_DISPLAY[item.finalGrade]}`);
    }
    if (item.estimatedValue) {
      console.log(`  Value: $${item.estimatedValue}`);
    }
    if (item.nextWorkflow) {
      console.log(`  Next: ${item.nextWorkflow}`);
    }

  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

// ==================== TECHNICIANS ====================

type TechMenuChoice = 'add' | 'list' | 'workload' | 'back';

async function techsMenu(): Promise<TechMenuChoice> {
  const { choice } = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: 'Technician Management',
    choices: [
      { name: '➕ Add Technician', value: 'add' },
      { name: '📋 List Technicians', value: 'list' },
      { name: '📊 View Workload', value: 'workload' },
      new inquirer.Separator('──────────────'),
      { name: '← Back to Main Menu', value: 'back' }
    ]
  }]);
  return choice;
}

async function addTechnicianMenu(): Promise<void> {
  console.log(chalk.bold('\n➕ Add Technician\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'employeeId',
      message: 'Employee ID:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'input',
      name: 'name',
      message: 'Full Name:',
      validate: (v) => v.length > 0 || 'Required'
    },
    {
      type: 'checkbox',
      name: 'specialties',
      message: 'Specialties:',
      choices: Object.entries(CATEGORY_DISPLAY).map(([k, v]) => ({ name: v, value: k }))
    }
  ]);

  const spinner = ora('Adding technician...').start();

  try {
    const tech = await addTechnician({
      employeeId: answers.employeeId,
      name: answers.name,
      specialties: answers.specialties as ProductCategory[]
    });

    spinner.succeed(chalk.green(`Technician added: ${tech.employeeId} - ${tech.name}`));
  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

async function listTechniciansMenu(): Promise<void> {
  const spinner = ora('Loading technicians...').start();

  try {
    const technicians = await listTechnicians();
    spinner.stop();

    if (technicians.length === 0) {
      console.log(chalk.yellow('\nNo technicians found.'));
    } else {
      console.log(chalk.bold(`\nTechnicians (${technicians.length}):\n`));

      const table = new Table({
        head: ['Employee ID', 'Name', 'Status', 'Specialties'],
        style: { head: ['cyan'], border: ['gray'] }
      });

      for (const t of technicians) {
        table.push([
          t.employeeId,
          t.name,
          t.isActive ? chalk.green('Active') : chalk.red('Inactive'),
          t.specialties.map(s => CATEGORY_DISPLAY[s]).join(', ') || '-'
        ]);
      }

      console.log(table.toString());
    }
  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

async function viewWorkloadMenu(): Promise<void> {
  const spinner = ora('Loading workloads...').start();

  try {
    const workloads = await getAllWorkloads();
    spinner.stop();

    if (workloads.length === 0) {
      console.log(chalk.yellow('\nNo active technicians found.'));
    } else {
      console.log(chalk.bold('\nTeam Workload:\n'));

      const table = new Table({
        head: ['Technician', 'Items', 'Tickets', 'Done Today'],
        style: { head: ['cyan'], border: ['gray'] }
      });

      for (const w of workloads) {
        table.push([
          w.technician.name,
          String(w.assignedItems),
          String(w.openTickets),
          chalk.green(String(w.completedToday))
        ]);
      }

      console.log(table.toString());
    }
  } catch (error) {
    spinner.fail(chalk.red((error as Error).message));
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press Enter to continue...'
  }]);
}

// ==================== MAIN LOOP ====================

export async function runMenu(): Promise<void> {
  let running = true;

  while (running) {
    showBanner();

    const mainChoice = await mainMenu();

    switch (mainChoice) {
      case 'dashboard':
        await showDashboard();
        break;

      case 'items': {
        let inItems = true;
        while (inItems) {
          showBanner();
          const itemChoice = await itemsMenu();
          switch (itemChoice) {
            case 'receive':
              await receiveItemMenu();
              break;
            case 'list':
              await listItemsMenu();
              break;
            case 'advance':
              await advanceItemMenu();
              break;
            case 'show':
              await showItemMenu();
              break;
            case 'back':
              inItems = false;
              break;
          }
        }
        break;
      }

      case 'techs': {
        let inTechs = true;
        while (inTechs) {
          showBanner();
          const techChoice = await techsMenu();
          switch (techChoice) {
            case 'add':
              await addTechnicianMenu();
              break;
            case 'list':
              await listTechniciansMenu();
              break;
            case 'workload':
              await viewWorkloadMenu();
              break;
            case 'back':
              inTechs = false;
              break;
          }
        }
        break;
      }

      case 'exit':
        running = false;
        console.log(chalk.green('\nGoodbye!\n'));
        break;
    }
  }

  await closePool();
}
