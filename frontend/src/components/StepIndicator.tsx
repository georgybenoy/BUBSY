import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  code: string;
  title: string;
  shortName?: string;
}

export interface StepIndicatorProps {
  steps: StepItem[];
  currentIndex: number;
  completedIndices?: number[];
  size?: 'standard' | 'kiosk';
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentIndex,
  completedIndices = [],
  size = 'kiosk',
}) => {
  const isKiosk = size === 'kiosk';

  return (
    <nav
      aria-label="Handwashing Steps"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isKiosk ? '12px' : '8px',
        flexWrap: 'wrap',
        padding: '8px 0',
      }}
    >
      {steps.map((step, idx) => {
        const isCurrent = idx === currentIndex;
        const isCompleted = completedIndices.includes(idx) || idx < currentIndex;

        // Shape and background
        const bubbleSize = isKiosk ? '44px' : '32px';

        let bgColor = '#f1f5f9';
        let textColor = 'var(--color-muted-text)';
        let borderColor = 'var(--color-border)';

        if (isCurrent) {
          bgColor = 'var(--color-primary)';
          textColor = '#ffffff';
          borderColor = 'var(--color-primary)';
        } else if (isCompleted) {
          bgColor = 'var(--color-soft-blue)';
          textColor = 'var(--color-primary)';
          borderColor = '#93c5fd';
        }

        return (
          <div
            key={step.code}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isKiosk ? '10px' : '6px',
            }}
          >
            <div
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: '50%',
                backgroundColor: bgColor,
                border: `2px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: textColor,
                fontWeight: 800,
                fontSize: isKiosk ? '18px' : '14px',
                boxShadow: isCurrent ? '0 0 0 4px rgba(37, 99, 235, 0.2)' : 'none',
                transition: 'all 0.2s ease',
              }}
              title={`${step.title} (${isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'})`}
            >
              {isCompleted ? (
                <Check size={isKiosk ? 22 : 16} strokeWidth={3} aria-label="Completed" />
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>

            {/* Connecting dot or bar between steps */}
            {idx < steps.length - 1 && (
              <div
                style={{
                  width: isKiosk ? '16px' : '10px',
                  height: '3px',
                  backgroundColor: isCompleted ? 'var(--color-primary)' : 'var(--color-border)',
                  borderRadius: '2px',
                }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
};
