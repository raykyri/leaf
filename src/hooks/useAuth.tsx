import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface User {
  did: string;
  handle: string;
  displayName?: string;
}

interface AuthContextType {
  user: User | null;
  csrfToken: string | null;
  isLoading: boolean;
  login: (handle: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setCsrfToken(data.csrfToken);
      } else {
        setUser(null);
        setCsrfToken(null);
      }
    } catch {
      setUser(null);
      setCsrfToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (handle: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    await refresh();
  };

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });
      if (!response.ok) {
        console.error('Logout request failed:', response.status);
      }
    } catch (error) {
      // Log but don't throw - we still want to clear local state
      console.error('Logout error:', error);
    } finally {
      // Always clear local state, even if the API call failed
      setUser(null);
      setCsrfToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, csrfToken, isLoading, login, logout, refresh }}>
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
