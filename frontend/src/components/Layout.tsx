import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSession } from '../App';
import {
  LayoutDashboard,
  Columns3,
  Package,
  ScanLine,
  LogOut,
  Workflow,
  ListTodo,
  Settings,
  ShieldCheck,
  Wrench,
  Clock,
  Users,
  Stethoscope,
  Award,
  ClipboardList,
  Database,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/workflow', icon: Workflow, label: 'Workflow' },
  { to: '/queue', icon: ListTodo, label: 'Job Queue' },
  { to: '/kanban', icon: Columns3, label: 'Kanban' },
  { to: '/items', icon: Package, label: 'Items' },
  { to: '/scan', icon: ScanLine, label: 'Scan' },
  { to: '/datawipe', icon: ShieldCheck, label: 'Data Wipe' },
  { to: '/parts', icon: Wrench, label: 'Parts' },
  { to: '/diagnostics', icon: Stethoscope, label: 'Diagnostics' },
  { to: '/certifications', icon: Award, label: 'Certifications' },
  { to: '/test-plans', icon: ClipboardList, label: 'Test Plans' },
  { to: '/device-database', icon: Database, label: 'Devices' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { session, endSession } = useSession();

  const handleLogout = async () => {
    await endSession();
    logout();
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">QuickRefurbz</div>

        {session && (
          <div className="session-info">
            <Clock size={12} />
            <span className="truncate">{session.employee_id} · {session.workstation_id}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Users size={16} />
              Users
            </NavLink>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={16} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-white hover:bg-dark-tertiary rounded-md transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
