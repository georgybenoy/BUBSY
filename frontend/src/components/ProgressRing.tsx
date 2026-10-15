import React from 'react';

export interface ProgressRingProps {
  progress?: number; // 0 to 100 or 0.0 to 1.0
  value?: number; // Alias for progress
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  'aria-label'?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  value,
  size = 180,
  strokeWidth = 14,
  color = 'var(--color-primary)',
  trackColor = 'var(--color-soft-blue)',
  label,
  sublabel,
  icon,
  'aria-label': ariaLabel = 'Handwashing progress',
}) => {
  // Normalize progress/value to percentage 0..100
  const raw = typeof progress === 'number' ? progress : typeof value === 'number' ? value : 0;
  const normalized = raw <= 1.0 && raw > 0 ? raw * 100 : raw;
  const clamped = Number.isNaN(normalized) ? 0 : Math.min(100, Math.max(0, normalized));

  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          display: 'block',
        }}
      >
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.35s ease',
          }}
        />
      </svg>

      {/* Center content */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '12px',
        }}
      >
        {icon && <div style={{ marginBottom: '4px' }}>{icon}</div>}
        {label ? (
          <div
            style={{
              fontSize: size > 140 ? '28px' : '20px',
              fontWeight: 800,
              color: 'var(--color-dark-text)',
              lineHeight: 1.1,
            }}
          >
            {label}
          </div>
        ) : (
          <div
            style={{
              fontSize: size > 140 ? '32px' : '22px',
              fontWeight: 800,
              color: 'var(--color-primary)',
            }}
          >
            {Math.round(clamped)}%
          </div>
        )}
        {sublabel && (
          <div
            style={{
              fontSize: size > 140 ? '14px' : '12px',
              fontWeight: 600,
              color: 'var(--color-muted-text)',
              marginTop: '2px',
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};
