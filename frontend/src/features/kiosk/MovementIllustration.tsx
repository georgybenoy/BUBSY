import React from 'react';
import { Droplets, Sparkles, Hand, HeartHandshake, Waves, Wind } from 'lucide-react';

export interface MovementIllustrationProps {
  stepCode: string;
  size?: number;
  className?: string;
}

export const MovementIllustration: React.FC<MovementIllustrationProps> = ({
  stepCode,
  size = 200,
  className = '',
}) => {
  const normalized = stepCode.toUpperCase();

  // Return specialized SVG/iconic visual representations
  let content: React.ReactNode;
  let bgGradient = 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)';
  let title = 'Wash your hands';

  if (normalized.includes('PREP_WET') || normalized === 'WET_HANDS') {
    bgGradient = 'linear-gradient(135deg, #bfdbfe 0%, #eff6ff 100%)';
    title = 'Wet hands with water';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <Waves size={size * 0.38} color="#2563eb" strokeWidth={2.5} />
        <Droplets size={size * 0.28} color="#0284c7" />
      </div>
    );
  } else if (normalized.includes('PREP_SOAP') || normalized === 'APPLY_SOAP') {
    bgGradient = 'linear-gradient(135deg, #fce7f3 0%, #eff6ff 100%)';
    title = 'Apply soapy bubbles';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={size * 0.38} color="#ec4899" strokeWidth={2.5} />
        <span style={{ fontSize: `${size * 0.14}px`, fontWeight: 800, color: '#be185d' }}>
          🫧 Lots of bubbles!
        </span>
      </div>
    );
  } else if (normalized.includes('STEP_1') || normalized.includes('PALM_TO_PALM')) {
    title = 'Palm to palm rubbing';
    content = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Hand size={size * 0.35} color="#2563eb" strokeWidth={2.5} style={{ transform: 'scaleX(-1)' }} />
        <Hand size={size * 0.35} color="#3b82f6" strokeWidth={2.5} />
      </div>
    );
  } else if (normalized.includes('STEP_2') || normalized.includes('BACK_OF_HANDS')) {
    title = 'Back of hands rubbing';
    content = (
      <div style={{ position: 'relative', width: `${size * 0.6}px`, height: `${size * 0.6}px` }}>
        <Hand size={size * 0.38} color="#2563eb" strokeWidth={2.5} style={{ position: 'absolute', top: 0, left: '10%' }} />
        <Hand
          size={size * 0.38}
          color="#60a5fa"
          strokeWidth={2.5}
          style={{ position: 'absolute', bottom: 0, right: '10%', opacity: 0.85 }}
        />
      </div>
    );
  } else if (normalized.includes('STEP_3') || normalized.includes('BETWEEN_FINGERS')) {
    title = 'Rub between fingers';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <HeartHandshake size={size * 0.42} color="#2563eb" strokeWidth={2.5} />
        <span style={{ fontSize: `${size * 0.11}px`, fontWeight: 700, color: '#1e40af' }}>
          Interlace fingers
        </span>
      </div>
    );
  } else if (normalized.includes('STEP_4') || normalized.includes('BACK_OF_FINGERS')) {
    title = 'Back of fingers interlocking';
    content = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Hand size={size * 0.35} color="#1d4ed8" strokeWidth={2.5} style={{ transform: 'rotate(45deg)' }} />
        <Hand size={size * 0.35} color="#3b82f6" strokeWidth={2.5} style={{ transform: 'rotate(-45deg)' }} />
      </div>
    );
  } else if (normalized.includes('STEP_5') || normalized.includes('THUMBS')) {
    title = 'Rub around thumbs';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Hand size={size * 0.38} color="#2563eb" strokeWidth={2.5} />
        <span style={{ fontSize: `${size * 0.12}px`, fontWeight: 800, color: '#1d4ed8' }}>
          👍 Both thumbs!
        </span>
      </div>
    );
  } else if (normalized.includes('STEP_6') || normalized.includes('FINGERNAILS')) {
    title = 'Fingernails and tips';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={size * 0.36} color="#0284c7" strokeWidth={2.5} />
        <span style={{ fontSize: `${size * 0.11}px`, fontWeight: 700, color: '#0369a1' }}>
          Circular in palms
        </span>
      </div>
    );
  } else if (normalized.includes('RINSE')) {
    title = 'Rinse clean';
    content = <Waves size={size * 0.4} color="#0284c7" strokeWidth={2.5} />;
  } else if (normalized.includes('DRY')) {
    title = 'Dry hands';
    content = <Wind size={size * 0.4} color="#0d9488" strokeWidth={2.5} />;
  } else {
    // Default friendly hand
    content = <Hand size={size * 0.4} color="#2563eb" strokeWidth={2.5} />;
  }

  return (
    <div
      className={`movement-illustration ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: 'var(--radius-lg)',
        background: bgGradient,
        border: '3px solid #bfdbfe',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
      }}
      role="img"
      aria-label={title}
    >
      {content}
    </div>
  );
};
