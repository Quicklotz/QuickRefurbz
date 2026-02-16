import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/api/client';
import {
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconRocket,
  IconSettings,
  IconPrinter,
  IconScan,
  IconMap,
  IconSparkles,
} from '@tabler/icons-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: <IconSparkles size={24} /> },
  { id: 'config', title: 'Station Config', icon: <IconSettings size={24} /> },
  { id: 'printer', title: 'Printer Setup', icon: <IconPrinter size={24} /> },
  { id: 'scanner', title: 'Scanner Test', icon: <IconScan size={24} /> },
  { id: 'tour', title: 'Quick Tour', icon: <IconMap size={24} /> },
  { id: 'ready', title: 'Ready!', icon: <IconRocket size={24} /> },
];

function PrinterSetupStep({ stationNum, config, setConfig }: {
  stationNum: string;
  config: {
    stationName: string;
    warehouseId: string;
    workstationId: string;
    printerIp: string;
    printerTested: boolean;
    scannerTested: boolean;
  };
  setConfig: (fn: (c: typeof config) => typeof config) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<Array<{ip: string; model: string; status: string}>>([]);
  const [scanDone, setScanDone] = useState(false);
  const [labelPreset, setLabelPreset] = useState('2x1');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const PRESETS: Record<string, {w: number; h: number; name: string}> = {
    '2x1': { w: 50.8, h: 25.4, name: '2" \u00d7 1"' },
    '2x1.5': { w: 50.8, h: 38.1, name: '2" \u00d7 1.5"' },
    '4x2': { w: 101.6, h: 50.8, name: '4" \u00d7 2"' },
    '4x6': { w: 101.6, h: 152.4, name: '4" \u00d7 6"' },
  };

  // Auto-scan on mount
  useEffect(() => {
    handleScan();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanDone(false);
    try {
      const result = await api.discoverPrinters();
      setDiscovered(result.printers || []);
      // Auto-select first printer
      if (result.printers?.length > 0) {
        setConfig(c => ({ ...c, printerIp: result.printers[0].ip }));
      }
    } catch {
      setDiscovered([]);
    } finally {
      setScanning(false);
      setScanDone(true);
    }
  };

  const handleTestPrint = async () => {
    if (!config.printerIp) return;
    setTesting(true);
    setTestResult(null);
    try {
      const preset = PRESETS[labelPreset];
      await api.testPrint(config.printerIp, preset.w, preset.h);
      setConfig(c => ({ ...c, printerTested: true }));
      setTestResult('success');
      // Save as default
      await api.savePrinterSettings({
        printer_ip: config.printerIp,
        printer_name: `Station ${stationNum}`,
        label_width_mm: preset.w,
        label_height_mm: preset.h,
        station_id: `RFB-${stationNum}`,
        is_default: true,
      });
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Printer Setup</h2>
      <p className="text-zinc-500 text-sm">Connect your Zebra label printer</p>

      {/* Scan status */}
      {scanning ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <IconPrinter size={16} className="animate-pulse text-ql-yellow" />
          Scanning network for printers...
        </div>
      ) : discovered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">{discovered.length} printer{discovered.length > 1 ? 's' : ''} found</p>
          {discovered.map((p) => (
            <button
              key={p.ip}
              type="button"
              onClick={() => setConfig(c => ({ ...c, printerIp: p.ip }))}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                config.printerIp === p.ip
                  ? 'border-ql-yellow bg-ql-yellow/10'
                  : 'border-zinc-800 bg-dark-primary hover:border-zinc-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{p.model || 'Zebra Printer'}</div>
                <div className="text-xs text-zinc-500 font-mono">{p.ip}</div>
              </div>
              {config.printerIp === p.ip && (
                <IconCheck size={16} className="text-ql-yellow" />
              )}
            </button>
          ))}
        </div>
      ) : scanDone ? (
        <div className="text-sm text-zinc-500">
          No printers found on network.
          <button onClick={handleScan} className="text-ql-yellow ml-1 hover:underline">Retry</button>
        </div>
      ) : null}

      {/* Manual IP fallback */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Or enter IP manually</label>
        <input
          value={discovered.some(p => p.ip === config.printerIp) ? '' : config.printerIp}
          onChange={e => setConfig(c => ({ ...c, printerIp: e.target.value }))}
          placeholder="192.168.1.100"
          className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-zinc-800 text-white text-sm focus:border-ql-yellow focus:outline-none placeholder:text-zinc-600 font-mono"
        />
      </div>

      {/* Label size */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Label Size</label>
        <select
          value={labelPreset}
          onChange={(e) => setLabelPreset(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-zinc-800 text-white text-sm focus:border-ql-yellow focus:outline-none"
        >
          {Object.entries(PRESETS).map(([key, p]) => (
            <option key={key} value={key}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Test & result */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestPrint}
          disabled={!config.printerIp || testing}
          className="px-4 py-2 rounded-lg bg-dark-primary border border-zinc-800 text-sm text-zinc-300 hover:border-ql-yellow transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <IconPrinter size={16} />
          {testing ? 'Printing...' : 'Test Print'}
        </button>
        {testResult === 'success' && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-500 text-sm flex items-center gap-1">
            <IconCheck size={16} /> Test label sent & saved
          </motion.span>
        )}
        {testResult === 'error' && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm">
            Print failed — check IP
          </motion.span>
        )}
      </div>

      <p className="text-zinc-600 text-xs">
        You can skip this and configure the printer later in Settings.
      </p>
    </div>
  );
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    stationName: user?.name || '',
    warehouseId: 'WH-001',
    workstationId: '',
    printerIp: '',
    printerTested: false,
    scannerTested: false,
  });

  const stationNum = user?.email?.match(/station(\d+)/)?.[1] || '??';

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1);
  }, [step]);

  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const finish = useCallback(async () => {
    try {
      await api.stationSetupComplete({
        station_id: `RFB-${stationNum}`,
        workstation_id: config.workstationId || `WS-${stationNum}`,
        warehouse_id: config.warehouseId,
      });
    } catch {
      // Non-blocking — station can still work
    }
    localStorage.setItem('rfb_setup_complete', 'true');
    onComplete();
  }, [stationNum, config, onComplete]);

  const handleScannerTest = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.length > 3) {
      setConfig(c => ({ ...c, scannerTested: true }));
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-dark-primary flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-dark-secondary border border-border rounded-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-dark-tertiary">
          <motion.div
            className="h-full bg-ql-yellow"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2 px-6">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-ql-yellow' : i < step ? 'bg-ql-yellow/40' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[320px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-ql-yellow/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-ql-yellow">RFB</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    Welcome to Station {stationNum}
                  </h2>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                    Let's get your refurbishment station set up. This will only take a minute.
                  </p>
                </div>
              )}

              {/* Step 1: Station Config */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">Station Configuration</h2>
                  <p className="text-zinc-500 text-sm">Confirm your station details</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Station Name</label>
                      <input
                        value={config.stationName}
                        onChange={e => setConfig({ ...config, stationName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-border text-white text-sm focus:border-ql-yellow focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Warehouse ID</label>
                      <input
                        value={config.warehouseId}
                        onChange={e => setConfig({ ...config, warehouseId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-border text-white text-sm focus:border-ql-yellow focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Workstation ID</label>
                      <input
                        value={config.workstationId}
                        onChange={e => setConfig({ ...config, workstationId: e.target.value })}
                        placeholder={`WS-${stationNum}`}
                        className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-border text-white text-sm focus:border-ql-yellow focus:outline-none placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Printer Setup */}
              {step === 2 && (
                <PrinterSetupStep
                  stationNum={stationNum}
                  config={config}
                  setConfig={setConfig}
                />
              )}

              {/* Step 3: Scanner Test */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">Scanner Test</h2>
                  <p className="text-zinc-500 text-sm">Scan any barcode to verify your scanner</p>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Scan barcode here (click, then scan)</label>
                    <input
                      autoFocus
                      onKeyDown={handleScannerTest}
                      placeholder="Scan a barcode..."
                      className="w-full px-3 py-2 rounded-lg bg-dark-primary border border-border text-white text-sm focus:border-ql-yellow focus:outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  {config.scannerTested ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-accent-green text-sm flex items-center gap-1"
                    >
                      <IconCheck size={16} /> Scanner working
                    </motion.p>
                  ) : (
                    <p className="text-zinc-600 text-xs">
                      Click the input field above, then scan any barcode. You can skip this step.
                    </p>
                  )}
                </div>
              )}

              {/* Step 4: Quick Tour */}
              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">Quick Tour</h2>
                  <p className="text-zinc-500 text-sm">Here's what you'll find in the app</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Dashboard', desc: 'Overview of your station activity and metrics' },
                      { label: 'Workflow', desc: 'Step-by-step refurbishment process for each item' },
                      { label: 'Intake', desc: 'Receive and log new items from pallets' },
                      { label: 'Scan', desc: 'Quick barcode lookup for any item' },
                      { label: 'Diagnostics', desc: 'Run diagnostic tests on devices' },
                      { label: 'Data Wipe', desc: 'Securely erase device data (NIST compliant)' },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-3 p-2 rounded-lg">
                        <IconCheck size={14} className="text-ql-yellow mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-white font-medium">{item.label}</span>
                          <span className="text-zinc-500"> &mdash; {item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Ready */}
              {step === 5 && (
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="w-16 h-16 mx-auto rounded-full bg-accent-green/10 flex items-center justify-center"
                  >
                    <IconRocket size={32} className="text-accent-green" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-white">You're all set!</h2>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                    Station {stationNum} is configured and ready. Start refurbishing!
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={prev}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <IconArrowLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="flex items-center gap-1 px-4 py-2 bg-ql-yellow text-dark-primary font-semibold text-sm rounded-lg hover:bg-ql-yellow-hover transition-colors"
            >
              Next <IconArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-1 px-4 py-2 bg-accent-green text-white font-semibold text-sm rounded-lg hover:bg-accent-green/90 transition-colors"
            >
              <IconRocket size={16} /> Start Working
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
