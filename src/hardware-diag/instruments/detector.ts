/**
 * Hardware Diagnostics - Port Detector
 * USB/serial port enumeration and auto-detection of known instruments
 */

import {
  DetectedPort,
  KnownInstrumentMatch,
  KNOWN_INSTRUMENTS,
} from '../types.js';

/**
 * Detect available serial/USB ports
 * Uses the serialport package for enumeration
 */
export async function detectPorts(): Promise<DetectedPort[]> {
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();

    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || undefined,
      productId: port.productId || undefined,
      vendorId: port.vendorId || undefined,
      serialNumber: port.serialNumber || undefined,
      pnpId: port.pnpId || undefined,
      friendlyName: (port as any).friendlyName || undefined,
    }));
  } catch (error) {
    // serialport not installed or no permissions
    const err = error as Error;
    if (err.message?.includes('Cannot find module')) {
      throw new Error(
        'serialport package not installed. Run: npm install serialport @serialport/parser-readline'
      );
    }
    throw error;
  }
}

/**
 * Match detected ports against known instrument VID/PID database
 */
export function matchKnownInstruments(
  ports: DetectedPort[]
): KnownInstrumentMatch[] {
  const matches: KnownInstrumentMatch[] = [];

  for (const port of ports) {
    if (!port.vendorId) continue;

    const vid = port.vendorId.toUpperCase();
    const pid = port.productId?.toUpperCase();

    for (const known of KNOWN_INSTRUMENTS) {
      const knownVid = known.vendorId.toUpperCase();
      const knownPid = known.productId?.toUpperCase();

      if (vid === knownVid) {
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

        if (knownPid && pid === knownPid) {
          confidence = 'HIGH';
        } else if (!knownPid) {
          confidence = 'MEDIUM';
        } else {
          continue; // PID mismatch
        }

        matches.push({
          port,
          type: known.type,
          manufacturer: known.manufacturer,
          model: known.model,
          confidence,
        });
      }
    }
  }

  return matches;
}

/**
 * Pretty-print detected port info
 */
export function formatPort(port: DetectedPort): string {
  const parts = [port.path];

  if (port.manufacturer) parts.push(`[${port.manufacturer}]`);
  if (port.vendorId && port.productId) {
    parts.push(`VID:${port.vendorId} PID:${port.productId}`);
  }
  if (port.serialNumber) parts.push(`S/N:${port.serialNumber}`);

  return parts.join(' ');
}
