import { useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { motion } from 'framer-motion';
import { Spotlight } from '@/components/aceternity/spotlight';
import {
  IconDownload,
  IconDeviceDesktop,
  IconBrandChrome,
  IconBrandEdge,
  IconBrandApple,
  IconBrandWindows,
  IconCheck,
  IconArrowRight,
  IconQrcode,
  IconUser,
  IconKey,
  IconAlertCircle,
  IconRefresh,
  IconWifi,
} from '@tabler/icons-react';

type Platform = 'windows' | 'mac' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'other';
}

const STATIONS = [
  { id: 'RFB-01', email: 'station01@quickrefurbz.local', name: 'Intake', pass: 'Refurb2026!S01' },
  { id: 'RFB-02', email: 'station02@quickrefurbz.local', name: 'Testing', pass: 'Refurb2026!S02' },
  { id: 'RFB-03', email: 'station03@quickrefurbz.local', name: 'Diagnostics', pass: 'Refurb2026!S03' },
  { id: 'RFB-04', email: 'station04@quickrefurbz.local', name: 'Data Wipe', pass: 'Refurb2026!S04' },
  { id: 'RFB-05', email: 'station05@quickrefurbz.local', name: 'Repair A', pass: 'Refurb2026!S05' },
  { id: 'RFB-06', email: 'station06@quickrefurbz.local', name: 'Repair B', pass: 'Refurb2026!S06' },
  { id: 'RFB-07', email: 'station07@quickrefurbz.local', name: 'Cleaning', pass: 'Refurb2026!S07' },
  { id: 'RFB-08', email: 'station08@quickrefurbz.local', name: 'Final QC', pass: 'Refurb2026!S08' },
  { id: 'RFB-09', email: 'station09@quickrefurbz.local', name: 'Certification', pass: 'Refurb2026!S09' },
  { id: 'RFB-10', email: 'station10@quickrefurbz.local', name: 'Packaging', pass: 'Refurb2026!S10' },
];

interface StepCardProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function StepCard({ step, title, description, icon }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: step * 0.1 }}
      className="flex gap-4 p-4 rounded-xl bg-dark-secondary border border-border"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ql-yellow/10 flex items-center justify-center text-ql-yellow font-bold text-sm">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-zinc-400">{icon}</span>
          <h3 className="font-semibold text-white text-sm">{title}</h3>
        </div>
        <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function Download() {
  const [platform] = useState<Platform>(detectPlatform);
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  const browserName = platform === 'windows' ? 'Edge or Chrome' : 'Chrome';
  const browserIcon = platform === 'windows'
    ? <IconBrandEdge size={20} />
    : <IconBrandChrome size={20} />;
  const platformIcon = platform === 'windows'
    ? <IconBrandWindows size={20} />
    : <IconBrandApple size={20} />;

  return (
    <div className="min-h-screen bg-dark-primary">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <Spotlight className="absolute -top-40 left-0 right-0" spotlightColor="rgba(212, 168, 0, 0.12)" />
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-ql-yellow/10 border border-ql-yellow/20 mb-6"
          >
            <span className="text-3xl font-bold text-ql-yellow">RFB</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3"
          >
            Install <span className="text-ql-yellow">QuickRefurbz</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-lg max-w-md mx-auto mb-8"
          >
            Get started at your refurbishment station in under 2 minutes
          </motion.p>

          {canInstall && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={promptInstall}
              className="inline-flex items-center gap-2 px-6 py-3 bg-ql-yellow text-dark-primary font-semibold rounded-xl hover:bg-ql-yellow-hover transition-colors"
            >
              <IconDownload size={20} />
              Install App Now
            </motion.button>
          )}

          {isInstalled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-green/10 text-accent-green rounded-xl text-sm"
            >
              <IconCheck size={18} />
              App is installed
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20 space-y-12">
        {/* Platform Detection */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-dark-secondary border border-border text-sm">
          {platformIcon}
          <span className="text-zinc-400">
            Detected: <span className="text-white font-medium">
              {platform === 'windows' ? 'Windows' : platform === 'mac' ? 'macOS' : 'Your device'}
            </span>
            {' '}&mdash; use <span className="text-ql-yellow">{browserName}</span> for best results
          </span>
        </div>

        {/* Install Steps */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <IconDeviceDesktop size={22} className="text-ql-yellow" />
            Installation Steps
          </h2>
          <div className="space-y-3">
            <StepCard
              step={1}
              title={`Open ${browserName}`}
              description={`Open this page in ${browserName} on your station computer. Type the URL in the address bar or scan the QR code below.`}
              icon={browserIcon}
            />
            <StepCard
              step={2}
              title="Look for the install icon"
              description={platform === 'windows'
                ? 'In the address bar, look for the install icon (monitor with down arrow) on the right side. Click it.'
                : 'In Chrome\'s address bar, look for the install icon. Or click the three dots menu and select "Install QuickRefurbz".'
              }
              icon={<IconDownload size={18} />}
            />
            <StepCard
              step={3}
              title='Click "Install"'
              description="A popup will appear asking if you want to install QuickRefurbz. Click Install to add it to your desktop."
              icon={<IconCheck size={18} />}
            />
            <StepCard
              step={4}
              title="Find it on your desktop"
              description={platform === 'windows'
                ? 'QuickRefurbz will appear on your desktop and in the Start menu. Double-click to open.'
                : 'QuickRefurbz will appear in your dock and Launchpad. Click to open.'
              }
              icon={<IconDeviceDesktop size={18} />}
            />
            <StepCard
              step={5}
              title="Log in with your station credentials"
              description="Use the email and password for your station from the table below. The setup wizard will guide you through the rest."
              icon={<IconArrowRight size={18} />}
            />
          </div>
        </div>

        {/* Station Credentials */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <IconUser size={22} className="text-ql-yellow" />
            Station Login Credentials
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-dark-secondary border-b border-border flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Internal Use Only
              </span>
              <button
                onClick={() => setShowAllPasswords(!showAllPasswords)}
                className="text-xs text-ql-yellow hover:text-ql-yellow-hover transition-colors flex items-center gap-1"
              >
                <IconKey size={14} />
                {showAllPasswords ? 'Hide' : 'Show'} passwords
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-zinc-500">
                    <th className="px-4 py-2.5 text-left font-medium">Station</th>
                    <th className="px-4 py-2.5 text-left font-medium">Role</th>
                    <th className="px-4 py-2.5 text-left font-medium">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {STATIONS.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-dark-secondary/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-ql-yellow text-xs">{s.id}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">{s.name}</td>
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-zinc-300 bg-dark-tertiary px-2 py-0.5 rounded">{s.email}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        {showAllPasswords ? (
                          <code className="text-xs text-accent-green bg-dark-tertiary px-2 py-0.5 rounded">{s.pass}</code>
                        ) : (
                          <span className="text-zinc-600 text-xs">{'*'.repeat(14)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            <IconQrcode size={22} className="text-ql-yellow" />
            Quick Access
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Scan this QR code on any station device to open this page
          </p>
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl">
            {/* Simple QR code placeholder - the actual URL */}
            <div className="w-32 h-32 flex items-center justify-center text-dark-primary text-xs text-center font-mono">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(window.location.origin + '/download')}`}
                alt="QR Code"
                className="w-32 h-32"
                crossOrigin="anonymous"
              />
            </div>
          </div>
          <p className="text-zinc-600 text-xs mt-2 font-mono">{window.location.origin}/download</p>
        </div>

        {/* Troubleshooting */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <IconAlertCircle size={22} className="text-ql-yellow" />
            Troubleshooting
          </h2>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-dark-secondary border border-border">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <IconBrandChrome size={16} className="text-zinc-400" />
                No install button showing?
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Make sure you&apos;re using Chrome or Edge (not Safari or Firefox). Refresh the page with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-dark-secondary border border-border">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <IconWifi size={16} className="text-zinc-400" />
                Page won&apos;t load?
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Check that the station is connected to the warehouse WiFi network. The app requires an internet connection for the first install.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-dark-secondary border border-border">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <IconRefresh size={16} className="text-zinc-400" />
                Login not working?
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Double-check the email and password from the table above. Passwords are case-sensitive. If still stuck, ask your supervisor to check the station accounts.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-zinc-600 text-xs pt-8 border-t border-border">
          QuickRefurbz &mdash; Upscaled Warehouse Station App
        </div>
      </div>
    </div>
  );
}
