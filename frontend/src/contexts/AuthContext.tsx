import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAuthToken, setRefreshToken, setUnauthorizedHandler } from '../services/api';
import type { User, AuthState } from '../types';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  });
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setState({ user: null, accessToken: null, refreshToken: null });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAuthToken(null);
    setRefreshToken(null);
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    setUnauthorizedHandler(logout);

    const token = localStorage.getItem('accessToken');
    const refresh = localStorage.getItem('refreshToken');

    if (token) {
      setAuthToken(token);
      setRefreshToken(refresh);

      authApi.me()
        .then((user: User) => {
          setState({ user, accessToken: token, refreshToken: refresh });
        })
        .catch(() => {
          logout();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [logout]);

  const login = async (email: string, password: string, tenantSlug: string) => {
    const data = await authApi.login(email, password, tenantSlug);
    const { accessToken, refreshToken, user } = data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setAuthToken(accessToken);
    setRefreshToken(refreshToken);

    setState({ user, accessToken, refreshToken });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
