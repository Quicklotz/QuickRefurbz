/**
 * QuickTestz - Manual Adapter
 * For stations without automated switching/metering.
 * All operations are operator-driven: turnOn/turnOff log instructions,
 * readings are entered manually via the operator checklist.
 */

import type { TestStation, TestOutlet, InstantReadings, HealthCheckResult } from '../types.js';
import type { PowerControllerAdapter } from './interface.js';

export class ManualAdapter implements PowerControllerAdapter {
  readonly name = 'Manual';

  async turnOn(_station: TestStation, outlet: TestOutlet): Promise<void> {
    console.log(`[ManualAdapter] OPERATOR: Please turn ON outlet "${outlet.label}" (channel ${outlet.controllerChannel})`);
    // In the API flow, the frontend will prompt the operator to confirm
  }

  async turnOff(_station: TestStation, outlet: TestOutlet): Promise<void> {
    console.log(`[ManualAdapter] OPERATOR: Please turn OFF outlet "${outlet.label}" (channel ${outlet.controllerChannel})`);
  }

  async getInstantReadings(_station: TestStation, _outlet: TestOutlet): Promise<InstantReadings> {
    // Manual adapter has no automated readings
    return {
      raw: { source: 'manual', message: 'No automated readings - use operator checklist' },
    };
  }

  async healthCheck(_station: TestStation): Promise<HealthCheckResult> {
    // Manual stations are always "ok" - operator is the controller
    return {
      ok: true,
      details: { message: 'Manual station - operator-controlled' },
    };
  }
}
