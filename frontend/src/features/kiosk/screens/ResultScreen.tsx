import React from 'react';
import { Award, CheckCircle, Trophy } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { BubsyMascot } from '../BubsyMascot';
import type { KioskCompleteSessionData } from '../../../types/kiosk';

export interface ResultScreenProps {
  completionData: KioskCompleteSessionData | null;
  isUnassigned: boolean;
  onDone: () => void;
  onViewProgress: () => void;
  isLargeText: boolean;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  completionData,
  isUnassigned,
  onDone,
  onViewProgress,
  isLargeText,
}) => {
  const pointsAwarded = completionData?.points_awarded ?? 0;
  const isCompleted = completionData?.outcome === 'completed';
  const qualifies = completionData?.qualifies_for_points ?? false;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        maxWidth: '850px',
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
        <BubsyMascot mood={isCompleted ? 'celebrating' : 'comforting'} size={170} />

        {isCompleted ? (
          <>
            <h1
              style={{
                fontSize: isLargeText ? '44px' : '38px',
                fontWeight: 900,
                color: 'var(--color-primary)',
                marginTop: '16px',
                marginBottom: '8px',
              }}
            >
              You did it!
            </h1>

            {/* Points Awarded (From Backend Only) */}
            {qualifies && pointsAwarded > 0 ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 28px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: '#fef3c7',
                  border: '3px solid #f59e0b',
                  color: '#92400e',
                  fontSize: isLargeText ? '26px' : '22px',
                  fontWeight: 900,
                  marginTop: '12px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)',
                }}
              >
                <Trophy size={28} color="#d97706" />
                <span>You earned {pointsAwarded} Bubsy Points!</span>
              </div>
            ) : isUnassigned ? (
              <div
                style={{
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#eff6ff',
                  color: 'var(--color-primary)',
                  fontSize: isLargeText ? '20px' : '17px',
                  fontWeight: 700,
                  marginTop: '12px',
                  marginBottom: '16px',
                }}
              >
                Super clean hands! Next time, scan your card to collect Bubsy Points!
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  fontSize: isLargeText ? '20px' : '17px',
                  fontWeight: 700,
                  marginTop: '12px',
                  marginBottom: '16px',
                }}
              >
                Great handwashing practice today!
              </div>
            )}

            <p
              style={{
                fontSize: isLargeText ? '22px' : '19px',
                color: 'var(--color-muted-text)',
                fontWeight: 700,
                marginBottom: '32px',
              }}
            >
              Clean hands, happy days!
            </p>
          </>
        ) : (
          /* Supportive feedback for incomplete / unverified sessions */
          <>
            <h1
              style={{
                fontSize: isLargeText ? '36px' : '32px',
                fontWeight: 900,
                color: 'var(--color-primary)',
                marginTop: '16px',
                marginBottom: '8px',
              }}
            >
              Good effort!
            </h1>
            <p
              style={{
                fontSize: isLargeText ? '22px' : '18px',
                color: 'var(--color-muted-text)',
                fontWeight: 600,
                marginBottom: '28px',
                maxWidth: '520px',
              }}
            >
              Every wash helps build healthy habits. Let’s try rubbing through all 6 steps next time!
            </p>
          </>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {!isUnassigned && (
            <Button
              variant="secondary"
              size="kiosk"
              onClick={onViewProgress}
              icon={<Award size={26} />}
              style={{ minHeight: '68px', minWidth: '220px' }}
            >
              My Progress
            </Button>
          )}

          <Button
            variant="primary"
            size="kiosk"
            onClick={onDone}
            icon={<CheckCircle size={26} />}
            style={{ minHeight: '68px', minWidth: '220px' }}
          >
            DONE
          </Button>
        </div>
      </Card>
    </div>
  );
};
