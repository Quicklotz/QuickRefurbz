/**
 * QuickDiagnosticz - Test Definitions
 * Category-specific diagnostic test suites
 *
 * Test Code Format: {CATEGORY}-{COMPONENT}-{NUMBER}
 * SA = Small Appliance, IM = Ice Maker, VC = Vacuum
 */

import { DiagnosticTestInput, TestSuite, CategoryTestConfig } from './types.js';
import { ProductCategory } from '../types.js';

// ==================== SMALL APPLIANCES (SA) ====================

export const SMALL_APPLIANCE_TESTS: DiagnosticTestInput[] = [
  {
    code: 'SA-PWR-001',
    name: 'Power On Test',
    category: 'APPLIANCE_SMALL',
    testType: 'FUNCTIONAL',
    description: 'Verify the appliance powers on correctly when plugged in and switched on.',
    instructions: '1. Inspect power cord for damage\n2. Plug into outlet\n3. Turn on power switch\n4. Verify power indicator light (if present)\n5. Listen for normal startup sounds',
    passCriteria: 'Device powers on, indicator lights illuminate, no unusual sounds or smells',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'SA-MTR-001',
    name: 'Motor Function Test',
    category: 'APPLIANCE_SMALL',
    testType: 'FUNCTIONAL',
    description: 'Test motor operation for appliances with motors (blenders, mixers, food processors, etc.).',
    instructions: '1. Power on device\n2. Engage motor at lowest speed\n3. Test each speed setting\n4. Listen for smooth, consistent operation\n5. Check for excessive vibration',
    passCriteria: 'Motor runs smoothly at all speeds, no grinding, no excessive vibration',
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'SA-HTR-001',
    name: 'Heating Element Test',
    category: 'APPLIANCE_SMALL',
    testType: 'FUNCTIONAL',
    description: 'Test heating element for appliances that heat (toasters, coffee makers, air fryers, etc.).',
    instructions: '1. Power on device\n2. Set to heating mode\n3. Wait for element to warm (2-3 minutes)\n4. Verify heat output with hand proximity test\n5. Check thermostat cycles properly',
    passCriteria: 'Heating element warms up within expected time, maintains temperature',
    isCritical: false,
    displayOrder: 3
  },
  {
    code: 'SA-CTL-001',
    name: 'Controls & Timer Test',
    category: 'APPLIANCE_SMALL',
    testType: 'FUNCTIONAL',
    description: 'Verify all buttons, dials, digital displays, and timers function correctly.',
    instructions: '1. Test each button/switch\n2. Verify dial positions\n3. Test digital display (if present)\n4. Set and run timer function\n5. Verify timer completes and signals',
    passCriteria: 'All controls respond correctly, display is clear, timer functions properly',
    isCritical: false,
    displayOrder: 4
  },
  {
    code: 'SA-SFT-001',
    name: 'Safety Features Test',
    category: 'APPLIANCE_SMALL',
    testType: 'SAFETY',
    description: 'Verify safety mechanisms function (lid locks, auto shutoff, thermal protection).',
    instructions: '1. Test lid lock engagement (blenders, pressure cookers)\n2. Verify auto-shutoff triggers\n3. Check thermal cutoff protection\n4. Test safety interlocks\n5. Verify no exposed wiring',
    passCriteria: 'All safety features engage properly, no bypassed safety mechanisms',
    isCritical: true,
    displayOrder: 5
  },
  {
    code: 'SA-CRD-001',
    name: 'Power Cord Inspection',
    category: 'APPLIANCE_SMALL',
    testType: 'VISUAL',
    description: 'Inspect power cord for damage, fraying, or exposed wires.',
    instructions: '1. Inspect entire cord length\n2. Check cord entry point into device\n3. Examine plug prongs\n4. Look for cuts, fraying, discoloration\n5. Verify strain relief intact',
    passCriteria: 'Cord is intact with no damage, plug prongs are straight, no exposed wires',
    isCritical: true,
    displayOrder: 6
  },
  {
    code: 'SA-COS-001',
    name: 'Cosmetic Condition',
    category: 'APPLIANCE_SMALL',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition including scratches, dents, discoloration.',
    instructions: '1. Inspect all exterior surfaces\n2. Note any scratches or scuffs\n3. Check for dents or cracks\n4. Look for discoloration or staining\n5. Verify all panels/covers secure',
    passCriteria: 'Rate cosmetic condition: Excellent (like new) / Good (minor wear) / Fair (visible wear) / Poor (significant damage)',
    isCritical: false,
    displayOrder: 7
  },
  {
    code: 'SA-ACC-001',
    name: 'Accessories Check',
    category: 'APPLIANCE_SMALL',
    testType: 'VISUAL',
    description: 'Verify included accessories are present and in good condition.',
    instructions: '1. Check for removable parts (bowls, blades, attachments)\n2. Verify instruction manual (if expected)\n3. Check for additional accessories\n4. Note any missing items\n5. Verify accessories fit properly',
    passCriteria: 'List all included accessories and their condition',
    isCritical: false,
    displayOrder: 8
  }
];

// ==================== ICE MAKERS (IM) ====================

export const ICE_MAKER_TESTS: DiagnosticTestInput[] = [
  {
    code: 'IM-PWR-001',
    name: 'Power On Test',
    category: 'ICE_MAKER',
    testType: 'FUNCTIONAL',
    description: 'Verify the ice maker powers on and initializes correctly.',
    instructions: '1. Inspect power cord for damage\n2. Plug into outlet\n3. Turn on power switch\n4. Verify display/indicator lights\n5. Listen for startup sequence',
    passCriteria: 'Device powers on, display illuminates, compressor starts within 2 minutes',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'IM-CMP-001',
    name: 'Compressor Function Test',
    category: 'ICE_MAKER',
    testType: 'FUNCTIONAL',
    description: 'Verify compressor engages and runs properly.',
    instructions: '1. Power on unit\n2. Listen for compressor startup (usually 30-60 seconds)\n3. Verify cooling fan runs\n4. Check for unusual compressor noises\n5. Feel for vibration (should be minimal)',
    passCriteria: 'Compressor starts, runs smoothly without excessive noise or vibration',
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'IM-ICE-001',
    name: 'Ice Production Cycle Test',
    category: 'ICE_MAKER',
    testType: 'FUNCTIONAL',
    description: 'Run a complete ice production cycle to verify ice is made.',
    instructions: '1. Fill reservoir with water to max line\n2. Start ice making cycle\n3. Monitor first batch production (typically 6-15 minutes)\n4. Verify ice releases into basket\n5. Check ice cube size/shape',
    passCriteria: 'Ice cubes form within expected time, release properly, correct size',
    isCritical: true,
    displayOrder: 3
  },
  {
    code: 'IM-WTR-001',
    name: 'Water System Test',
    category: 'ICE_MAKER',
    testType: 'FUNCTIONAL',
    description: 'Test water inlet, reservoir, and drainage system.',
    instructions: '1. Verify water reservoir holds water without leaks\n2. Check water inlet for obstructions\n3. Test drain plug functionality\n4. Verify water level sensor works\n5. Check for leaks during operation',
    passCriteria: 'No leaks, water system functions correctly, sensors respond properly',
    isCritical: true,
    displayOrder: 4
  },
  {
    code: 'IM-TMP-001',
    name: 'Temperature Reading',
    category: 'ICE_MAKER',
    testType: 'MEASUREMENT',
    description: 'Measure internal temperature to verify cooling performance.',
    instructions: '1. Allow unit to run for 15 minutes\n2. Use thermometer to measure evaporator area\n3. Verify temperature drops below freezing\n4. Record temperature reading',
    passCriteria: 'Evaporator reaches freezing temperature (32°F/0°C or below)',
    measurementUnit: 'F',
    measurementMin: -10,
    measurementMax: 32,
    isCritical: false,
    displayOrder: 5
  },
  {
    code: 'IM-NSE-001',
    name: 'Noise Level Assessment',
    category: 'ICE_MAKER',
    testType: 'MEASUREMENT',
    description: 'Measure operational noise level.',
    instructions: '1. Place sound meter 3 feet from unit\n2. Measure during compressor operation\n3. Record decibel reading\n4. Note any unusual sounds',
    passCriteria: 'Noise level under 50dB, no grinding or clicking sounds',
    measurementUnit: 'dB',
    measurementMin: 0,
    measurementMax: 50,
    isCritical: false,
    displayOrder: 6
  },
  {
    code: 'IM-ICQ-001',
    name: 'Ice Quality Check',
    category: 'ICE_MAKER',
    testType: 'VISUAL',
    description: 'Inspect ice cube quality, clarity, and consistency.',
    instructions: '1. Examine produced ice cubes\n2. Check for clarity vs cloudiness\n3. Verify consistent size\n4. Check for proper cube shape\n5. Taste test for off-flavors (optional)',
    passCriteria: 'Ice cubes are properly formed, reasonably clear, consistent size',
    isCritical: false,
    displayOrder: 7
  },
  {
    code: 'IM-CTL-001',
    name: 'Controls & Display Test',
    category: 'ICE_MAKER',
    testType: 'FUNCTIONAL',
    description: 'Test all buttons, ice size selection, and display functions.',
    instructions: '1. Test power button\n2. Test ice size selection (if available)\n3. Verify display indicators\n4. Test any additional modes\n5. Check ice full sensor',
    passCriteria: 'All controls respond, display is clear, sensors function properly',
    isCritical: false,
    displayOrder: 8
  },
  {
    code: 'IM-COS-001',
    name: 'Cosmetic Condition',
    category: 'ICE_MAKER',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition of the unit.',
    instructions: '1. Inspect exterior housing\n2. Check lid condition and hinge\n3. Inspect ice basket\n4. Check for rust or corrosion\n5. Verify all panels secure',
    passCriteria: 'Rate cosmetic condition: Excellent / Good / Fair / Poor',
    isCritical: false,
    displayOrder: 9
  }
];

// ==================== VACUUMS (VC) ====================

export const VACUUM_TESTS: DiagnosticTestInput[] = [
  {
    code: 'VC-PWR-001',
    name: 'Power On Test',
    category: 'VACUUM',
    testType: 'FUNCTIONAL',
    description: 'Verify the vacuum powers on correctly.',
    instructions: '1. For corded: inspect cord, plug in, turn on\n2. For cordless: ensure battery charged, turn on\n3. Verify power indicator\n4. Listen for motor startup\n5. Check for normal operation sound',
    passCriteria: 'Device powers on immediately, motor runs smoothly',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'VC-SUC-001',
    name: 'Suction Power Test',
    category: 'VACUUM',
    testType: 'MEASUREMENT',
    description: 'Measure suction power to verify cleaning performance.',
    instructions: '1. Clear any obstructions in hose/path\n2. Use suction gauge or water lift test\n3. Test at multiple power settings if available\n4. Compare to expected specifications\n5. Note if suction varies during use',
    passCriteria: 'Suction within acceptable range for model type',
    measurementUnit: 'CFM',
    measurementMin: 20,
    measurementMax: 200,
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'VC-MTR-001',
    name: 'Motor Function Test',
    category: 'VACUUM',
    testType: 'FUNCTIONAL',
    description: 'Test motor operation at all speed settings.',
    instructions: '1. Run motor at lowest setting\n2. Progress through all speed settings\n3. Listen for consistent operation\n4. Check for overheating smell\n5. Verify motor sounds healthy',
    passCriteria: 'Motor runs smoothly at all speeds, no burning smell',
    isCritical: true,
    displayOrder: 3
  },
  {
    code: 'VC-BRS-001',
    name: 'Brush Roll Test',
    category: 'VACUUM',
    testType: 'FUNCTIONAL',
    description: 'Test motorized brush roll operation.',
    instructions: '1. Engage brush roll (if powered)\n2. Verify rotation\n3. Check for hair/debris wrapped around brush\n4. Test brush roll on/off switch\n5. Check brush bristle condition',
    passCriteria: 'Brush roll spins freely, no obstructions, bristles intact',
    isCritical: false,
    displayOrder: 4
  },
  {
    code: 'VC-FLT-001',
    name: 'Filter Condition',
    category: 'VACUUM',
    testType: 'VISUAL',
    description: 'Inspect filter condition and cleanliness.',
    instructions: '1. Remove filter(s)\n2. Inspect for damage or tears\n3. Check cleanliness level\n4. Verify HEPA filter seal (if applicable)\n5. Note if replacement needed',
    passCriteria: 'Filter intact, reasonably clean or new, properly sealed',
    isCritical: false,
    displayOrder: 5
  },
  {
    code: 'VC-HSE-001',
    name: 'Hose & Attachments',
    category: 'VACUUM',
    testType: 'VISUAL',
    description: 'Inspect hose and attachments for damage or blockages.',
    instructions: '1. Inspect full hose length for cracks\n2. Check hose connections\n3. Verify no internal blockages\n4. Inspect included attachments\n5. Test attachment fit',
    passCriteria: 'Hose intact with no cracks/holes, attachments in good condition',
    isCritical: false,
    displayOrder: 6
  },
  {
    code: 'VC-BAT-001',
    name: 'Battery Health Test',
    category: 'VACUUM',
    testType: 'MEASUREMENT',
    description: 'Test battery capacity and health for cordless vacuums.',
    instructions: '1. Fully charge battery\n2. Run vacuum at normal power\n3. Time how long until battery depletes\n4. Compare to rated runtime\n5. Check for rapid discharge',
    passCriteria: 'Battery achieves at least 70% of rated runtime',
    measurementUnit: '%',
    measurementMin: 70,
    measurementMax: 100,
    isCritical: true,
    displayOrder: 7
  },
  {
    code: 'VC-CHG-001',
    name: 'Charging Test',
    category: 'VACUUM',
    testType: 'FUNCTIONAL',
    description: 'Test charging system for cordless vacuums.',
    instructions: '1. Place on charger/dock\n2. Verify charging indicator illuminates\n3. Confirm battery accepts charge\n4. Check charger connection security\n5. Test charge completion indicator',
    passCriteria: 'Charging initiates properly, indicators work, completes charge',
    isCritical: true,
    displayOrder: 8
  },
  {
    code: 'VC-NSE-001',
    name: 'Noise Level Assessment',
    category: 'VACUUM',
    testType: 'MEASUREMENT',
    description: 'Measure operational noise level.',
    instructions: '1. Run vacuum at normal power\n2. Measure noise at 3 feet distance\n3. Note any unusual sounds\n4. Compare to typical range',
    passCriteria: 'Noise within normal range for vacuum type (typically 60-80dB)',
    measurementUnit: 'dB',
    measurementMin: 50,
    measurementMax: 85,
    isCritical: false,
    displayOrder: 9
  },
  {
    code: 'VC-DST-001',
    name: 'Dust Container Test',
    category: 'VACUUM',
    testType: 'FUNCTIONAL',
    description: 'Test dust bin/bag system operation.',
    instructions: '1. Remove dust container/bag\n2. Check seal condition\n3. Verify proper reinstallation\n4. Test release mechanism\n5. Check container for cracks',
    passCriteria: 'Container seals properly, release mechanism works, no cracks',
    isCritical: false,
    displayOrder: 10
  },
  {
    code: 'VC-COS-001',
    name: 'Cosmetic Condition',
    category: 'VACUUM',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition.',
    instructions: '1. Inspect body for scratches/dents\n2. Check wheels/rollers\n3. Verify all covers/panels secure\n4. Check cord condition (corded)\n5. Note overall appearance',
    passCriteria: 'Rate cosmetic condition: Excellent / Good / Fair / Poor',
    isCritical: false,
    displayOrder: 11
  }
];

// ==================== PHONES (PH) ====================

export const PHONE_TESTS: DiagnosticTestInput[] = [
  {
    code: 'PH-PWR-001',
    name: 'Power On Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Verify the phone powers on and boots to home screen.',
    instructions: '1. Press and hold power button\n2. Verify boot animation appears\n3. Wait for home screen\n4. Check for boot loops or crashes',
    passCriteria: 'Device boots to home screen within 60 seconds without errors',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'PH-DSP-001',
    name: 'Display Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test display for dead pixels, burn-in, and touch response.',
    instructions: '1. Display solid colors (red, green, blue, white, black)\n2. Check for dead pixels or lines\n3. Check for burn-in or image retention\n4. Test touch response across entire screen\n5. Test multi-touch capability',
    passCriteria: 'No dead pixels, no burn-in, touch responds accurately across entire screen',
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'PH-TCH-001',
    name: 'Touch Screen Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Verify touch screen responsiveness and accuracy.',
    instructions: '1. Open touch test app or drawing app\n2. Draw lines across entire screen\n3. Test corners and edges\n4. Test pinch-to-zoom gesture\n5. Test swipe gestures',
    passCriteria: 'Touch registers accurately in all areas, gestures work correctly',
    isCritical: true,
    displayOrder: 3
  },
  {
    code: 'PH-BAT-001',
    name: 'Battery Health Test',
    category: 'PHONE',
    testType: 'MEASUREMENT',
    description: 'Check battery capacity and health percentage.',
    instructions: '1. Check battery health in settings (iOS) or use diagnostic app\n2. Record battery capacity percentage\n3. Check for battery swelling\n4. Verify charging indicator works',
    passCriteria: 'Battery health above 80%',
    measurementUnit: '%',
    measurementMin: 80,
    measurementMax: 100,
    isCritical: true,
    displayOrder: 4
  },
  {
    code: 'PH-CHG-001',
    name: 'Charging Port Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test charging port functionality.',
    instructions: '1. Connect charging cable\n2. Verify charging indicator appears\n3. Verify cable fits snugly\n4. Test data transfer capability\n5. Check for debris or damage in port',
    passCriteria: 'Device charges and syncs data properly',
    isCritical: true,
    displayOrder: 5
  },
  {
    code: 'PH-CAM-001',
    name: 'Camera Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test front and rear cameras.',
    instructions: '1. Open camera app\n2. Test rear camera focus and capture\n3. Test front camera\n4. Test flash (if equipped)\n5. Test video recording\n6. Check for lens scratches or haze',
    passCriteria: 'Both cameras capture clear images, flash works, no lens damage',
    isCritical: false,
    displayOrder: 6
  },
  {
    code: 'PH-AUD-001',
    name: 'Audio Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test speakers, earpiece, and microphone.',
    instructions: '1. Play audio through main speaker\n2. Test earpiece during call simulation\n3. Test microphone by recording voice memo\n4. Test headphone jack (if equipped)\n5. Check for distortion or crackling',
    passCriteria: 'All audio components function clearly without distortion',
    isCritical: false,
    displayOrder: 7
  },
  {
    code: 'PH-BTN-001',
    name: 'Button Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test all physical buttons.',
    instructions: '1. Test power button\n2. Test volume up/down buttons\n3. Test mute switch (if equipped)\n4. Test home button (if equipped)\n5. Check button feel and response',
    passCriteria: 'All buttons respond correctly with proper tactile feedback',
    isCritical: false,
    displayOrder: 8
  },
  {
    code: 'PH-WIF-001',
    name: 'WiFi Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test WiFi connectivity.',
    instructions: '1. Enable WiFi\n2. Scan for networks\n3. Connect to test network\n4. Verify internet access\n5. Check signal strength',
    passCriteria: 'Device connects to WiFi and accesses internet',
    isCritical: false,
    displayOrder: 9
  },
  {
    code: 'PH-BLU-001',
    name: 'Bluetooth Test',
    category: 'PHONE',
    testType: 'FUNCTIONAL',
    description: 'Test Bluetooth connectivity.',
    instructions: '1. Enable Bluetooth\n2. Scan for devices\n3. Pair with test device\n4. Verify connection stability',
    passCriteria: 'Device pairs and maintains stable Bluetooth connection',
    isCritical: false,
    displayOrder: 10
  },
  {
    code: 'PH-FRP-001',
    name: 'FRP/iCloud Lock Check',
    category: 'PHONE',
    testType: 'SAFETY',
    description: 'Verify device is not activation locked.',
    instructions: '1. Check for Factory Reset Protection (Android)\n2. Check for iCloud Activation Lock (iOS)\n3. Verify device can be set up as new\n4. Check for MDM profiles',
    passCriteria: 'Device is not locked and can be set up as new',
    isCritical: true,
    displayOrder: 11
  },
  {
    code: 'PH-COS-001',
    name: 'Cosmetic Condition',
    category: 'PHONE',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition.',
    instructions: '1. Inspect screen for scratches\n2. Check frame/housing for dents\n3. Inspect camera lens\n4. Check for water damage indicators\n5. Rate overall condition',
    passCriteria: 'Rate cosmetic condition: Excellent / Good / Fair / Poor',
    isCritical: false,
    displayOrder: 12
  }
];

// ==================== TABLETS (TB) ====================

export const TABLET_TESTS: DiagnosticTestInput[] = [
  {
    code: 'TB-PWR-001',
    name: 'Power On Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Verify the tablet powers on and boots correctly.',
    instructions: '1. Press and hold power button\n2. Verify boot animation\n3. Wait for home screen\n4. Check for crashes or freezes',
    passCriteria: 'Device boots to home screen without errors',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'TB-DSP-001',
    name: 'Display Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test display quality and touch response.',
    instructions: '1. Display solid colors (R,G,B,W,Black)\n2. Check for dead pixels or lines\n3. Check for backlight bleeding\n4. Test touch response across screen\n5. Test multi-touch',
    passCriteria: 'No dead pixels, even backlight, accurate touch response',
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'TB-BAT-001',
    name: 'Battery Health Test',
    category: 'TABLET',
    testType: 'MEASUREMENT',
    description: 'Check battery capacity and health.',
    instructions: '1. Check battery health percentage\n2. Verify charging works\n3. Check for battery swelling\n4. Note cycle count if available',
    passCriteria: 'Battery health above 80%',
    measurementUnit: '%',
    measurementMin: 80,
    measurementMax: 100,
    isCritical: true,
    displayOrder: 3
  },
  {
    code: 'TB-CHG-001',
    name: 'Charging Port Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test charging and data port.',
    instructions: '1. Connect charging cable\n2. Verify charging indicator\n3. Test data transfer\n4. Check port for damage',
    passCriteria: 'Device charges and syncs properly',
    isCritical: true,
    displayOrder: 4
  },
  {
    code: 'TB-CAM-001',
    name: 'Camera Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test all cameras.',
    instructions: '1. Test rear camera\n2. Test front camera\n3. Test video recording\n4. Check lens condition',
    passCriteria: 'All cameras capture clear images',
    isCritical: false,
    displayOrder: 5
  },
  {
    code: 'TB-AUD-001',
    name: 'Audio Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test speakers and microphone.',
    instructions: '1. Play audio through speakers\n2. Test stereo separation\n3. Record voice memo\n4. Test headphone jack if equipped',
    passCriteria: 'Clear audio without distortion',
    isCritical: false,
    displayOrder: 6
  },
  {
    code: 'TB-BTN-001',
    name: 'Button Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test all physical buttons.',
    instructions: '1. Test power button\n2. Test volume buttons\n3. Test home button if equipped',
    passCriteria: 'All buttons respond correctly',
    isCritical: false,
    displayOrder: 7
  },
  {
    code: 'TB-WIF-001',
    name: 'WiFi Test',
    category: 'TABLET',
    testType: 'FUNCTIONAL',
    description: 'Test WiFi connectivity.',
    instructions: '1. Connect to WiFi\n2. Verify internet access\n3. Check signal strength',
    passCriteria: 'WiFi connects and works properly',
    isCritical: false,
    displayOrder: 8
  },
  {
    code: 'TB-FRP-001',
    name: 'FRP/iCloud Lock Check',
    category: 'TABLET',
    testType: 'SAFETY',
    description: 'Verify device is not activation locked.',
    instructions: '1. Check for FRP or iCloud lock\n2. Verify device can be set up as new\n3. Check for MDM profiles',
    passCriteria: 'Device is not locked',
    isCritical: true,
    displayOrder: 9
  },
  {
    code: 'TB-COS-001',
    name: 'Cosmetic Condition',
    category: 'TABLET',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition.',
    instructions: '1. Inspect screen for scratches\n2. Check body for damage\n3. Inspect cameras\n4. Rate condition',
    passCriteria: 'Rate: Excellent / Good / Fair / Poor',
    isCritical: false,
    displayOrder: 10
  }
];

// ==================== LAPTOPS (LP) ====================

export const LAPTOP_TESTS: DiagnosticTestInput[] = [
  {
    code: 'LP-PWR-001',
    name: 'Power On Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Verify laptop powers on and boots to OS.',
    instructions: '1. Press power button\n2. Verify POST completes\n3. Wait for OS to load\n4. Check for BIOS errors or beeps',
    passCriteria: 'Laptop boots to desktop without errors',
    isCritical: true,
    displayOrder: 1
  },
  {
    code: 'LP-DSP-001',
    name: 'Display Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test display quality and hinge operation.',
    instructions: '1. Display solid colors (R,G,B,W,Black)\n2. Check for dead pixels or lines\n3. Check backlight uniformity\n4. Test hinge operation\n5. Check for screen wobble',
    passCriteria: 'No dead pixels, even backlight, hinge operates smoothly',
    isCritical: true,
    displayOrder: 2
  },
  {
    code: 'LP-KEY-001',
    name: 'Keyboard Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test all keyboard keys.',
    instructions: '1. Open keyboard test utility\n2. Press every key\n3. Check for stuck or unresponsive keys\n4. Test backlight if equipped\n5. Check key feel consistency',
    passCriteria: 'All keys register correctly with proper feel',
    isCritical: true,
    displayOrder: 3
  },
  {
    code: 'LP-TRK-001',
    name: 'Trackpad Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test trackpad functionality.',
    instructions: '1. Test cursor movement\n2. Test left/right click\n3. Test multi-touch gestures\n4. Check for dead spots\n5. Test click force consistency',
    passCriteria: 'Trackpad responds accurately, all gestures work',
    isCritical: true,
    displayOrder: 4
  },
  {
    code: 'LP-BAT-001',
    name: 'Battery Health Test',
    category: 'LAPTOP',
    testType: 'MEASUREMENT',
    description: 'Check battery capacity and health.',
    instructions: '1. Check battery health in OS or BIOS\n2. Note design capacity vs current capacity\n3. Calculate health percentage\n4. Check cycle count',
    passCriteria: 'Battery health above 80%',
    measurementUnit: '%',
    measurementMin: 80,
    measurementMax: 100,
    isCritical: true,
    displayOrder: 5
  },
  {
    code: 'LP-CHG-001',
    name: 'Charging Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test charging functionality.',
    instructions: '1. Connect charger\n2. Verify charging indicator\n3. Verify battery percentage increases\n4. Check charger port condition',
    passCriteria: 'Laptop charges properly',
    isCritical: true,
    displayOrder: 6
  },
  {
    code: 'LP-USB-001',
    name: 'USB Ports Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test all USB ports.',
    instructions: '1. Test each USB port with test device\n2. Verify data transfer\n3. Check for loose connections\n4. Test USB-C ports if equipped',
    passCriteria: 'All USB ports function correctly',
    isCritical: false,
    displayOrder: 7
  },
  {
    code: 'LP-CAM-001',
    name: 'Webcam Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test built-in webcam.',
    instructions: '1. Open camera app\n2. Verify image quality\n3. Test microphone\n4. Check camera light indicator',
    passCriteria: 'Webcam produces clear image',
    isCritical: false,
    displayOrder: 8
  },
  {
    code: 'LP-AUD-001',
    name: 'Audio Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test speakers and audio jack.',
    instructions: '1. Play audio through speakers\n2. Test headphone jack\n3. Test microphone\n4. Check for distortion',
    passCriteria: 'Audio plays clearly without distortion',
    isCritical: false,
    displayOrder: 9
  },
  {
    code: 'LP-WIF-001',
    name: 'WiFi Test',
    category: 'LAPTOP',
    testType: 'FUNCTIONAL',
    description: 'Test WiFi connectivity.',
    instructions: '1. Connect to WiFi network\n2. Verify internet access\n3. Check signal strength\n4. Test 2.4GHz and 5GHz bands',
    passCriteria: 'WiFi connects and maintains stable connection',
    isCritical: false,
    displayOrder: 10
  },
  {
    code: 'LP-SSD-001',
    name: 'Storage Health Test',
    category: 'LAPTOP',
    testType: 'MEASUREMENT',
    description: 'Check SSD/HDD health status.',
    instructions: '1. Run disk health check utility\n2. Check SMART status\n3. Note any bad sectors\n4. Check remaining lifespan percentage',
    passCriteria: 'Storage health above 80%',
    measurementUnit: '%',
    measurementMin: 80,
    measurementMax: 100,
    isCritical: false,
    displayOrder: 11
  },
  {
    code: 'LP-COS-001',
    name: 'Cosmetic Condition',
    category: 'LAPTOP',
    testType: 'VISUAL',
    description: 'Assess overall cosmetic condition.',
    instructions: '1. Inspect lid for scratches/dents\n2. Check palm rest condition\n3. Inspect screen bezel\n4. Check bottom cover\n5. Rate overall condition',
    passCriteria: 'Rate: Excellent / Good / Fair / Poor',
    isCritical: false,
    displayOrder: 12
  }
];

// ==================== TEST SUITE BUILDERS ====================

/**
 * Get all tests for a category
 */
export function getTestsForCategory(category: ProductCategory): DiagnosticTestInput[] {
  switch (category) {
    case 'APPLIANCE_SMALL':
      return SMALL_APPLIANCE_TESTS;
    case 'ICE_MAKER':
      return ICE_MAKER_TESTS;
    case 'VACUUM':
      return VACUUM_TESTS;
    case 'PHONE':
      return PHONE_TESTS;
    case 'TABLET':
      return TABLET_TESTS;
    case 'LAPTOP':
      return LAPTOP_TESTS;
    default:
      return [];
  }
}

/**
 * Get test suite with metadata for a category
 */
export function getTestSuite(category: ProductCategory): TestSuite | null {
  const tests = getTestsForCategory(category);
  if (tests.length === 0) return null;

  const criticalCount = tests.filter(t => t.isCritical).length;

  const categoryNames: Partial<Record<ProductCategory, string>> = {
    APPLIANCE_SMALL: 'Small Appliance',
    ICE_MAKER: 'Ice Maker',
    VACUUM: 'Vacuum',
    PHONE: 'Phone/Smartphone',
    TABLET: 'Tablet',
    LAPTOP: 'Laptop',
  };

  return {
    category,
    categoryName: categoryNames[category] || category,
    tests: tests as any[], // Cast to full DiagnosticTest (will have id/createdAt from DB)
    criticalTestCount: criticalCount,
    totalTestCount: tests.length
  };
}

/**
 * Get category test configuration
 */
export function getCategoryConfig(category: ProductCategory): CategoryTestConfig | null {
  const configs: Partial<Record<ProductCategory, CategoryTestConfig>> = {
    APPLIANCE_SMALL: {
      category: 'APPLIANCE_SMALL',
      estimatedMinutes: 15,
      requiresSpecialEquipment: false,
      additionalInstructions: 'Ensure appliance has cooled if previously used before testing.'
    },
    ICE_MAKER: {
      category: 'ICE_MAKER',
      estimatedMinutes: 30,
      requiresSpecialEquipment: true,
      equipmentList: ['Thermometer', 'Water supply'],
      additionalInstructions: 'Allow 15-20 minutes for first ice production cycle. Have clean water available.'
    },
    VACUUM: {
      category: 'VACUUM',
      estimatedMinutes: 20,
      requiresSpecialEquipment: false,
      additionalInstructions: 'For cordless models, ensure battery is charged before testing. Have debris for suction test if needed.'
    },
    PHONE: {
      category: 'PHONE',
      estimatedMinutes: 20,
      requiresSpecialEquipment: true,
      equipmentList: ['Charging cable', 'SIM ejector', 'WiFi network'],
      additionalInstructions: 'Ensure device is charged to at least 20% before testing. Factory reset may be required.'
    },
    TABLET: {
      category: 'TABLET',
      estimatedMinutes: 20,
      requiresSpecialEquipment: true,
      equipmentList: ['Charging cable', 'WiFi network'],
      additionalInstructions: 'Ensure device is charged to at least 20% before testing.'
    },
    LAPTOP: {
      category: 'LAPTOP',
      estimatedMinutes: 30,
      requiresSpecialEquipment: true,
      equipmentList: ['Power adapter', 'USB device', 'WiFi network'],
      additionalInstructions: 'Connect to power before running battery health test. Have diagnostic utilities ready.'
    }
  };

  return configs[category] || null;
}

/**
 * Get all available test suites
 */
export function getAllTestSuites(): TestSuite[] {
  const categories: ProductCategory[] = [
    'APPLIANCE_SMALL', 'ICE_MAKER', 'VACUUM',
    'PHONE', 'TABLET', 'LAPTOP'
  ];
  return categories
    .map(c => getTestSuite(c))
    .filter((suite): suite is TestSuite => suite !== null);
}

/**
 * Get critical tests for a category
 */
export function getCriticalTests(category: ProductCategory): DiagnosticTestInput[] {
  return getTestsForCategory(category).filter(t => t.isCritical);
}

/**
 * Check if a test code is valid
 */
export function isValidTestCode(code: string): boolean {
  const allTests = [
    ...SMALL_APPLIANCE_TESTS,
    ...ICE_MAKER_TESTS,
    ...VACUUM_TESTS,
    ...PHONE_TESTS,
    ...TABLET_TESTS,
    ...LAPTOP_TESTS,
  ];
  return allTests.some(t => t.code === code);
}

/**
 * Get test by code
 */
export function getTestByCode(code: string): DiagnosticTestInput | null {
  const allTests = [
    ...SMALL_APPLIANCE_TESTS,
    ...ICE_MAKER_TESTS,
    ...VACUUM_TESTS,
    ...PHONE_TESTS,
    ...TABLET_TESTS,
    ...LAPTOP_TESTS,
  ];
  return allTests.find(t => t.code === code) || null;
}

/**
 * Get category from test code prefix
 */
export function getCategoryFromTestCode(code: string): ProductCategory | null {
  const prefix = code.split('-')[0];
  const prefixMap: Record<string, ProductCategory> = {
    SA: 'APPLIANCE_SMALL',
    IM: 'ICE_MAKER',
    VC: 'VACUUM',
    PH: 'PHONE',
    TB: 'TABLET',
    LP: 'LAPTOP',
  };
  return prefixMap[prefix] || null;
}

/**
 * Get all test category codes
 */
export function getAllTestCategories(): string[] {
  return ['APPLIANCE_SMALL', 'ICE_MAKER', 'VACUUM', 'PHONE', 'TABLET', 'LAPTOP'];
}
