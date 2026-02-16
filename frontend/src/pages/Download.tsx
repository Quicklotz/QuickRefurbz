import { useState } from 'react';
import { motion } from 'framer-motion';
import { Spotlight } from '@/components/aceternity/spotlight';
import {
  IconDeviceDesktop,
  IconBrandApple,
  IconCheck,
  IconArrowRight,
  IconQrcode,
  IconUser,
  IconKey,
  IconAlertCircle,
  IconWifi,
  IconBrowser,
  IconBookmark,
  IconExternalLink,
} from '@tabler/icons-react';

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
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  const appUrl = `${window.location.origin}`;

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
            Set Up <span className="text-ql-yellow">QuickRefurbz</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-lg max-w-md mx-auto mb-8"
          >
            Get your Mac station ready in under 2 minutes
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-secondary border border-border rounded-xl text-sm text-zinc-400"
          >
            <IconBrandApple size={18} />
            macOS Setup Guide
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20 space-y-12">
        {/* Setup Steps */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <IconDeviceDesktop size={22} className="text-ql-yellow" />
            Setup Steps
          </h2>
          <div className="space-y-3">
            <StepCard
              step={1}
              title="Open Safari or Chrome"
              description={`Open your browser and go to: ${appUrl}`}
              icon={<IconBrowser size={18} />}
            />
            <StepCard
              step={2}
              title="Bookmark the page"
              description="Press ⌘+D (Cmd+D) to bookmark QuickRefurbz for quick access. You can also drag the tab to your Dock."
              icon={<IconBookmark size={18} />}
            />
            <StepCard
              step={3}
              title="Log in with your station credentials"
              description="Use the email and password for your station from the table below."
              icon={<IconUser size={18} />}
            />
            <StepCard
              step={4}
              title="Complete the setup wizard"
              description="The first time you log in, a setup wizard will walk you through configuring your printer, scanner, and station details."
              icon={<IconArrowRight size={18} />}
            />
            <StepCard
              step={5}
              title="Start refurbishing"
              description="You're all set. Navigate to Intake, Workflow, or Diagnostics from the sidebar to begin processing items."
              icon={<IconCheck size={18} />}
            />
          </div>
        </div>

        {/* Optional: Add to Dock */}
        <div className="p-5 rounded-xl bg-dark-secondary border border-border">
          <h3 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
            <IconExternalLink size={16} className="text-ql-yellow" />
            Tip: Add to Dock for quick access
          </h3>
          <p className="text-zinc-500 text-xs leading-relaxed">
            In Safari, go to <strong className="text-zinc-300">File &rarr; Add to Dock</strong> to create a shortcut.
            In Chrome, click the three-dot menu &rarr; <strong className="text-zinc-300">More Tools &rarr; Create Shortcut</strong>.
            This gives you a desktop icon without installing a separate app.
          </p>
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
            Scan this QR code on any station to open QuickRefurbz
          </p>
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(appUrl)}`}
              alt="QR Code"
              className="w-32 h-32"
              crossOrigin="anonymous"
            />
          </div>
          <p className="text-zinc-600 text-xs mt-2 font-mono">{appUrl}</p>
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
                <IconWifi size={16} className="text-zinc-400" />
                Page won&apos;t load?
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Check that the station is connected to the warehouse network. Try refreshing with ⌘+Shift+R.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-dark-secondary border border-border">
              <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                <IconKey size={16} className="text-zinc-400" />
                Can&apos;t log in?
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Double-check the email and password from the table above. Passwords are case-sensitive. If stuck, contact your supervisor.
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
