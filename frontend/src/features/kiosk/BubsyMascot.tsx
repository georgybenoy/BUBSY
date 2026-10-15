import React from 'react';

export type MascotMood = 'waving' | 'searching' | 'ready' | 'washing' | 'celebrating' | 'comforting';

export interface BubsyMascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const BubsyMascot: React.FC<BubsyMascotProps> = ({
  mood = 'waving',
  size = 140,
  className = '',
  style,
}) => {
  return (
    <div
      className={`bubsy-mascot ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0px 8px 16px rgba(37, 99, 235, 0.18))',
        ...style,
      }}
      aria-label={`Bubsy mascot is ${mood}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft Background Bubble Glow */}
        <circle cx="80" cy="80" r="72" fill="#eff6ff" />
        <circle cx="120" cy="40" r="14" fill="#dbeafe" opacity="0.8" />
        <circle cx="34" cy="50" r="8" fill="#dbeafe" opacity="0.6" />
        <circle cx="126" cy="118" r="10" fill="#bfdbfe" opacity="0.7" />

        {/* Mascot Body: Friendly Rounded Water Drop / Bear Bubble */}
        <path
          d="M80 20C50 20 30 46 30 82C30 114 52 136 80 136C108 136 130 114 130 82C130 46 110 20 80 20Z"
          fill="#3b82f6"
        />
        {/* Lighter Belly Patch */}
        <ellipse cx="80" cy="94" rx="34" ry="28" fill="#93c5fd" />

        {/* Ears / Bubbles */}
        <circle cx="42" cy="36" r="16" fill="#2563eb" />
        <circle cx="42" cy="36" r="9" fill="#bfdbfe" />
        <circle cx="118" cy="36" r="16" fill="#2563eb" />
        <circle cx="118" cy="36" r="9" fill="#bfdbfe" />

        {/* Big Bright Expressive Eyes */}
        <circle cx="62" cy="72" r="10" fill="#0f172a" />
        <circle cx="65" cy="69" r="3.5" fill="#ffffff" />
        <circle cx="60" cy="74" r="1.5" fill="#ffffff" />

        <circle cx="98" cy="72" r="10" fill="#0f172a" />
        <circle cx="101" cy="69" r="3.5" fill="#ffffff" />
        <circle cx="96" cy="74" r="1.5" fill="#ffffff" />

        {/* Rosy Cheeks */}
        <circle cx="48" cy="84" r="7" fill="#f472b6" opacity="0.75" />
        <circle cx="112" cy="84" r="7" fill="#f472b6" opacity="0.75" />

        {/* Mouth depending on mood */}
        {mood === 'celebrating' && (
          <>
            <path
              d="M68 88C68 98 92 98 92 88H68Z"
              fill="#ef4444"
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            {/* Celebration Party Stars */}
            <path d="M78 8Q80 0 82 8Q90 10 82 12Q80 20 78 12Q70 10 78 8Z" fill="#fbbf24" />
          </>
        )}
        {mood === 'waving' && (
          <path
            d="M72 88C72 96 88 96 88 88"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        {mood === 'searching' && (
          <path
            d="M74 90C78 93 82 93 86 90"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {mood === 'ready' && (
          <path
            d="M70 86C70 96 90 96 90 86"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        {mood === 'washing' && (
          <>
            <path
              d="M72 88C72 95 88 95 88 88"
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Soap bubbles on paws */}
            <circle cx="68" cy="116" r="6" fill="#ffffff" opacity="0.85" />
            <circle cx="92" cy="116" r="8" fill="#ffffff" opacity="0.85" />
            <circle cx="80" cy="120" r="5" fill="#ffffff" opacity="0.9" />
          </>
        )}
        {mood === 'comforting' && (
          <path
            d="M74 92C78 89 82 89 86 92"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}

        {/* Waving Paw for waving mood */}
        {mood === 'waving' && (
          <g>
            <path
              d="M120 78C132 68 142 56 142 46C142 40 134 40 128 46C122 52 116 66 116 72"
              fill="#2563eb"
            />
            <circle cx="140" cy="44" r="6" fill="#60a5fa" />
          </g>
        )}

        {/* Soapy Hands for washing mood */}
        {mood === 'washing' && (
          <g>
            <path
              d="M54 110C64 104 96 104 106 110C96 122 64 122 54 110Z"
              fill="#60a5fa"
              stroke="#2563eb"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
