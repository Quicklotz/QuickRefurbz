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

import { QuickTestzBridge } from './hardware-diag/quicktestz-bridge/bridge.js';
import * as testRunManager from './quicktestz/services/testRunManager.js';
import * as readingsCollector from './quicktestz/services/readingsCollector.js';
import {
  CONTROLLER_TYPE_DISPLAY,
  TEST_RUN_STATUS_DISPLAY,
  TEST_RUN_RESULT_DISPLAY,
} from './quicktestz/types.js';

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
  .description('Start a hardware test session (add --station to run integrated with QuickTestz)')
  .requiredOption('-c, --category <category>', 'Product category (e.g. APPLIANCE_SMALL, VACUUM)')
  .option('--operator <name>', 'Operator name')
  .option('--station <id>', 'QuickTestz station ID (enables integrated test)')
  .option('--outlet <id>', 'Specific outlet ID (defaults to first enabled)')
  .option('--skip-unavailable', 'Skip steps for unavailable instruments')
  .action(async (qlid: string, opts) => {
    try {
      await initializeDatabase();

      // Integrated mode: delegate to QuickTestzBridge when --station is provided
      if (opts.station) {
        const bridge = new QuickTestzBridge();
        const testSpinner = ora('Running integrated test (hardware-diag + QuickTestz)...').start();

        const result = await bridge.startIntegratedTest({
          qlid,
          category: opts.category,
          stationId: opts.station,
          outletId: opts.outlet,
          operatorName: opts.operator,
          skipUnavailable: opts.skipUnavailable,
          onProgress: (completed, total, message) => {
            testSpinner.text = `[${completed}/${total}] ${message}`;
          },
        });

        testSpinner.stop();

        // Hardware-diag results
        const hwColor =
          result.hardwareExecution.overallResult === 'PASS'
            ? chalk.green
            : result.hardwareExecution.overallResult === 'FAIL'
            ? chalk.red
            : chalk.yellow;

        console.log(chalk.bold('\nHardware Test Results:'));
        console.log(`  QLID:      ${chalk.cyan(qlid)}`);
        console.log(`  Result:    ${hwColor(result.hardwareExecution.overallResult || 'UNKNOWN')}`);
        console.log(`  Passed:    ${chalk.green(result.hardwareExecution.passedSteps.toString())}/${result.hardwareExecution.totalSteps}`);
        console.log(`  Failed:    ${chalk.red(result.hardwareExecution.failedSteps.toString())}/${result.hardwareExecution.totalSteps}`);

        // QuickTestz results
        const qtColor =
          result.testRun.result === 'PASS'
            ? chalk.green
            : result.testRun.result === 'FAIL'
            ? chalk.red
            : result.testRun.result === 'ANOMALY'
            ? chalk.yellow
            : chalk.gray;

        console.log(chalk.bold('\nQuickTestz Results:'));
        console.log(`  Test Run:  ${result.testRun.id.slice(0, 8)}...`);
        console.log(`  Result:    ${qtColor(result.testRun.result || 'PENDING')}`);
        console.log(`  Score:     ${result.testRun.score ?? '-'}/100`);
        console.log(`  Readings:  ${result.readingsRecorded} recorded`);
        if (result.testRun.anomalies.length > 0) {
          console.log(`  Anomalies: ${chalk.yellow(result.testRun.anomalies.length.toString())}`);
        }
        return;
      }

      // Standalone mode: original hardware-diag only
      const planLoader = new TestPlanLoader();

      const spinner = ora(`Loading test plan for ${opts.category}...`).start();
      let plan;
      try {
        plan = await planLoader.loadPlanByCategory(opts.category);
      } catch {
        spinner.fail(`No test plan found for category: ${opts.category}`);
        return;
      }
      spinner.succeed(`Plan loaded: ${plan.name} (${plan.steps.length} steps)`);

      if (plan.safetyWarnings && plan.safetyWarnings.length > 0) {
        console.log(chalk.red.bold('\nSafety Warnings:'));
        for (const warning of plan.safetyWarnings) {
          console.log(chalk.red(`  ! ${warning}`));
        }
        console.log();
      }

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

      const runner = new HardwareTestRunner();
      const testSpinner = ora('Running hardware tests...').start();

      const execution = await runner.run({
        qlid,
        category: opts.category,
        operatorName: opts.operator,
        skipUnavailable: opts.skipUnavailable,
        onProgress: (completed, total, message) => {
          testSpinner.text = `[${completed}/${total}] ${message}`;
        },
      });

      testSpinner.stop();

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

// ==================== STATION COMMANDS ====================

const stationCmd = program
  .command('station')
  .description('QuickTestz station management');

stationCmd
  .command('list')
  .description('List QuickTestz stations with outlets and controller info')
  .action(async () => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const { stations, instruments } = await bridge.listStationsWithInstruments();

      if (stations.length === 0) {
        console.log(chalk.yellow('No stations configured.'));
        console.log(chalk.dim('  Create stations via the QuickTestz API or web UI.'));
        return;
      }

      const table = new Table({
        head: ['ID', 'Name', 'Location', 'Controller', 'Outlets', 'GFCI', 'Safety'],
        style: { head: ['cyan'] },
      });

      for (const station of stations) {
        const enabledOutlets = station.outlets.filter((o) => o.enabled).length;
        const totalOutlets = station.outlets.length;
        const gfci = station.safetyFlags.gfciPresent ? chalk.green('Yes') : chalk.red('No');
        const ack = station.safetyFlags.acknowledgedBy
          ? chalk.green(`Ack: ${station.safetyFlags.acknowledgedBy}`)
          : chalk.yellow('Not acknowledged');

        table.push([
          station.id.slice(0, 8) + '...',
          station.name,
          station.location || '-',
          CONTROLLER_TYPE_DISPLAY[station.controllerType] || station.controllerType,
          `${enabledOutlets}/${totalOutlets}`,
          gfci,
          ack,
        ]);
      }

      console.log(chalk.bold('\nQuickTestz Stations:\n'));
      console.log(table.toString());

      if (instruments.length > 0) {
        console.log(chalk.dim(`\n  ${instruments.length} hardware instrument(s) registered`));
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

stationCmd
  .command('health <stationId>')
  .description('Health-check a station\'s controller')
  .action(async (stationId: string) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const spinner = ora('Checking station health...').start();

      const health = await bridge.getStationHealth(stationId);

      if (health.ok) {
        spinner.succeed('Station controller is healthy');
      } else {
        spinner.fail('Station controller health check failed');
      }
      console.log(chalk.dim(JSON.stringify(health.details, null, 2)));
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

stationCmd
  .command('view <stationId>')
  .description('Detailed view of a station with outlets and nearby instruments')
  .action(async (stationId: string) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const { stations, instruments } = await bridge.listStationsWithInstruments();

      const station = stations.find((s) => s.id === stationId || s.id.startsWith(stationId));
      if (!station) {
        console.error(chalk.red(`Station not found: ${stationId}`));
        return;
      }

      console.log(chalk.bold(`\nStation: ${station.name}`));
      console.log(`  ID:         ${station.id}`);
      console.log(`  Location:   ${station.location || '-'}`);
      console.log(`  Controller: ${CONTROLLER_TYPE_DISPLAY[station.controllerType] || station.controllerType}`);
      console.log(`  Base URL:   ${station.controllerBaseUrl || '-'}`);
      console.log(`  GFCI:       ${station.safetyFlags.gfciPresent ? chalk.green('Present') : chalk.red('Not present')}`);
      console.log(`  Ack by:     ${station.safetyFlags.acknowledgedBy || chalk.yellow('None')}`);

      if (station.outlets.length > 0) {
        console.log(chalk.bold('\n  Outlets:'));
        const table = new Table({
          head: ['ID', 'Label', 'Channel', 'Max Amps', 'On/Off', 'Metering', 'Enabled'],
          style: { head: ['cyan'] },
        });

        for (const outlet of station.outlets) {
          table.push([
            outlet.id.slice(0, 8) + '...',
            outlet.label,
            outlet.controllerChannel,
            outlet.maxAmps?.toString() || '-',
            outlet.supportsOnOff ? chalk.green('Yes') : 'No',
            outlet.supportsPowerMetering ? chalk.green('Yes') : 'No',
            outlet.enabled ? chalk.green('Yes') : chalk.red('No'),
          ]);
        }
        console.log(table.toString());
      }

      if (instruments.length > 0) {
        console.log(chalk.bold('\n  Registered Instruments:'));
        for (const inst of instruments) {
          const statusColor = inst.status === 'ACTIVE' ? chalk.green : chalk.gray;
          console.log(`    ${inst.name} (${INSTRUMENT_TYPE_DISPLAY[inst.type]}) - ${statusColor(inst.status)} @ ${inst.connectionPath}`);
        }
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== TEST RUN COMMANDS ====================

const testrunCmd = program
  .command('testrun')
  .description('QuickTestz test run management');

testrunCmd
  .command('create')
  .description('Create a new QuickTestz test run')
  .requiredOption('--qlid <qlid>', 'Item QLID')
  .requiredOption('--station <id>', 'Station ID')
  .option('--outlet <id>', 'Outlet ID (defaults to first enabled)')
  .option('--profile <id>', 'Profile ID')
  .option('--category <cat>', 'Category (to auto-select profile)')
  .action(async (opts) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();

      const spinner = ora('Creating test run...').start();
      const run = await bridge.createTestRunFromCli({
        qlid: opts.qlid,
        stationId: opts.station,
        outletId: opts.outlet,
        profileId: opts.profile,
        category: opts.category,
      });

      spinner.succeed(`Test run created: ${chalk.cyan(run.id.slice(0, 8))}...`);
      console.log(`  QLID:    ${run.qlid}`);
      console.log(`  Station: ${run.stationId.slice(0, 8)}...`);
      console.log(`  Outlet:  ${run.outletId.slice(0, 8)}...`);
      console.log(`  Status:  ${run.status}`);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('start <runId>')
  .description('Energize outlet and start collecting readings')
  .action(async (runId: string) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const spinner = ora('Energizing and starting collection...').start();

      const run = await bridge.startTestRun(runId);
      spinner.succeed(`Test run started: ${chalk.cyan(run?.status || 'COLLECTING')}`);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('stop <runId>')
  .description('De-energize outlet and stop collecting')
  .action(async (runId: string) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const spinner = ora('De-energizing and stopping collection...').start();

      const run = await bridge.stopTestRun(runId);
      spinner.succeed(`Test run stopped: ${chalk.cyan(run?.status || 'CHECKLIST')}`);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('complete <runId>')
  .description('Compute result and complete a test run')
  .action(async (runId: string) => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();
      const spinner = ora('Computing results...').start();

      const run = await bridge.completeTestRun(runId);
      if (!run) {
        spinner.fail('Test run not found');
        return;
      }

      const resultColor =
        run.result === 'PASS'
          ? chalk.green
          : run.result === 'FAIL'
          ? chalk.red
          : run.result === 'ANOMALY'
          ? chalk.yellow
          : chalk.gray;

      spinner.succeed(`Test run completed`);
      console.log(`  Result: ${resultColor(run.result || 'UNKNOWN')}`);
      console.log(`  Score:  ${run.score ?? '-'}/100`);
      if (run.anomalies.length > 0) {
        console.log(`  Anomalies: ${chalk.yellow(run.anomalies.length.toString())}`);
        for (const a of run.anomalies) {
          console.log(`    ${chalk.yellow(a.type)}: ${a.message}`);
        }
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('status <runId>')
  .description('Show test run status with latest readings and anomalies')
  .action(async (runId: string) => {
    try {
      await initializeDatabase();

      const run = await testRunManager.getTestRun(runId);
      if (!run) {
        console.error(chalk.red(`Test run not found: ${runId}`));
        return;
      }

      const statusColor =
        run.status === 'COMPLETED' ? chalk.green
        : run.status === 'ABORTED' || run.status === 'ERROR' ? chalk.red
        : chalk.cyan;

      console.log(chalk.bold(`\nTest Run: ${run.id.slice(0, 8)}...`));
      console.log(`  QLID:    ${run.qlid}`);
      console.log(`  Status:  ${statusColor(TEST_RUN_STATUS_DISPLAY[run.status])}`);
      if (run.result) {
        const resultColor =
          run.result === 'PASS' ? chalk.green
          : run.result === 'FAIL' ? chalk.red
          : chalk.yellow;
        console.log(`  Result:  ${resultColor(TEST_RUN_RESULT_DISPLAY[run.result])}`);
        console.log(`  Score:   ${run.score ?? '-'}/100`);
      }
      if (run.startedAt) console.log(`  Started: ${run.startedAt.toISOString()}`);
      if (run.endedAt) console.log(`  Ended:   ${run.endedAt.toISOString()}`);

      // Latest reading
      const latest = await readingsCollector.getLatestReading(runId);
      if (latest) {
        console.log(chalk.bold('\n  Latest Reading:'));
        console.log(`    Watts: ${latest.watts ?? '-'}  Volts: ${latest.volts ?? '-'}  Amps: ${latest.amps ?? '-'}`);
        console.log(`    Time:  ${latest.ts.toISOString()}`);
      }

      // Anomalies
      if (run.anomalies.length > 0) {
        console.log(chalk.bold('\n  Anomalies:'));
        for (const a of run.anomalies) {
          console.log(`    ${chalk.yellow(a.type)}: ${a.message} (${a.timestamp})`);
        }
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('list')
  .description('List recent test runs')
  .option('--qlid <qlid>', 'Filter by QLID')
  .option('--station <id>', 'Filter by station ID')
  .option('--status <status>', 'Filter by status')
  .option('-n, --limit <n>', 'Number of results', '20')
  .action(async (opts) => {
    try {
      await initializeDatabase();

      const runs = await testRunManager.listTestRuns({
        qlid: opts.qlid,
        stationId: opts.station,
        status: opts.status,
        limit: parseInt(opts.limit),
      });

      if (runs.length === 0) {
        console.log(chalk.yellow('No test runs found.'));
        return;
      }

      const table = new Table({
        head: ['ID', 'QLID', 'Status', 'Result', 'Score', 'Station', 'Created'],
        style: { head: ['cyan'] },
      });

      for (const run of runs) {
        const statusColor =
          run.status === 'COMPLETED' ? chalk.green
          : run.status === 'ABORTED' || run.status === 'ERROR' ? chalk.red
          : chalk.cyan;
        const resultColor =
          run.result === 'PASS' ? chalk.green
          : run.result === 'FAIL' ? chalk.red
          : run.result === 'ANOMALY' ? chalk.yellow
          : chalk.gray;

        table.push([
          run.id.slice(0, 8) + '...',
          run.qlid,
          statusColor(TEST_RUN_STATUS_DISPLAY[run.status]),
          run.result ? resultColor(TEST_RUN_RESULT_DISPLAY[run.result]) : '-',
          run.score !== undefined ? run.score.toString() : '-',
          run.stationId.slice(0, 8) + '...',
          run.createdAt.toISOString().slice(0, 16),
        ]);
      }

      console.log(chalk.bold('\nRecent Test Runs:\n'));
      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

testrunCmd
  .command('readings <runId>')
  .description('Show readings for a test run')
  .option('-n, --limit <n>', 'Number of readings', '20')
  .action(async (runId: string, opts) => {
    try {
      await initializeDatabase();

      const readings = await readingsCollector.getReadings(runId, parseInt(opts.limit));

      if (readings.length === 0) {
        console.log(chalk.yellow('No readings found for this test run.'));
        return;
      }

      const table = new Table({
        head: ['Time', 'Watts', 'Volts', 'Amps', 'Source'],
        style: { head: ['cyan'] },
      });

      for (const r of readings) {
        const source = (r.raw as Record<string, unknown>)?.source as string || '-';
        table.push([
          r.ts.toISOString().slice(11, 23),
          r.watts?.toFixed(2) ?? '-',
          r.volts?.toFixed(2) ?? '-',
          r.amps?.toFixed(3) ?? '-',
          source,
        ]);
      }

      console.log(chalk.bold(`\nReadings for ${runId.slice(0, 8)}... (latest ${readings.length}):\n`));
      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// ==================== OVERVIEW COMMAND ====================

program
  .command('overview')
  .description('Unified dashboard: stations, instruments, active test runs')
  .action(async () => {
    try {
      await initializeDatabase();
      const bridge = new QuickTestzBridge();

      const [{ stations, instruments }, activeRuns] = await Promise.all([
        bridge.listStationsWithInstruments(),
        testRunManager.listTestRuns({ limit: 10 }),
      ]);

      console.log(chalk.bold('\n=== QuickRefurbz Overview ===\n'));

      // Stations
      console.log(chalk.bold(`Stations (${stations.length}):`));
      if (stations.length === 0) {
        console.log(chalk.dim('  No stations configured'));
      } else {
        for (const s of stations) {
          const enabledOutlets = s.outlets.filter((o) => o.enabled).length;
          const gfci = s.safetyFlags.gfciPresent ? chalk.green('GFCI') : chalk.red('no GFCI');
          console.log(`  ${chalk.cyan(s.name)} (${CONTROLLER_TYPE_DISPLAY[s.controllerType]}) - ${enabledOutlets} outlet(s) - ${gfci}`);
        }
      }

      // Instruments
      console.log(chalk.bold(`\nInstruments (${instruments.length}):`));
      if (instruments.length === 0) {
        console.log(chalk.dim('  No instruments registered'));
      } else {
        for (const inst of instruments) {
          const statusColor = inst.status === 'ACTIVE' ? chalk.green : chalk.gray;
          console.log(`  ${chalk.cyan(inst.name)} (${INSTRUMENT_TYPE_DISPLAY[inst.type]}) - ${statusColor(inst.status)} @ ${inst.connectionPath}`);
        }
      }

      // Active/recent test runs
      const active = activeRuns.filter((r) =>
        ['CREATED', 'ENERGIZED', 'COLLECTING', 'CHECKLIST', 'COMPUTING'].includes(r.status)
      );

      console.log(chalk.bold(`\nActive Test Runs (${active.length}):`));
      if (active.length === 0) {
        console.log(chalk.dim('  No active test runs'));
      } else {
        for (const run of active) {
          console.log(
            `  ${chalk.cyan(run.qlid)} - ${TEST_RUN_STATUS_DISPLAY[run.status]} - station ${run.stationId.slice(0, 8)}... - started ${run.startedAt?.toISOString().slice(0, 16) || '-'}`
          );
        }
      }

      // Recent completed
      const completed = activeRuns.filter((r) => r.status === 'COMPLETED').slice(0, 5);
      if (completed.length > 0) {
        console.log(chalk.bold(`\nRecent Completed (${completed.length}):`));
        for (const run of completed) {
          const resultColor =
            run.result === 'PASS' ? chalk.green
            : run.result === 'FAIL' ? chalk.red
            : chalk.yellow;
          console.log(
            `  ${chalk.cyan(run.qlid)} - ${resultColor(run.result || 'UNKNOWN')} (${run.score ?? '-'}/100) - ${run.endedAt?.toISOString().slice(0, 16) || '-'}`
          );
        }
      }

      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
    }
  });

// Parse and run
program.parse();
