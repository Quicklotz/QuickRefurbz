import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Items } from './pages/Items';
import { Scan } from './pages/Scan';
import { WorkflowStation } from './pages/WorkflowStation';
import { JobQueue } from './pages/JobQueue';
import { SettingsPage } from './pages/Settings';
import { DataWipePage } from './pages/DataWipe';
import { PartsPage } from './pages/Parts';
import { SessionPrompt } from './components/SessionPrompt';
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

  const refreshSession = async () => {
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
  };

  const endSession = async () => {
    try {
      await api.endSession();
      setSession(null);
      setRequiresSession(true);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  useEffect(() => {
    refreshSession();
  }, [user]);

  if (loading) {
    return (
      <div className="login-container">
        <div>Loading...</div>
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
      <div className="login-container">
        <div>Loading...</div>
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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
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
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
