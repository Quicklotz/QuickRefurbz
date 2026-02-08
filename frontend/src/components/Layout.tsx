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
  Clock
} from 'lucide-react';

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
            <Clock size={14} />
            <span>{session.employee_id} | {session.workstation_id}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/workflow" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Workflow size={20} />
            Workflow Station
          </NavLink>
          <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ListTodo size={20} />
            Job Queue
          </NavLink>
          <NavLink to="/kanban" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Columns3 size={20} />
            Kanban Board
          </NavLink>
          <NavLink to="/items" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Package size={20} />
            Items
          </NavLink>
          <NavLink to="/scan" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ScanLine size={20} />
            Scan Item
          </NavLink>
          <NavLink to="/datawipe" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ShieldCheck size={20} />
            Data Wipe
          </NavLink>
          <NavLink to="/parts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Wrench size={20} />
            Parts
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
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
            className="btn btn-secondary"
            style={{ padding: '0.5rem' }}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
