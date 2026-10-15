import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ProgressRing } from '../../../components/ProgressRing';
import { StepIndicator } from '../../../components/StepIndicator';
import { BubsyMascot } from '../BubsyMascot';
import { MovementIllustration } from '../MovementIllustration';
import type { KioskChildSafeEvent } from '../../../types/kiosk';

export interface ActiveWashScreenProps {
  activeEvent: KioskChildSafeEvent | null;
  onFinishSession: () => void;
  isLoading: boolean;
  isLargeText: boolean;
}

const DEFAULT_STEPS = [
  { code: 'STEP_1', title: 'Palm to Palm', shortName: 'Palms' },
  { code: 'STEP_2', title: 'Back of Hands', shortName: 'Backs' },
  { code: 'STEP_3', title: 'Between Fingers', shortName: 'Between' },
  { code: 'STEP_4', title: 'Back of Fingers', shortName: 'Knuckles' },
  { code: 'STEP_5', title: 'Thumbs', shortName: 'Thumbs' },
  { code: 'STEP_6', title: 'Fingernails & Tips', shortName: 'Fingertips' },
];

export const ActiveWashScreen: React.FC<ActiveWashScreenProps> = ({
  activeEvent,
  onFinishSession,
  isLoading,
  isLargeText,
}) => {
  // Safe defaults if event hasn't arrived yet
  const stepNumber = activeEvent?.step_number || 1;
  const totalSteps = activeEvent?.total_steps || 6;
  const stepCode = activeEvent?.step_code || 'STEP_1';
  const progressRatio = activeEvent?.progress_ratio ?? 0.0;
  const statusHint = activeEvent?.status_hint || 'GREAT_START';

  // Child-safe friendly status translations
  let feedbackText = 'Great start! Keep rubbing!';
  let feedbackColor = 'var(--color-primary)';
  let isUncertain = false;

  if (statusHint === 'GREAT_START') {
    feedbackText = 'Great start! Keep those hands moving!';
    feedbackColor = 'var(--color-primary)';
  } else if (statusHint === 'KEEP_RUBBING') {
    feedbackText = 'Nice work — keep rubbing!';
    feedbackColor = '#16a34a';
  } else if (statusHint === 'TRY_SLOWER') {
    feedbackText = 'Try rubbing a little slower and smoother.';
    feedbackColor = '#d97706';
  } else if (statusHint === 'RETRY') {
    feedbackText = "Let's try that movement again!";
    feedbackColor = '#4f46e5';
    isUncertain = true;
  } else if (statusHint === 'STEP_COMPLETED') {
    feedbackText = 'Awesome job! Moving to the next step!';
    feedbackColor = '#16a34a';
  }

  // Supporting instructions
  const promptText = activeEvent?.prompt_text || 'Rub your hands together!';
  let supportingText = 'Get into all the little spaces!';
  if (stepCode.includes('STEP_1')) {
    supportingText = 'Rub palms together firmly in circles.';
  } else if (stepCode.includes('STEP_2')) {
    supportingText = 'Rub the back of each hand with the other palm.';
  } else if (stepCode.includes('STEP_3')) {
    supportingText = 'Interlace your fingers and rub between them.';
  } else if (stepCode.includes('STEP_4')) {
    supportingText = 'Lock fingers and rub backs of fingers against palms.';
  } else if (stepCode.includes('STEP_5')) {
    supportingText = 'Grip each thumb and rub in circular twists.';
  } else if (stepCode.includes('STEP_6')) {
    supportingText = 'Rub fingertips in circles against your opposite palm.';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 20px',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Top Title & Step Indicator */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
            letterSpacing: '1px',
            marginBottom: '4px',
          }}
        >
          Your Wash Adventure
        </span>
        <h1
          style={{
            fontSize: isLargeText ? '28px' : '24px',
            fontWeight: 900,
            color: 'var(--color-dark-text)',
            marginBottom: '12px',
          }}
        >
          Step {stepNumber} of {totalSteps}
        </h1>

        <StepIndicator
          steps={DEFAULT_STEPS}
          currentIndex={stepNumber - 1}
          size="kiosk"
        />
      </div>

      {/* Main Adventure Card */}
      <Card
        variant="kiosk"
        padding="md"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 32px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Visual Movement Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            width: '100%',
            gap: '24px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          {/* Movement Illustration Box */}
          <MovementIllustration stepCode={stepCode} size={190} />

          {/* Real-time Progress Ring */}
          <ProgressRing
            progress={progressRatio}
            size={180}
            strokeWidth={14}
            color={isUncertain ? '#6366f1' : 'var(--color-primary)'}
            label={`${Math.round(progressRatio * 100)}%`}
            sublabel="Step Progress"
          />

          {/* Cheering Mascot */}
          <BubsyMascot mood={isUncertain ? 'comforting' : 'washing'} size={150} />
        </div>

        {/* Big Main Instruction */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2
            style={{
              fontSize: isLargeText ? '36px' : '30px',
              fontWeight: 900,
              color: 'var(--color-primary)',
              marginBottom: '6px',
            }}
          >
            {promptText}
          </h2>
          <p
            style={{
              fontSize: isLargeText ? '20px' : '17px',
              fontWeight: 600,
              color: 'var(--color-muted-text)',
            }}
          >
            {supportingText}
          </p>
        </div>

        {/* Bubsy Child-Safe Feedback Banner */}
        <div
          role="status"
          aria-live="polite"
          style={{
            width: '100%',
            maxWidth: '640px',
            padding: '16px 24px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#f0fdf4',
            border: `2px solid ${feedbackColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <Sparkles size={24} color={feedbackColor} />
          <span
            style={{
              fontSize: isLargeText ? '22px' : '19px',
              fontWeight: 800,
              color: feedbackColor,
            }}
          >
            {feedbackText}
          </span>
        </div>

        {/* Finish Session Action Button */}
        <Button
          variant="primary"
          size="kiosk"
          onClick={onFinishSession}
          loading={isLoading}
          icon={stepNumber >= totalSteps ? <CheckCircle2 size={26} /> : <ArrowRight size={26} />}
          iconPosition="right"
          style={{
            minHeight: '64px',
            minWidth: '280px',
            fontSize: isLargeText ? '22px' : '20px',
          }}
        >
          {stepNumber >= totalSteps ? "I'M ALL DONE!" : 'NEXT STEP'}
        </Button>
      </Card>
    </div>
  );
};
