import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, ShieldCheck } from 'lucide-react';

export type StatusBadgeType = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export interface StatusBadgeProps {
  status: StatusBadgeType;
  label: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'kiosk';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'neutral',
  label,
  icon,
  size = 'md',
  className = '',
}) => {
  const configs: Record<
    StatusBadgeType,
    { bg: string; text: string; border: string; defaultIcon: React.ReactNode }
  > = {
    success: {
      bg: '#ecfdf5',
      text: '#065f46',
      border: '#a7f3d0',
      defaultIcon: <CheckCircle2 size={16} strokeWidth={2.5} aria-hidden="true" />,
    },
    warning: {
      bg: '#fffbeb',
      text: '#92400e',
      border: '#fde68a',
      defaultIcon: <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />,
    },
    error: {
      bg: '#fef2f2',
      text: '#991b1b',
      border: '#fecaca',
      defaultIcon: <AlertCircle size={16} strokeWidth={2.5} aria-hidden="true" />,
    },
    info: {
      bg: '#eff6ff',
      text: '#1e40af',
      border: '#bfdbfe',
      defaultIcon: <Info size={16} strokeWidth={2.5} aria-hidden="true" />,
    },
    neutral: {
      bg: '#f8fafc',
      text: '#475569',
      border: '#e2e8f0',
      defaultIcon: <ShieldCheck size={16} strokeWidth={2.5} aria-hidden="true" />,
    },
  };

  const currentConfig = configs[status] || configs.neutral;

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '3px 8px', fontSize: '12px', gap: '4px', borderRadius: 'var(--radius-sm)' },
    md: { padding: '6px 12px', fontSize: '14px', gap: '6px', borderRadius: 'var(--radius-sm)' },
    lg: { padding: '8px 16px', fontSize: '16px', gap: '8px', borderRadius: 'var(--radius-md)' },
    kiosk: {
      padding: '12px 22px',
      fontSize: '20px',
      fontWeight: 800,
      gap: '10px',
      borderRadius: 'var(--radius-lg)',
    },
  };

  return (
    <span
      className={`bubsy-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        backgroundColor: currentConfig.bg,
        color: currentConfig.text,
        border: `1.5px solid ${currentConfig.border}`,
        lineHeight: 1,
        ...sizeStyles[size],
      }}
    >
      <span style={{ display: 'inline-flex' }}>{icon || currentConfig.defaultIcon}</span>
      <span>{label}</span>
    </span>
  );
};
