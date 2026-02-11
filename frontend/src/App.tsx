import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { PageErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { AcceptInvite } from './pages/AcceptInvite';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Items } from './pages/Items';
import { Scan } from './pages/Scan';
import { WorkflowStation } from './pages/WorkflowStation';
import { JobQueue } from './pages/JobQueue';
import { SettingsPage } from './pages/Settings';
import { DataWipePage } from './pages/DataWipe';
import { PartsPage } from './pages/Parts';
import { UserManagement } from './pages/UserManagement';
import { Diagnostics } from './pages/Diagnostics';
import { Certifications } from './pages/Certifications';
import { TestPlans } from './pages/TestPlans';
import { DeviceDatabase } from './pages/DeviceDatabase';
import { Verify } from './pages/Verify';
import { SessionPrompt } from './components/SessionPrompt';
import { Loader } from './components/aceternity/loader';
import { ToastProvider } from './components/aceternity/toast';
import { api } from './api/client';

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
      {children}
    </SessionContext.Provider>
  );
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

  return <SessionProvider>{children}</SessionProvider>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify/:certificationId" element={<Verify />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="workflow" element={<WorkflowStation />} />
        <Route path="queue" element={<JobQueue />} />
        <Route path="kanban" element={<Kanban />} />
        <Route path="items" element={<Items />} />
        <Route path="scan" element={<Scan />} />
        <Route path="datawipe" element={<DataWipePage />} />
        <Route path="parts" element={<PartsPage />} />
        <Route path="diagnostics" element={<Diagnostics />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="test-plans" element={<TestPlans />} />
        <Route path="device-database" element={<DeviceDatabase />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <PageErrorBoundary>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </PageErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
