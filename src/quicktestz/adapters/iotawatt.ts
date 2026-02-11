/**
 * QuickTestz - IoTaWatt HTTP Adapter
 * Reads per-channel power data from IoTaWatt energy monitor.
 *
 * IoTaWatt exposes a query API for real-time readings:
 *   GET /query?select=[channel.Watts,channel.Volts,channel.Amps]
 *
 * Note: IoTaWatt is a monitoring device - it does NOT control outlets.
 * turnOn/turnOff are no-ops (IoTaWatt must be paired with a separate relay/switch).
 */

import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../types.js';
import type { PowerControllerAdapter } from './interface.js';

export class IoTaWattAdapter implements PowerControllerAdapter {
  readonly name = 'IoTaWatt (HTTP)';

  async turnOn(_station: TestStation, _outlet: TestOutlet): Promise<void> {
    // IoTaWatt is monitor-only; outlet switching must be handled by external relay
    console.warn('[IoTaWattAdapter] turnOn is a no-op - IoTaWatt is monitor-only');
  }

  async turnOff(_station: TestStation, _outlet: TestOutlet): Promise<void> {
    // IoTaWatt is monitor-only
    console.warn('[IoTaWattAdapter] turnOff is a no-op - IoTaWatt is monitor-only');
  }

  async getInstantReadings(station: TestStation, outlet: TestOutlet): Promise<InstantReadings> {
    const base = this.baseUrl(station);
    const ch = outlet.controllerChannel;

    // IoTaWatt query API: select=[channel_N.Watts,channel_N.Volts,channel_N.Amps]
    const select = `[${ch}.Watts,${ch}.Volts,${ch}.Amps]`;
    const url = `${base}/query?select=${encodeURIComponent(select)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) {
      throw new Error(`IoTaWatt query failed: ${resp.status}`);
    }

    const data = await resp.json() as number[];
    // IoTaWatt returns array matching the select order
    return {
      watts: typeof data[0] === 'number' ? data[0] : undefined,
      volts: typeof data[1] === 'number' ? data[1] : undefined,
      amps: typeof data[2] === 'number' ? data[2] : undefined,
      raw: { channel: ch, response: data },
    };
  }

  async healthCheck(station: TestStation): Promise<HealthCheckResult> {
    try {
      const base = this.baseUrl(station);
      const resp = await fetch(`${base}/status`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        return { ok: false, details: { error: `HTTP ${resp.status}` } };
      }

      const data = await resp.json() as Record<string, unknown>;
      return {
        ok: true,
        details: data,
      };
    } catch (err) {
      return {
        ok: false,
        details: { error: String(err) },
      };
    }
  }

  // ==================== PRIVATE ====================

  private baseUrl(station: TestStation): string {
    const base = station.controllerBaseUrl?.replace(/\/$/, '');
    if (!base) throw new Error('IoTaWatt adapter requires controllerBaseUrl (e.g. http://192.168.1.101)');
    return base;
  }
}
