#!/usr/bin/env node

/**
 * qr-enhanced - Hardware Electronics Testing CLI
 * Automated hardware-level measurements using test instruments
 *
 * Part of QuickRefurbz - integrates with existing DiagnosticSession system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';

import { initializeDatabase } from './database.js';
import { detectPorts, matchKnownInstruments } from './hardware-diag/instruments/detector.js';
import { formatPort } from './hardware-diag/instruments/detector.js';
import { ScpiController } from './hardware-diag/instruments/scpi.js';
import { SigrokWrapper } from './hardware-diag/instruments/sigrok.js';
import {
  registerInstrument,
  getInstrument,
  listInstruments,
  updateInstrumentStatus,
  deleteInstrument,
} from './hardware-diag/instruments/registry.js';
import { TestPlanLoader } from './hardware-diag/testing/testPlanLoader.js';
import { HardwareTestRunner } from './hardware-diag/testing/testRunner.js';
import { ResultRecorder } from './hardware-diag/testing/resultRecorder.js';
import {
  INSTRUMENT_TYPE_DISPLAY,
  CONNECTION_TYPE_DISPLAY,
  STATUS_DISPLAY,
} from './hardware-diag/types.js';

import type {
  InstrumentType,
  ConnectionType,
} from './hardware-diag/types.js';

const program = new Command();

program
  .name('qr-enhanced')
  .description('Hardware Electronics Testing CLI - Automated measurements with real instruments')
  .version('1.0.0');

// ==================== SCAN COMMAND ====================

program
  .command('scan')
  .description('Scan USB/serial ports for connected instruments')
  .action(async () => {
    const spinner = ora('Scanning serial/USB ports...').start();

    try {
      const ports = await detectPorts();
      spinner.stop();

      if (ports.length === 0) {
        console.log(chalk.yellow('No serial/USB ports found.'));
        console.log(chalk.dim('  Tip: Connect an instrument via USB and try again.'));
        return;
      }

      console.log(chalk.bold(`\nFound ${ports.length} port(s):\n`));

      const table = new Table({
        head: ['Port', 'Manufacturer', 'VID:PID', 'Serial'],
        style: { head: ['cyan'] },
      });

      for (const port of ports) {
        table.push([
          port.path,
          port.manufacturer || '-',
          port.vendorId && port.productId
            ? `${port.vendorId}:${port.productId}`
            : '-',
          port.serialNumber || '-',
        ]);
      }

      console.log(table.toString());

      // Auto-detect known instruments
      const matches = matchKnownInstruments(ports);
      if (matches.length > 0) {
        console.log(chalk.bold('\nRecognized instruments:\n'));
        for (const match of matches) {
          const conf = match.confidence === 'HIGH'
            ? chalk.green(match.confidence)
            : match.confidence === 'MEDIUM'
            ? chalk.yellow(match.confidence)
            : chalk.red(match.confidence);
          console.log(
            `  ${chalk.cyan(match.port.path)} -> ${match.manufacturer} ${match.model} (${INSTRUMENT_TYPE_DISPLAY[match.type]}) [${conf}]`
          );
        }
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== INSTRUMENT COMMANDS ====================

const instrumentCmd = program
  .command('instrument')
  .description('Manage registered test instruments');

instrumentCmd
  .command('add')
  .description('Register a new instrument (interactive)')
  .action(async () => {
    try {
      await initializeDatabase();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Instrument name:',
          validate: (v: string) => v.length > 0 || 'Name is required',
        },
        {
          type: 'list',
          name: 'type',
          message: 'Instrument type:',
          choices: Object.entries(INSTRUMENT_TYPE_DISPLAY).map(([k, v]) => ({
            name: v,
            value: k,
          })),
        },
        {
          type: 'input',
          name: 'manufacturer',
          message: 'Manufacturer:',
          validate: (v: string) => v.length > 0 || 'Manufacturer is required',
        },
        {
          type: 'input',
          name: 'model',
          message: 'Model:',
          validate: (v: string) => v.length > 0 || 'Model is required',
        },
        {
          type: 'input',
          name: 'serialNumber',
          message: 'Serial number (optional):',
        },
        {
          type: 'list',
          name: 'connectionType',
          message: 'Connection type:',
          choices: Object.entries(CONNECTION_TYPE_DISPLAY).map(([k, v]) => ({
            name: v,
            value: k,
          })),
        },
        {
          type: 'input',
          name: 'connectionPath',
          message: 'Connection path (e.g. /dev/ttyUSB0 or 192.168.1.50:5555):',
          validate: (v: string) => v.length > 0 || 'Path is required',
        },
        {
          type: 'number',
          name: 'baudRate',
          message: 'Baud rate (for serial, default 9600):',
          default: 9600,
        },
        {
          type: 'input',
          name: 'notes',
          message: 'Notes (optional):',
        },
      ]);

      const spinner = ora('Registering instrument...').start();

      const instrument = await registerInstrument({
        name: answers.name,
        type: answers.type as InstrumentType,
        manufacturer: answers.manufacturer,
        model: answers.model,
        serialNumber: answers.serialNumber || undefined,
        connectionType: answers.connectionType as ConnectionType,
        connectionPath: answers.connectionPath,
        baudRate: answers.baudRate,
        notes: answers.notes || undefined,
      });

      spinner.succeed(
        `Registered: ${chalk.cyan(instrument.name)} (${instrument.id.slice(0, 8)}...)`
      );
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

instrumentCmd
  .command('list')
  .description('List registered instruments')
  .action(async () => {
    try {
      await initializeDatabase();

      const instruments = await listInstruments();

      if (instruments.length === 0) {
        console.log(chalk.yellow('No instruments registered.'));
        console.log(chalk.dim('  Use: qr-enhanced instrument add'));
        return;
      }

      const table = new Table({
        head: ['ID', 'Name', 'Type', 'Manufacturer', 'Model', 'Path', 'Status'],
        style: { head: ['cyan'] },
      });

      for (const inst of instruments) {
        const statusColor =
          inst.status === 'ACTIVE'
            ? chalk.green
            : inst.status === 'ERROR'
            ? chalk.red
            : chalk.gray;

        table.push([
          inst.id.slice(0, 8) + '...',
          inst.name,
          INSTRUMENT_TYPE_DISPLAY[inst.type] || inst.type,
          inst.manufacturer,
          inst.model,
          inst.connectionPath,
          statusColor(STATUS_DISPLAY[inst.status] || inst.status),
        ]);
      }

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

instrumentCmd
  .command('remove <instrumentId>')
  .description('Remove a registered instrument')
  .action(async (instrumentId: string) => {
    try {
      await initializeDatabase();

      const deleted = await deleteInstrument(instrumentId);
      if (deleted) {
        console.log(chalk.green(`Instrument ${instrumentId} removed.`));
      } else {
        console.log(chalk.yellow(`Instrument ${instrumentId} not found.`));
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== MEASURE COMMAND ====================

program
  .command('measure <instrumentId> <scpiCommand>')
  .description('Send SCPI command and read response')
  .option('-b, --baud <rate>', 'Baud rate', '9600')
  .option('-t, --timeout <ms>', 'Response timeout in ms', '5000')
  .action(async (instrumentId: string, scpiCommand: string, opts) => {
    try {
      await initializeDatabase();

      const instrument = await getInstrument(instrumentId);
      if (!instrument) {
        console.error(chalk.red(`Instrument not found: ${instrumentId}`));
        return;
      }

      const spinner = ora(`Connecting to ${instrument.name}...`).start();

      const controller = new ScpiController({
        path: instrument.connectionPath,
        baudRate: instrument.baudRate || parseInt(opts.baud),
        timeout: parseInt(opts.timeout),
        instrumentId: instrument.id,
      });

      try {
        await controller.connect();
        spinner.text = `Sending: ${scpiCommand}`;

        const measurement = await controller.measure(scpiCommand);
        spinner.stop();

        console.log(chalk.bold('\nSCPI Response:'));
        console.log(`  Raw:   ${chalk.cyan(measurement.response.raw)}`);
        if (measurement.response.value !== undefined) {
          console.log(`  Value: ${chalk.green(measurement.response.value.toString())}`);
        }
        if (measurement.response.unit) {
          console.log(`  Unit:  ${measurement.response.unit}`);
        }

        await updateInstrumentStatus(instrument.id, 'ACTIVE');
      } finally {
        await controller.disconnect();
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== SIGROK COMMANDS ====================

const sigrokCmd = program
  .command('sigrok')
  .description('Sigrok logic analyzer commands');

sigrokCmd
  .command('devices')
  .description('List sigrok-compatible devices')
  .action(async () => {
    const sigrok = new SigrokWrapper();

    const installed = await sigrok.isInstalled();
    if (!installed) {
      console.error(
        chalk.red(
          'sigrok-cli not found. Install: brew install sigrok-cli (macOS) or apt install sigrok-cli (Linux)'
        )
      );
      return;
    }

    const version = await sigrok.getVersion();
    console.log(chalk.dim(`sigrok-cli version: ${version}\n`));

    const spinner = ora('Scanning for devices...').start();

    try {
      const devices = await sigrok.scanDevices();
      spinner.stop();

      if (devices.length === 0) {
        console.log(chalk.yellow('No sigrok-compatible devices found.'));
        return;
      }

      const table = new Table({
        head: ['Driver', 'Description', 'Channels'],
        style: { head: ['cyan'] },
      });

      for (const device of devices) {
        table.push([
          device.driver,
          device.description,
          device.channels.join(', ') || '-',
        ]);
      }

      console.log(table.toString());
    } catch (error) {
      spinner.fail('Device scan failed');
      console.error(chalk.red((error as Error).message));
    }
  });

sigrokCmd
  .command('capture')
  .description('Capture signals from a logic analyzer')
  .option('-d, --driver <name>', 'Sigrok driver name', 'fx2lafw')
  .option('-s, --samplerate <rate>', 'Sample rate', '1M')
  .option('-t, --time <ms>', 'Capture duration in ms', '1000')
  .option('-c, --channels <list>', 'Channels (comma-separated)', 'D0,D1,D2,D3')
  .option('-f, --format <fmt>', 'Output format (sr, csv, vcd)', 'sr')
  .action(async (opts) => {
    const sigrok = new SigrokWrapper();

    const spinner = ora(
      `Capturing ${opts.time}ms at ${opts.samplerate} on ${opts.driver}...`
    ).start();

    try {
      const capture = await sigrok.capture({
        instrumentId: 'cli',
        driver: opts.driver,
        sampleRate: opts.samplerate,
        durationMs: parseInt(opts.time),
        channels: opts.channels.split(','),
        outputFormat: opts.format,
      });

      spinner.succeed(`Captured to: ${chalk.cyan(capture.filePath)}`);
      console.log(`  Duration: ${capture.durationMs}ms`);
      console.log(`  Channels: ${capture.channels.join(', ')}`);
    } catch (error) {
      spinner.fail('Capture failed');
      console.error(chalk.red((error as Error).message));
    }
  });

sigrokCmd
  .command('decode <file> <protocol>')
  .description('Decode captured signal file')
  .action(async (file: string, protocol: string) => {
    const sigrok = new SigrokWrapper();
    const spinner = ora(`Decoding ${file} with ${protocol}...`).start();

    try {
      const result = await sigrok.decode(file, protocol);
      spinner.stop();

      console.log(
        chalk.bold(`\nDecoded ${result.annotations.length} annotation(s):\n`)
      );

      for (const ann of result.annotations.slice(0, 50)) {
        console.log(
          `  [${ann.startSample}-${ann.endSample}] ${chalk.cyan(ann.type)}: ${ann.data}`
        );
      }

      if (result.annotations.length > 50) {
        console.log(
          chalk.dim(`  ... and ${result.annotations.length - 50} more`)
        );
      }
    } catch (error) {
      spinner.fail('Decode failed');
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== TEST COMMANDS ====================

const testCmd = program
  .command('test')
  .description('Automated hardware test execution');

testCmd
  .command('start <qlid>')
  .description('Start a hardware test session')
  .requiredOption('-c, --category <category>', 'Product category (e.g. APPLIANCE_SMALL, VACUUM)')
  .option('--operator <name>', 'Operator name')
  .option('--station <id>', 'Station ID')
  .option('--skip-unavailable', 'Skip steps for unavailable instruments')
  .action(async (qlid: string, opts) => {
    try {
      await initializeDatabase();

      const planLoader = new TestPlanLoader();

      // Verify plan exists
      const spinner = ora(`Loading test plan for ${opts.category}...`).start();
      let plan;
      try {
        plan = await planLoader.loadPlanByCategory(opts.category);
      } catch {
        spinner.fail(`No test plan found for category: ${opts.category}`);
        return;
      }
      spinner.succeed(`Plan loaded: ${plan.name} (${plan.steps.length} steps)`);

      // Display safety warnings
      if (plan.safetyWarnings && plan.safetyWarnings.length > 0) {
        console.log(chalk.red.bold('\nSafety Warnings:'));
        for (const warning of plan.safetyWarnings) {
          console.log(chalk.red(`  ! ${warning}`));
        }
        console.log();
      }

      // Confirm start
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Start hardware test for ${chalk.cyan(qlid)}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Test cancelled.'));
        return;
      }

      // Run tests
      const runner = new HardwareTestRunner();
      const testSpinner = ora('Running hardware tests...').start();

      const execution = await runner.run({
        qlid,
        category: opts.category,
        operatorName: opts.operator,
        stationId: opts.station,
        skipUnavailable: opts.skipUnavailable,
        onProgress: (completed, total, message) => {
          testSpinner.text = `[${completed}/${total}] ${message}`;
        },
      });

      testSpinner.stop();

      // Show results
      const resultColor =
        execution.overallResult === 'PASS'
          ? chalk.green
          : execution.overallResult === 'FAIL'
          ? chalk.red
          : chalk.yellow;

      console.log(chalk.bold('\nTest Results:'));
      console.log(`  QLID:     ${chalk.cyan(qlid)}`);
      console.log(`  Plan:     ${plan.name}`);
      console.log(`  Result:   ${resultColor(execution.overallResult || 'UNKNOWN')}`);
      console.log(`  Passed:   ${chalk.green(execution.passedSteps.toString())}/${execution.totalSteps}`);
      console.log(`  Failed:   ${chalk.red(execution.failedSteps.toString())}/${execution.totalSteps}`);
      console.log(`  ID:       ${execution.id}`);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testCmd
  .command('run <qlid>')
  .description('Run full automated test plan (non-interactive)')
  .requiredOption('-c, --category <category>', 'Product category')
  .option('--skip-unavailable', 'Skip steps for unavailable instruments')
  .action(async (qlid: string, opts) => {
    try {
      await initializeDatabase();

      const runner = new HardwareTestRunner();

      console.log(chalk.bold(`\nRunning hardware tests for ${chalk.cyan(qlid)}...\n`));

      const execution = await runner.run({
        qlid,
        category: opts.category,
        skipUnavailable: opts.skipUnavailable,
        onProgress: (completed, total, message) => {
          const pct = Math.round((completed / total) * 100);
          const bar = '='.repeat(Math.floor(pct / 5)) + ' '.repeat(20 - Math.floor(pct / 5));
          process.stdout.write(`\r  [${bar}] ${pct}% ${message}`);
        },
      });

      console.log('\n');

      const resultColor =
        execution.overallResult === 'PASS'
          ? chalk.green
          : execution.overallResult === 'FAIL'
          ? chalk.red
          : chalk.yellow;

      console.log(
        `Result: ${resultColor(execution.overallResult || 'UNKNOWN')} | ` +
        `Passed: ${execution.passedSteps}/${execution.totalSteps} | ` +
        `Failed: ${execution.failedSteps} | ` +
        `ID: ${execution.id.slice(0, 8)}`
      );
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testCmd
  .command('result <qlid>')
  .description('Show hardware test results for a QLID')
  .action(async (qlid: string) => {
    try {
      await initializeDatabase();

      const recorder = new ResultRecorder();
      const executions = await recorder.getExecutionsForQlid(qlid);

      if (executions.length === 0) {
        console.log(chalk.yellow(`No hardware test results for ${qlid}.`));
        return;
      }

      for (const exec of executions) {
        const resultColor =
          exec.overallResult === 'PASS'
            ? chalk.green
            : exec.overallResult === 'FAIL'
            ? chalk.red
            : chalk.yellow;

        console.log(chalk.bold(`\nExecution: ${exec.id.slice(0, 8)}...`));
        console.log(`  Category: ${exec.category}`);
        console.log(`  Status:   ${exec.status}`);
        console.log(`  Result:   ${resultColor(exec.overallResult || 'PENDING')}`);
        console.log(`  Steps:    ${exec.passedSteps} passed / ${exec.failedSteps} failed / ${exec.totalSteps} total`);
        console.log(`  Started:  ${exec.startedAt.toISOString()}`);
        if (exec.completedAt) {
          console.log(`  Ended:    ${exec.completedAt.toISOString()}`);
        }

        // Show step details
        const steps = await recorder.getStepResults(exec.id);
        if (steps.length > 0) {
          console.log(chalk.dim('\n  Step Results:'));
          const table = new Table({
            head: ['#', 'Code', 'Status', 'Measured', 'Expected', 'SCPI'],
            style: { head: ['cyan'] },
          });

          for (const step of steps) {
            const statusColor =
              step.status === 'PASS'
                ? chalk.green
                : step.status === 'FAIL'
                ? chalk.red
                : step.status === 'SKIP'
                ? chalk.gray
                : chalk.yellow;

            table.push([
              step.stepNumber.toString(),
              step.testCode,
              statusColor(step.status),
              step.measuredValue !== undefined
                ? `${step.measuredValue} ${step.measuredUnit || ''}`
                : '-',
              step.expectedMin !== undefined && step.expectedMax !== undefined
                ? `${step.expectedMin}-${step.expectedMax}`
                : '-',
              step.scpiCommand || '-',
            ]);
          }

          console.log(table.toString());
        }
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== PLANS COMMANDS ====================

const plansCmd = program
  .command('plans')
  .description('View available hardware test plans');

plansCmd
  .command('list')
  .description('List all available test plans')
  .action(async () => {
    try {
      const loader = new TestPlanLoader();
      const plans = await loader.listPlans();

      if (plans.length === 0) {
        console.log(chalk.yellow('No test plans found.'));
        return;
      }

      console.log(chalk.bold('\nAvailable Hardware Test Plans:\n'));

      const table = new Table({
        head: ['Slug', 'Name', 'Category', 'Steps', 'Est. Time'],
        style: { head: ['cyan'] },
      });

      for (const plan of plans) {
        table.push([
          plan.slug,
          plan.name,
          plan.category,
          plan.stepCount.toString(),
          `${plan.estimatedMinutes} min`,
        ]);
      }

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

plansCmd
  .command('show <category>')
  .description('Show detailed test plan for a category')
  .action(async (category: string) => {
    try {
      const loader = new TestPlanLoader();

      // Try as slug first, then as category enum
      let details: string;
      try {
        details = await loader.getPlanDetails(category.toLowerCase().replace(/_/g, '-'));
      } catch {
        details = await loader.getPlanDetails(category);
      }

      console.log('\n' + details);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== INIT COMMAND ====================

program
  .command('init')
  .description('Initialize hardware diagnostics database tables')
  .action(async () => {
    const spinner = ora('Initializing database...').start();
    try {
      await initializeDatabase();
      spinner.succeed('Database initialized with hardware diagnostics tables.');
    } catch (error) {
      spinner.fail('Database initialization failed');
      console.error(chalk.red((error as Error).message));
    }
  });

// Parse and run
program.parse();
