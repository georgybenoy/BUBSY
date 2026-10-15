import React, { useEffect, useState } from 'react';
import { Droplets, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { MovementIllustration } from '../MovementIllustration';

export interface PreparationScreenProps {
  onPreparationFinished: () => void;
  isLargeText: boolean;
}

export const PreparationScreen: React.FC<PreparationScreenProps> = ({
  onPreparationFinished,
  isLargeText,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onPreparationFinished();
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining, onPreparationFinished]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <Card
        variant="kiosk"
        padding="kiosk"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
            letterSpacing: '1px',
            marginBottom: '4px',
          }}
        >
          Preparation Instructions
        </div>

        <h1
          style={{
            fontSize: isLargeText ? '38px' : '32px',
            fontWeight: 900,
            color: 'var(--color-dark-text)',
            marginBottom: '28px',
          }}
        >
          Get ready to wash!
        </h1>

        {/* 2 Preparatory Steps Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
            width: '100%',
            marginBottom: '36px',
          }}
        >
          {/* Step 1: Wet hands */}
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#eff6ff',
              border: '2px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <MovementIllustration stepCode="PREP_WET" size={140} />
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: isLargeText ? '22px' : '19px',
                fontWeight: 800,
                color: 'var(--color-primary)',
                marginBottom: '6px',
              }}
            >
              <Droplets size={22} />
              <span>1. Wet your hands</span>
            </div>
            <p style={{ fontSize: isLargeText ? '16px' : '14px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Turn on the tap and wet both hands thoroughly with clean water.
            </p>
          </div>

          {/* Step 2: Apply soap */}
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#fdf2f8',
              border: '2px solid #fbcfe8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <MovementIllustration stepCode="PREP_SOAP" size={140} />
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: isLargeText ? '22px' : '19px',
                fontWeight: 800,
                color: '#db2777',
                marginBottom: '6px',
              }}
            >
              <Sparkles size={22} />
              <span>2. Apply soap</span>
            </div>
            <p style={{ fontSize: isLargeText ? '16px' : '14px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Pump a dollop of soap to create lots of rich, foamy bubbles!
            </p>
          </div>
        </div>

        {/* Skip / Proceed Action Button */}
        <Button
          variant="primary"
          size="kiosk"
          onClick={onPreparationFinished}
          icon={<ArrowRight size={28} />}
          iconPosition="right"
          style={{
            minHeight: '68px',
            minWidth: '320px',
            fontSize: isLargeText ? '24px' : '22px',
          }}
        >
          {secondsRemaining > 0 ? `I'm Ready! (${secondsRemaining}s)` : "I'M READY!"}
        </Button>
      </Card>
    </div>
  );
};
