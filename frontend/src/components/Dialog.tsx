import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'kiosk';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyles: Record<string, string> = {
    md: '480px',
    lg: '640px',
    kiosk: '760px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        style={{
          width: '100%',
          maxWidth: widthStyles[size] || widthStyles.md,
          backgroundColor: 'var(--color-surface)',
          borderRadius: size === 'kiosk' ? 'var(--radius-lg)' : 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '2px solid var(--color-border)',
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: size === 'kiosk' ? '24px 32px' : '16px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: size === 'kiosk' ? 'var(--color-soft-blue)' : 'var(--color-surface)',
          }}
        >
          <div>
            <h2
              id="dialog-title"
              style={{
                fontSize: size === 'kiosk' ? '24px' : '18px',
                fontWeight: 800,
                color: size === 'kiosk' ? 'var(--color-primary)' : 'var(--color-dark-text)',
                margin: 0,
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                id="dialog-description"
                style={{
                  fontSize: size === 'kiosk' ? '15px' : '13px',
                  color: 'var(--color-muted-text)',
                  marginTop: '4px',
                  marginBottom: 0,
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: size === 'kiosk' ? '48px' : '36px',
              height: size === 'kiosk' ? '48px' : '36px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-muted-text)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <X size={size === 'kiosk' ? 24 : 18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: size === 'kiosk' ? '32px' : '24px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
