"use client";
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/App';
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
  SidebarUserSection,
  useSidebar,
} from '@/components/aceternity/sidebar';
import { Spotlight } from '@/components/aceternity/spotlight';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconLayoutDashboard,
  IconColumns3,
  IconPackage,
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
} from '@tabler/icons-react';

const navItems = [
  { to: '/', icon: <IconLayoutDashboard size={20} />, label: 'Dashboard', end: true },
  { to: '/workflow', icon: <IconBinaryTree size={20} />, label: 'Workflow Station' },
  { to: '/queue', icon: <IconListCheck size={20} />, label: 'Job Queue' },
  { to: '/kanban', icon: <IconColumns3 size={20} />, label: 'Kanban Board' },
  { to: '/items', icon: <IconPackage size={20} />, label: 'Items' },
  { to: '/scan', icon: <IconScan size={20} />, label: 'Scan Item' },
  { to: '/datawipe', icon: <IconShieldCheck size={20} />, label: 'Data Wipe' },
  { to: '/parts', icon: <IconTool size={20} />, label: 'Parts' },
  { to: '/diagnostics', icon: <IconStethoscope size={20} />, label: 'Diagnostics' },
  { to: '/certifications', icon: <IconCertificate size={20} />, label: 'Certifications' },
  { to: '/test-plans', icon: <IconClipboardList size={20} />, label: 'Test Plans' },
  { to: '/device-database', icon: <IconDatabase size={20} />, label: 'Device Database' },
];

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
          className="px-4 py-3 border-b border-border overflow-hidden"
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-dark-tertiary rounded-lg px-3 py-2">
            <IconClock size={14} className="text-ql-yellow" />
            <span>{session.employee_id} | {session.workstation_id}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SidebarNav() {
  const { user, logout } = useAuth();
  const { endSession } = useSession();

  const handleLogout = async () => {
    await endSession();
    logout();
  };

  return (
    <SidebarBody>
      <SidebarHeader>
        <SidebarLogo
          logo={<span className="text-2xl font-bold text-ql-yellow whitespace-nowrap">QuickRefurbz</span>}
          logoCompact={<span className="text-2xl font-bold text-ql-yellow">QR</span>}
        />
      </SidebarHeader>

      <SessionInfo />

      <SidebarContent>
        {navItems.map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            end={item.end}
          />
        ))}

        {user?.role === 'admin' && (
          <SidebarLink
            to="/users"
            icon={<IconUsers size={20} />}
            label="Users"
          />
        )}

        <SidebarLink
          to="/settings"
          icon={<IconSettings size={20} />}
          label="Settings"
        />
      </SidebarContent>

      <SidebarFooter>
        <Spotlight className="border-t border-border" spotlightColor="rgba(241, 196, 15, 0.1)">
          <div className="p-4 flex items-center gap-3">
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
