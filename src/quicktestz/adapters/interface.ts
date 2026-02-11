/**
 * QuickTestz - Power Controller Adapter Interface
 * All controller adapters must implement this interface.
 *
 * Safety contract:
 *   - turnOn() must verify station safety flags before energizing
 *   - turnOff() must always succeed (best-effort de-energize)
 *   - healthCheck() must return ok:false if controller unreachable
 */

import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../types.js';
import { ShellyAdapter } from './shelly.js';
import { IoTaWattAdapter } from './iotawatt.js';
import { SnmpPduAdapter } from './snmp-pdu.js';
import { ManualAdapter } from './manual.js';

export interface PowerControllerAdapter {
  /** Human-readable adapter name */
  readonly name: string;

  /** Turn an outlet ON (energize) */
  turnOn(station: TestStation, outlet: TestOutlet): Promise<void>;

  /** Turn an outlet OFF (de-energize) - must be best-effort, never throw */
  turnOff(station: TestStation, outlet: TestOutlet): Promise<void>;

  /** Read instantaneous power metrics from the outlet */
  getInstantReadings(station: TestStation, outlet: TestOutlet): Promise<InstantReadings>;

  /** Health-check the controller (reachable, firmware OK, etc.) */
  healthCheck(station: TestStation): Promise<HealthCheckResult>;
}

/**
 * Factory: resolve adapter by controller type string
 */
export function getAdapter(controllerType: string): PowerControllerAdapter {
  switch (controllerType) {
    case 'SHELLY_GEN2_HTTP':
      return new ShellyAdapter();
    case 'IOTAWATT_HTTP':
      return new IoTaWattAdapter();
    case 'SNMP_PDU':
      return new SnmpPduAdapter();
    case 'MANUAL':
      return new ManualAdapter();
    default:
      throw new Error(`Unknown controller type: ${controllerType}`);
  }
}
