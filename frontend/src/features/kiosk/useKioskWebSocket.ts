import { useEffect, useRef } from 'react';
import type { KioskChildSafeEvent } from '../../types/kiosk';
import { getKioskWebSocketUrl } from '../../services/api';

export interface UseKioskWebSocketProps {
  sessionId: string | null;
  isActive: boolean;
  onEvent: (event: KioskChildSafeEvent) => void;
  onError?: (err: Event) => void;
}

export function useKioskWebSocket({
  sessionId,
  isActive,
  onEvent,
  onError,
}: UseKioskWebSocketProps): void {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId || !isActive) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const wsUrl = getKioskWebSocketUrl(sessionId);
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const parsed: KioskChildSafeEvent = JSON.parse(event.data);
          onEvent(parsed);
        } catch {
          // Ignore invalid non-JSON frames
        }
      };

      socket.onerror = (err) => {
        if (onError) onError(err);
      };

      socket.onclose = () => {
        wsRef.current = null;
      };
    } catch (err) {
      // WebSocket initialization failure
      if (onError && err instanceof Event) onError(err);
    }

    return () => {
      if (socket) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [sessionId, isActive, onEvent, onError]);
}
