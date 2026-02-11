/**
 * Hardware Diagnostics - SCPI Controller
 * Serial communication with SCPI-compatible instruments
 * (Rigol DM3058E, Keysight 34460A, Korad KA3005P, etc.)
 */

import type { ScpiResponse, ScpiMeasurement } from '../types.js';

interface ScpiControllerOptions {
  path: string;
  baudRate?: number;
  timeout?: number;
  instrumentId?: string;
}

/**
 * SCPI (Standard Commands for Programmable Instruments) controller
 * Manages serial connection and command/response cycle
 */
export class ScpiController {
  private port: any = null;
  private parser: any = null;
  private readonly path: string;
  private readonly baudRate: number;
  private readonly timeout: number;
  private readonly instrumentId: string;
  private connected = false;

  constructor(options: ScpiControllerOptions) {
    this.path = options.path;
    this.baudRate = options.baudRate || 9600;
    this.timeout = options.timeout || 5000;
    this.instrumentId = options.instrumentId || 'unknown';
  }

  /**
   * Open serial connection to instrument
   */
  async connect(): Promise<void> {
    const { SerialPort } = await import('serialport');
    const { ReadlineParser } = await import('@serialport/parser-readline');

    this.port = new SerialPort({
      path: this.path,
      baudRate: this.baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });

    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

    return new Promise((resolve, reject) => {
      this.port.open((err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open ${this.path}: ${err.message}`));
        } else {
          this.connected = true;
          resolve();
        }
      });
    });
  }

  /**
   * Send SCPI command and read response
   */
  async send(command: string): Promise<ScpiResponse> {
    if (!this.connected || !this.port) {
      throw new Error('Not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`SCPI timeout after ${this.timeout}ms for: ${command}`));
      }, this.timeout);

      // Listen for response (queries end with ?)
      const isQuery = command.trim().endsWith('?');

      if (isQuery) {
        this.parser.once('data', (data: string) => {
          clearTimeout(timer);
          const raw = data.trim();
          const parsed = parseScpiValue(raw);
          resolve({
            raw,
            value: parsed.value,
            unit: parsed.unit,
            timestamp: new Date(),
          });
        });
      }

      // Write command
      this.port.write(command + '\n', (err: Error | null) => {
        if (err) {
          clearTimeout(timer);
          reject(new Error(`Write error: ${err.message}`));
          return;
        }

        // Non-query commands resolve immediately
        if (!isQuery) {
          clearTimeout(timer);
          resolve({ raw: 'OK', timestamp: new Date() });
        }
      });
    });
  }

  /**
   * Send command and get numeric measurement
   */
  async measure(command: string): Promise<ScpiMeasurement> {
    const response = await this.send(command);
    return {
      command,
      response,
      instrumentId: this.instrumentId,
      measuredAt: new Date(),
    };
  }

  /**
   * Query instrument identity (*IDN?)
   */
  async identify(): Promise<string> {
    const response = await this.send('*IDN?');
    return response.raw;
  }

  /**
   * Reset instrument to defaults (*RST)
   */
  async reset(): Promise<void> {
    await this.send('*RST');
  }

  /**
   * Measure DC voltage
   */
  async measureDCVoltage(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:VOLT:DC?');
  }

  /**
   * Measure AC voltage
   */
  async measureACVoltage(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:VOLT:AC?');
  }

  /**
   * Measure DC current
   */
  async measureDCCurrent(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:CURR:DC?');
  }

  /**
   * Measure AC current
   */
  async measureACCurrent(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:CURR:AC?');
  }

  /**
   * Measure resistance (2-wire)
   */
  async measureResistance(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:RES?');
  }

  /**
   * Measure frequency
   */
  async measureFrequency(): Promise<ScpiMeasurement> {
    return this.measure('MEAS:FREQ?');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close serial connection
   */
  async disconnect(): Promise<void> {
    if (this.port && this.connected) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.connected = false;
          this.port = null;
          this.parser = null;
          resolve();
        });
      });
    }
  }
}

/**
 * Parse SCPI response value into number and unit
 */
function parseScpiValue(raw: string): { value?: number; unit?: string } {
  // Try to parse as a plain number (most common SCPI response)
  const num = parseFloat(raw);
  if (!isNaN(num)) {
    // Check for scientific notation like +1.23456E+02
    return { value: num };
  }

  // Try to extract number with unit suffix
  const match = raw.match(/^([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*(\w+)?$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2] || undefined,
    };
  }

  return {};
}
