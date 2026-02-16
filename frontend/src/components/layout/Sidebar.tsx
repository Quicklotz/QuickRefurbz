"use client";
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/App';
import { useLocation } from 'react-router-dom';
import { Walkthrough, WALKTHROUGHS, useWalkthrough } from '@/components/Walkthrough';
import {
  SidebarProvider,
  Sidebar as AceternitySidebar,
  SidebarBody,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarLink,
  SidebarButton,
  SidebarLogo,
  SidebarSection,
  SidebarDivider,
  SidebarUserSection,
  useSidebar,
} from '@/components/aceternity/sidebar';
import { Spotlight } from '@/components/aceternity/spotlight';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconLayoutDashboard,
  IconColumns3,
  IconPackage,
  IconPackageImport,
  IconScan,
  IconLogout,
  IconBinaryTree,
  IconListCheck,
  IconSettings,
  IconShieldCheck,
  IconTool,
  IconClock,
  IconUsers,
  IconStethoscope,
  IconCertificate,
  IconClipboardList,
  IconDatabase,
  IconChartBar,
  IconDeviceDesktop,
  IconHelp,
} from '@tabler/icons-react';

// Organized navigation structure
const navSections = [
  {
    title: 'Operations',
    items: [
      { to: '/', icon: <IconLayoutDashboard size={20} />, label: 'Dashboard', end: true },
      { to: '/workflow', icon: <IconBinaryTree size={20} />, label: 'Workflow' },
      { to: '/queue', icon: <IconListCheck size={20} />, label: 'Queue' },
      { to: '/kanban', icon: <IconColumns3 size={20} />, label: 'Kanban' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/items', icon: <IconPackage size={20} />, label: 'Items' },
      { to: '/intake', icon: <IconPackageImport size={20} />, label: 'Intake' },
      { to: '/scan', icon: <IconScan size={20} />, label: 'Scan' },
      { to: '/parts', icon: <IconTool size={20} />, label: 'Parts' },
    ],
  },
  {
    title: 'Quality',
    items: [
      { to: '/diagnostics', icon: <IconStethoscope size={20} />, label: 'Diagnostics' },
      { to: '/datawipe', icon: <IconShieldCheck size={20} />, label: 'Data Wipe' },
      { to: '/certifications', icon: <IconCertificate size={20} />, label: 'Certs' },
      { to: '/test-plans', icon: <IconClipboardList size={20} />, label: 'Test Plans' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/device-database', icon: <IconDatabase size={20} />, label: 'Devices' },
      { to: '/monitor', icon: <IconChartBar size={20} />, label: 'Monitor' },
    ],
  },
];

// Map routes to walkthrough IDs
const ROUTE_WALKTHROUGH: Record<string, string> = {
  '/intake': 'intake',
  '/scan': 'scan',
  '/workflow': 'workflow',
  '/diagnostics': 'diagnostics',
  '/datawipe': 'datawipe',
};

function SessionInfo() {
  const { session } = useSession();
  const { open } = useSidebar();

  if (!session) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 py-2 border-b border-border overflow-hidden"
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-dark-tertiary rounded-lg px-3 py-1.5">
            <IconClock size={12} className="text-ql-yellow" />
            <span className="truncate">{session.employee_id} | {session.workstation_id}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SidebarNav() {
  const { user, logout } = useAuth();
  const { endSession } = useSession();
  const location = useLocation();
  const [activeWalkthrough, setActiveWalkthrough] = useState<string | null>(null);

  // Check if current page has a walkthrough
  const pageWalkthroughId = ROUTE_WALKTHROUGH[location.pathname];
  const walkthroughHook = useWalkthrough(pageWalkthroughId || '');

  const handleLogout = async () => {
    await endSession();
    logout();
  };

  const handleHelp = () => {
    if (pageWalkthroughId && WALKTHROUGHS[pageWalkthroughId]) {
      setActiveWalkthrough(pageWalkthroughId);
    }
  };

  return (
    <>
      <SidebarBody>
        <SidebarHeader>
          <SidebarLogo
            logo={<span className="text-xl font-bold text-ql-yellow whitespace-nowrap">QuickRefurbz</span>}
            logoCompact={<span className="text-xl font-bold text-ql-yellow">QR</span>}
          />
        </SidebarHeader>

        <SessionInfo />

        <SidebarContent>
          {navSections.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  end={item.end}
                />
              ))}
            </SidebarSection>
          ))}

          {user?.role === 'admin' && (
            <>
              <SidebarDivider />
              <SidebarLink
                to="/stations"
                icon={<IconDeviceDesktop size={20} />}
                label="Stations"
              />
              <SidebarLink
                to="/users"
                icon={<IconUsers size={20} />}
                label="Users"
              />
            </>
          )}

          <SidebarDivider />
          <SidebarLink
            to="/settings"
            icon={<IconSettings size={20} />}
            label="Settings"
          />
          <SidebarLink
            to="/help"
            icon={<IconHelp size={20} />}
            label="Help & Guides"
          />
          {pageWalkthroughId && (
            <SidebarButton
              icon={<IconHelp size={20} />}
              label="Page Guide"
              onClick={handleHelp}
            />
          )}
        </SidebarContent>

        <SidebarFooter>
          <Spotlight className="border-t border-border" spotlightColor="rgba(241, 196, 15, 0.08)">
            <div className="p-3 flex items-center gap-2">
              <SidebarUserSection
                name={user?.name || 'User'}
                role={user?.role}
              />
              <SidebarButton
                icon={<IconLogout size={18} />}
                label="Logout"
                onClick={handleLogout}
                variant="danger"
              />
            </div>
          </Spotlight>
        </SidebarFooter>
      </SidebarBody>

      {/* Auto-show walkthrough on first visit */}
      {pageWalkthroughId && walkthroughHook.showWalkthrough && !activeWalkthrough && (
        <Walkthrough
          walkthroughId={pageWalkthroughId}
          onComplete={() => walkthroughHook.dismissWalkthrough()}
          onSkip={() => walkthroughHook.dismissWalkthrough()}
        />
      )}

      {/* Manual walkthrough trigger */}
      {activeWalkthrough && (
        <Walkthrough
          walkthroughId={activeWalkthrough}
          onComplete={() => setActiveWalkthrough(null)}
          onSkip={() => setActiveWalkthrough(null)}
        />
      )}
    </>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  return (
    <SidebarProvider open={!collapsed} setOpen={() => onToggle?.()}>
      <AceternitySidebar>
        <SidebarNav />
      </AceternitySidebar>
    </SidebarProvider>
  );
}
