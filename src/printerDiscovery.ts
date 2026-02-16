/**
 * QuickRefurbz - Printer Discovery
 * Auto-detect Zebra label printers on the local network via TCP port 9100
 */

import net from 'net';

export interface DiscoveredPrinter {
  ip: string;
  port: number;
  model: string;
  serial: string;
  firmware: string;
  status: 'online' | 'error';
  responseTime: number;
}

export interface PrinterStatus {
  ip: string;
  online: boolean;
  model?: string;
  serial?: string;
  firmware?: string;
  labelWidthDots?: number;
  labelLengthDots?: number;
  paperOut?: boolean;
  headOpen?: boolean;
  paused?: boolean;
}

/**
 * Discover printers on the local /24 subnet by scanning port 9100.
 * Optionally provide a subnet base like "192.168.1" — defaults to common subnets.
 */
export async function discoverPrinters(subnetBase?: string): Promise<DiscoveredPrinter[]> {
  const subnets = subnetBase
    ? [subnetBase]
    : ['192.168.1', '192.168.0', '10.0.0', '10.0.1', '172.16.0'];

  const found: DiscoveredPrinter[] = [];
  const scanPromises: Promise<void>[] = [];

  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      scanPromises.push(
        probePort(ip, 9100, 300).then(async (open) => {
          if (open) {
            try {
              const info = await queryPrinterInfo(ip);
              found.push(info);
            } catch {
              found.push({
                ip,
                port: 9100,
                model: 'Unknown',
                serial: '',
                firmware: '',
                status: 'online',
                responseTime: 0,
              });
            }
          }
        })
      );
    }
  }

  // Run in batches of 50 to avoid socket exhaustion
  const batchSize = 50;
  for (let i = 0; i < scanPromises.length; i += batchSize) {
    await Promise.all(scanPromises.slice(i, i + batchSize));
  }

  return found;
}

/**
 * Check if a single printer is online and get its info.
 */
export async function checkPrinterStatus(ip: string): Promise<PrinterStatus> {
  const online = await probePort(ip, 9100, 3000);
  if (!online) {
    return { ip, online: false };
  }

  try {
    const info = await queryPrinterInfo(ip);
    const hostStatus = await queryHostStatus(ip);

    return {
      ip,
      online: true,
      model: info.model,
      serial: info.serial,
      firmware: info.firmware,
      ...hostStatus,
    };
  } catch {
    return { ip, online: true };
  }
}

/**
 * Get the configured label size from the printer via ~HS command.
 */
export async function getPrinterLabelSize(ip: string): Promise<{
  labelWidthDots: number;
  labelLengthDots: number;
  dpi: number;
  widthMm: number;
  heightMm: number;
}> {
  const status = await queryHostStatus(ip);
  const dpi = 203; // Standard Zebra DPI
  return {
    labelWidthDots: status.labelWidthDots || 406,
    labelLengthDots: status.labelLengthDots || 203,
    dpi,
    widthMm: Math.round(((status.labelWidthDots || 406) / dpi) * 25.4 * 10) / 10,
    heightMm: Math.round(((status.labelLengthDots || 203) / dpi) * 25.4 * 10) / 10,
  };
}

// --- Internal helpers ---

function probePort(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

function sendCommand(ip: string, command: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';

    socket.setTimeout(timeoutMs);

    socket.connect(9100, ip, () => {
      socket.write(command);
    });

    socket.on('data', (chunk) => {
      data += chunk.toString();
    });

    // Give the printer 500ms to finish responding, then close
    socket.on('data', () => {
      setTimeout(() => {
        socket.destroy();
        resolve(data);
      }, 500);
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (data) resolve(data);
      else reject(new Error('Printer command timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function queryPrinterInfo(ip: string): Promise<DiscoveredPrinter> {
  const start = Date.now();
  const response = await sendCommand(ip, '~HI');
  const responseTime = Date.now() - start;

  // Parse ~HI response: "Model,Firmware,DPI,Memory,Options"
  // Example: "ZD421-300dpi ZPL,V84.20.21Z,300,524288,N"
  const parts = response.trim().split(',');

  return {
    ip,
    port: 9100,
    model: parts[0]?.trim() || 'Zebra Printer',
    firmware: parts[1]?.trim() || '',
    serial: parts.length > 4 ? parts[4]?.trim() : '',
    status: 'online',
    responseTime,
  };
}

async function queryHostStatus(ip: string): Promise<{
  labelWidthDots?: number;
  labelLengthDots?: number;
  paperOut?: boolean;
  headOpen?: boolean;
  paused?: boolean;
}> {
  try {
    const response = await sendCommand(ip, '~HS');
    // Parse ~HS response — three lines of CSV data
    // Line 1: print-width, label-length, ...
    const lines = response.trim().split('\n').map((l) => l.trim());
    if (lines.length < 1) return {};

    const fields = lines[0].replace(/[^\d,]/g, '').split(',');
    return {
      labelWidthDots: fields[1] ? parseInt(fields[1]) : undefined,
      labelLengthDots: fields[2] ? parseInt(fields[2]) : undefined,
      paperOut: fields[3] === '1',
      headOpen: fields[4] === '1',
      paused: fields[0] === '1',
    };
  } catch {
    return {};
  }
}
