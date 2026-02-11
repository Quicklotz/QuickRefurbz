/**
 * QuickTestz - Equipment Catalog Seed Data
 * Pre-populates the equipment catalog with known test bench hardware.
 */

import * as equipmentCatalog from '../services/equipmentCatalog.js';
import * as profileManager from '../services/profileManager.js';
import type { EquipmentCatalogInput, TestProfileInput } from '../types.js';

const SEED_EQUIPMENT: EquipmentCatalogInput[] = [
  {
    name: 'Shelly Pro 4PM',
    category: 'Smart Relay',
    vendor: 'Shelly',
    model: 'Pro 4PM',
    integrationType: 'SHELLY_GEN2_HTTP',
    connection: ['LAN', 'WiFi'],
    capabilities: ['outlet_on_off', 'per_channel_power_metering', '4_channels'],
    linkUrl: 'https://www.shelly.com/en-us/products/shop/shelly-pro-4-pm',
    requiredForCategories: ['VACUUM', 'ICE_MAKER', 'SMALL_APPLIANCE'],
    notes: '4-channel relay with power metering per channel. DIN rail mount.',
  },
  {
    name: 'IoTaWatt',
    category: 'Energy Monitor',
    vendor: 'IoTaWatt',
    model: 'IoTaWatt',
    integrationType: 'IOTAWATT_HTTP',
    connection: ['WiFi'],
    capabilities: ['per_channel_power_metering', '14_channels', 'ct_clamps'],
    linkUrl: 'https://iotawatt.com/',
    requiredForCategories: ['VACUUM', 'ICE_MAKER', 'SMALL_APPLIANCE'],
    notes: '14-channel CT clamp energy monitor with HTTP API.',
  },
  {
    name: 'APC Switched Rack PDU',
    category: 'PDU',
    vendor: 'APC',
    model: 'AP7900B',
    integrationType: 'SNMP_PDU',
    connection: ['LAN'],
    capabilities: ['outlet_on_off', 'bank_metering', 'snmp_v2c'],
    linkUrl: 'https://www.apc.com/us/en/product/AP7900B/',
    requiredForCategories: [],
    notes: '8-outlet switched PDU with SNMP management. Good for rack-mounted setups.',
  },
  {
    name: 'StacoVT Variable Transformer (Variac)',
    category: 'Power Supply',
    vendor: 'Staco Energy',
    model: 'VT Series',
    integrationType: 'MANUAL',
    connection: [],
    capabilities: ['variable_voltage', 'manual_control'],
    requiredForCategories: ['SMALL_APPLIANCE'],
    notes: 'Variable transformer for testing at different voltages. Manual control only.',
  },
  {
    name: 'Leviton GFCI Outlet',
    category: 'Safety',
    vendor: 'Leviton',
    model: 'GFNT2-W',
    integrationType: 'MANUAL',
    connection: [],
    capabilities: ['gfci_protection'],
    requiredForCategories: ['VACUUM', 'ICE_MAKER', 'SMALL_APPLIANCE'],
    notes: 'Required at every test station for operator safety. 20A rated.',
  },
  {
    name: 'Dwyer Magnehelic Differential Pressure Gauge',
    category: 'Measurement',
    vendor: 'Dwyer',
    model: 'Series 2000',
    integrationType: 'MANUAL',
    connection: [],
    capabilities: ['pressure_measurement', 'suction_testing'],
    requiredForCategories: ['VACUUM'],
    notes: 'Measures vacuum suction pressure for vacuum motor health assessment.',
  },
];

const SEED_PROFILES: TestProfileInput[] = [
  {
    category: 'VACUUM',
    name: 'Vacuum - Standard Power Test',
    thresholds: {
      maxPeakWatts: 1500,
      minStableWatts: 200,
      maxStableWatts: 1200,
      spikeShutdownWatts: 2000,
      minRunSeconds: 30,
    },
    operatorChecklist: [
      { id: 'vac-motor-sound', label: 'Motor runs smoothly (no grinding/scraping)', type: 'boolean', required: true },
      { id: 'vac-suction', label: 'Suction present at nozzle', type: 'boolean', required: true },
      { id: 'vac-brushroll', label: 'Brush roll spins freely', type: 'boolean', required: false },
      { id: 'vac-cord', label: 'Power cord intact, no damage', type: 'boolean', required: true },
      { id: 'vac-suction-psi', label: 'Suction reading (inches of water)', type: 'number', required: false },
      { id: 'vac-notes', label: 'Additional observations', type: 'text', required: false },
    ],
  },
  {
    category: 'ICE_MAKER',
    name: 'Ice Maker - Compressor & Cycle Test',
    thresholds: {
      maxPeakWatts: 300,
      minStableWatts: 60,
      maxStableWatts: 200,
      spikeShutdownWatts: 500,
      minRunSeconds: 120,
    },
    operatorChecklist: [
      { id: 'ice-compressor', label: 'Compressor starts and runs', type: 'boolean', required: true },
      { id: 'ice-fan', label: 'Fan operates', type: 'boolean', required: true },
      { id: 'ice-water-pump', label: 'Water pump cycles', type: 'boolean', required: true },
      { id: 'ice-no-leak', label: 'No water leaks observed', type: 'boolean', required: true },
      { id: 'ice-temp', label: 'Evaporator gets cold to touch', type: 'boolean', required: true },
      { id: 'ice-noise', label: 'No abnormal noises', type: 'boolean', required: true },
      { id: 'ice-notes', label: 'Additional observations', type: 'text', required: false },
    ],
  },
  {
    category: 'SMALL_APPLIANCE',
    name: 'Small Appliance - General Power Test',
    thresholds: {
      maxPeakWatts: 1800,
      minStableWatts: 5,
      maxStableWatts: 1500,
      spikeShutdownWatts: 2500,
      minRunSeconds: 15,
    },
    operatorChecklist: [
      { id: 'app-powers-on', label: 'Device powers on', type: 'boolean', required: true },
      { id: 'app-controls', label: 'Controls respond (buttons/dials)', type: 'boolean', required: true },
      { id: 'app-function', label: 'Primary function operates', type: 'boolean', required: true },
      { id: 'app-cord', label: 'Power cord intact', type: 'boolean', required: true },
      { id: 'app-smell', label: 'No burning smell', type: 'boolean', required: true },
      { id: 'app-notes', label: 'Additional observations', type: 'text', required: false },
    ],
  },
];

/**
 * Seed equipment catalog and test profiles (idempotent - skips if data exists)
 */
export async function seedEquipmentAndProfiles(): Promise<{
  equipmentSeeded: number;
  profilesSeeded: number;
}> {
  let equipmentSeeded = 0;
  let profilesSeeded = 0;

  // Check if equipment already seeded
  const existingEquipment = await equipmentCatalog.listEquipment();
  if (existingEquipment.length === 0) {
    for (const item of SEED_EQUIPMENT) {
      await equipmentCatalog.createEquipment(item);
      equipmentSeeded++;
    }
  }

  // Check if profiles already seeded
  const existingProfiles = await profileManager.listProfiles();
  if (existingProfiles.length === 0) {
    for (const profile of SEED_PROFILES) {
      await profileManager.createProfile(profile);
      profilesSeeded++;
    }
  }

  return { equipmentSeeded, profilesSeeded };
}
