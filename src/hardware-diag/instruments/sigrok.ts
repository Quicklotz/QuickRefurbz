/**
 * Hardware Diagnostics - Sigrok Wrapper
 * Wraps sigrok-cli for logic analysis, signal capture, and protocol decoding
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  SigrokDevice,
  SigrokCapture,
  SigrokCaptureInput,
  SigrokDecodeResult,
} from '../types.js';

const execFileAsync = promisify(execFile);

const SIGROK_CLI = 'sigrok-cli';
const DEFAULT_CAPTURE_DIR = path.join(process.cwd(), 'data', 'captures');

/**
 * Wrapper around sigrok-cli for logic analysis
 */
export class SigrokWrapper {
  private captureDir: string;

  constructor(captureDir?: string) {
    this.captureDir = captureDir || DEFAULT_CAPTURE_DIR;
  }

  /**
   * Check if sigrok-cli is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execFileAsync(SIGROK_CLI, ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get sigrok-cli version
   */
  async getVersion(): Promise<string> {
    const { stdout } = await execFileAsync(SIGROK_CLI, ['--version']);
    const match = stdout.match(/sigrok-cli\s+([\d.]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Scan for connected sigrok-compatible devices
   */
  async scanDevices(): Promise<SigrokDevice[]> {
    try {
      const { stdout } = await execFileAsync(SIGROK_CLI, ['--scan'], {
        timeout: 10000,
      });

      return parseScanOutput(stdout);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('ENOENT')) {
        throw new Error(
          'sigrok-cli not found. Install: brew install sigrok-cli (macOS) or apt install sigrok-cli (Linux)'
        );
      }
      throw error;
    }
  }

  /**
   * List supported sigrok drivers
   */
  async listDrivers(): Promise<string[]> {
    const { stdout } = await execFileAsync(SIGROK_CLI, ['--list-supported']);
    const lines = stdout.split('\n').filter((l) => l.trim());
    return lines;
  }

  /**
   * Capture signals from a logic analyzer
   */
  async capture(input: SigrokCaptureInput): Promise<SigrokCapture> {
    const captureId = randomUUID();
    const ext = input.outputFormat || 'sr';
    const filePath = path.join(this.captureDir, `${captureId}.${ext}`);

    const args = [
      '--driver', input.driver,
      '--config', `samplerate=${input.sampleRate || '1M'}`,
      '--time', `${input.durationMs || 1000}`,
      '--output-file', filePath,
    ];

    if (input.channels && input.channels.length > 0) {
      args.push('--channels', input.channels.join(','));
    }

    if (input.triggerCondition) {
      args.push('--triggers', input.triggerCondition);
    }

    if (input.outputFormat && input.outputFormat !== 'sr') {
      args.push('--output-format', input.outputFormat);
    }

    const startTime = Date.now();

    try {
      await execFileAsync(SIGROK_CLI, args, {
        timeout: (input.durationMs || 1000) + 10000, // capture time + buffer
      });
    } catch (error) {
      const err = error as Error & { stderr?: string };
      throw new Error(
        `Sigrok capture failed: ${err.stderr || err.message}`
      );
    }

    const durationMs = Date.now() - startTime;

    return {
      id: captureId,
      instrumentId: input.instrumentId,
      filePath,
      driver: input.driver,
      sampleRate: input.sampleRate || '1M',
      durationMs,
      channels: input.channels || [],
      triggerCondition: input.triggerCondition,
      capturedAt: new Date(),
    };
  }

  /**
   * Decode a captured signal file with a protocol decoder
   */
  async decode(
    filePath: string,
    protocol: string,
    options?: Record<string, string>
  ): Promise<SigrokDecodeResult> {
    const args = [
      '--input-file', filePath,
      '--protocol-decoders', protocol,
      '--protocol-decoder-annotations', protocol,
    ];

    if (options) {
      const optStr = Object.entries(options)
        .map(([k, v]) => `${k}=${v}`)
        .join(':');
      args[3] = `${protocol}:${optStr}`; // Override protocol-decoders arg
    }

    const { stdout } = await execFileAsync(SIGROK_CLI, args, {
      timeout: 30000,
    });

    return {
      protocol,
      annotations: parseDecodeOutput(stdout),
      decodedAt: new Date(),
    };
  }
}

/**
 * Parse sigrok-cli --scan output into device list
 */
function parseScanOutput(output: string): SigrokDevice[] {
  const devices: SigrokDevice[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    // Format: "driver_name - description with channels: D0 D1 D2 ..."
    const match = line.match(
      /^(\S+)\s+-\s+(.+?)(?:\s+with\s+(\d+)\s+channels?)?/
    );
    if (match) {
      const channelMatch = line.match(/channels?:\s*(.+)/);
      devices.push({
        driver: match[1],
        description: match[2].trim(),
        channels: channelMatch
          ? channelMatch[1].split(/\s+/).filter(Boolean)
          : [],
      });
    }
  }

  return devices;
}

/**
 * Parse sigrok-cli protocol decoder output
 */
function parseDecodeOutput(
  output: string
): SigrokDecodeResult['annotations'] {
  const annotations: SigrokDecodeResult['annotations'] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    // Format: "start-end protocol: type: data"
    const match = line.match(/^(\d+)-(\d+)\s+\S+:\s*(\S+):\s*(.+)/);
    if (match) {
      annotations.push({
        startSample: parseInt(match[1]),
        endSample: parseInt(match[2]),
        type: match[3],
        data: match[4].trim(),
      });
    }
  }

  return annotations;
}
