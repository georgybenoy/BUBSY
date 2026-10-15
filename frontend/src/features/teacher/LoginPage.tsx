import React, { useState } from 'react';
import { AlertCircle, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export const LoginPage: React.FC = () => {
  const { login, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsSubmitting(true);
    const success = await login(username.trim(), password);
    setIsSubmitting(false);

    if (success) {
      navigate('/teacher');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-canvas)',
        padding: '24px',
        fontFamily: 'var(--font-family-teacher)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          padding: '36px 32px',
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '22px',
            }}
            aria-hidden="true"
          >
            B
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--color-dark-text)',
              margin: '0 0 6px 0',
            }}
          >
            Bubsy Teacher Portal
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: 0 }}>
            Sign in to access school compliance reports and controls.
          </p>
        </div>

        {/* Error Alert (accessible, not color-only) */}
        {error && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              fontSize: '14px',
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <div>
              <strong style={{ display: 'block', fontWeight: 600 }}>Sign-in Problem</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-dark-text)',
                marginBottom: '6px',
              }}
            >
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-muted-text)',
                }}
                aria-hidden="true"
              />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) clearError();
                }}
                placeholder="Enter staff username"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px 10px 36px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-dark-text)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-dark-text)',
                marginBottom: '6px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-muted-text)',
                }}
                aria-hidden="true"
              />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                placeholder="Enter staff password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px 10px 36px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-dark-text)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
            style={{
              width: '100%',
              backgroundColor:
                isSubmitting || !username.trim() || !password
                  ? 'var(--color-muted-text)'
                  : 'var(--color-primary)',
              color: '#ffffff',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting || !username.trim() || !password ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        {/* Back to kiosk option */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link
            to="/kiosk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--color-muted-text)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Return to Student Kiosk</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
