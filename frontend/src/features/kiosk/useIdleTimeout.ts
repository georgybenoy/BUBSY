import { useEffect, useRef } from 'react';

/**
 * Automatically triggers onTimeout after idleDurationMs of no user activity.
 * Active only when isEnabled is true.
 */
export function useIdleTimeout(
  onTimeout: () => void,
  idleDurationMs = 25000,
  isEnabled = true,
): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, idleDurationMs);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => resetTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [onTimeout, idleDurationMs, isEnabled]);
}
