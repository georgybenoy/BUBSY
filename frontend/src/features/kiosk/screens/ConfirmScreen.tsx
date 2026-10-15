import React from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { BubsyMascot } from '../BubsyMascot';
import type { KioskConfig, KioskIdentifyResult } from '../../../types/kiosk';

export interface ConfirmScreenProps {
  student: KioskIdentifyResult | null;
  config: KioskConfig;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isLargeText: boolean;
}

export const ConfirmScreen: React.FC<ConfirmScreenProps> = ({
  student,
  config,
  onConfirm,
  onCancel,
  isLoading,
  isLargeText,
}) => {
  // Respect policy on displaying student first name
  const showName = config.first_name_display_allowed && student?.first_name;
  const greeting = showName ? `Ready, ${student.first_name}?` : 'Ready to wash?';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        maxWidth: '780px',
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
        <BubsyMascot mood="ready" size={160} />

        <h1
          style={{
            fontSize: isLargeText ? '40px' : '34px',
            fontWeight: 900,
            color: 'var(--color-primary)',
            marginTop: '20px',
            marginBottom: '12px',
          }}
        >
          {greeting}
        </h1>

        <p
          style={{
            fontSize: isLargeText ? '22px' : '18px',
            color: 'var(--color-muted-text)',
            fontWeight: 600,
            marginBottom: '36px',
            maxWidth: '520px',
          }}
        >
          We're going to get those hands super clean and sparkly!
        </p>

        {/* Big Touch-Friendly Confirmation Button */}
        <Button
          variant="primary"
          size="kiosk"
          onClick={onConfirm}
          loading={isLoading}
          icon={<ArrowRight size={28} />}
          iconPosition="right"
          style={{
            minWidth: '280px',
            minHeight: '74px',
            fontSize: isLargeText ? '26px' : '22px',
            marginBottom: '24px',
          }}
        >
          YES, LET'S GO!
        </Button>

        {/* Not You Switch Option */}
        <Button
          variant="ghost"
          size="md"
          onClick={onCancel}
          icon={<RotateCcw size={18} />}
          style={{
            color: 'var(--color-muted-text)',
            fontSize: isLargeText ? '17px' : '15px',
            fontWeight: 600,
            minHeight: '48px',
          }}
        >
          Not you? Tap here to scan again
        </Button>
      </Card>
    </div>
  );
};
