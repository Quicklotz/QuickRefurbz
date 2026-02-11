/**
 * QuickRefurbz - Category SOPs
 * Standard Operating Procedures for each product category
 */

import type { RefurbState, WorkflowStep, ProductCategory, CategorySOP } from '../types.js';

// ==================== PHONE SOP ====================

const PHONE_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'phone-security-1',
    code: 'PHONE_FACTORY_RESET',
    name: 'Factory Reset',
    type: 'CHECKLIST',
    prompt: 'Perform factory reset on the device',
    helpText: 'Navigate to Settings > General > Reset > Erase All Content and Settings. Wait for the device to complete the reset process.',
    required: true,
    order: 1,
    checklistItems: [
      'Device powered on successfully',
      'Factory reset initiated from settings',
      'Reset completed - device shows setup screen',
    ],
  },
  {
    id: 'phone-security-2',
    code: 'PHONE_ICLOUD_CHECK',
    name: 'iCloud/Google Account Check',
    type: 'CHECKLIST',
    prompt: 'Verify device is not locked to any cloud account',
    helpText: 'For iOS: Check for Activation Lock. For Android: Check for Google FRP. If locked, route to BLOCKED.',
    required: true,
    order: 2,
    checklistItems: [
      'No Apple ID / Google Account signed in',
      'Activation Lock / FRP is disabled',
      'Find My iPhone / Find My Device is OFF',
    ],
  },
  {
    id: 'phone-security-3',
    code: 'PHONE_MDM_CHECK',
    name: 'MDM/Enterprise Check',
    type: 'CHECKLIST',
    prompt: 'Check for MDM profiles or enterprise enrollment',
    helpText: 'Check Settings > General > VPN & Device Management (iOS) or Settings > Security > Device admin apps (Android)',
    required: true,
    order: 3,
    checklistItems: [
      'No MDM profile present',
      'No enterprise enrollment detected',
      'Device is not supervised/managed',
    ],
  },
  {
    id: 'phone-security-4',
    code: 'PHONE_FIRMWARE_UPDATE',
    name: 'Firmware Update',
    type: 'CONFIRMATION',
    prompt: 'Update device to latest stable firmware (if not current)',
    helpText: 'Check Settings > General > Software Update. Update only if not on the latest version.',
    required: false,
    order: 4,
  },
];

const PHONE_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'phone-diag-1',
    code: 'PHONE_SCREEN_TEST',
    name: 'Display & Touch Test',
    type: 'INPUT',
    prompt: 'Test screen display and touch functionality',
    helpText: 'Use test pattern apps to check for dead pixels, burn-in, and touch responsiveness across all areas.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        displayFunctional: { type: 'boolean', title: 'Display powers on and shows image' },
        touchResponsive: { type: 'boolean', title: 'Touch responds across entire screen' },
        deadPixels: { type: 'string', enum: ['none', 'few', 'many'], title: 'Dead/stuck pixels' },
        burnIn: { type: 'boolean', title: 'Screen burn-in visible' },
        screenCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Physical condition' },
      },
      required: ['displayFunctional', 'touchResponsive', 'deadPixels', 'burnIn'],
    },
  },
  {
    id: 'phone-diag-2',
    code: 'PHONE_BATTERY_TEST',
    name: 'Battery Health Test',
    type: 'MEASUREMENT',
    prompt: 'Check battery health and capacity',
    helpText: 'iOS: Settings > Battery > Battery Health. Android: Use 3uTools or similar diagnostic tool.',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        batteryHealth: { type: 'number', minimum: 0, maximum: 100, title: 'Battery Health %' },
        cycleCount: { type: 'number', minimum: 0, title: 'Charge Cycle Count' },
        batterySwelling: { type: 'boolean', title: 'Battery swelling detected' },
        holdsCharge: { type: 'boolean', title: 'Battery holds charge normally' },
      },
      required: ['batteryHealth', 'batterySwelling', 'holdsCharge'],
    },
  },
  {
    id: 'phone-diag-3',
    code: 'PHONE_CAMERA_TEST',
    name: 'Camera Test',
    type: 'CHECKLIST',
    prompt: 'Test all camera functions',
    helpText: 'Open camera app and test front/rear cameras, flash, autofocus, and video recording.',
    required: true,
    order: 3,
    checklistItems: [
      'Front camera captures clear image',
      'Rear camera captures clear image',
      'Flash fires correctly',
      'Autofocus works properly',
      'Video recording works',
      'No visible lens damage or debris',
    ],
  },
  {
    id: 'phone-diag-4',
    code: 'PHONE_BUTTON_TEST',
    name: 'Physical Button Test',
    type: 'CHECKLIST',
    prompt: 'Test all physical buttons',
    helpText: 'Press each button multiple times to verify responsiveness and tactile feedback.',
    required: true,
    order: 4,
    checklistItems: [
      'Power button responsive',
      'Volume up button works',
      'Volume down button works',
      'Mute/ring switch works (if applicable)',
      'Home button works (if applicable)',
    ],
  },
  {
    id: 'phone-diag-5',
    code: 'PHONE_AUDIO_TEST',
    name: 'Audio Test',
    type: 'CHECKLIST',
    prompt: 'Test speakers and microphone',
    helpText: 'Play audio through speakers and test microphone with voice recording.',
    required: true,
    order: 5,
    checklistItems: [
      'Earpiece speaker works clearly',
      'Bottom speaker works clearly',
      'Microphone records audio clearly',
      'No distortion or crackling sounds',
    ],
  },
  {
    id: 'phone-diag-6',
    code: 'PHONE_CONNECTIVITY_TEST',
    name: 'Connectivity Test',
    type: 'CHECKLIST',
    prompt: 'Test wireless connectivity',
    helpText: 'Connect to WiFi, pair Bluetooth device, and test cellular if SIM available.',
    required: true,
    order: 6,
    checklistItems: [
      'WiFi connects and browses internet',
      'Bluetooth pairs successfully',
      'Cellular signal detected (if SIM available)',
      'GPS acquires location',
      'NFC works (if applicable)',
    ],
  },
  {
    id: 'phone-diag-7',
    code: 'PHONE_CHARGING_TEST',
    name: 'Charging Port Test',
    type: 'CHECKLIST',
    prompt: 'Test charging functionality',
    helpText: 'Connect charging cable and verify proper charging indication.',
    required: true,
    order: 7,
    checklistItems: [
      'Charging port accepts cable firmly',
      'Device shows charging indicator',
      'Wireless charging works (if applicable)',
    ],
  },
];

const PHONE_FINAL_TEST: WorkflowStep[] = [
  {
    id: 'phone-final-1',
    code: 'PHONE_FINAL_FUNCTION',
    name: 'Final Functionality Check',
    type: 'CHECKLIST',
    prompt: 'Verify all repairs completed and device fully functional',
    helpText: 'Re-verify all previously identified issues have been resolved.',
    required: true,
    order: 1,
    checklistItems: [
      'All diagnosed issues have been repaired',
      'Device boots normally without errors',
      'All hardware components tested and working',
      'No unexpected behavior observed',
    ],
  },
  {
    id: 'phone-final-2',
    code: 'PHONE_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade based on physical condition',
    helpText: 'A = Like new, B = Minor wear, C = Visible wear, no cracks',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        screenCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Screen condition' },
        bodyCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Body/frame condition' },
        overallGrade: { type: 'string', enum: ['A', 'B', 'C'], title: 'Overall cosmetic grade' },
      },
      required: ['screenCondition', 'bodyCondition', 'overallGrade'],
    },
  },
];

// ==================== LAPTOP SOP ====================

const LAPTOP_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'laptop-security-1',
    code: 'LAPTOP_BIOS_RESET',
    name: 'BIOS/UEFI Reset',
    type: 'CHECKLIST',
    prompt: 'Reset BIOS to factory defaults and check for passwords',
    helpText: 'Access BIOS setup on boot. Clear any passwords and reset to defaults.',
    required: true,
    order: 1,
    checklistItems: [
      'BIOS accessible (no password lock)',
      'BIOS reset to factory defaults',
      'Secure Boot configured appropriately',
      'Boot order set correctly',
    ],
  },
  {
    id: 'laptop-security-2',
    code: 'LAPTOP_SECURE_ERASE',
    name: 'Secure Disk Erase',
    type: 'CONFIRMATION',
    prompt: 'Perform secure erase of all storage devices',
    helpText: 'Use DBAN, Secure Erase, or manufacturer tools to wipe all drives.',
    required: true,
    order: 2,
  },
  {
    id: 'laptop-security-3',
    code: 'LAPTOP_OS_INSTALL',
    name: 'OS Installation',
    type: 'CHECKLIST',
    prompt: 'Install clean operating system',
    helpText: 'Install appropriate OS (Windows, macOS, ChromeOS) with latest updates.',
    required: true,
    order: 3,
    checklistItems: [
      'Clean OS installed',
      'All Windows/OS updates applied',
      'Device drivers installed',
      'No user accounts created (OOBE ready)',
    ],
  },
];

const LAPTOP_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'laptop-diag-1',
    code: 'LAPTOP_DISPLAY_TEST',
    name: 'Display Test',
    type: 'INPUT',
    prompt: 'Test display quality and functionality',
    helpText: 'Use test patterns to check for dead pixels, backlight issues, and color accuracy.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        displayWorks: { type: 'boolean', title: 'Display powers on' },
        deadPixels: { type: 'string', enum: ['none', 'few', 'many'], title: 'Dead pixels' },
        backlightUniform: { type: 'boolean', title: 'Backlight uniform (no bleeding)' },
        hingeCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Hinge condition' },
      },
      required: ['displayWorks', 'deadPixels', 'backlightUniform'],
    },
  },
  {
    id: 'laptop-diag-2',
    code: 'LAPTOP_KEYBOARD_TEST',
    name: 'Keyboard Test',
    type: 'CHECKLIST',
    prompt: 'Test all keyboard keys and backlight',
    helpText: 'Use keyboard tester to verify all keys register correctly.',
    required: true,
    order: 2,
    checklistItems: [
      'All keys register correctly',
      'No stuck or unresponsive keys',
      'Keyboard backlight works (if applicable)',
      'Function keys work properly',
    ],
  },
  {
    id: 'laptop-diag-3',
    code: 'LAPTOP_TRACKPAD_TEST',
    name: 'Trackpad Test',
    type: 'CHECKLIST',
    prompt: 'Test trackpad functionality',
    helpText: 'Test cursor movement, clicking, and gestures.',
    required: true,
    order: 3,
    checklistItems: [
      'Cursor tracks smoothly',
      'Left click works',
      'Right click works',
      'Multi-touch gestures work',
    ],
  },
  {
    id: 'laptop-diag-4',
    code: 'LAPTOP_PORT_TEST',
    name: 'Port Test',
    type: 'CHECKLIST',
    prompt: 'Test all ports and connections',
    helpText: 'Connect devices to each port to verify functionality.',
    required: true,
    order: 4,
    checklistItems: [
      'USB-A ports work',
      'USB-C ports work',
      'HDMI/DisplayPort output works',
      'Headphone jack works',
      'SD card reader works (if applicable)',
      'Ethernet port works (if applicable)',
    ],
  },
  {
    id: 'laptop-diag-5',
    code: 'LAPTOP_BATTERY_TEST',
    name: 'Battery Test',
    type: 'MEASUREMENT',
    prompt: 'Test battery health and capacity',
    helpText: 'Use battery report tools to check health percentage and cycle count.',
    required: true,
    order: 5,
    inputSchema: {
      type: 'object',
      properties: {
        batteryHealth: { type: 'number', minimum: 0, maximum: 100, title: 'Battery Health %' },
        cycleCount: { type: 'number', minimum: 0, title: 'Cycle Count' },
        estimatedRuntime: { type: 'number', minimum: 0, title: 'Estimated Runtime (hours)' },
        chargesNormally: { type: 'boolean', title: 'Charges normally' },
      },
      required: ['batteryHealth', 'chargesNormally'],
    },
  },
  {
    id: 'laptop-diag-6',
    code: 'LAPTOP_THERMAL_TEST',
    name: 'Thermal Test',
    type: 'MEASUREMENT',
    prompt: 'Check thermal performance under load',
    helpText: 'Run stress test and monitor temperatures. Check fan operation.',
    required: true,
    order: 6,
    inputSchema: {
      type: 'object',
      properties: {
        idleTemp: { type: 'number', title: 'Idle CPU Temp (C)' },
        loadTemp: { type: 'number', title: 'Load CPU Temp (C)' },
        fanWorks: { type: 'boolean', title: 'Fan operates correctly' },
        thermalThrottling: { type: 'boolean', title: 'Thermal throttling observed' },
      },
      required: ['fanWorks', 'thermalThrottling'],
    },
  },
];

const LAPTOP_FINAL_TEST: WorkflowStep[] = [
  {
    id: 'laptop-final-1',
    code: 'LAPTOP_STRESS_TEST',
    name: 'Stress Test',
    type: 'CONFIRMATION',
    prompt: 'Run 30-minute stress test to verify stability',
    helpText: 'Run CPU and GPU stress test. Monitor for crashes, overheating, or errors.',
    required: true,
    order: 1,
  },
  {
    id: 'laptop-final-2',
    code: 'LAPTOP_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        lidCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Lid/cover condition' },
        palmRestCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Palm rest condition' },
        overallGrade: { type: 'string', enum: ['A', 'B', 'C'], title: 'Overall grade' },
      },
      required: ['lidCondition', 'palmRestCondition', 'overallGrade'],
    },
  },
];

// ==================== TV SOP ====================

const TV_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'tv-security-1',
    code: 'TV_FACTORY_RESET',
    name: 'Factory Reset',
    type: 'CHECKLIST',
    prompt: 'Perform factory reset',
    helpText: 'Navigate to Settings > System > Reset to factory defaults.',
    required: true,
    order: 1,
    checklistItems: [
      'TV powered on successfully',
      'Factory reset initiated',
      'Reset completed - TV shows initial setup',
    ],
  },
  {
    id: 'tv-security-2',
    code: 'TV_ACCOUNT_REMOVAL',
    name: 'Account Removal',
    type: 'CHECKLIST',
    prompt: 'Verify all streaming accounts removed',
    helpText: 'Check all streaming apps are logged out and no linked devices.',
    required: true,
    order: 2,
    checklistItems: [
      'No streaming accounts signed in',
      'No linked/paired devices',
      'Parental controls cleared',
    ],
  },
  {
    id: 'tv-security-3',
    code: 'TV_FIRMWARE_UPDATE',
    name: 'Firmware Update',
    type: 'CONFIRMATION',
    prompt: 'Update TV firmware to latest version',
    helpText: 'Check Settings > Support > Software Update.',
    required: false,
    order: 3,
  },
];

const TV_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'tv-diag-1',
    code: 'TV_PANEL_TEST',
    name: 'Panel Test',
    type: 'INPUT',
    prompt: 'Test display panel quality',
    helpText: 'Use test patterns to check for dead pixels, uniformity, and color accuracy.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        panelType: { type: 'string', enum: ['LED', 'OLED', 'QLED', 'LCD'], title: 'Panel type' },
        deadPixels: { type: 'string', enum: ['none', 'few', 'many'], title: 'Dead/stuck pixels' },
        uniformity: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Brightness uniformity' },
        colorAccuracy: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Color accuracy' },
      },
      required: ['panelType', 'deadPixels', 'uniformity'],
    },
  },
  {
    id: 'tv-diag-2',
    code: 'TV_BACKLIGHT_TEST',
    name: 'Backlight Test',
    type: 'INPUT',
    prompt: 'Test backlight function (LED/LCD TVs)',
    helpText: 'Display black screen and check for backlight bleeding or dead zones.',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        backlightWorks: { type: 'boolean', title: 'Backlight powers on' },
        backlightBleeding: { type: 'string', enum: ['none', 'minor', 'moderate', 'severe'], title: 'Backlight bleeding' },
        deadZones: { type: 'boolean', title: 'Dead backlight zones present' },
      },
      required: ['backlightWorks', 'backlightBleeding', 'deadZones'],
    },
  },
  {
    id: 'tv-diag-3',
    code: 'TV_INPUT_TEST',
    name: 'Input Port Test',
    type: 'CHECKLIST',
    prompt: 'Test all input ports',
    helpText: 'Connect devices to each HDMI port and other inputs.',
    required: true,
    order: 3,
    checklistItems: [
      'HDMI 1 works',
      'HDMI 2 works',
      'HDMI 3 works (if applicable)',
      'HDMI 4 works (if applicable)',
      'USB ports work',
      'Antenna/cable input works',
      'AV/Component input works (if applicable)',
    ],
  },
  {
    id: 'tv-diag-4',
    code: 'TV_AUDIO_TEST',
    name: 'Audio Test',
    type: 'CHECKLIST',
    prompt: 'Test built-in speakers',
    helpText: 'Play audio content and verify speaker output.',
    required: true,
    order: 4,
    checklistItems: [
      'Left speaker works',
      'Right speaker works',
      'No distortion at normal volume',
      'Audio output ports work (optical, headphone)',
    ],
  },
  {
    id: 'tv-diag-5',
    code: 'TV_SMART_FEATURES',
    name: 'Smart TV Features',
    type: 'CHECKLIST',
    prompt: 'Test smart TV functionality',
    helpText: 'Connect to WiFi and test app functionality.',
    required: true,
    order: 5,
    checklistItems: [
      'WiFi connects successfully',
      'Smart apps load correctly',
      'Streaming apps functional',
      'Voice control works (if applicable)',
    ],
  },
  {
    id: 'tv-diag-6',
    code: 'TV_REMOTE_TEST',
    name: 'Remote Control Test',
    type: 'CHECKLIST',
    prompt: 'Test remote control pairing and function',
    helpText: 'Pair included remote and test all buttons.',
    required: true,
    order: 6,
    checklistItems: [
      'Remote pairs with TV',
      'All buttons functional',
      'IR remote works (if applicable)',
      'Voice button works (if applicable)',
    ],
  },
];

const TV_FINAL_TEST: WorkflowStep[] = [
  {
    id: 'tv-final-1',
    code: 'TV_BURN_IN_CHECK',
    name: 'Burn-In Check',
    type: 'INPUT',
    prompt: 'Check for image retention or burn-in',
    helpText: 'Display solid colors and gray screens to check for ghosting.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        burnInPresent: { type: 'boolean', title: 'Burn-in/image retention visible' },
        burnInSeverity: { type: 'string', enum: ['none', 'minor', 'moderate', 'severe'], title: 'Burn-in severity' },
      },
      required: ['burnInPresent'],
    },
  },
  {
    id: 'tv-final-2',
    code: 'TV_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        screenCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Screen condition' },
        bezelCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'], title: 'Bezel/frame condition' },
        standCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'missing'], title: 'Stand condition' },
        overallGrade: { type: 'string', enum: ['A', 'B', 'C'], title: 'Overall grade' },
      },
      required: ['screenCondition', 'bezelCondition', 'overallGrade'],
    },
  },
];

// ==================== GENERIC SOP ====================

const GENERIC_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'generic-security-1',
    code: 'GENERIC_FACTORY_RESET',
    name: 'Factory Reset',
    type: 'CONFIRMATION',
    prompt: 'Perform factory reset on the device',
    required: true,
    order: 1,
  },
  {
    id: 'generic-security-2',
    code: 'GENERIC_ACCOUNT_CHECK',
    name: 'Account Removal',
    type: 'CHECKLIST',
    prompt: 'Verify no user accounts remain on device',
    required: true,
    order: 2,
    checklistItems: [
      'No user accounts signed in',
      'Device ready for new user setup',
    ],
  },
];

const GENERIC_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'generic-diag-1',
    code: 'GENERIC_POWER_TEST',
    name: 'Power Test',
    type: 'CHECKLIST',
    prompt: 'Verify device powers on correctly',
    required: true,
    order: 1,
    checklistItems: [
      'Device powers on',
      'No error messages on boot',
      'Device reaches operational state',
    ],
  },
  {
    id: 'generic-diag-2',
    code: 'GENERIC_FUNCTION_TEST',
    name: 'Function Test',
    type: 'CHECKLIST',
    prompt: 'Test primary device functions',
    required: true,
    order: 2,
    checklistItems: [
      'Primary function works correctly',
      'Secondary functions work correctly',
      'No obvious defects observed',
    ],
  },
];

const GENERIC_FINAL_TEST: WorkflowStep[] = [
  {
    id: 'generic-final-1',
    code: 'GENERIC_FINAL_CHECK',
    name: 'Final Verification',
    type: 'CONFIRMATION',
    prompt: 'Verify all repairs complete and device functional',
    required: true,
    order: 1,
  },
  {
    id: 'generic-final-2',
    code: 'GENERIC_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        overallGrade: { type: 'string', enum: ['A', 'B', 'C'], title: 'Overall grade' },
      },
      required: ['overallGrade'],
    },
  },
];

// ==================== SOP MAPS ====================

const PHONE_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', PHONE_SECURITY_PREP],
  ['DIAGNOSED', PHONE_DIAGNOSIS],
  ['FINAL_TEST_IN_PROGRESS', PHONE_FINAL_TEST],
]);

const LAPTOP_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', LAPTOP_SECURITY_PREP],
  ['DIAGNOSED', LAPTOP_DIAGNOSIS],
  ['FINAL_TEST_IN_PROGRESS', LAPTOP_FINAL_TEST],
]);

const TV_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', TV_SECURITY_PREP],
  ['DIAGNOSED', TV_DIAGNOSIS],
  ['FINAL_TEST_IN_PROGRESS', TV_FINAL_TEST],
]);

const GENERIC_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', GENERIC_SECURITY_PREP],
  ['DIAGNOSED', GENERIC_DIAGNOSIS],
  ['FINAL_TEST_IN_PROGRESS', GENERIC_FINAL_TEST],
]);

// ==================== SOP SERVICE ====================

const CATEGORY_SOPS: Record<ProductCategory, Map<RefurbState, WorkflowStep[]>> = {
  PHONE: PHONE_SOP,
  TABLET: PHONE_SOP, // Tablets use phone SOP
  LAPTOP: LAPTOP_SOP,
  DESKTOP: LAPTOP_SOP, // Desktops use laptop SOP
  TV: TV_SOP,
  MONITOR: TV_SOP, // Monitors use TV SOP
  AUDIO: GENERIC_SOP,
  APPLIANCE_SMALL: GENERIC_SOP,
  APPLIANCE_LARGE: GENERIC_SOP,
  ICE_MAKER: GENERIC_SOP, // Ice makers use generic SOP
  VACUUM: GENERIC_SOP, // Vacuums use generic SOP
  GAMING: GENERIC_SOP,
  WEARABLE: PHONE_SOP, // Wearables use phone SOP
  OTHER: GENERIC_SOP,
};

/**
 * Get the SOP for a specific category
 */
export function getCategorySOP(category: ProductCategory): CategorySOP {
  const stateSteps = CATEGORY_SOPS[category] || GENERIC_SOP;
  return { category, stateSteps };
}

/**
 * Get steps for a specific state and category
 */
export function getStepsForState(
  state: RefurbState,
  category: ProductCategory
): WorkflowStep[] {
  const sop = CATEGORY_SOPS[category] || GENERIC_SOP;
  return sop.get(state) || [];
}

/**
 * Get all available category SOPs
 */
export function getAllCategorySOPs(): Record<ProductCategory, CategorySOP> {
  const result: Record<string, CategorySOP> = {};
  for (const [category, stateSteps] of Object.entries(CATEGORY_SOPS)) {
    result[category] = { category: category as ProductCategory, stateSteps };
  }
  return result as Record<ProductCategory, CategorySOP>;
}

// ==================== EXPORTED SOP OBJECTS ====================

/**
 * CategorySOPs - Exported object format for API
 */
export const CategorySOPs: Record<ProductCategory, { name: string; states: Record<RefurbState, WorkflowStep[]> }> = {
  PHONE: {
    name: 'Phone/Smartphone SOP',
    states: Object.fromEntries(PHONE_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  TABLET: {
    name: 'Tablet SOP',
    states: Object.fromEntries(PHONE_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  LAPTOP: {
    name: 'Laptop SOP',
    states: Object.fromEntries(LAPTOP_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  DESKTOP: {
    name: 'Desktop SOP',
    states: Object.fromEntries(LAPTOP_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  TV: {
    name: 'Television SOP',
    states: Object.fromEntries(TV_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  MONITOR: {
    name: 'Monitor SOP',
    states: Object.fromEntries(TV_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  AUDIO: {
    name: 'Audio Equipment SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  APPLIANCE_SMALL: {
    name: 'Small Appliance SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  APPLIANCE_LARGE: {
    name: 'Large Appliance SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  ICE_MAKER: {
    name: 'Ice Maker SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  VACUUM: {
    name: 'Vacuum SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  GAMING: {
    name: 'Gaming Equipment SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  WEARABLE: {
    name: 'Wearable Device SOP',
    states: Object.fromEntries(PHONE_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  OTHER: {
    name: 'Generic SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
};

/**
 * Get SOP for a category (convenience function for API)
 */
export function getSOPForCategory(category: ProductCategory): { name: string; states: Record<RefurbState, WorkflowStep[]> } {
  return CategorySOPs[category] || CategorySOPs['OTHER'];
}

// ==================== DEFECT CODES ====================

export interface DefectCode {
  code: string;
  category: string;
  component: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC';
  description: string;
  repairSop?: string;
}

export const DefectCodes: DefectCode[] = [
  // Phone Defects
  { code: 'PHN_SCR_CRACK', category: 'PHONE', component: 'Screen', severity: 'MAJOR', description: 'Screen cracked or shattered', repairSop: 'Replace display assembly' },
  { code: 'PHN_SCR_DEAD_PX', category: 'PHONE', component: 'Screen', severity: 'MINOR', description: 'Dead or stuck pixels on display' },
  { code: 'PHN_SCR_BURN', category: 'PHONE', component: 'Screen', severity: 'MAJOR', description: 'Screen burn-in visible' },
  { code: 'PHN_SCR_TOUCH', category: 'PHONE', component: 'Screen', severity: 'CRITICAL', description: 'Touch not responsive', repairSop: 'Replace digitizer or display assembly' },
  { code: 'PHN_BAT_LOW', category: 'PHONE', component: 'Battery', severity: 'MAJOR', description: 'Battery health below 80%', repairSop: 'Replace battery' },
  { code: 'PHN_BAT_SWELL', category: 'PHONE', component: 'Battery', severity: 'CRITICAL', description: 'Battery swelling detected', repairSop: 'Replace battery immediately' },
  { code: 'PHN_CAM_FRONT', category: 'PHONE', component: 'Camera', severity: 'MAJOR', description: 'Front camera not working', repairSop: 'Replace front camera module' },
  { code: 'PHN_CAM_REAR', category: 'PHONE', component: 'Camera', severity: 'MAJOR', description: 'Rear camera not working', repairSop: 'Replace rear camera module' },
  { code: 'PHN_BTN_PWR', category: 'PHONE', component: 'Buttons', severity: 'CRITICAL', description: 'Power button not working', repairSop: 'Replace power button flex' },
  { code: 'PHN_BTN_VOL', category: 'PHONE', component: 'Buttons', severity: 'MINOR', description: 'Volume buttons not working', repairSop: 'Replace volume button flex' },
  { code: 'PHN_SPKR', category: 'PHONE', component: 'Audio', severity: 'MAJOR', description: 'Speaker not working', repairSop: 'Replace speaker' },
  { code: 'PHN_MIC', category: 'PHONE', component: 'Audio', severity: 'MAJOR', description: 'Microphone not working', repairSop: 'Replace microphone' },
  { code: 'PHN_CHG_PORT', category: 'PHONE', component: 'Charging', severity: 'CRITICAL', description: 'Charging port damaged', repairSop: 'Replace charging port assembly' },
  { code: 'PHN_WIFI', category: 'PHONE', component: 'Connectivity', severity: 'MAJOR', description: 'WiFi not working' },
  { code: 'PHN_BT', category: 'PHONE', component: 'Connectivity', severity: 'MINOR', description: 'Bluetooth not working' },
  { code: 'PHN_ICLOUD', category: 'PHONE', component: 'Software', severity: 'CRITICAL', description: 'iCloud/Activation locked' },
  { code: 'PHN_MDM', category: 'PHONE', component: 'Software', severity: 'CRITICAL', description: 'MDM/Enterprise enrolled' },

  // Laptop Defects
  { code: 'LAP_SCR_CRACK', category: 'LAPTOP', component: 'Display', severity: 'MAJOR', description: 'Screen cracked', repairSop: 'Replace LCD panel' },
  { code: 'LAP_SCR_DEAD_PX', category: 'LAPTOP', component: 'Display', severity: 'MINOR', description: 'Dead pixels present' },
  { code: 'LAP_SCR_BLEED', category: 'LAPTOP', component: 'Display', severity: 'MINOR', description: 'Backlight bleeding' },
  { code: 'LAP_HINGE', category: 'LAPTOP', component: 'Display', severity: 'MAJOR', description: 'Hinge broken or loose', repairSop: 'Replace hinges' },
  { code: 'LAP_KB_KEY', category: 'LAPTOP', component: 'Keyboard', severity: 'MINOR', description: 'Keys missing or not working', repairSop: 'Replace keyboard' },
  { code: 'LAP_KB_FULL', category: 'LAPTOP', component: 'Keyboard', severity: 'MAJOR', description: 'Keyboard fully non-functional', repairSop: 'Replace keyboard' },
  { code: 'LAP_TP', category: 'LAPTOP', component: 'Trackpad', severity: 'MAJOR', description: 'Trackpad not working', repairSop: 'Replace trackpad' },
  { code: 'LAP_BAT', category: 'LAPTOP', component: 'Battery', severity: 'MAJOR', description: 'Battery health low', repairSop: 'Replace battery' },
  { code: 'LAP_CHG', category: 'LAPTOP', component: 'Charging', severity: 'CRITICAL', description: 'Does not charge', repairSop: 'Diagnose charging circuit' },
  { code: 'LAP_USB', category: 'LAPTOP', component: 'Ports', severity: 'MINOR', description: 'USB port(s) not working' },
  { code: 'LAP_HDMI', category: 'LAPTOP', component: 'Ports', severity: 'MINOR', description: 'HDMI/Video output not working' },
  { code: 'LAP_FAN', category: 'LAPTOP', component: 'Thermal', severity: 'MAJOR', description: 'Fan not working', repairSop: 'Replace fan' },
  { code: 'LAP_THERM', category: 'LAPTOP', component: 'Thermal', severity: 'MAJOR', description: 'Thermal throttling/overheating', repairSop: 'Replace thermal paste, clean vents' },
  { code: 'LAP_BIOS_PW', category: 'LAPTOP', component: 'Software', severity: 'CRITICAL', description: 'BIOS password locked' },

  // TV Defects
  { code: 'TV_PANEL_CRACK', category: 'TV', component: 'Panel', severity: 'CRITICAL', description: 'Panel cracked' },
  { code: 'TV_PANEL_DEAD', category: 'TV', component: 'Panel', severity: 'MINOR', description: 'Dead pixels present' },
  { code: 'TV_BURN', category: 'TV', component: 'Panel', severity: 'MAJOR', description: 'Screen burn-in visible' },
  { code: 'TV_BL_ZONE', category: 'TV', component: 'Backlight', severity: 'MAJOR', description: 'Backlight zone failure', repairSop: 'Replace LED strips' },
  { code: 'TV_BL_FULL', category: 'TV', component: 'Backlight', severity: 'CRITICAL', description: 'No backlight', repairSop: 'Replace LED driver or strips' },
  { code: 'TV_HDMI', category: 'TV', component: 'Inputs', severity: 'MAJOR', description: 'HDMI port(s) not working', repairSop: 'Replace main board or HDMI board' },
  { code: 'TV_SPKR', category: 'TV', component: 'Audio', severity: 'MINOR', description: 'Internal speakers not working' },
  { code: 'TV_WIFI', category: 'TV', component: 'Connectivity', severity: 'MINOR', description: 'WiFi not connecting' },
  { code: 'TV_REMOTE', category: 'TV', component: 'Accessories', severity: 'COSMETIC', description: 'Remote missing or not working' },
  { code: 'TV_STAND', category: 'TV', component: 'Accessories', severity: 'COSMETIC', description: 'Stand missing or damaged' },

  // General Defects
  { code: 'GEN_COSM_MINOR', category: 'GENERAL', component: 'Cosmetic', severity: 'COSMETIC', description: 'Minor scratches or scuffs' },
  { code: 'GEN_COSM_MAJOR', category: 'GENERAL', component: 'Cosmetic', severity: 'COSMETIC', description: 'Major cosmetic damage (dents, deep scratches)' },
  { code: 'GEN_NO_POWER', category: 'GENERAL', component: 'Power', severity: 'CRITICAL', description: 'Device does not power on' },
  { code: 'GEN_PWR_CYCLE', category: 'GENERAL', component: 'Power', severity: 'MAJOR', description: 'Device randomly restarts or shuts off' },
  { code: 'GEN_MISSING_PART', category: 'GENERAL', component: 'Parts', severity: 'MINOR', description: 'Accessory or part missing' },
];
