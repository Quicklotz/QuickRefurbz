/**
 * QuickTestz - Shelly Gen2 HTTP Adapter
 * Controls Shelly Pro 4PM (or similar Gen2 devices) via local HTTP API.
 *
 * API reference: Shelly Gen2 HTTP RPC
 *   - Switch.Set     { id: <channel>, on: true/false }
 *   - Switch.GetStatus { id: <channel> }  → apower, voltage, current
 *   - Shelly.GetStatus                   → device overview + all channels
 */

import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../types.js';
import type { PowerControllerAdapter } from './interface.js';

export class ShellyAdapter implements PowerControllerAdapter {
  readonly name = 'Shelly Gen2 (HTTP)';

  async turnOn(station: TestStation, outlet: TestOutlet): Promise<void> {
    const url = this.rpcUrl(station, 'Switch.Set');
    const body = { id: Number(outlet.controllerChannel), on: true };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`Shelly turnOn failed: ${resp.status} ${await resp.text()}`);
    }
  }

  async turnOff(station: TestStation, outlet: TestOutlet): Promise<void> {
    try {
      const url = this.rpcUrl(station, 'Switch.Set');
      const body = { id: Number(outlet.controllerChannel), on: false };
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        console.error(`[ShellyAdapter] turnOff non-OK: ${resp.status}`);
      }
    } catch (err) {
      // Best-effort: log but don't throw
      console.error(`[ShellyAdapter] turnOff error (best-effort):`, err);
    }
  }

  async getInstantReadings(station: TestStation, outlet: TestOutlet): Promise<InstantReadings> {
    const url = this.rpcUrl(station, 'Switch.GetStatus');
    const body = { id: Number(outlet.controllerChannel) };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) {
      throw new Error(`Shelly getInstantReadings failed: ${resp.status}`);
    }

    const data = await resp.json() as Record<string, unknown>;

    return {
      watts: typeof data.apower === 'number' ? data.apower : undefined,
      volts: typeof data.voltage === 'number' ? data.voltage : undefined,
      amps: typeof data.current === 'number' ? data.current : undefined,
      raw: data,
    };
  }

  async healthCheck(station: TestStation): Promise<HealthCheckResult> {
    try {
      const url = this.rpcUrl(station, 'Shelly.GetStatus');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        return { ok: false, details: { error: `HTTP ${resp.status}` } };
      }

      const data = await resp.json() as Record<string, unknown>;
      return {
        ok: true,
        details: {
          firmware: (data.sys as Record<string, unknown>)?.available_updates,
          uptime: (data.sys as Record<string, unknown>)?.uptime,
          ...data,
        },
      };
    } catch (err) {
      return {
        ok: false,
        details: { error: String(err) },
      };
    }
  }

  // ==================== PRIVATE ====================

  private rpcUrl(station: TestStation, method: string): string {
    const base = station.controllerBaseUrl?.replace(/\/$/, '');
    if (!base) throw new Error('Shelly adapter requires controllerBaseUrl (e.g. http://192.168.1.100)');
    return `${base}/rpc/${method}`;
  }
}
