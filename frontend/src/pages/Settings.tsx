"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Warehouse,
  Workflow,
  Camera,
  Bell,
  Clock,
  Save,
  CheckCircle,
  AlertCircle,
  Printer,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  Ruler,
} from 'lucide-react';
import { api } from '@/api/client';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface AppSettings {
  warehouseName: string;
  warehouseId: string;
  defaultPriority: string;
  autoAssignTechnician: boolean;
  maxRetestAttempts: number;
  requirePhotoOnDiagnosis: boolean;
  requirePhotoOnRepair: boolean;
  enableNotifications: boolean;
  notificationEmail: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  warehouseName: 'Main Warehouse',
  warehouseId: 'WH001',
  defaultPriority: 'NORMAL',
  autoAssignTechnician: false,
  maxRetestAttempts: 2,
  requirePhotoOnDiagnosis: false,
  requirePhotoOnRepair: false,
  enableNotifications: false,
  notificationEmail: '',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}

function ToggleSwitch({ checked, onChange, label, hint }: ToggleSwitchProps) {
  return (
    <div className="space-y-1">
      <label
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onChange(!checked)}
      >
        <div
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            checked ? 'bg-accent-green' : 'bg-dark-tertiary'
          }`}
        >
          <motion.div
            className="absolute w-5 h-5 bg-white rounded-full top-0.5 shadow-md"
            animate={{ left: checked ? '22px' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </div>
        <span className="text-sm font-medium text-white group-hover:text-ql-yellow transition-colors">
          {label}
        </span>
      </label>
      {hint && <p className="text-xs text-zinc-500 ml-14">{hint}</p>}
    </div>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Printer state
  const [scanning, setScanning] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<Array<{ip: string; model: string; status: string}>>([]);
  const [savedPrinters, setSavedPrinters] = useState<Array<{id: string; printer_ip: string; printer_name: string | null; printer_model: string | null; label_width_mm: number; label_height_mm: number; is_default: boolean}>>([]);
  const [selectedPrinterIp, setSelectedPrinterIp] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [labelPreset, setLabelPreset] = useState('2x1');
  const [customWidth, setCustomWidth] = useState(50.8);
  const [customHeight, setCustomHeight] = useState(25.4);
  const [testingPrint, setTestingPrint] = useState(false);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);

  const LABEL_PRESETS: Record<string, { width: number; height: number; label: string }> = {
    '2x1': { width: 50.8, height: 25.4, label: '2" x 1"' },
    '2x1.5': { width: 50.8, height: 38.1, label: '2" x 1.5"' },
    '4x2': { width: 101.6, height: 50.8, label: '4" x 2"' },
    '4x6': { width: 101.6, height: 152.4, label: '4" x 6"' },
    'custom': { width: 0, height: 0, label: 'Custom' },
  };

  const getActiveLabelSize = () => {
    if (labelPreset === 'custom') {
      return { width: customWidth, height: customHeight };
    }
    const preset = LABEL_PRESETS[labelPreset];
    return { width: preset.width, height: preset.height };
  };

  const getActiveIp = () => selectedPrinterIp || manualIp;

  useEffect(() => {
    loadSettings();
    loadSavedPrinters();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPrinters = async () => {
    try {
      const data = await api.getPrinterSettings();
      setSavedPrinters(data.printers || []);
    } catch (err) {
      console.error('Failed to load saved printers:', err);
    }
  };

  const handleScanPrinters = async () => {
    setScanning(true);
    setPrinterMessage(null);
    try {
      const data = await api.discoverPrinters();
      setDiscoveredPrinters(
        (data.printers || []).map((p: any) => ({
          ip: p.ip,
          model: p.model || 'Unknown Model',
          status: p.status || 'unknown',
        }))
      );
      if (!data.printers?.length) {
        setPrinterMessage({ type: 'error', text: 'No printers found on the network' });
      }
    } catch (err) {
      console.error('Printer scan failed:', err);
      setPrinterMessage({ type: 'error', text: 'Failed to scan for printers' });
    } finally {
      setScanning(false);
    }
  };

  const handleAutoDetectLabel = async () => {
    const ip = getActiveIp();
    if (!ip) {
      setPrinterMessage({ type: 'error', text: 'Select or enter a printer IP first' });
      return;
    }
    setPrinterMessage(null);
    try {
      const data = await api.getPrinterLabelSize(ip);
      if (data.widthMm && data.heightMm) {
        setLabelPreset('custom');
        setCustomWidth(data.widthMm);
        setCustomHeight(data.heightMm);
        setPrinterMessage({ type: 'success', text: `Detected label size: ${data.widthMm}mm x ${data.heightMm}mm` });
      }
    } catch (err) {
      console.error('Label auto-detect failed:', err);
      setPrinterMessage({ type: 'error', text: 'Failed to detect label size' });
    }
  };

  const handleTestPrint = async () => {
    const ip = getActiveIp();
    if (!ip) {
      setPrinterMessage({ type: 'error', text: 'Select or enter a printer IP first' });
      return;
    }
    setTestingPrint(true);
    setPrinterMessage(null);
    try {
      const { width, height } = getActiveLabelSize();
      const data = await api.testPrint(ip, width, height);
      setPrinterMessage({ type: 'success', text: data.message || 'Test print sent successfully' });
    } catch (err) {
      console.error('Test print failed:', err);
      setPrinterMessage({ type: 'error', text: 'Test print failed' });
    } finally {
      setTestingPrint(false);
    }
  };

  const handleSavePrinter = async () => {
    const ip = getActiveIp();
    if (!ip) {
      setPrinterMessage({ type: 'error', text: 'Select or enter a printer IP first' });
      return;
    }
    setSavingPrinter(true);
    setPrinterMessage(null);
    try {
      const { width, height } = getActiveLabelSize();
      const discovered = discoveredPrinters.find(p => p.ip === ip);
      await api.savePrinterSettings({
        printer_ip: ip,
        printer_name: discovered?.model || manualIp || ip,
        printer_model: discovered?.model || undefined,
        label_width_mm: width,
        label_height_mm: height,
        is_default: savedPrinters.length === 0,
      });
      setPrinterMessage({ type: 'success', text: 'Printer saved as default' });
      await loadSavedPrinters();
    } catch (err) {
      console.error('Failed to save printer:', err);
      setPrinterMessage({ type: 'error', text: 'Failed to save printer settings' });
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    setPrinterMessage(null);
    try {
      await api.deletePrinterSettings(id);
      setPrinterMessage({ type: 'success', text: 'Printer removed' });
      await loadSavedPrinters();
    } catch (err) {
      console.error('Failed to delete printer:', err);
      setPrinterMessage({ type: 'error', text: 'Failed to remove printer' });
    }
  };

  const handleChange = (key: keyof AppSettings, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.updateSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-ql-yellow" />
            Settings
          </h1>
          <TextGenerateEffect
            words="Configure system preferences and workflow options"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          <Save size={18} />
          Save Changes
        </Button>
      </motion.div>

      {/* Success/Error Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-accent-green/10 border border-accent-green text-accent-green'
                : 'bg-accent-red/10 border border-accent-red text-accent-red'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warehouse Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Warehouse className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Warehouse</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="warehouseName">Warehouse Name</Label>
              <Input
                id="warehouseName"
                type="text"
                value={settings.warehouseName}
                onChange={(e) => handleChange('warehouseName', e.target.value)}
                placeholder="Enter warehouse name"
              />
              <p className="text-xs text-zinc-500 mt-1">Display name for this refurbishment location</p>
            </div>
            <div>
              <Label htmlFor="warehouseId">Warehouse ID</Label>
              <Input
                id="warehouseId"
                type="text"
                value={settings.warehouseId}
                onChange={(e) => handleChange('warehouseId', e.target.value)}
                placeholder="e.g., WH001"
              />
              <p className="text-xs text-zinc-500 mt-1">Unique identifier used in barcodes and tracking</p>
            </div>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Workflow Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Workflow className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Workflow</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="defaultPriority">Default Priority</Label>
              <select
                id="defaultPriority"
                value={settings.defaultPriority}
                onChange={(e) => handleChange('defaultPriority', e.target.value)}
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none transition-colors"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Default priority for new jobs</p>
            </div>
            <div>
              <Label htmlFor="maxRetestAttempts">Max Retest Attempts</Label>
              <Input
                id="maxRetestAttempts"
                type="number"
                value={settings.maxRetestAttempts}
                onChange={(e) => handleChange('maxRetestAttempts', parseInt(e.target.value) || 2)}
                min={1}
                max={5}
              />
              <p className="text-xs text-zinc-500 mt-1">Maximum times a device can fail final test before disposition</p>
            </div>
            <div className="md:col-span-2">
              <ToggleSwitch
                checked={settings.autoAssignTechnician}
                onChange={(checked) => handleChange('autoAssignTechnician', checked)}
                label="Auto-assign technician"
                hint="Automatically assign jobs to available technicians"
              />
            </div>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Photo Requirements */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Camera className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Photo Requirements</h2>
          </div>
          <div className="space-y-6">
            <ToggleSwitch
              checked={settings.requirePhotoOnDiagnosis}
              onChange={(checked) => handleChange('requirePhotoOnDiagnosis', checked)}
              label="Require photo on diagnosis"
              hint="Technicians must take photos when diagnosing defects"
            />
            <ToggleSwitch
              checked={settings.requirePhotoOnRepair}
              onChange={(checked) => handleChange('requirePhotoOnRepair', checked)}
              label="Require photo after repair"
              hint="Technicians must take photos after completing repairs"
            />
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Bell className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-6">
            <ToggleSwitch
              checked={settings.enableNotifications}
              onChange={(checked) => handleChange('enableNotifications', checked)}
              label="Enable email notifications"
              hint="Send email alerts for blocked/escalated jobs"
            />
            <AnimatePresence>
              {settings.enableNotifications && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="ml-14"
                >
                  <Label htmlFor="notificationEmail">Notification Email</Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={settings.notificationEmail}
                    onChange={(e) => handleChange('notificationEmail', e.target.value)}
                    placeholder="manager@example.com"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Email address for notifications</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Working Hours */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Clock className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Working Hours</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="workingHoursStart">Start Time</Label>
              <Input
                id="workingHoursStart"
                type="time"
                value={settings.workingHoursStart}
                onChange={(e) => handleChange('workingHoursStart', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="workingHoursEnd">End Time</Label>
              <Input
                id="workingHoursEnd"
                type="time"
                value={settings.workingHoursEnd}
                onChange={(e) => handleChange('workingHoursEnd', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4">Used for scheduling and reporting purposes</p>
        </SpotlightCard>
      </motion.div>

      {/* Printer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Printer className="w-5 h-5 text-ql-yellow" />
            <h2 className="text-lg font-semibold text-white">Printer</h2>
          </div>

          {/* Printer Message */}
          <AnimatePresence>
            {printerMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-4 p-3 rounded-lg flex items-center gap-3 text-sm ${
                  printerMessage.type === 'success'
                    ? 'bg-accent-green/10 border border-accent-green text-accent-green'
                    : 'bg-accent-red/10 border border-accent-red text-accent-red'
                }`}
              >
                {printerMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{printerMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scan for Printers */}
          <div className="space-y-4">
            <div>
              <Label>Discover Printers</Label>
              <p className="text-xs text-zinc-500 mb-3">Scan the local network for compatible label printers</p>
              <Button
                variant="secondary"
                onClick={handleScanPrinters}
                loading={scanning}
                className="gap-2"
              >
                <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scanning...' : 'Scan for Printers'}
              </Button>
            </div>

            {/* Discovered Printers */}
            <AnimatePresence>
              {discoveredPrinters.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label>Found Printers</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {discoveredPrinters.map((printer) => (
                      <motion.button
                        key={printer.ip}
                        type="button"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => {
                          setSelectedPrinterIp(printer.ip);
                          setManualIp('');
                        }}
                        className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                          selectedPrinterIp === printer.ip
                            ? 'border-ql-yellow bg-ql-yellow/10'
                            : 'border-border bg-dark-tertiary hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{printer.model}</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              printer.status === 'online' || printer.status === 'ready'
                                ? 'bg-accent-green/10 text-accent-green'
                                : 'bg-zinc-700 text-zinc-400'
                            }`}
                          >
                            {printer.status === 'online' || printer.status === 'ready' ? (
                              <Wifi size={10} />
                            ) : (
                              <WifiOff size={10} />
                            )}
                            {printer.status}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500">{printer.ip}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Manual IP Entry */}
            <div>
              <Label htmlFor="manualPrinterIp">Manual IP Address</Label>
              <Input
                id="manualPrinterIp"
                type="text"
                value={manualIp}
                onChange={(e) => {
                  setManualIp(e.target.value);
                  if (e.target.value) setSelectedPrinterIp('');
                }}
                placeholder="e.g., 192.168.1.100"
              />
              <p className="text-xs text-zinc-500 mt-1">Enter an IP address if the printer was not discovered automatically</p>
            </div>

            {/* Label Size */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-4 h-4 text-ql-yellow" />
                <Label>Label Size</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <select
                    value={labelPreset}
                    onChange={(e) => {
                      setLabelPreset(e.target.value);
                      const preset = LABEL_PRESETS[e.target.value];
                      if (preset && e.target.value !== 'custom') {
                        setCustomWidth(preset.width);
                        setCustomHeight(preset.height);
                      }
                    }}
                    className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none transition-colors"
                  >
                    {Object.entries(LABEL_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Button
                    variant="secondary"
                    onClick={handleAutoDetectLabel}
                    className="gap-2"
                  >
                    <Ruler size={16} />
                    Auto-detect Label Size
                  </Button>
                </div>
              </div>

              {/* Custom mm inputs */}
              <AnimatePresence>
                {labelPreset === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-4 mt-3"
                  >
                    <div>
                      <Label htmlFor="customLabelWidth">Width (mm)</Label>
                      <Input
                        id="customLabelWidth"
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseFloat(e.target.value) || 0)}
                        min={10}
                        max={200}
                        step={0.1}
                      />
                    </div>
                    <div>
                      <Label htmlFor="customLabelHeight">Height (mm)</Label>
                      <Input
                        id="customLabelHeight"
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseFloat(e.target.value) || 0)}
                        min={10}
                        max={300}
                        step={0.1}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
              <Button
                variant="secondary"
                onClick={handleTestPrint}
                loading={testingPrint}
                className="gap-2"
              >
                <Printer size={16} />
                {testingPrint ? 'Printing...' : 'Test Print'}
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePrinter}
                loading={savingPrinter}
                className="gap-2"
              >
                <Save size={16} />
                {savingPrinter ? 'Saving...' : 'Save as Default'}
              </Button>
            </div>

            {/* Saved Printers List */}
            {savedPrinters.length > 0 && (
              <div className="border-t border-border pt-4">
                <Label>Saved Printers</Label>
                <div className="space-y-2 mt-2">
                  {savedPrinters.map((printer) => (
                    <motion.div
                      key={printer.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-tertiary border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <Printer className="w-4 h-4 text-zinc-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {printer.printer_name || printer.printer_model || printer.printer_ip}
                            </span>
                            {printer.is_default && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-ql-yellow/10 text-ql-yellow">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500">
                            {printer.printer_ip} &middot; {printer.label_width_mm}mm x {printer.label_height_mm}mm
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePrinter(printer.id)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                        title="Remove printer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Bottom Save Button (Mobile) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="md:hidden pb-6"
      >
        <Button variant="primary" onClick={handleSave} loading={saving} className="w-full">
          <Save size={18} />
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}
