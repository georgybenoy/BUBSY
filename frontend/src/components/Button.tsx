import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'kiosk';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  children,
  disabled,
  style,
  className = '',
  ...rest
}) => {
  // Sizing tokens ensuring min 64px touch target on kiosk
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '13px',
      minHeight: '36px',
      borderRadius: 'var(--radius-sm)',
      gap: '6px',
    },
    md: {
      padding: '10px 18px',
      fontSize: '15px',
      minHeight: '44px',
      borderRadius: 'var(--radius-md)',
      gap: '8px',
    },
    lg: {
      padding: '14px 24px',
      fontSize: '17px',
      minHeight: '52px',
      borderRadius: 'var(--radius-lg)',
      gap: '10px',
    },
    kiosk: {
      padding: '18px 36px',
      fontSize: '22px',
      fontWeight: 800,
      minHeight: '64px',
      minWidth: '64px',
      borderRadius: 'var(--radius-lg)',
      gap: '14px',
      letterSpacing: '0.5px',
      boxShadow: 'var(--shadow-md)',
    },
  };

  // Variant color styles with high contrast
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: '#ffffff',
      border: '2px solid transparent',
    },
    secondary: {
      backgroundColor: 'var(--color-soft-blue)',
      color: 'var(--color-primary)',
      border: '2px solid transparent',
    },
    outline: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-dark-text)',
      border: '2px solid var(--color-border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-dark-text)',
      border: '2px solid transparent',
    },
    danger: {
      backgroundColor: 'var(--color-error)',
      color: '#ffffff',
      border: '2px solid transparent',
    },
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;
  const currentVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      disabled={disabled || loading}
      className={`bubsy-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: size === 'kiosk' ? 'var(--font-family-kiosk)' : 'inherit',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        width: fullWidth ? '100%' : 'auto',
        ...currentSize,
        ...currentVariant,
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: size === 'kiosk' ? '24px' : '16px',
            height: size === 'kiosk' ? '24px' : '16px',
            border: '3px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
        </>
      )}
    </button>
  );
};
