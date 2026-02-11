/**
 * QuickTestz - SNMP PDU Adapter
 * Controls rack PDUs (APC, Raritan, etc.) via SNMP for outlet switching.
 *
 * Uses HTTP-to-SNMP bridge pattern: expects an snmp-proxy or direct
 * SNMP library integration. For now, uses a simple HTTP wrapper around
 * snmpwalk/snmpset commands via child_process (no native SNMP dep needed).
 *
 * OIDs for APC Switched Rack PDU (common):
 *   Outlet control: .1.3.6.1.4.1.318.1.1.4.4.2.1.3.<outlet>
 *     1=on, 2=off, 3=reboot
 *   Outlet status: .1.3.6.1.4.1.318.1.1.12.3.5.1.1.4.<outlet>
 *   Current (tenths of amps): .1.3.6.1.4.1.318.1.1.12.2.3.1.1.2.<bank>
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../types.js';
import type { PowerControllerAdapter } from './interface.js';

const execAsync = promisify(exec);

// APC Switched Rack PDU OIDs
const OID_OUTLET_CONTROL = '.1.3.6.1.4.1.318.1.1.4.4.2.1.3';
const OID_OUTLET_STATUS = '.1.3.6.1.4.1.318.1.1.12.3.5.1.1.4';
const OID_BANK_CURRENT = '.1.3.6.1.4.1.318.1.1.12.2.3.1.1.2';
const OID_SYSNAME = '.1.3.6.1.2.1.1.5.0';

export class SnmpPduAdapter implements PowerControllerAdapter {
  readonly name = 'SNMP PDU';

  private community = 'private'; // write community
  private readCommunity = 'public';

  async turnOn(station: TestStation, outlet: TestOutlet): Promise<void> {
    const host = this.getHost(station);
    const ch = outlet.controllerChannel;
    const oid = `${OID_OUTLET_CONTROL}.${ch}`;

    try {
      await execAsync(
        `snmpset -v2c -c ${this.community} ${host} ${oid} i 1`,
        { timeout: 10000 }
      );
    } catch (err) {
      throw new Error(`SNMP PDU turnOn failed: ${err}`);
    }
  }

  async turnOff(station: TestStation, outlet: TestOutlet): Promise<void> {
    try {
      const host = this.getHost(station);
      const ch = outlet.controllerChannel;
      const oid = `${OID_OUTLET_CONTROL}.${ch}`;

      await execAsync(
        `snmpset -v2c -c ${this.community} ${host} ${oid} i 2`,
        { timeout: 10000 }
      );
    } catch (err) {
      // Best-effort
      console.error(`[SnmpPduAdapter] turnOff error (best-effort):`, err);
    }
  }

  async getInstantReadings(station: TestStation, outlet: TestOutlet): Promise<InstantReadings> {
    const host = this.getHost(station);
    const ch = outlet.controllerChannel;

    // Read outlet status and bank current
    try {
      const statusOid = `${OID_OUTLET_STATUS}.${ch}`;
      const currentOid = `${OID_BANK_CURRENT}.1`; // bank 1

      const [statusResult, currentResult] = await Promise.all([
        execAsync(`snmpget -v2c -c ${this.readCommunity} ${host} ${statusOid}`, { timeout: 5000 }),
        execAsync(`snmpget -v2c -c ${this.readCommunity} ${host} ${currentOid}`, { timeout: 5000 }),
      ]);

      // Parse SNMP responses
      const currentMatch = currentResult.stdout.match(/INTEGER:\s*(\d+)/);
      const currentTenths = currentMatch ? Number(currentMatch[1]) : undefined;

      return {
        amps: currentTenths !== undefined ? currentTenths / 10 : undefined,
        raw: {
          outletStatus: statusResult.stdout.trim(),
          bankCurrent: currentResult.stdout.trim(),
        },
      };
    } catch (err) {
      throw new Error(`SNMP PDU getInstantReadings failed: ${err}`);
    }
  }

  async healthCheck(station: TestStation): Promise<HealthCheckResult> {
    try {
      const host = this.getHost(station);

      const result = await execAsync(
        `snmpget -v2c -c ${this.readCommunity} ${host} ${OID_SYSNAME}`,
        { timeout: 5000 }
      );

      const nameMatch = result.stdout.match(/STRING:\s*"?(.+?)"?\s*$/);

      return {
        ok: true,
        details: {
          sysName: nameMatch ? nameMatch[1] : 'Unknown',
          raw: result.stdout.trim(),
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

  private getHost(station: TestStation): string {
    const url = station.controllerBaseUrl;
    if (!url) throw new Error('SNMP PDU adapter requires controllerBaseUrl (IP or hostname)');
    // Strip protocol if present (SNMP uses raw IP)
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
