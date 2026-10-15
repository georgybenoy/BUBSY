import React from 'react';
import { useAuth } from '../context/useAuth';
import { LoginPage } from '../features/teacher/LoginPage';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-canvas)',
          gap: '12px',
          color: 'var(--color-muted-text)',
        }}
        role="status"
        aria-live="polite"
      >
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Checking authorization...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
};
