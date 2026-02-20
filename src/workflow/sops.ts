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

// ==================== ICE MAKER SOP ====================

const ICE_MAKER_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'ice-security-1',
    code: 'ICE_POWER_SAFETY',
    name: 'Power Safety Check',
    type: 'CHECKLIST',
    prompt: 'Inspect power cord and electrical safety',
    promptEs: 'Inspeccionar el cable de alimentación y la seguridad eléctrica',
    helpText: 'Check cord for damage, verify proper plug type, confirm grounding.',
    helpTextEs: 'Verificar el cable por daños, confirmar tipo de enchufe correcto, confirmar conexión a tierra.',
    required: true,
    order: 1,
    checklistItems: [
      'Power cord intact, no fraying',
      'Proper plug type (3-prong grounded)',
      'Strain relief intact at cord entry',
      'No visible damage to housing near cord',
    ],
    checklistItemsEs: [
      'Cable de alimentación intacto, sin deshilachado',
      'Tipo de enchufe correcto (3 clavijas con tierra)',
      'Alivio de tensión intacto en la entrada del cable',
      'Sin daño visible en la carcasa cerca del cable',
    ],
  },
  {
    id: 'ice-security-2',
    code: 'ICE_DRAIN_PREP',
    name: 'Drain & Prep',
    type: 'CONFIRMATION',
    prompt: 'Unplug unit, drain water reservoir, and remove all ice',
    promptEs: 'Desconectar la unidad, drenar el depósito de agua y retirar todo el hielo',
    helpText: 'Ensure unit is unplugged. Open drain plug and empty all water. Remove ice basket and discard old ice.',
    helpTextEs: 'Asegurar que la unidad esté desconectada. Abrir el tapón de drenaje y vaciar toda el agua. Retirar la canasta de hielo y desechar el hielo viejo.',
    required: true,
    order: 2,
  },
  {
    id: 'ice-security-3',
    code: 'ICE_INITIAL_POWER',
    name: 'Initial Power Test',
    type: 'CHECKLIST',
    prompt: 'Power on and verify basic operation',
    promptEs: 'Encender y verificar operación básica',
    helpText: 'Plug in and power on. Verify compressor engages and controls respond.',
    helpTextEs: 'Conectar y encender. Verificar que el compresor se active y los controles respondan.',
    required: true,
    order: 3,
    checklistItems: [
      'Powers on successfully',
      'Compressor engages (listen for hum)',
      'Display/controls respond to input',
      'No error codes shown',
    ],
    checklistItemsEs: [
      'Enciende correctamente',
      'El compresor se activa (escuchar zumbido)',
      'La pantalla/controles responden',
      'No se muestran códigos de error',
    ],
  },
];

const ICE_MAKER_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'ice-diag-1',
    code: 'ICE_RESERVOIR_INSPECT',
    name: 'Water Reservoir Inspection',
    type: 'CHECKLIST',
    prompt: 'Inspect water reservoir for cracks, leaks, and cleanliness',
    promptEs: 'Inspeccionar el depósito de agua por grietas, fugas y limpieza',
    helpText: 'Remove reservoir if removable. Check for cracks, mineral buildup, and proper seal.',
    helpTextEs: 'Retirar el depósito si es removible. Verificar grietas, acumulación mineral y sello adecuado.',
    required: true,
    order: 1,
    checklistItems: [
      'No cracks or leaks in reservoir',
      'Interior clean, no heavy mineral buildup',
      'Seal/gasket intact',
      'Fill line visible and accurate',
    ],
    checklistItemsEs: [
      'Sin grietas ni fugas en el depósito',
      'Interior limpio, sin acumulación mineral severa',
      'Sello/junta intacto',
      'Línea de llenado visible y precisa',
    ],
  },
  {
    id: 'ice-diag-2',
    code: 'ICE_COMPRESSOR_TEST',
    name: 'Compressor Function',
    type: 'MEASUREMENT',
    prompt: 'Test compressor engagement and operation',
    promptEs: 'Probar el funcionamiento del compresor',
    helpText: 'Time how long compressor takes to engage. Listen for unusual sounds or vibration.',
    helpTextEs: 'Medir cuánto tarda el compresor en activarse. Escuchar sonidos o vibraciones inusuales.',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        engageTimeSeconds: { type: 'number', minimum: 0, maximum: 300, title: 'Time to engage (seconds)' },
        runsQuietly: { type: 'boolean', title: 'Runs quietly without unusual noise' },
        noExcessiveVibration: { type: 'boolean', title: 'No excessive vibration' },
      },
      required: ['engageTimeSeconds', 'runsQuietly'],
    },
  },
  {
    id: 'ice-diag-3',
    code: 'ICE_PRODUCTION_CYCLE',
    name: 'Ice Production Cycle',
    type: 'MEASUREMENT',
    prompt: 'Run ice production cycle and measure output',
    promptEs: 'Ejecutar ciclo de producción de hielo y medir la salida',
    helpText: 'Fill reservoir, start cycle. Measure time to first batch and ice quality.',
    helpTextEs: 'Llenar depósito, iniciar ciclo. Medir tiempo hasta el primer lote y calidad del hielo.',
    required: true,
    order: 3,
    inputSchema: {
      type: 'object',
      properties: {
        cycleTimeMinutes: { type: 'number', minimum: 0, title: 'Cycle time (minutes)' },
        iceFormsCorrectly: { type: 'boolean', title: 'Ice forms proper size/shape' },
        consistentOutput: { type: 'boolean', title: 'Consistent output across cycles' },
      },
      required: ['cycleTimeMinutes', 'iceFormsCorrectly'],
    },
  },
  {
    id: 'ice-diag-4',
    code: 'ICE_PUMP_DRAINAGE',
    name: 'Water Pump & Drainage',
    type: 'CHECKLIST',
    prompt: 'Test water pump activation and drainage system',
    promptEs: 'Probar activación de bomba de agua y sistema de drenaje',
    helpText: 'Verify pump activates during cycle, water flows properly, drain plug seals.',
    helpTextEs: 'Verificar que la bomba se active durante el ciclo, el agua fluya correctamente, el tapón de drenaje selle.',
    required: true,
    order: 4,
    checklistItems: [
      'Water pump activates during cycle',
      'Water flows properly to ice tray',
      'Drain plug seals without leaks',
      'No leaks during operation',
    ],
    checklistItemsEs: [
      'La bomba de agua se activa durante el ciclo',
      'El agua fluye correctamente a la bandeja de hielo',
      'El tapón de drenaje sella sin fugas',
      'Sin fugas durante la operación',
    ],
  },
  {
    id: 'ice-diag-5',
    code: 'ICE_CONTROLS_DISPLAY',
    name: 'Controls & Display',
    type: 'CHECKLIST',
    prompt: 'Test all buttons, display, and selector functions',
    promptEs: 'Probar todos los botones, pantalla y funciones de selección',
    helpText: 'Press each button, verify display segments, test ice size selector and timer.',
    helpTextEs: 'Presionar cada botón, verificar segmentos de pantalla, probar selector de tamaño de hielo y temporizador.',
    required: true,
    order: 5,
    checklistItems: [
      'All buttons respond correctly',
      'Display shows all segments properly',
      'Ice size selector works (S/L)',
      'Timer/auto-off functions work',
    ],
    checklistItemsEs: [
      'Todos los botones responden correctamente',
      'La pantalla muestra todos los segmentos',
      'El selector de tamaño de hielo funciona (S/L)',
      'Las funciones de temporizador/apagado automático funcionan',
    ],
  },
  {
    id: 'ice-diag-6',
    code: 'ICE_THERMOSTAT_SENSORS',
    name: 'Thermostat & Sensors',
    type: 'MEASUREMENT',
    prompt: 'Verify temperature control and sensor accuracy',
    promptEs: 'Verificar control de temperatura y precisión de sensores',
    helpText: 'Check that unit reaches target freezing temp. Verify auto-shutoff when basket is full.',
    helpTextEs: 'Verificar que la unidad alcance la temperatura de congelación objetivo. Verificar apagado automático cuando la canasta está llena.',
    required: true,
    order: 6,
    inputSchema: {
      type: 'object',
      properties: {
        reachesTargetTemp: { type: 'boolean', title: 'Reaches target freezing temperature' },
        sensorReadingsAccurate: { type: 'boolean', title: 'Sensor readings accurate' },
        autoShutoffTriggers: { type: 'boolean', title: 'Auto-shutoff triggers when full' },
      },
      required: ['reachesTargetTemp', 'autoShutoffTriggers'],
    },
  },
];

const ICE_MAKER_REPAIR: WorkflowStep[] = [
  {
    id: 'ice-repair-1',
    code: 'ICE_DESCALE',
    name: 'Descale Water System',
    type: 'CHECKLIST',
    prompt: 'Run descaling cycle to remove mineral buildup',
    promptEs: 'Ejecutar ciclo de descalcificación para eliminar acumulación mineral',
    helpText: 'Use vinegar or citric acid solution. Run cycle, then flush 3x with clean water.',
    helpTextEs: 'Usar solución de vinagre o ácido cítrico. Ejecutar ciclo, luego enjuagar 3 veces con agua limpia.',
    required: true,
    order: 1,
    checklistItems: [
      'Descaling solution circulated through system',
      'Flushed 3x with clean water',
      'Water flow improved after descale',
      'No residual taste/odor',
    ],
    checklistItemsEs: [
      'Solución descalcificadora circulada por el sistema',
      'Enjuagado 3 veces con agua limpia',
      'Flujo de agua mejorado después de descalcificar',
      'Sin sabor/olor residual',
    ],
  },
  {
    id: 'ice-repair-2',
    code: 'ICE_FILTER_SERVICE',
    name: 'Filter Service',
    type: 'CONFIRMATION',
    prompt: 'Clean or replace water filter and verify housing seal',
    promptEs: 'Limpiar o reemplazar filtro de agua y verificar sello de la carcasa',
    helpText: 'Remove filter, clean or replace. Ensure filter housing is properly sealed.',
    helpTextEs: 'Retirar filtro, limpiar o reemplazar. Asegurar que la carcasa del filtro esté correctamente sellada.',
    required: true,
    order: 2,
  },
  {
    id: 'ice-repair-3',
    code: 'ICE_COMPRESSOR_MAINT',
    name: 'Compressor Maintenance',
    type: 'CHECKLIST',
    prompt: 'Clean condenser coils and verify fan operation',
    promptEs: 'Limpiar serpentines del condensador y verificar operación del ventilador',
    helpText: 'Use brush/compressed air on condenser coils. Check refrigerant lines visually. Verify fan spins freely.',
    helpTextEs: 'Usar cepillo/aire comprimido en serpentines del condensador. Verificar líneas de refrigerante visualmente. Verificar que el ventilador gire libremente.',
    required: true,
    order: 3,
    checklistItems: [
      'Condenser coils cleaned',
      'Refrigerant lines visually intact (no oil residue)',
      'Fan operates freely',
      'Ventilation area clear of obstructions',
    ],
    checklistItemsEs: [
      'Serpentines del condensador limpios',
      'Líneas de refrigerante visualmente intactas (sin residuo de aceite)',
      'El ventilador opera libremente',
      'Área de ventilación libre de obstrucciones',
    ],
  },
  {
    id: 'ice-repair-4',
    code: 'ICE_PUMP_SEAL_SERVICE',
    name: 'Pump & Seal Service',
    type: 'CHECKLIST',
    prompt: 'Clean pump intake and replace worn seals/gaskets',
    promptEs: 'Limpiar entrada de la bomba y reemplazar sellos/juntas desgastados',
    helpText: 'Clean debris from pump intake. Inspect and replace worn seals. Test drain plug seal.',
    helpTextEs: 'Limpiar residuos de la entrada de la bomba. Inspeccionar y reemplazar sellos desgastados. Probar sello del tapón de drenaje.',
    required: true,
    order: 4,
    checklistItems: [
      'Pump intake cleaned of debris',
      'Worn seals/gaskets replaced',
      'Drain plug seals properly',
      'No leaks after service',
    ],
    checklistItemsEs: [
      'Entrada de la bomba limpia de residuos',
      'Sellos/juntas desgastados reemplazados',
      'Tapón de drenaje sella correctamente',
      'Sin fugas después del servicio',
    ],
  },
  {
    id: 'ice-repair-5',
    code: 'ICE_CONTROL_BOARD',
    name: 'Control Board Check',
    type: 'CHECKLIST',
    prompt: 'Inspect control board for damage and test contacts',
    promptEs: 'Inspeccionar placa de control por daños y probar contactos',
    helpText: 'Open control panel. Look for burn marks, corrosion, loose connections. Test button contacts.',
    helpTextEs: 'Abrir panel de control. Buscar marcas de quemadura, corrosión, conexiones sueltas. Probar contactos de botones.',
    required: true,
    order: 5,
    checklistItems: [
      'No burn marks or corrosion on board',
      'All button contacts functional',
      'Display segments all working',
      'Connections secure and clean',
    ],
    checklistItemsEs: [
      'Sin marcas de quemadura o corrosión en la placa',
      'Todos los contactos de botones funcionales',
      'Todos los segmentos de pantalla funcionando',
      'Conexiones seguras y limpias',
    ],
  },
];

const ICE_MAKER_FINAL: WorkflowStep[] = [
  {
    id: 'ice-final-1',
    code: 'ICE_FULL_CYCLE_TEST',
    name: 'Full Cycle Test',
    type: 'MEASUREMENT',
    prompt: 'Run complete ice cycle and verify quality (4-hour runtime recommended)',
    promptEs: 'Ejecutar ciclo completo de hielo y verificar calidad (se recomienda 4 horas de funcionamiento)',
    helpText: 'Run full production cycle. Check ice quality, measure cycle time, inspect for leaks throughout.',
    helpTextEs: 'Ejecutar ciclo completo de producción. Verificar calidad del hielo, medir tiempo de ciclo, inspeccionar fugas.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        cycleTimeMinutes: { type: 'number', minimum: 0, title: 'Full cycle time (minutes)' },
        iceQualityGood: { type: 'boolean', title: 'Ice quality acceptable' },
        noLeaks: { type: 'boolean', title: 'No leaks detected during test' },
      },
      required: ['cycleTimeMinutes', 'iceQualityGood', 'noLeaks'],
    },
  },
  {
    id: 'ice-final-2',
    code: 'ICE_LEAK_CHECK',
    name: 'Leak Check',
    type: 'CHECKLIST',
    prompt: 'Final leak inspection of all water points',
    promptEs: 'Inspección final de fugas en todos los puntos de agua',
    helpText: 'Check under unit, reservoir seal, drain plug, and all water connections.',
    helpTextEs: 'Verificar debajo de la unidad, sello del depósito, tapón de drenaje y todas las conexiones de agua.',
    required: true,
    order: 2,
    checklistItems: [
      'No water under unit',
      'Reservoir seal holds',
      'Drain plug secure',
      'All connections dry',
    ],
    checklistItemsEs: [
      'Sin agua debajo de la unidad',
      'Sello del depósito mantiene',
      'Tapón de drenaje seguro',
      'Todas las conexiones secas',
    ],
  },
  {
    id: 'ice-final-3',
    code: 'ICE_NOISE_VIBRATION',
    name: 'Noise & Vibration',
    type: 'CONFIRMATION',
    prompt: 'Verify compressor noise is acceptable and unit is stable',
    promptEs: 'Verificar que el ruido del compresor sea aceptable y la unidad esté estable',
    helpText: 'Listen for acceptable compressor hum. Check for rattling. Verify stable on flat surface.',
    helpTextEs: 'Escuchar zumbido aceptable del compresor. Verificar que no haya traqueteo. Verificar estabilidad en superficie plana.',
    required: true,
    order: 3,
  },
  {
    id: 'ice-final-4',
    code: 'ICE_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade and document condition',
    promptEs: 'Asignar grado cosmético y documentar condición',
    helpText: 'Grade A/B/C/D based on physical condition. Add notes and take photo.',
    helpTextEs: 'Calificar A/B/C/D según condición física. Agregar notas y tomar foto.',
    required: true,
    order: 4,
    inputSchema: {
      type: 'object',
      properties: {
        overallGrade: { type: 'string', enum: ['A', 'B', 'C', 'D'], title: 'Overall cosmetic grade' },
        conditionNotes: { type: 'string', title: 'Condition notes' },
      },
      required: ['overallGrade'],
    },
  },
];

// ==================== VACUUM SOP ====================

const VACUUM_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'vac-security-1',
    code: 'VAC_CORD_SAFETY',
    name: 'Power Cord Safety',
    type: 'CHECKLIST',
    prompt: 'Inspect power cord for damage and safety',
    promptEs: 'Inspeccionar el cable de alimentación por daños y seguridad',
    helpText: 'Check full length of cord for cuts, fraying, exposed wire. Verify plug prongs are straight.',
    helpTextEs: 'Verificar toda la longitud del cable por cortes, deshilachado, cable expuesto. Verificar que las clavijas estén rectas.',
    required: true,
    order: 1,
    checklistItems: [
      'Cord intact, no exposed wire',
      'Plug prongs straight and undamaged',
      'Strain relief intact',
      'Cord rewind works (if applicable)',
    ],
    checklistItemsEs: [
      'Cable intacto, sin cable expuesto',
      'Clavijas del enchufe rectas y sin daño',
      'Alivio de tensión intacto',
      'Rebobinado del cable funciona (si aplica)',
    ],
  },
  {
    id: 'vac-security-2',
    code: 'VAC_INITIAL_POWER',
    name: 'Initial Power Test',
    type: 'CHECKLIST',
    prompt: 'Power on and test all speed settings',
    promptEs: 'Encender y probar todas las configuraciones de velocidad',
    helpText: 'Turn on at each speed setting. Listen for motor issues. Check for burning smell.',
    helpTextEs: 'Encender en cada configuración de velocidad. Escuchar problemas del motor. Verificar si hay olor a quemado.',
    required: true,
    order: 2,
    checklistItems: [
      'Powers on at all settings',
      'Motor runs smoothly',
      'No burning smell',
      'Speed control transitions work',
    ],
    checklistItemsEs: [
      'Enciende en todas las configuraciones',
      'El motor funciona suavemente',
      'Sin olor a quemado',
      'Las transiciones de control de velocidad funcionan',
    ],
  },
  {
    id: 'vac-security-3',
    code: 'VAC_MOTOR_SOUND',
    name: 'Motor Sound Check',
    type: 'CONFIRMATION',
    prompt: 'Confirm motor sound is normal with no grinding or squealing',
    promptEs: 'Confirmar que el sonido del motor es normal sin rechinidos o chirridos',
    helpText: 'Run motor for 30 seconds. Normal = consistent hum. Bad = grinding, squealing, intermittent.',
    helpTextEs: 'Ejecutar el motor por 30 segundos. Normal = zumbido constante. Malo = rechinido, chirrido, intermitente.',
    required: true,
    order: 3,
  },
];

const VACUUM_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'vac-diag-1',
    code: 'VAC_SUCTION_TEST',
    name: 'Suction Power',
    type: 'MEASUREMENT',
    prompt: 'Test suction strength on all settings',
    promptEs: 'Probar potencia de succión en todas las configuraciones',
    helpText: 'Test with hand over nozzle at each setting. Check for air leaks at attachment points.',
    helpTextEs: 'Probar con la mano sobre la boquilla en cada configuración. Verificar fugas de aire en puntos de conexión.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        suctionStrong: { type: 'boolean', title: 'Strong suction on all settings' },
        noAirLeaks: { type: 'boolean', title: 'No air leaks at connections' },
        sealAtAttachments: { type: 'boolean', title: 'Proper seal at all attachments' },
      },
      required: ['suctionStrong', 'noAirLeaks'],
    },
  },
  {
    id: 'vac-diag-2',
    code: 'VAC_BRUSH_ROLL',
    name: 'Brush Roll',
    type: 'CHECKLIST',
    prompt: 'Inspect brush roll condition and operation',
    promptEs: 'Inspeccionar condición y operación del rodillo de cepillo',
    helpText: 'Remove brush roll if possible. Check bristles, bearings, and spin freely test.',
    helpTextEs: 'Retirar rodillo de cepillo si es posible. Verificar cerdas, rodamientos y prueba de giro libre.',
    required: true,
    order: 2,
    checklistItems: [
      'Spins freely without resistance',
      'Bristles not worn flat',
      'No tangled debris (hair, string)',
      'Bearings smooth, no grinding',
    ],
    checklistItemsEs: [
      'Gira libremente sin resistencia',
      'Cerdas no están desgastadas',
      'Sin residuos enredados (pelo, hilo)',
      'Rodamientos suaves, sin rechinido',
    ],
  },
  {
    id: 'vac-diag-3',
    code: 'VAC_BELT_CHECK',
    name: 'Belt Condition',
    type: 'CHECKLIST',
    prompt: 'Check drive belt tension and condition',
    promptEs: 'Verificar tensión y condición de la correa de transmisión',
    helpText: 'Remove cover to access belt. Check for cracks, stretching, and proper seating on motor shaft.',
    helpTextEs: 'Retirar cubierta para acceder a la correa. Verificar grietas, estiramiento y asentamiento correcto en el eje del motor.',
    required: true,
    order: 3,
    checklistItems: [
      'Proper tension (not loose)',
      'No cracks or fraying',
      'Correct size belt',
      'Seats properly on motor shaft',
    ],
    checklistItemsEs: [
      'Tensión adecuada (no floja)',
      'Sin grietas o deshilachado',
      'Correa de tamaño correcto',
      'Se asienta correctamente en el eje del motor',
    ],
  },
  {
    id: 'vac-diag-4',
    code: 'VAC_FILTER_SYSTEM',
    name: 'Filter System',
    type: 'CHECKLIST',
    prompt: 'Inspect all filters and filter housing',
    promptEs: 'Inspeccionar todos los filtros y carcasas de filtros',
    helpText: 'Check HEPA, foam, pre-motor, and exhaust filters. Verify housings seal properly.',
    helpTextEs: 'Verificar filtros HEPA, de espuma, pre-motor y de escape. Verificar que las carcasas sellen correctamente.',
    required: true,
    order: 4,
    checklistItems: [
      'HEPA filter condition acceptable',
      'Pre-motor filter clean',
      'Exhaust filter clean',
      'Filter housing seals properly',
    ],
    checklistItemsEs: [
      'Condición del filtro HEPA aceptable',
      'Filtro pre-motor limpio',
      'Filtro de escape limpio',
      'Carcasa del filtro sella correctamente',
    ],
  },
  {
    id: 'vac-diag-5',
    code: 'VAC_HOSE_WAND',
    name: 'Hose & Wand',
    type: 'CHECKLIST',
    prompt: 'Inspect hose and wand for damage and blockages',
    promptEs: 'Inspeccionar manguera y tubo por daños y obstrucciones',
    helpText: 'Look through hose for blockages. Check for cracks. Test swivel joints and extension locks.',
    helpTextEs: 'Mirar a través de la manguera por obstrucciones. Verificar grietas. Probar articulaciones giratorias y seguros de extensión.',
    required: true,
    order: 5,
    checklistItems: [
      'No cracks or holes in hose',
      'No blockages',
      'Swivel joints work smoothly',
      'Extension wand locks properly',
    ],
    checklistItemsEs: [
      'Sin grietas o agujeros en la manguera',
      'Sin obstrucciones',
      'Articulaciones giratorias funcionan suavemente',
      'Tubo de extensión se bloquea correctamente',
    ],
  },
  {
    id: 'vac-diag-6',
    code: 'VAC_WHEELS_CASTERS',
    name: 'Wheels & Casters',
    type: 'CHECKLIST',
    prompt: 'Check all wheels and height adjustment',
    promptEs: 'Verificar todas las ruedas y ajuste de altura',
    helpText: 'Spin each wheel. Check for wobble. Test height adjustment mechanism.',
    helpTextEs: 'Girar cada rueda. Verificar si hay bamboleo. Probar mecanismo de ajuste de altura.',
    required: true,
    order: 6,
    checklistItems: [
      'All wheels present and roll freely',
      'No wobble on any wheel',
      'Height adjustment works (if applicable)',
      'Vacuum stands stable',
    ],
    checklistItemsEs: [
      'Todas las ruedas presentes y giran libremente',
      'Sin bamboleo en ninguna rueda',
      'Ajuste de altura funciona (si aplica)',
      'La aspiradora se mantiene estable',
    ],
  },
  {
    id: 'vac-diag-7',
    code: 'VAC_BAG_CANISTER',
    name: 'Bag/Canister',
    type: 'CHECKLIST',
    prompt: 'Inspect bag compartment or dustbin canister',
    promptEs: 'Inspeccionar compartimento de bolsa o depósito de polvo',
    helpText: 'Check bag compartment is clean, canister latch works, seal intact, capacity indicator functions.',
    helpTextEs: 'Verificar que el compartimento de bolsa esté limpio, el cierre del depósito funcione, sello intacto, indicador de capacidad funcione.',
    required: true,
    order: 7,
    checklistItems: [
      'Bag compartment clean / canister empty',
      'Latch/release mechanism works',
      'Seal/gasket intact',
      'Capacity indicator works (if applicable)',
    ],
    checklistItemsEs: [
      'Compartimento de bolsa limpio / depósito vacío',
      'Mecanismo de cierre/liberación funciona',
      'Sello/junta intacto',
      'Indicador de capacidad funciona (si aplica)',
    ],
  },
];

const VACUUM_REPAIR: WorkflowStep[] = [
  {
    id: 'vac-repair-1',
    code: 'VAC_BELT_REPLACE',
    name: 'Belt Replacement',
    type: 'CONFIRMATION',
    prompt: 'Replace drive belt if worn and verify proper tension',
    promptEs: 'Reemplazar correa de transmisión si está desgastada y verificar tensión adecuada',
    helpText: 'Remove old belt, install new one. Verify proper tension and seating on motor shaft.',
    helpTextEs: 'Retirar correa vieja, instalar nueva. Verificar tensión adecuada y asentamiento en el eje del motor.',
    required: true,
    order: 1,
  },
  {
    id: 'vac-repair-2',
    code: 'VAC_FILTER_SERVICE',
    name: 'Filter Service',
    type: 'CHECKLIST',
    prompt: 'Clean or replace all filters',
    promptEs: 'Limpiar o reemplazar todos los filtros',
    helpText: 'Wash reusable filters with water and dry completely. Replace disposable filters.',
    helpTextEs: 'Lavar filtros reutilizables con agua y secar completamente. Reemplazar filtros desechables.',
    required: true,
    order: 2,
    checklistItems: [
      'Filters cleaned or replaced',
      'HEPA filter tested/replaced',
      'Housing resealed properly',
      'No gaps in filter seating',
    ],
    checklistItemsEs: [
      'Filtros limpiados o reemplazados',
      'Filtro HEPA probado/reemplazado',
      'Carcasa resellada correctamente',
      'Sin espacios en el asentamiento del filtro',
    ],
  },
  {
    id: 'vac-repair-3',
    code: 'VAC_BRUSH_SERVICE',
    name: 'Brush Roll Service',
    type: 'CHECKLIST',
    prompt: 'Clean brush roll and service bearings',
    promptEs: 'Limpiar rodillo de cepillo y dar servicio a rodamientos',
    helpText: 'Remove all tangled debris. Lubricate bearings if accessible. Verify end caps secure.',
    helpTextEs: 'Retirar todos los residuos enredados. Lubricar rodamientos si son accesibles. Verificar que las tapas estén seguras.',
    required: true,
    order: 3,
    checklistItems: [
      'All debris removed from brush',
      'Bearings lubricated (if accessible)',
      'End caps secure',
      'Rotation test passed',
    ],
    checklistItemsEs: [
      'Todos los residuos retirados del cepillo',
      'Rodamientos lubricados (si accesibles)',
      'Tapas de extremo seguras',
      'Prueba de rotación aprobada',
    ],
  },
  {
    id: 'vac-repair-4',
    code: 'VAC_HOSE_REPAIR',
    name: 'Hose Repair',
    type: 'CHECKLIST',
    prompt: 'Clear blockages and repair or replace damaged hose',
    promptEs: 'Despejar obstrucciones y reparar o reemplazar manguera dañada',
    helpText: 'Use a straightened coat hanger or long stick to clear blockages. Patch or replace cracked hose.',
    helpTextEs: 'Usar un gancho de ropa enderezado o palo largo para despejar obstrucciones. Parchar o reemplazar manguera agrietada.',
    required: true,
    order: 4,
    checklistItems: [
      'Blockages cleared',
      'Cracks repaired or hose replaced',
      'All connections tight',
      'Suction confirmed at hose end',
    ],
    checklistItemsEs: [
      'Obstrucciones despejadas',
      'Grietas reparadas o manguera reemplazada',
      'Todas las conexiones apretadas',
      'Succión confirmada en el extremo de la manguera',
    ],
  },
  {
    id: 'vac-repair-5',
    code: 'VAC_MOTOR_SERVICE',
    name: 'Motor Service',
    type: 'CHECKLIST',
    prompt: 'Service motor bearings and ventilation',
    promptEs: 'Dar servicio a rodamientos del motor y ventilación',
    helpText: 'Lubricate bearings if accessible. Check carbon brushes. Ensure all vents are clear.',
    helpTextEs: 'Lubricar rodamientos si son accesibles. Verificar escobillas de carbón. Asegurar que todas las rejillas estén despejadas.',
    required: true,
    order: 5,
    checklistItems: [
      'Bearings lubricated (if accessible)',
      'Carbon brushes checked (sufficient length)',
      'Ventilation paths clear',
      'Motor runs smoother after service',
    ],
    checklistItemsEs: [
      'Rodamientos lubricados (si accesibles)',
      'Escobillas de carbón verificadas (longitud suficiente)',
      'Vías de ventilación despejadas',
      'Motor funciona más suave después del servicio',
    ],
  },
  {
    id: 'vac-repair-6',
    code: 'VAC_WHEEL_SEAL_SERVICE',
    name: 'Wheel & Seal Service',
    type: 'CHECKLIST',
    prompt: 'Replace damaged wheels and all worn seals',
    promptEs: 'Reemplazar ruedas dañadas y todos los sellos desgastados',
    helpText: 'Replace broken wheels. Replace all gaskets and seals. Tighten all body screws.',
    helpTextEs: 'Reemplazar ruedas rotas. Reemplazar todas las juntas y sellos. Apretar todos los tornillos del cuerpo.',
    required: true,
    order: 6,
    checklistItems: [
      'Damaged wheels replaced',
      'All gaskets/seals replaced',
      'Body screws tight',
      'Unit stable and rolls freely',
    ],
    checklistItemsEs: [
      'Ruedas dañadas reemplazadas',
      'Todas las juntas/sellos reemplazados',
      'Tornillos del cuerpo apretados',
      'Unidad estable y rueda libremente',
    ],
  },
];

const VACUUM_FINAL: WorkflowStep[] = [
  {
    id: 'vac-final-1',
    code: 'VAC_FULL_SUCTION_TEST',
    name: 'Full Suction Test',
    type: 'MEASUREMENT',
    prompt: 'Test suction on all surfaces with all attachments',
    promptEs: 'Probar succión en todas las superficies con todos los accesorios',
    helpText: 'Test on hard floor and carpet if possible. Test each attachment. Verify edge cleaning.',
    helpTextEs: 'Probar en piso duro y alfombra si es posible. Probar cada accesorio. Verificar limpieza de bordes.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        hardFloorSuction: { type: 'boolean', title: 'Hard floor suction good' },
        carpetSuction: { type: 'boolean', title: 'Carpet suction good' },
        allAttachmentsWork: { type: 'boolean', title: 'All attachments functional' },
      },
      required: ['hardFloorSuction', 'allAttachmentsWork'],
    },
  },
  {
    id: 'vac-final-2',
    code: 'VAC_BRUSH_BELT_VERIFY',
    name: 'Brush & Belt Verify',
    type: 'CONFIRMATION',
    prompt: 'Verify brush spins at correct speed and belt stays seated',
    promptEs: 'Verificar que el cepillo gira a velocidad correcta y la correa se mantiene en su lugar',
    helpText: 'Run brush roll while observing. Belt should not slip or jump off.',
    helpTextEs: 'Ejecutar rodillo de cepillo mientras se observa. La correa no debe deslizarse o saltar.',
    required: true,
    order: 2,
  },
  {
    id: 'vac-final-3',
    code: 'VAC_NOISE_LEVEL',
    name: 'Noise Level',
    type: 'CONFIRMATION',
    prompt: 'Verify operating noise is acceptable with smooth operation',
    promptEs: 'Verificar que el ruido de operación sea aceptable con operación suave',
    helpText: 'Run at all speeds. No new sounds, rattling, or whistling should be present.',
    helpTextEs: 'Ejecutar a todas las velocidades. No deben presentarse sonidos nuevos, traqueteo o silbido.',
    required: true,
    order: 3,
  },
  {
    id: 'vac-final-4',
    code: 'VAC_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade and document condition',
    promptEs: 'Asignar grado cosmético y documentar condición',
    helpText: 'Grade A/B/C/D based on physical condition. Add notes and take photo.',
    helpTextEs: 'Calificar A/B/C/D según condición física. Agregar notas y tomar foto.',
    required: true,
    order: 4,
    inputSchema: {
      type: 'object',
      properties: {
        overallGrade: { type: 'string', enum: ['A', 'B', 'C', 'D'], title: 'Overall cosmetic grade' },
        conditionNotes: { type: 'string', title: 'Condition notes' },
      },
      required: ['overallGrade'],
    },
  },
];

// ==================== SMALL APPLIANCE SOP ====================

const SMALL_APPLIANCE_SECURITY_PREP: WorkflowStep[] = [
  {
    id: 'sapp-security-1',
    code: 'SAPP_CORD_SAFETY',
    name: 'Power Cord Safety',
    type: 'CHECKLIST',
    prompt: 'Inspect power cord and verify grounding',
    promptEs: 'Inspeccionar cable de alimentación y verificar conexión a tierra',
    helpText: 'Check full length of cord. Verify plug type and grounding.',
    helpTextEs: 'Verificar toda la longitud del cable. Verificar tipo de enchufe y conexión a tierra.',
    required: true,
    order: 1,
    checklistItems: [
      'Cord intact, no fraying',
      'Proper plug type',
      'Grounding verified (if applicable)',
      'Strain relief intact',
    ],
    checklistItemsEs: [
      'Cable intacto, sin deshilachado',
      'Tipo de enchufe correcto',
      'Conexión a tierra verificada (si aplica)',
      'Alivio de tensión intacto',
    ],
  },
  {
    id: 'sapp-security-2',
    code: 'SAPP_INITIAL_POWER',
    name: 'Initial Power Test',
    type: 'CHECKLIST',
    prompt: 'Power on and verify all controls respond',
    promptEs: 'Encender y verificar que todos los controles respondan',
    helpText: 'Plug in and power on. Check all controls, display, and indicator lights.',
    helpTextEs: 'Conectar y encender. Verificar todos los controles, pantalla y luces indicadoras.',
    required: true,
    order: 2,
    checklistItems: [
      'Powers on successfully',
      'All controls respond',
      'Display functions (if applicable)',
      'Indicator lights work',
    ],
    checklistItemsEs: [
      'Enciende correctamente',
      'Todos los controles responden',
      'Pantalla funciona (si aplica)',
      'Luces indicadoras funcionan',
    ],
  },
  {
    id: 'sapp-security-3',
    code: 'SAPP_BUTTON_CONTROL',
    name: 'Button & Control Test',
    type: 'CHECKLIST',
    prompt: 'Test all buttons, dials, and digital controls',
    promptEs: 'Probar todos los botones, perillas y controles digitales',
    helpText: 'Press each button, turn each dial. Verify digital touchscreen or buttons respond.',
    helpTextEs: 'Presionar cada botón, girar cada perilla. Verificar que la pantalla táctil o botones digitales respondan.',
    required: true,
    order: 3,
    checklistItems: [
      'All buttons click and respond',
      'Dials turn smoothly',
      'Digital controls work',
      'Mode/program selection works',
    ],
    checklistItemsEs: [
      'Todos los botones hacen clic y responden',
      'Las perillas giran suavemente',
      'Los controles digitales funcionan',
      'La selección de modo/programa funciona',
    ],
  },
];

const SMALL_APPLIANCE_DIAGNOSIS: WorkflowStep[] = [
  {
    id: 'sapp-diag-1',
    code: 'SAPP_HEATING_ELEMENT',
    name: 'Heating Element',
    type: 'MEASUREMENT',
    prompt: 'Test heating element performance and distribution',
    promptEs: 'Probar rendimiento del elemento calefactor y distribución',
    helpText: 'Set target temperature. Measure actual temp with thermometer. Check for hot spots.',
    helpTextEs: 'Establecer temperatura objetivo. Medir temperatura real con termómetro. Verificar puntos calientes.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        heatsToTarget: { type: 'boolean', title: 'Heats to target temperature' },
        evenDistribution: { type: 'boolean', title: 'Even heat distribution' },
        timeToTempMinutes: { type: 'number', minimum: 0, title: 'Time to reach temp (minutes)' },
      },
      required: ['heatsToTarget', 'evenDistribution'],
    },
  },
  {
    id: 'sapp-diag-2',
    code: 'SAPP_TEMP_ACCURACY',
    name: 'Temperature Accuracy',
    type: 'MEASUREMENT',
    prompt: 'Compare displayed temperature vs. actual measurement',
    promptEs: 'Comparar temperatura mostrada vs. medición real',
    helpText: 'Use external thermometer to verify displayed temperature is accurate. Check thermostat cycles.',
    helpTextEs: 'Usar termómetro externo para verificar que la temperatura mostrada sea precisa. Verificar ciclos del termostato.',
    required: true,
    order: 2,
    inputSchema: {
      type: 'object',
      properties: {
        displayedTemp: { type: 'number', title: 'Displayed temperature (°F)' },
        measuredTemp: { type: 'number', title: 'Measured temperature (°F)' },
        thermostatCycles: { type: 'boolean', title: 'Thermostat cycles correctly' },
      },
      required: ['thermostatCycles'],
    },
  },
  {
    id: 'sapp-diag-3',
    code: 'SAPP_TIMER_FUNCTION',
    name: 'Timer Function',
    type: 'CHECKLIST',
    prompt: 'Test timer accuracy and auto-shutoff',
    promptEs: 'Probar precisión del temporizador y apagado automático',
    helpText: 'Set timer for 1 minute. Verify countdown is accurate and alert sounds.',
    helpTextEs: 'Establecer temporizador por 1 minuto. Verificar que la cuenta regresiva sea precisa y la alerta suene.',
    required: true,
    order: 3,
    checklistItems: [
      'Timer counts accurately',
      'Auto-shutoff triggers at zero',
      'Audible alert sounds',
      'Display shows remaining time',
    ],
    checklistItemsEs: [
      'El temporizador cuenta con precisión',
      'El apagado automático se activa en cero',
      'La alerta audible suena',
      'La pantalla muestra tiempo restante',
    ],
  },
  {
    id: 'sapp-diag-4',
    code: 'SAPP_SAFETY_SHUTOFF',
    name: 'Safety Shutoff',
    type: 'CHECKLIST',
    prompt: 'Verify all safety mechanisms work',
    promptEs: 'Verificar que todos los mecanismos de seguridad funcionen',
    helpText: 'Test overheat protection, tip-over shutoff (if applicable), and auto-off after idle.',
    helpTextEs: 'Probar protección contra sobrecalentamiento, apagado por volcadura (si aplica) y apagado automático después de inactividad.',
    required: true,
    order: 4,
    checklistItems: [
      'Overheat protection works',
      'Tip-over shutoff works (if applicable)',
      'Auto-off after idle triggers',
      'Safety interlock functional (lid/door)',
    ],
    checklistItemsEs: [
      'Protección contra sobrecalentamiento funciona',
      'Apagado por volcadura funciona (si aplica)',
      'Apagado automático por inactividad se activa',
      'Interbloqueo de seguridad funcional (tapa/puerta)',
    ],
  },
  {
    id: 'sapp-diag-5',
    code: 'SAPP_SEAL_GASKET',
    name: 'Seal & Gasket',
    type: 'CHECKLIST',
    prompt: 'Check lid/door seals and latches',
    promptEs: 'Verificar sellos de tapa/puerta y seguros',
    helpText: 'Close lid/door and check for steam or heat escape. Verify latch holds securely.',
    helpTextEs: 'Cerrar tapa/puerta y verificar escape de vapor o calor. Verificar que el seguro mantenga firmemente.',
    required: true,
    order: 5,
    checklistItems: [
      'Lid/door seals properly',
      'No steam/heat escape when closed',
      'Latch holds securely',
      'Gasket/seal not cracked or worn',
    ],
    checklistItemsEs: [
      'Tapa/puerta sella correctamente',
      'Sin escape de vapor/calor cuando está cerrado',
      'El seguro mantiene firmemente',
      'Junta/sello sin grietas o desgaste',
    ],
  },
  {
    id: 'sapp-diag-6',
    code: 'SAPP_INTERIOR',
    name: 'Interior Condition',
    type: 'CHECKLIST',
    prompt: 'Inspect interior surfaces and components',
    promptEs: 'Inspeccionar superficies interiores y componentes',
    helpText: 'Check for rust, mineral buildup, coating damage. Verify racks/trays slide freely.',
    helpTextEs: 'Verificar oxidación, acumulación mineral, daño al recubrimiento. Verificar que bandejas/rejillas se deslicen libremente.',
    required: true,
    order: 6,
    checklistItems: [
      'No rust present',
      'No heavy mineral buildup',
      'Interior coating intact',
      'Racks/trays slide freely',
    ],
    checklistItemsEs: [
      'Sin oxidación presente',
      'Sin acumulación mineral severa',
      'Recubrimiento interior intacto',
      'Bandejas/rejillas se deslizan libremente',
    ],
  },
  {
    id: 'sapp-diag-7',
    code: 'SAPP_ALL_SETTINGS',
    name: 'All Settings Test',
    type: 'CHECKLIST',
    prompt: 'Test every mode and preset setting',
    promptEs: 'Probar cada modo y configuración preestablecida',
    helpText: 'Cycle through every mode/setting. Verify temperature presets and special features.',
    helpTextEs: 'Recorrer cada modo/configuración. Verificar preajustes de temperatura y características especiales.',
    required: true,
    order: 7,
    checklistItems: [
      'Every mode/setting functions',
      'Temperature presets accurate',
      'Special features work (steam, etc.)',
      'Programs run to completion',
    ],
    checklistItemsEs: [
      'Cada modo/configuración funciona',
      'Preajustes de temperatura precisos',
      'Características especiales funcionan (vapor, etc.)',
      'Los programas se ejecutan hasta completarse',
    ],
  },
];

const SMALL_APPLIANCE_REPAIR: WorkflowStep[] = [
  {
    id: 'sapp-repair-1',
    code: 'SAPP_DESCALE_CLEAN',
    name: 'Descale & Clean',
    type: 'CHECKLIST',
    prompt: 'Run descaling cycle and deep clean interior',
    promptEs: 'Ejecutar ciclo de descalcificación y limpieza profunda del interior',
    helpText: 'Use vinegar/citric acid for mineral deposits. Rinse thoroughly after.',
    helpTextEs: 'Usar vinagre/ácido cítrico para depósitos minerales. Enjuagar completamente después.',
    required: true,
    order: 1,
    checklistItems: [
      'Descaling cycle completed',
      'Mineral deposits removed',
      'Rinsed thoroughly',
      'No residual taste or odor',
    ],
    checklistItemsEs: [
      'Ciclo de descalcificación completado',
      'Depósitos minerales eliminados',
      'Enjuagado completamente',
      'Sin sabor u olor residual',
    ],
  },
  {
    id: 'sapp-repair-2',
    code: 'SAPP_GASKET_REPLACE',
    name: 'Gasket/Seal Replace',
    type: 'CONFIRMATION',
    prompt: 'Replace worn gasket/seal and verify fit',
    promptEs: 'Reemplazar junta/sello desgastado y verificar ajuste',
    helpText: 'Remove old gasket, clean surface, install new gasket. Test seal.',
    helpTextEs: 'Retirar junta vieja, limpiar superficie, instalar junta nueva. Probar sello.',
    required: true,
    order: 2,
  },
  {
    id: 'sapp-repair-3',
    code: 'SAPP_HEATING_SERVICE',
    name: 'Heating Element Service',
    type: 'CHECKLIST',
    prompt: 'Clean heating element and check connections',
    promptEs: 'Limpiar elemento calefactor y verificar conexiones',
    helpText: 'Clean element of residue. Verify connections are tight. Check ohm reading if accessible.',
    helpTextEs: 'Limpiar el elemento de residuos. Verificar que las conexiones estén apretadas. Verificar lectura de ohmios si es accesible.',
    required: true,
    order: 3,
    checklistItems: [
      'Element cleaned of residue',
      'Connections tight and clean',
      'No corrosion on contacts',
      'Ohm reading normal (if testable)',
    ],
    checklistItemsEs: [
      'Elemento limpio de residuos',
      'Conexiones apretadas y limpias',
      'Sin corrosión en contactos',
      'Lectura de ohmios normal (si es comprobable)',
    ],
  },
  {
    id: 'sapp-repair-4',
    code: 'SAPP_CONTROL_BOARD',
    name: 'Control Board Check',
    type: 'CHECKLIST',
    prompt: 'Inspect control board and test relay/switch continuity',
    promptEs: 'Inspeccionar placa de control y probar continuidad de relé/interruptor',
    helpText: 'Open control panel. Look for burn marks, test relay contacts, check switch continuity.',
    helpTextEs: 'Abrir panel de control. Buscar marcas de quemadura, probar contactos de relé, verificar continuidad de interruptores.',
    required: true,
    order: 4,
    checklistItems: [
      'No burn marks on board',
      'Relay/switch continuity verified',
      'Connections secure',
      'Replace board if needed',
    ],
    checklistItemsEs: [
      'Sin marcas de quemadura en la placa',
      'Continuidad de relé/interruptor verificada',
      'Conexiones seguras',
      'Reemplazar placa si es necesario',
    ],
  },
  {
    id: 'sapp-repair-5',
    code: 'SAPP_INTERIOR_REFURB',
    name: 'Interior Refurbish',
    type: 'CHECKLIST',
    prompt: 'Deep clean and refurbish interior surfaces',
    promptEs: 'Limpieza profunda y renovación de superficies interiores',
    helpText: 'Deep clean all surfaces. Re-coat if needed. Verify all racks/accessories present. Sanitize.',
    helpTextEs: 'Limpiar profundamente todas las superficies. Recubrir si es necesario. Verificar que todos los accesorios estén presentes. Sanitizar.',
    required: true,
    order: 5,
    checklistItems: [
      'All surfaces deep cleaned',
      'Re-coated if needed',
      'All racks/accessories present',
      'Interior sanitized',
    ],
    checklistItemsEs: [
      'Todas las superficies limpiadas profundamente',
      'Recubierto si es necesario',
      'Todos los accesorios presentes',
      'Interior sanitizado',
    ],
  },
];

const SMALL_APPLIANCE_FINAL: WorkflowStep[] = [
  {
    id: 'sapp-final-1',
    code: 'SAPP_FULL_FUNCTION',
    name: 'Full Function Test',
    type: 'MEASUREMENT',
    prompt: 'Test all modes/settings and run complete cycle',
    promptEs: 'Probar todos los modos/configuraciones y ejecutar ciclo completo',
    helpText: 'Run at each setting. Verify temperatures match. Complete one full cycle.',
    helpTextEs: 'Ejecutar en cada configuración. Verificar que las temperaturas coincidan. Completar un ciclo completo.',
    required: true,
    order: 1,
    inputSchema: {
      type: 'object',
      properties: {
        allModesWork: { type: 'boolean', title: 'All modes/settings functional' },
        tempsAccurate: { type: 'boolean', title: 'Temperatures match settings' },
        completeCycleOk: { type: 'boolean', title: 'Complete cycle runs successfully' },
      },
      required: ['allModesWork', 'completeCycleOk'],
    },
  },
  {
    id: 'sapp-final-2',
    code: 'SAPP_SAFETY_VERIFY',
    name: 'Safety Verify',
    type: 'CHECKLIST',
    prompt: 'Final safety verification of all mechanisms',
    promptEs: 'Verificación final de seguridad de todos los mecanismos',
    helpText: 'Re-verify all safety shutoffs, cord security, and stability.',
    helpTextEs: 'Re-verificar todos los apagados de seguridad, seguridad del cable y estabilidad.',
    required: true,
    order: 2,
    checklistItems: [
      'All safety shutoffs confirmed working',
      'Cord/plug secure',
      'Stable on flat surface',
      'No exposed hot surfaces when closed',
    ],
    checklistItemsEs: [
      'Todos los apagados de seguridad confirmados',
      'Cable/enchufe seguro',
      'Estable en superficie plana',
      'Sin superficies calientes expuestas cuando está cerrado',
    ],
  },
  {
    id: 'sapp-final-3',
    code: 'SAPP_CYCLE_TIMING',
    name: 'Cycle Timing',
    type: 'MEASUREMENT',
    prompt: 'Measure timing for each setting and verify auto-off',
    promptEs: 'Medir tiempo para cada configuración y verificar apagado automático',
    helpText: 'Time each program/setting cycle. Verify auto-off triggers correctly.',
    helpTextEs: 'Cronometrar cada ciclo de programa/configuración. Verificar que el apagado automático se active correctamente.',
    required: true,
    order: 3,
    inputSchema: {
      type: 'object',
      properties: {
        timingMatchesSpec: { type: 'boolean', title: 'Timing matches spec for each setting' },
        autoOffWorks: { type: 'boolean', title: 'Auto-off works correctly' },
      },
      required: ['timingMatchesSpec', 'autoOffWorks'],
    },
  },
  {
    id: 'sapp-final-4',
    code: 'SAPP_COSMETIC_GRADE',
    name: 'Cosmetic Grading',
    type: 'INPUT',
    prompt: 'Assign cosmetic grade and document condition',
    promptEs: 'Asignar grado cosmético y documentar condición',
    helpText: 'Grade A/B/C/D based on physical condition. Add notes and take photo.',
    helpTextEs: 'Calificar A/B/C/D según condición física. Agregar notas y tomar foto.',
    required: true,
    order: 4,
    inputSchema: {
      type: 'object',
      properties: {
        overallGrade: { type: 'string', enum: ['A', 'B', 'C', 'D'], title: 'Overall cosmetic grade' },
        conditionNotes: { type: 'string', title: 'Condition notes' },
      },
      required: ['overallGrade'],
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

const ICE_MAKER_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', ICE_MAKER_SECURITY_PREP],
  ['DIAGNOSED', ICE_MAKER_DIAGNOSIS],
  ['REPAIR_IN_PROGRESS', ICE_MAKER_REPAIR],
  ['FINAL_TEST_IN_PROGRESS', ICE_MAKER_FINAL],
]);

const VACUUM_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', VACUUM_SECURITY_PREP],
  ['DIAGNOSED', VACUUM_DIAGNOSIS],
  ['REPAIR_IN_PROGRESS', VACUUM_REPAIR],
  ['FINAL_TEST_IN_PROGRESS', VACUUM_FINAL],
]);

const SMALL_APPLIANCE_SOP: Map<RefurbState, WorkflowStep[]> = new Map([
  ['REFURBZ_IN_PROGRESS', SMALL_APPLIANCE_SECURITY_PREP],
  ['DIAGNOSED', SMALL_APPLIANCE_DIAGNOSIS],
  ['REPAIR_IN_PROGRESS', SMALL_APPLIANCE_REPAIR],
  ['FINAL_TEST_IN_PROGRESS', SMALL_APPLIANCE_FINAL],
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
  APPLIANCE_SMALL: SMALL_APPLIANCE_SOP,
  APPLIANCE_LARGE: GENERIC_SOP,
  ICE_MAKER: ICE_MAKER_SOP,
  VACUUM: VACUUM_SOP,
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
    states: Object.fromEntries(SMALL_APPLIANCE_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  APPLIANCE_LARGE: {
    name: 'Large Appliance SOP',
    states: Object.fromEntries(GENERIC_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  ICE_MAKER: {
    name: 'Ice Maker SOP',
    states: Object.fromEntries(ICE_MAKER_SOP) as Record<RefurbState, WorkflowStep[]>,
  },
  VACUUM: {
    name: 'Vacuum SOP',
    states: Object.fromEntries(VACUUM_SOP) as Record<RefurbState, WorkflowStep[]>,
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
