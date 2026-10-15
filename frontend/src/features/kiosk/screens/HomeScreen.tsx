import React from 'react';
import { Volume2, VolumeX, Type, ArrowRight, QrCode } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { BubsyMascot } from '../BubsyMascot';
import type { KioskAccessibilitySettings } from '../../../types/kiosk';

export interface HomeScreenProps {
  onStartWash: () => void;
  accessibility: KioskAccessibilitySettings;
  onToggleAudio: () => void;
  onToggleTextSize: () => void;
  isLargeText: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartWash,
  accessibility,
  onToggleAudio,
  onToggleTextSize,
  isLargeText,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
      }}
    >
      {/* Top Accessibility Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignSelf: 'flex-end',
          marginBottom: '24px',
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAudio}
          icon={accessibility.audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          style={{ minHeight: '44px' }}
        >
          {accessibility.audioEnabled ? 'Voice On' : 'Voice Off'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTextSize}
          icon={<Type size={18} />}
          style={{ minHeight: '44px' }}
        >
          {isLargeText ? 'Text: Large' : 'Text: Normal'}
        </Button>
      </div>

      {/* Hero Card */}
      <Card
        variant="kiosk"
        padding="kiosk"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Friendly Mascot */}
        <BubsyMascot mood="waving" size={170} />

        <h1
          style={{
            fontSize: isLargeText ? '40px' : '34px',
            fontWeight: 900,
            color: 'var(--color-primary)',
            marginTop: '20px',
            marginBottom: '8px',
            letterSpacing: '-0.5px',
          }}
        >
          Hey there, handwashing hero!
        </h1>

        <p
          style={{
            fontSize: isLargeText ? '24px' : '20px',
            color: 'var(--color-muted-text)',
            fontWeight: 700,
            marginBottom: '36px',
            maxWidth: '560px',
          }}
        >
          Ready for your wash adventure?
        </p>

        {/* Large Primary Action Button */}
        <Button
          variant="primary"
          size="kiosk"
          onClick={onStartWash}
          icon={<ArrowRight size={28} />}
          iconPosition="right"
          style={{
            minWidth: '280px',
            minHeight: '76px',
            fontSize: isLargeText ? '26px' : '24px',
            boxShadow: '0 12px 20px -4px rgba(37, 99, 235, 0.35)',
          }}
        >
          LET'S WASH!
        </Button>

        {/* Secondary Scan Cue */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-muted-text)',
            fontSize: isLargeText ? '17px' : '15px',
            fontWeight: 600,
          }}
        >
          <QrCode size={20} color="var(--color-primary)" />
          <span>Scan your student QR code to begin</span>
        </div>
      </Card>
    </div>
  );
};
