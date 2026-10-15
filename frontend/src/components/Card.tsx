import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'surface' | 'soft' | 'highlight' | 'kiosk';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'kiosk';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'surface',
  padding = 'md',
  interactive = false,
  children,
  style,
  className = '',
  ...rest
}) => {
  const paddingStyles: Record<string, string> = {
    none: '0',
    sm: '12px',
    md: '20px',
    lg: '32px',
    kiosk: '40px',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
    },
    surface: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-md)',
    },
    soft: {
      backgroundColor: 'var(--color-soft-blue)',
      border: '1px solid #bfdbfe',
    },
    highlight: {
      backgroundColor: 'var(--color-surface)',
      border: '3px solid var(--color-primary)',
      boxShadow: 'var(--shadow-lg)',
    },
    kiosk: {
      backgroundColor: 'var(--color-surface)',
      border: '2px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-family-kiosk)',
    },
  };

  return (
    <div
      className={`bubsy-card ${className}`}
      style={{
        borderRadius: variant === 'kiosk' ? 'var(--radius-lg)' : 'var(--radius-md)',
        padding: paddingStyles[padding] || paddingStyles.md,
        transition: interactive ? 'transform 0.15s ease, box-shadow 0.15s ease' : undefined,
        cursor: interactive ? 'pointer' : undefined,
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
