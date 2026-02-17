"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/api/client';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Migrate old auth_token key to unified 'token' key
    const oldToken = localStorage.getItem('auth_token');
    if (oldToken) {
      localStorage.removeItem('auth_token');
      if (!api.getToken()) {
        api.setToken(oldToken);
      }
    }

    // Check for existing token on mount (uses same 'token' key as ApiClient)
    const token = api.getToken();
    if (token) {
      api.getCurrentUser()
        .then(setUser)
        .catch(() => {
          api.setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    // api.login() already calls setToken internally
    const response = await api.login(username, password);
    setUser(response.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
