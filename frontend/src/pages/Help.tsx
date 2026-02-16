"use client";
import { useState, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Rocket,
  Package,
  ClipboardList,
  AlertTriangle,
  Keyboard,
  ArrowLeft,
} from 'lucide-react';
import { SpotlightCard } from '@/components/aceternity/spotlight';

// ─── Section & Article Data ────────────────────────────────────

interface Article {
  id: string;
  title: string;
  content: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  articles: Article[];
}

const HELP_SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Rocket size={20} />,
    color: 'text-ql-yellow',
    articles: [
      {
        id: 'install-pwa',
        title: 'Installing the App (PWA)',
        content: `## Installing QuickRefurbz on Your Device

**On Chrome / Edge (recommended):**
1. Open **install.quickrefurbz.com** in your browser
2. Click the **"Install QuickRefurbz"** button
3. Follow the browser prompt to add to your home screen
4. The app icon will appear on your desktop or app drawer

**On Safari (iPad):**
1. Open **install.quickrefurbz.com**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right

**Important:** The app works offline for basic functions but requires network access for printing labels, syncing data, and running diagnostics.`,
      },
      {
        id: 'setup-wizard',
        title: 'First-Time Setup Wizard',
        content: `## Setup Wizard Walkthrough

When you log in for the first time on a station account, the setup wizard guides you through configuration:

**Step 1 — Welcome**
Confirms your station number. No action needed, just click Next.

**Step 2 — Station Config**
- **Station Name**: Auto-filled from your account. You can customize it (e.g., "Station 3 - TVs").
- **Warehouse ID**: Usually \`WH-001\`. Only change if you have multiple warehouses.
- **Workstation ID**: Auto-assigned. Override if your station has a physical label.

**Step 3 — Printer Setup**
Click **"Scan for Printers"** to auto-detect Zebra printers on your network. Select your printer and choose the label size. Hit **"Test Print"** to confirm it works.

**Step 4 — Scanner Test**
Click the input field, then scan any barcode with your USB scanner. A green checkmark confirms it's working.

**Step 5 — Quick Tour**
Overview of the main sections. Click Next.

**Step 6 — Ready!**
Click **"Start Working"** to enter the app. You won't see the wizard again unless you clear your browser data.`,
      },
      {
        id: 'logging-in',
        title: 'Logging In with Station Credentials',
        content: `## Station Login

Each workstation has its own login credentials:

| Station | Email | Password |
|---------|-------|----------|
| Station 01 | station01@quickrefurbz.local | Provided by admin |
| Station 02 | station02@quickrefurbz.local | Provided by admin |
| ... | ... | ... |
| Station 10 | station10@quickrefurbz.local | Provided by admin |

**To log in:**
1. Open the app or navigate to **quickrefurbz.com**
2. Enter your station email
3. Enter the password provided by your supervisor
4. Click **"Sign In"**

**Trouble logging in?** See the Troubleshooting section below. If your account is locked, contact an admin.

**Admin accounts** use personal email addresses (e.g., connor@quicklotz.com) and have access to all features including user management and monitoring.`,
      },
    ],
  },
  {
    id: 'station-guides',
    title: 'Station Guides',
    icon: <Package size={20} />,
    color: 'text-accent-blue',
    articles: [
      {
        id: 'intake',
        title: 'Intake: Receiving Pallets & Scanning Items',
        content: `## Intake Process

**Before you start:** Make sure your scanner is connected and your label printer is online (green dot in the printer dropdown).

### Receiving a New Pallet
1. Go to **Intake** from the sidebar
2. Click **"New Pallet Session"**
3. Select the **retailer** (Best Buy, Target, Amazon, etc.)
4. Enter the **liquidation source** (e.g., "DirectLiquidation Lot #4521")
5. Enter the **expected item count** from the manifest
6. Click **"Start Session"**

### Scanning Items
1. Scan each item's barcode with your USB scanner — the cursor auto-focuses to the scan input
2. The system generates a unique **QLID** barcode for each item
3. Enter the **manufacturer** and **model** if known (helps downstream)
4. Select a **category** (Phone, Laptop, TV, etc.)
5. Click **"Add Item"** or press **Enter**

### Printing Labels
- Click **"Print Label"** on each item row
- Select your saved printer from the dropdown (or use browser print)
- Stick the label on the item — see the Label Placement guide in SOPs

### Ending the Session
When all items are scanned, click **"End Session"**. The pallet moves to the workflow queue.`,
      },
      {
        id: 'diagnostics',
        title: 'Diagnostics: Running Device Tests',
        content: `## Running Diagnostics

### Starting a Diagnostic Session
1. Navigate to **Diagnostics** from the sidebar
2. Scan the item's QLID barcode — the item details load automatically
3. The system selects the appropriate **test plan** based on the device category
4. Click **"Start Testing"**

### Running Tests
Each test plan has ordered steps. For each step:
1. Read the test description carefully
2. Perform the test on the physical device
3. Record the result: **Pass**, **Fail**, or **Skip**
4. Add notes if something is unusual
5. Click **"Next Test"** to proceed

### Common Tests
- **Power On**: Device boots successfully
- **Display Check**: No dead pixels, cracks, or discoloration
- **Touch/Input**: All buttons and touch inputs respond
- **Connectivity**: Wi-Fi, Bluetooth, cellular (if applicable)
- **Audio**: Speakers and microphone work
- **Camera**: Front and rear cameras capture images
- **Battery**: Holds charge (if applicable)

### Completing Diagnostics
After all tests, the system shows an **overall result** (Pass/Fail) and recommends the next workflow stage. Items that fail are routed to Repair.`,
      },
      {
        id: 'datawipe',
        title: 'Data Wipe: Secure Erasure',
        content: `## Data Wipe Process

Data wipe is **mandatory** for all devices that store personal data (phones, laptops, tablets).

### Starting a Wipe
1. Go to **Data Wipe** from the sidebar
2. Scan the item's QLID barcode
3. Select the **wipe method**:
   - **Factory Reset** — Quick, suitable for most consumer devices
   - **NIST 800-88 Clear** — Overwrite with zeros, standard compliance
   - **NIST 800-88 Purge** — Cryptographic erase, for SSDs and flash storage
   - **Physical Destruction** — For items marked as salvage/scrap

### During the Wipe
- The wipe status shows as **In Progress** with an estimated time
- Do NOT disconnect or power off the device during wipe
- You can start another device while waiting

### Verifying Completion
1. The system marks the wipe as **Complete** when done
2. Verify the device boots to factory setup screen
3. Click **"Verify Wipe"** to confirm
4. A **Data Wipe Certificate** is generated with timestamp, method, and operator ID

### If a Wipe Fails
- Retry with the same method first
- If it fails again, escalate to supervisor — the device may have hardware issues`,
      },
      {
        id: 'repair',
        title: 'Repair/Refurb: Workflow & Parts',
        content: `## Repair & Refurbishment

### Workflow Stages
Items move through stages in order:
1. **Intake** → Item received, labeled
2. **Diagnostics** → Tested, issues identified
3. **Data Wipe** → Personal data erased
4. **Repair** → Defects fixed, parts replaced
5. **Final QC** → Quality check, grading
6. **Complete** → Certified, ready for sale

### Working on a Repair
1. Go to **Workflow** from the sidebar
2. Your assigned items appear in the queue
3. Click an item to open its detail card
4. View the diagnostic results to see what needs fixing
5. Perform the repair on the physical device

### Logging Parts Used
1. In the item detail, click **"Add Part"**
2. Search or scan the part barcode
3. Select the part from inventory
4. Enter quantity used
5. Click **"Log Part"**

The part is deducted from inventory and linked to the item's repair history.

### Advancing to Next Stage
After repair is complete, click **"Advance Stage"** to move the item to Final QC.`,
      },
      {
        id: 'final-qc',
        title: 'Final QC & Certification',
        content: `## Final Quality Check & Certification

### Grading
After repair, each item is graded based on cosmetic and functional condition:

| Grade | Condition | Warranty |
|-------|-----------|----------|
| **A** | Like New — no visible wear, all features perfect | Yes |
| **B** | Excellent — minor scratches, all core features work | Yes |
| **C** | Good — visible wear, functional with minor issues | Yes |
| **D** | Fair — significant cosmetic damage, needs repair | No |
| **F** | Poor — parts only or non-functional | No |

### Running Final QC
1. Open the item in **Workflow**
2. Inspect the device against the grading rubric
3. Select the appropriate **grade**
4. Take photos if required (configurable in Settings)
5. Click **"Submit Grade"**

### Generating Certificates
Items graded A, B, or C automatically get a **Refurbishment Certificate** with:
- Unique certification ID
- QR code linking to the verification page
- Grade, test results summary, wipe confirmation
- Operator and date

### Printing the Refurb Label
The refurb label (RFB-QLID format) includes the grade badge and QR code. Print it and apply it to the device before packaging.`,
      },
      {
        id: 'packaging',
        title: 'Packaging: Preparing for Shipment',
        content: `## Packaging Certified Items

### Before Packaging
- Confirm the item has a **refurb label** (RFB-QLID) attached
- Confirm the **certification** is generated (check Certs page)
- Verify the **grade** is correct

### Packaging Standards
1. **Grade A items**: Original box if available, or new white box with foam inserts
2. **Grade B items**: Clean box with bubble wrap
3. **Grade C items**: Standard shipping box with padding
4. **Grade D/F items**: Bulk packaging for parts/salvage

### Completing the Item
1. In Workflow, click **"Mark Complete"**
2. The item moves to **Complete** status
3. It's now ready for listing on marketplaces (QuickListingz integration)

### Bulk Packaging
For large batches, use the **Kanban** view to see all items at the Complete stage and process them in order.`,
      },
    ],
  },
  {
    id: 'sop',
    title: 'Standard Operating Procedures',
    icon: <ClipboardList size={20} />,
    color: 'text-accent-green',
    articles: [
      {
        id: 'daily-opening',
        title: 'Daily Opening Procedure',
        content: `## Daily Opening Procedure

Complete these steps at the start of every shift:

1. **Power on your workstation** — monitor, scanner, printer
2. **Open QuickRefurbz** — launch the app or PWA
3. **Log in** with your station credentials
4. **Start a work session** — select your employee ID and workstation
5. **Verify printer connection**:
   - Go to Settings → Printer
   - Check the status dot is **green** (online)
   - If red, see Troubleshooting → "Printer not found"
6. **Check your queue** — open Workflow to see assigned items
7. **Verify scanner** — scan any barcode to confirm it reads correctly
8. **Review any notes** from the previous shift (check the item notes/flags)

**Estimated time:** 2–3 minutes`,
      },
      {
        id: 'item-handling',
        title: 'Item Handling Standards',
        content: `## Item Handling Standards

### General Rules
- **Always wear nitrile gloves** when handling devices — prevents fingerprints and ESD damage
- **Use ESD mats** at your workstation — especially for phones, laptops, and PCBs
- **Handle screens face-up** — never place devices screen-down on hard surfaces
- **Use two hands** for items over 10 lbs (TVs, monitors, desktops)

### ESD (Electrostatic Discharge) Prevention
- Touch your ESD mat or grounding strap before handling circuit boards
- Never work on carpet without an ESD mat
- Keep plastic bags away from open electronics

### Damage Prevention
- Do not stack devices on top of each other
- Use padded bins for work-in-progress items
- Keep liquids away from the workstation
- Report any accidental damage immediately — do NOT hide it

### Item Storage
- Items awaiting processing go in labeled bins by stage
- Never leave items on the floor
- Fragile items (screens) get foam dividers in bins`,
      },
      {
        id: 'label-placement',
        title: 'Label Placement Guide',
        content: `## Label Placement Guide

Proper label placement ensures items can be scanned quickly at every stage.

### Phones & Small Devices
- Place label on the **back cover** (not the screen)
- Position in the **upper-right corner**
- Ensure the barcode is fully visible and not wrinkled

### Laptops
- Place label on the **bottom of the laptop**
- Position near the **serial number sticker** area
- Avoid covering ventilation holes

### TVs & Monitors
- Place label on the **back panel**, upper-left area
- Use a **larger label size** (4x2) for easier scanning
- Also place a smaller label on the **original box** if keeping

### Desktops & Towers
- Place label on the **top surface** or **front bezel**
- Avoid the side panels (they may be removed)

### General Rules
- Label must be **flat** — no wrinkles or bubbles
- Barcode lines must be **parallel** to the short edge for best scanning
- If a label is damaged, print and apply a new one
- Never cover an existing label — remove the old one first`,
      },
      {
        id: 'grading-criteria',
        title: 'Grading Criteria',
        content: `## Grading Criteria

### Grade A — Like New
- **Cosmetic**: No visible scratches, dents, or discoloration. Screen is flawless.
- **Functional**: 100% of features working. Battery health > 85%.
- **Accessories**: All original accessories present (charger, cable, box preferred).
- **Warranty**: Eligible for 90-day warranty.

### Grade B — Excellent
- **Cosmetic**: Minor surface scratches (not visible at arm's length). No dents.
- **Functional**: All core features working. Minor cosmetic-only issues acceptable.
- **Accessories**: Charger included. Original box not required.
- **Warranty**: Eligible for 90-day warranty.

### Grade C — Good
- **Cosmetic**: Visible scratches or light scuffs. Small dents acceptable. No cracks.
- **Functional**: Fully functional. Minor issues (e.g., slightly dim display) acceptable.
- **Accessories**: Aftermarket charger acceptable.
- **Warranty**: Eligible for 30-day warranty.

### Grade D — Fair
- **Cosmetic**: Significant cosmetic damage. Scratches, dents, discoloration.
- **Functional**: Core features work but has known issues documented.
- **Accessories**: Not required.
- **Warranty**: Sold as-is. No warranty.

### Grade F — Poor / Salvage
- **Cosmetic**: Heavy damage, cracked screens, broken housing.
- **Functional**: May not power on. For parts only.
- **Warranty**: None. Marked for parts harvesting or recycling.`,
      },
      {
        id: 'escalation',
        title: 'Escalation Procedure',
        content: `## Escalation Procedure

### When to Escalate
- Device has **unknown defects** you can't diagnose
- Repair requires **parts not in inventory**
- Item appears to be a **counterfeit or recalled product**
- **Safety concern** (swollen battery, burn marks, chemical smell)
- Customer data that **won't wipe** after 2 attempts
- Any **physical injury risk** (broken glass, sharp edges)

### How to Escalate
1. In the item's Workflow detail, click **"Flag for Review"**
2. Select the escalation reason from the dropdown
3. Add detailed notes about what you observed
4. The item moves to **Blocked** status with a red flag
5. Your supervisor receives a notification

### Supervisor Response
- The supervisor reviews the flagged item within the shift
- They may reassign, approve a special procedure, or mark for disposal
- You'll see the resolution in the item's history

### Safety Escalations
For **swollen batteries** or **chemical smells**:
1. **Stop immediately**
2. Place the device in the **fireproof containment bin**
3. Notify your supervisor **verbally** (don't just flag in the app)
4. Do NOT attempt to remove the battery yourself`,
      },
      {
        id: 'daily-closing',
        title: 'End-of-Day Procedure',
        content: `## End-of-Day Procedure

Complete these steps at the end of every shift:

1. **Finish current item** — don't leave an item mid-repair. If you can't finish, add notes explaining where you stopped.
2. **End your work session** — click your name in the sidebar footer → "End Session"
3. **Log your counts** — the session summary shows items processed. Verify it's accurate.
4. **Secure items**:
   - Return all items to labeled bins
   - Lock any high-value items in the secure cabinet
   - Place work-in-progress items in the "WIP" bin with a note
5. **Power down** — turn off your printer and scanner. Leave the workstation monitor on standby.
6. **Clean up** — wipe down your ESD mat, dispose of used gloves, organize cables.
7. **Log out** of the app.

**Estimated time:** 5 minutes`,
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: <AlertTriangle size={20} />,
    color: 'text-accent-orange',
    articles: [
      {
        id: 'printer-offline',
        title: 'Printer Not Found / Offline',
        content: `## Printer Not Found / Offline

### Quick Fixes
1. **Check the printer is powered on** — is the status light green?
2. **Check the network cable** — ensure the Ethernet cable is plugged in firmly
3. **Restart the printer** — power off, wait 10 seconds, power on
4. **Re-scan in Settings** — go to Settings → Printer → "Scan for Printers"

### If the Printer Shows as Offline (Red Dot)
- Verify the printer's IP address hasn't changed (check the printer's LCD menu or print a config label by holding the feed button for 5 seconds)
- If the IP changed, update it in Settings → Printer
- Make sure the printer and your workstation are on the **same network/VLAN**

### Paper / Ribbon Issues
- **Flashing red light** — paper out. Load a new roll of labels.
- **Faded print** — replace the thermal ribbon (if using thermal transfer) or adjust density in printer settings.
- **Labels not aligning** — run a calibration: hold the feed button for 3 seconds until it flashes, then release.

### If Nothing Works
- Try printing from another station to isolate whether it's a printer or workstation issue
- Contact IT support with the printer model and IP address`,
      },
      {
        id: 'scanner-issues',
        title: 'Scanner Not Reading Barcodes',
        content: `## Scanner Not Reading Barcodes

### Quick Fixes
1. **Check the USB cable** — unplug and replug the scanner
2. **Check the barcode** — is it wrinkled, smudged, or damaged? Print a new label.
3. **Clean the scanner lens** — use a soft cloth to wipe the glass window
4. **Test with a known barcode** — scan a product UPC to verify the scanner works

### Barcode Won't Scan
- **Too close**: Hold the scanner 4–8 inches from the barcode
- **Angle**: Aim straight at the barcode, not at an angle
- **Lighting**: Avoid direct sunlight on the barcode — it can wash out the contrast

### Scanner Beeps but Nothing Appears
- Make sure the cursor is in an input field (click the scan input first)
- Check that the scanner is in **keyboard wedge mode** (default). If it's in serial mode, it won't type into the app.
- Try a different USB port

### Scanner Not Detected at All
- Check Device Manager (Windows) or System Information (Mac) for the USB device
- Try a different USB cable
- Restart the workstation`,
      },
      {
        id: 'app-loading',
        title: "App Won't Load / Stuck on Loading",
        content: `## App Won't Load or Stuck on Loading Screen

### Quick Fixes
1. **Hard refresh** — press \`Ctrl+Shift+R\` (Windows) or \`Cmd+Shift+R\` (Mac)
2. **Clear browser cache** — Settings → Privacy → Clear browsing data → Cached images and files
3. **Check your network** — can you access other websites? If not, it's a network issue.

### Stuck on "Loading session..." or "Authenticating..."
- Your auth token may have expired. Click **"Logout"** (if visible) and log in again.
- If the logout button isn't visible, clear your browser's localStorage:
  1. Open DevTools (\`F12\`)
  2. Go to Application → Local Storage
  3. Delete the \`token\` entry
  4. Refresh the page

### White Screen / Blank Page
- Open DevTools (\`F12\`) → Console tab — look for red error messages
- Try opening the app in an **Incognito/Private** window to rule out extensions
- If using an old browser, update to the latest Chrome or Edge

### PWA Not Updating
If you're using the installed PWA and it seems outdated:
1. Close the PWA completely
2. Reopen it — it should fetch the latest version
3. If still outdated, uninstall the PWA and reinstall from install.quickrefurbz.com`,
      },
      {
        id: 'login-issues',
        title: 'Login Issues',
        content: `## Login Issues

### "Invalid credentials" Error
- Double-check your email — station accounts use \`stationXX@quickrefurbz.local\` format
- Passwords are case-sensitive — check Caps Lock
- If you recently changed your password, make sure you're using the new one

### Account Locked
- After 5 failed login attempts, accounts are temporarily locked for 15 minutes
- Wait and try again, or contact an admin to unlock your account

### "Session expired" While Working
- Sessions last 12 hours. After that, you'll need to log in again.
- Save any in-progress work notes before the session expires
- After logging in, your work session will still be active

### Forgot Password
- Click **"Forgot Password"** on the login screen
- Admin accounts can reset via email
- Station accounts must be reset by an admin — contact your supervisor`,
      },
      {
        id: 'item-stuck',
        title: 'Item Stuck in Workflow',
        content: `## Item Stuck in Workflow

### Item Won't Advance to Next Stage
- Check if there are **required steps** not completed (diagnostics, data wipe)
- Some stages require all tests to be recorded before advancing
- Look for a **red warning banner** on the item detail — it explains what's missing

### Item Shows Wrong Stage
- The Kanban board auto-refreshes every 30 seconds. Try a manual refresh (\`F5\`).
- If the stage is genuinely wrong, an admin can manually override it in the item detail → "Override Stage"

### Item Disappeared
- Check the search bar — scan or type the QLID
- Items marked as **Salvage** or **Scrapped** are moved to a separate view
- Check the **Items** page with "All" status filter — it shows everything

### Duplicate Items
If the same physical device has two QLIDs:
1. Identify the correct QLID (the one with work history)
2. Flag the duplicate via **"Flag for Review"** → reason: "Duplicate entry"
3. An admin will merge or delete the duplicate`,
      },
    ],
  },
  {
    id: 'quick-reference',
    title: 'Quick Reference',
    icon: <Keyboard size={20} />,
    color: 'text-accent-purple',
    articles: [
      {
        id: 'keyboard-shortcuts',
        title: 'Keyboard Shortcuts',
        content: `## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`/\` | Focus search / scan input |
| \`Ctrl+K\` | Quick search (items, pallets) |
| \`Enter\` | Submit form / Confirm action |
| \`Escape\` | Close modal / Cancel |
| \`Ctrl+P\` | Print current label |
| \`Ctrl+S\` | Save settings |
| \`Tab\` | Move to next field |
| \`Shift+Tab\` | Move to previous field |

### Scanner Shortcuts
Your USB barcode scanner acts as a keyboard. When you scan a barcode:
- If a scan input is focused, the barcode value is entered automatically
- The scanner sends an **Enter** key after the barcode, triggering the search/lookup

### Navigation
Use the sidebar to navigate between pages. On mobile, swipe right to open the sidebar.`,
      },
      {
        id: 'roles',
        title: 'Station Roles & Responsibilities',
        content: `## Station Roles

### Technician (Station Accounts)
- Process items through the refurbishment workflow
- Run diagnostics, perform repairs, grade items
- Print and apply labels
- Log parts usage
- Flag items for supervisor review

### Manager
- All technician capabilities
- View monitoring dashboard
- Manage parts inventory
- Run productivity reports
- Override workflow stages
- Approve escalated items

### Admin
- All manager capabilities
- Manage user accounts and station setup
- Configure system settings
- Access all stations' data
- Seed station accounts
- View system health metrics`,
      },
      {
        id: 'label-format',
        title: 'Label Format Guide',
        content: `## Label Format Guide

### Intake Label (QLID)
\`\`\`
┌──────────────────────────────┐
│ PAL-BB-20260215-001 - Best Buy│
│ ║║║║ PAL-BB-...-QLIDA12345  │
│ Employee: EMP001   WH: WH001│
│ 2026-02-15 09:30:00          │
│ Samsung Galaxy S24           │
└──────────────────────────────┘
\`\`\`

**Fields:**
- **Line 1**: Pallet ID + Retailer name
- **Line 2**: Barcode — PalletID-QLID{series}{number}
- **Line 3**: Employee ID + Warehouse ID
- **Line 4**: Timestamp
- **Line 5**: Manufacturer + Model (if known)

### Refurbished Label (RFB-QLID)
\`\`\`
┌──────────────────────────────────┐
│ REFURBISHED                  [A] │
│ ║║║║ RFB-QLIDA0000012345        │
│ Samsung Galaxy S24 Ultra         │
│ Phone | Best Buy                 │
│ 2026-02-15 | S/N: RF8N123456    │
│ Grade A - Like New | CERT-xxx   [QR]│
└──────────────────────────────────┘
\`\`\`

**Fields:**
- **Grade badge**: Letter grade in top-right box (A/B/C/D/F)
- **Barcode**: RFB-{QLID} format
- **QR code**: Links to public verification page
- **Cert ID**: Unique certification identifier`,
      },
      {
        id: 'grade-definitions',
        title: 'Grade Definitions Table',
        content: `## Grade Definitions

| Grade | Name | Cosmetic | Functional | Max Defects | Warranty |
|-------|------|----------|------------|-------------|----------|
| **A** | Like New | Flawless — no scratches, dents, or wear | 100% features working, battery >85% | 0 | 90 days |
| **B** | Excellent | Minor scratches not visible at arm's length | All core features working | 2 | 90 days |
| **C** | Good | Visible wear, light scratches, no cracks | Fully functional, minor issues OK | 4 | 30 days |
| **D** | Fair | Significant cosmetic damage | Works but has documented issues | 6 | None |
| **F** | Poor | Heavy damage, cracks, broken parts | May not power on, parts only | Unlimited | None |
| **S** | Salvage | Destroyed / unrepairable | Non-functional | N/A | None |

### Key Notes
- Grades A–C are eligible for resale with certification
- Grade D items may be re-listed as "for parts" or returned to repair
- Grade F and Salvage items go to parts harvesting or recycling
- Battery health is measured as a percentage of original capacity
- "Max defects" refers to the number of non-cosmetic issues allowed`,
      },
    ],
  },
];

// ─── Accordion Article Component ────────────────────────────────

function ArticleAccordion({ article, isOpen, onToggle }: {
  article: Article;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 px-4 text-left hover:bg-dark-hover/50 transition-colors group"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-zinc-500 group-hover:text-zinc-300 flex-shrink-0"
        >
          <ChevronRight size={14} />
        </motion.div>
        <span className={`text-sm font-medium transition-colors ${isOpen ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
          {article.title}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-11">
              <div className="prose-rfb text-sm text-zinc-400 leading-relaxed">
                <MarkdownContent content={article.content} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Simple Markdown Renderer ────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1 my-3 ml-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-ql-yellow mt-1.5 text-[6px]">&#9679;</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 1) {
      const header = tableRows[0];
      const body = tableRows.slice(1).filter(r => !r.every(c => /^[-|:]+$/.test(c.trim())));
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-dark-tertiary">
                {header.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-zinc-300 whitespace-nowrap">
                    <span dangerouslySetInnerHTML={{ __html: inlineFormat(h.trim()) }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-border/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                      <span dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="my-3 p-3 bg-dark-primary rounded-lg border border-border/50 overflow-x-auto font-mono text-xs text-zinc-300 leading-relaxed">
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        tableRows = [cells];
      } else {
        // Skip separator rows
        if (!cells.every(c => /^[-:]+$/.test(c))) {
          tableRows.push(cells);
        }
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (line.startsWith('## ')) {
      flushList();
      continue; // Skip h2 — the article title already serves as the header
    }
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h3-${elements.length}`} className="text-white font-semibold mt-4 mb-2 text-sm">
          {line.replace('### ', '')}
        </h4>
      );
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line.trim())) {
      flushList();
      const match = line.trim().match(/^\d+\.\s(.+)/);
      if (match) {
        const num = line.trim().match(/^(\d+)\./)?.[1];
        elements.push(
          <div key={`ol-${elements.length}`} className="flex items-start gap-2 my-1 ml-1">
            <span className="text-ql-yellow font-mono text-xs mt-0.5 w-4 flex-shrink-0">{num}.</span>
            <span dangerouslySetInnerHTML={{ __html: inlineFormat(match[1]) }} />
          </div>
        );
      }
      continue;
    }

    // Bullet lists
    if (line.trim().startsWith('- ')) {
      listItems.push(line.trim().replace(/^- /, ''));
      continue;
    } else {
      flushList();
    }

    // Empty lines
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p key={`p-${elements.length}`} className="my-2" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
  }

  flushList();
  flushTable();

  return <>{elements}</>;
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-200 font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-dark-primary rounded text-ql-yellow font-mono text-xs">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-accent-blue hover:underline" target="_blank" rel="noopener">$1</a>');
}

// ─── Main Help Page ────────────────────────────────────────────

export function Help() {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['getting-started']));
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set());

  const isStandalone = location.pathname.startsWith('/help') && !document.querySelector('[data-sidebar]');

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleArticle = (articleId: string) => {
    setOpenArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  // Filter sections + articles by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return HELP_SECTIONS;

    const q = searchQuery.toLowerCase();
    return HELP_SECTIONS.map(section => ({
      ...section,
      articles: section.articles.filter(
        a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
      ),
    })).filter(s => s.articles.length > 0);
  }, [searchQuery]);

  // Auto-expand sections and articles when searching
  const effectiveSections = searchQuery.trim()
    ? new Set(filteredSections.map(s => s.id))
    : openSections;

  const effectiveArticles = searchQuery.trim()
    ? new Set(filteredSections.flatMap(s => s.articles.map(a => a.id)))
    : openArticles;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Standalone header — shown when accessed via help.quickrefurbz.com */}
      {isStandalone && (
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-ql-yellow transition-colors"
          >
            <ArrowLeft size={12} />
            Back to QuickRefurbz
          </Link>
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-ql-yellow/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-ql-yellow" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Help & Guides</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Station reference, SOPs, and troubleshooting</p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full pl-10 pr-4 py-2.5 bg-dark-secondary border border-border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:border-ql-yellow/50 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-zinc-600 mt-2 ml-1">
            {filteredSections.reduce((sum, s) => sum + s.articles.length, 0)} results for "{searchQuery}"
          </p>
        )}
      </motion.div>

      {/* Sections */}
      <div className="space-y-3">
        {filteredSections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + idx * 0.03 }}
          >
            <SpotlightCard>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-hover/30 transition-colors rounded-t-xl"
              >
                <div className={`${section.color} flex-shrink-0`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                  <span className="text-xs text-zinc-600">{section.articles.length} articles</span>
                </div>
                <motion.div
                  animate={{ rotate: effectiveSections.has(section.id) ? 180 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-zinc-500 flex-shrink-0"
                >
                  <ChevronDown size={16} />
                </motion.div>
              </button>

              {/* Section Articles */}
              <AnimatePresence initial={false}>
                {effectiveSections.has(section.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    {section.articles.map((article) => (
                      <ArticleAccordion
                        key={article.id}
                        article={article}
                        isOpen={effectiveArticles.has(article.id)}
                        onToggle={() => toggleArticle(article.id)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>

      {/* No Results */}
      {filteredSections.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No articles match "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-ql-yellow hover:underline"
          >
            Clear search
          </button>
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 mb-4 text-center"
      >
        <p className="text-xs text-zinc-600">
          Can't find what you need? Contact your supervisor or admin.
        </p>
      </motion.div>
    </div>
  );
}

export default Help;
