import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Columns3,
  Package,
  Boxes,
  ScanLine,
  LogOut
} from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">QuickRefurbz</div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/kanban" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Columns3 size={20} />
            Kanban Board
          </NavLink>
          <NavLink to="/items" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Package size={20} />
            Items
          </NavLink>
          <NavLink to="/pallets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Boxes size={20} />
            Pallets
          </NavLink>
          <NavLink to="/scan" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ScanLine size={20} />
            Scan Item
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
            onClick={logout}
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
