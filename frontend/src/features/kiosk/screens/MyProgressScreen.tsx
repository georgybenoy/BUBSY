import React from 'react';
import { Trophy, Award, CheckCircle2, ArrowLeft, Star } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import type { KioskStudentProgress } from '../../../types/kiosk';

export interface MyProgressScreenProps {
  progressData: KioskStudentProgress | null;
  onBackToHome: () => void;
  isLargeText: boolean;
}

export const MyProgressScreen: React.FC<MyProgressScreenProps> = ({
  progressData,
  onBackToHome,
  isLargeText,
}) => {
  const points = progressData?.monthly_points ?? 0;
  const sessions = progressData?.qualifying_sessions ?? 0;
  const badges = progressData?.badges ?? [];
  const handle = progressData?.display_handle || 'Handwasher';
  const nextAchievement = progressData?.next_achievement;

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
          My Handwashing Journey
        </span>

        <h1
          style={{
            fontSize: isLargeText ? '38px' : '32px',
            fontWeight: 900,
            color: 'var(--color-dark-text)',
            marginBottom: '24px',
          }}
        >
          Great work, {handle}!
        </h1>

        {/* Aggregate Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            width: '100%',
            marginBottom: '32px',
          }}
        >
          {/* Monthly Points */}
          <div
            style={{
              padding: '24px 16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#fef3c7',
              border: '2px solid #fde68a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Trophy size={36} color="#d97706" style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '36px', fontWeight: 900, color: '#92400e' }}>{points}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#b45309' }}>Monthly Points</span>
          </div>

          {/* Qualifying Washes */}
          <div
            style={{
              padding: '24px 16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#ecfdf5',
              border: '2px solid #a7f3d0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <CheckCircle2 size={36} color="#059669" style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '36px', fontWeight: 900, color: '#065f46' }}>{sessions}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#047857' }}>
              Clean Washes This Month
            </span>
          </div>

          {/* Badges Count */}
          <div
            style={{
              padding: '24px 16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#eff6ff',
              border: '2px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Award size={36} color="#2563eb" style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '36px', fontWeight: 900, color: '#1e40af' }}>{badges.length}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8' }}>
              Badges Collected
            </span>
          </div>
        </div>

        {/* Badges Collection Showcase */}
        <div style={{ width: '100%', marginBottom: '32px', textAlign: 'left' }}>
          <h2
            style={{
              fontSize: isLargeText ? '24px' : '20px',
              fontWeight: 800,
              color: 'var(--color-dark-text)',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            Your Badges
          </h2>

          {badges.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              {badges.map((badge) => (
                <div
                  key={badge.achievement_id}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#ffffff',
                    border: '2px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Star size={28} color="#f59e0b" fill="#f59e0b" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-dark-text)' }}>
                      {badge.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                      {badge.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#f8fafc',
                textAlign: 'center',
                color: 'var(--color-muted-text)',
                fontWeight: 600,
              }}
            >
              Keep washing each day to unlock your first Bubsy Badge!
            </div>
          )}
        </div>

        {/* Progress Toward Next Target */}
        {nextAchievement && (
          <div
            style={{
              padding: '16px 24px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--color-border)',
              width: '100%',
              marginBottom: '32px',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
              Next Goal: {nextAchievement.name} ({nextAchievement.points_remaining} points left)
            </span>
          </div>
        )}

        {/* Done / Return Action */}
        <Button
          variant="primary"
          size="kiosk"
          onClick={onBackToHome}
          icon={<ArrowLeft size={24} />}
          style={{ minHeight: '68px', minWidth: '240px' }}
        >
          Back to Home
        </Button>
      </Card>
    </div>
  );
};
