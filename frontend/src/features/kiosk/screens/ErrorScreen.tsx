import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { BubsyMascot } from '../BubsyMascot';

export interface ErrorScreenProps {
  errorMessage: string | null;
  onRetry: () => void;
  onHome: () => void;
  isLargeText: boolean;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorMessage,
  onRetry,
  onHome,
  isLargeText,
}) => {
  // Plain language child-friendly translation
  let friendlyTitle = 'Oops! Something went a bit wonky.';
  let friendlyAdvice = 'Don’t worry — let’s give it another try, or ask a teacher for help.';

  const raw = (errorMessage || '').toLowerCase();
  if (raw.includes('camera')) {
    friendlyTitle = 'The camera is taking a quick nap!';
    friendlyAdvice = 'Please tell your teacher so they can check the camera plug.';
  } else if (raw.includes('network') || raw.includes('connect')) {
    friendlyTitle = 'Waiting for Bubsy helper!';
    friendlyAdvice = 'We are having trouble talking to the handwashing helper. Let’s try again.';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        maxWidth: '750px',
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
        <BubsyMascot mood="comforting" size={160} />

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-error)',
            fontWeight: 800,
            marginTop: '16px',
            marginBottom: '8px',
          }}
        >
          <AlertCircle size={24} />
          <span style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            System Notice
          </span>
        </div>

        <h1
          style={{
            fontSize: isLargeText ? '36px' : '30px',
            fontWeight: 900,
            color: 'var(--color-dark-text)',
            marginBottom: '12px',
          }}
        >
          {friendlyTitle}
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
          {friendlyAdvice}
        </p>

        {/* Clear Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button
            variant="primary"
            size="kiosk"
            onClick={onRetry}
            icon={<RotateCcw size={26} />}
            style={{ minHeight: '68px', minWidth: '220px' }}
          >
            Try Again
          </Button>

          <Button
            variant="outline"
            size="kiosk"
            onClick={onHome}
            icon={<Home size={26} />}
            style={{ minHeight: '68px', minWidth: '220px' }}
          >
            Home
          </Button>
        </div>
      </Card>
    </div>
  );
};
