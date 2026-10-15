import React, { useEffect, useState } from 'react';
import type { TeacherUser } from '../types/auth';
import { fetchMeApi, loginApi, logoutApi } from '../services/api';
import { AuthContext } from './auth-context-base';

const TOKEN_STORAGE_KEY = 'bubsy_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await fetchMeApi(storedToken);
        if (!isMounted) return;

        if (res.data && !res.error) {
          setUser(res.data);
          setToken(storedToken);
        } else {
          // Session expired or invalid on backend - handle session expiry
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } catch {
        if (isMounted) {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const res = await loginApi(username, password);

    if (res.error || !res.data) {
      setError(res.error?.message || 'Invalid username or password.');
      setIsLoading(false);
      return false;
    }

    const { token: receivedToken, teacher } = res.data;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, receivedToken);
    setToken(receivedToken);
    setUser(teacher);
    setIsLoading(false);
    return true;
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi(token);
    } finally {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setError(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
