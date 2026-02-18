import { useState, useEffect, useRef, createContext, useContext, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PalletSessionProvider } from './contexts/PalletSessionContext';
import { AppLayout } from './components/layout/AppLayout';
import { PageErrorBoundary } from './components/ErrorBoundary';
import { SessionPrompt } from './components/SessionPrompt';
import { SetupWizard } from './components/SetupWizard';
import { Loader } from './components/aceternity/loader';
import { ToastProvider } from './components/aceternity/toast';
import { api } from './api/client';

// Lazy-loaded page components
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite').then(m => ({ default: m.AcceptInvite })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Kanban = lazy(() => import('./pages/Kanban').then(m => ({ default: m.Kanban })));
const Items = lazy(() => import('./pages/Items').then(m => ({ default: m.Items })));
const Intake = lazy(() => import('./pages/Intake').then(m => ({ default: m.Intake })));
const Scan = lazy(() => import('./pages/Scan').then(m => ({ default: m.Scan })));
const WorkflowStation = lazy(() => import('./pages/WorkflowStation').then(m => ({ default: m.WorkflowStation })));
const JobQueue = lazy(() => import('./pages/JobQueue').then(m => ({ default: m.JobQueue })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const DataWipePage = lazy(() => import('./pages/DataWipe').then(m => ({ default: m.DataWipePage })));
const PartsPage = lazy(() => import('./pages/Parts').then(m => ({ default: m.PartsPage })));
const UserManagement = lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Diagnostics = lazy(() => import('./pages/Diagnostics').then(m => ({ default: m.Diagnostics })));
const Certifications = lazy(() => import('./pages/Certifications').then(m => ({ default: m.Certifications })));
const TestPlans = lazy(() => import('./pages/TestPlans').then(m => ({ default: m.TestPlans })));
const DeviceDatabase = lazy(() => import('./pages/DeviceDatabase').then(m => ({ default: m.DeviceDatabase })));
const Verify = lazy(() => import('./pages/Verify').then(m => ({ default: m.Verify })));
const Download = lazy(() => import('./pages/Download').then(m => ({ default: m.Download })));
const StationMonitor = lazy(() => import('./pages/StationMonitor').then(m => ({ default: m.StationMonitor })));
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));

// Loading fallback for Suspense
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-dark-primary flex items-center justify-center">
      <Loader size="xl" variant="dots" text="Loading..." />
    </div>
  );
}

// 404 page
function NotFound() {
  return (
    <div className="min-h-screen bg-dark-primary flex flex-col items-center justify-center text-white">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-8">Page not found</p>
      <Link
        to="/"
        className="px-6 py-3 bg-accent-primary hover:bg-accent-primary/80 rounded-lg text-white font-medium transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}

// Session Context
interface WorkSession {
  id: string;
  employee_id: string;
  workstation_id: string;
  warehouse_id: string;
  session_date: string;
  started_at: string;
}

interface SessionContextType {
  session: WorkSession | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  endSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresSession, setRequiresSession] = useState(false);

  const refreshSession = useCallback(async () => {
    if (!user) {
      setSession(null);
      setRequiresSession(false);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getSession();
      setSession(data.session);
      setRequiresSession(data.requiresSession);
    } catch (err) {
      console.error('Failed to get session:', err);
      setSession(null);
      setRequiresSession(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const endSession = useCallback(async () => {
    try {
      await api.endSession();
      setSession(null);
      setRequiresSession(true);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <Loader size="xl" variant="bars" text="Loading session..." />
      </div>
    );
  }

  if (user && requiresSession && !session) {
    return (
      <SessionPrompt
        onSessionStarted={(newSession) => {
          setSession(newSession);
          setRequiresSession(false);
        }}
      />
    );
  }

  return (
    <SessionContext.Provider value={{ session, loading, refreshSession, endSession }}>
      <PalletSessionProvider>
        {children}
      </PalletSessionProvider>
    </SessionContext.Provider>
  );
}

// Heartbeat hook — sends station heartbeat every 30s
function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    // Derive station ID from email (station01@quickrefurbz.local → RFB-01)
    const stationMatch = user.email?.match(/station(\d+)@quickrefurbz\.local/);
    const stationId = stationMatch ? `RFB-${stationMatch[1]}` : undefined;

    if (!stationId) return; // Only station accounts send heartbeats

    const startTime = Date.now();

    const sendHeartbeat = () => {
      api.stationHeartbeat({
        station_id: stationId,
        current_page: locationRef.current,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      }).catch(() => { /* swallow — non-critical */ });
    };

    // Send immediately, then every 30s
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return <>{children}</>;
}

// Setup wizard gate — shows wizard on first login for station accounts
function SetupWizardGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecked(true);
      return;
    }
    const isStation = user.email?.endsWith('@quickrefurbz.local');
    const setupDone = localStorage.getItem('rfb_setup_complete');
    setNeedsSetup(!!isStation && !setupDone);
    setChecked(true);
  }, [user]);

  if (!checked) return null;

  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <Loader size="xl" variant="dots" text="Authenticating..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SessionProvider>
      <SetupWizardGate>
        {children}
      </SetupWizardGate>
    </SessionProvider>
  );
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/download" element={<Download />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify/:certificationId" element={<Verify />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/:section" element={<Help />} />
        <Route path="/help/:section/:article" element={<Help />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Intake />} />
          <Route path="scan" element={<Scan />} />
          <Route path="items" element={<Items />} />
          <Route path="workflow" element={<WorkflowStation />} />
          <Route path="diagnostics" element={<Diagnostics />} />
          <Route path="datawipe" element={<DataWipePage />} />
          <Route path="certifications" element={<Certifications />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="queue" element={<JobQueue />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="parts" element={<PartsPage />} />
          <Route path="test-plans" element={<TestPlans />} />
          <Route path="device-database" element={<DeviceDatabase />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="stations"
            element={
              <AdminRoute>
                <StationMonitor />
              </AdminRoute>
            }
          />
        </Route>
        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const Router = import.meta.env.VITE_ELECTRON === 'true' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <PageErrorBoundary>
          <AuthProvider>
            <HeartbeatProvider>
              <AppRoutes />
            </HeartbeatProvider>
          </AuthProvider>
        </PageErrorBoundary>
      </ToastProvider>
    </Router>
  );
}
