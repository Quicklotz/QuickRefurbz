/**
 * QuickTestz Bridge - SCPI Instrument Adapter
 * Implements PowerControllerAdapter using a registered SCPI multimeter.
 *
 * Note: SCPI instruments can measure but cannot control outlets.
 * turnOn/turnOff are no-ops. Use alongside a real power controller
 * (Shelly, IoTaWatt) for outlet control.
 */

import type { PowerControllerAdapter } from '../../quicktestz/adapters/interface.js';
import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../../quicktestz/types.js';
import { ScpiController } from '../instruments/scpi.js';
import { getInstrument } from '../instruments/registry.js';

export class ScpiInstrumentAdapter implements PowerControllerAdapter {
  readonly name = 'SCPI Instrument';
  private readonly instrumentId: string;
  private controller: ScpiController | null = null;

  constructor(instrumentId: string) {
    this.instrumentId = instrumentId;
  }

  /**
   * No-op: SCPI instruments cannot control power outlets
   */
  async turnOn(_station: TestStation, _outlet: TestOutlet): Promise<void> {
    // SCPI instruments are measurement-only, they cannot energize outlets
  }

  /**
   * No-op: SCPI instruments cannot control power outlets
   */
  async turnOff(_station: TestStation, _outlet: TestOutlet): Promise<void> {
    // SCPI instruments are measurement-only, they cannot de-energize outlets
  }

  /**
   * Read instantaneous AC voltage and current from the SCPI instrument,
   * compute watts from V * A.
   */
  async getInstantReadings(_station: TestStation, _outlet: TestOutlet): Promise<InstantReadings> {
    const ctrl = await this.ensureConnected();

    const [voltageMeas, currentMeas] = await Promise.all([
      ctrl.measure('MEAS:VOLT:AC?'),
      ctrl.measure('MEAS:CURR:AC?'),
    ]);

    const volts = voltageMeas.response.value;
    const amps = currentMeas.response.value;
    const watts = volts !== undefined && amps !== undefined
      ? volts * amps
      : undefined;

    return {
      watts,
      volts,
      amps,
      raw: {
        source: 'scpi_instrument',
        instrumentId: this.instrumentId,
        voltageRaw: voltageMeas.response.raw,
        currentRaw: currentMeas.response.raw,
      },
    };
  }

  /**
   * Verify instrument is reachable by sending *IDN?
   */
  async healthCheck(_station: TestStation): Promise<HealthCheckResult> {
    try {
      const ctrl = await this.ensureConnected();
      const idn = await ctrl.identify();
      return {
        ok: true,
        details: {
          instrumentId: this.instrumentId,
          identity: idn,
        },
      };
    } catch (err) {
      return {
        ok: false,
        details: {
          instrumentId: this.instrumentId,
          error: (err as Error).message,
        },
      };
    }
  }

  /**
   * Disconnect the underlying SCPI controller
   */
  async disconnect(): Promise<void> {
    if (this.controller) {
      await this.controller.disconnect();
      this.controller = null;
    }
  }

  private async ensureConnected(): Promise<ScpiController> {
    if (this.controller?.isConnected()) {
      return this.controller;
    }

    const instrument = await getInstrument(this.instrumentId);
    if (!instrument) {
      throw new Error(`SCPI instrument not found: ${this.instrumentId}`);
    }

    this.controller = new ScpiController({
      path: instrument.connectionPath,
      baudRate: instrument.baudRate,
      instrumentId: instrument.id,
    });

    await this.controller.connect();
    return this.controller;
  }
}
