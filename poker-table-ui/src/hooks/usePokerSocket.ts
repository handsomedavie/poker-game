import { useCallback, useEffect, useRef, useState } from 'react';
import { SERVER_WS_URL } from '../config/env';
import type { CurrentUserProfile, ServerTableState } from '../types/server.types';
import { fetchCurrentUser } from '../services/userService';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface UsePokerSocketResult {
  currentUser: CurrentUserProfile | null;
  tableState: ServerTableState | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  sendAction: (command: string, payload?: Record<string, unknown>) => void;
  socket: WebSocket | null;
}

const buildWsUrl = (base: string, tableId: string, user: CurrentUserProfile) => {
  const sanitizedBase = base.replace(/\/$/, '');
  const params = new URLSearchParams({
    user_id: user.userId,
    display_name: user.displayName,
  });
  return `${sanitizedBase}/ws/tables/${tableId}?${params.toString()}`;
};

export const usePokerSocket = (tableId: string): UsePokerSocketResult => {
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);
  const [tableState, setTableState] = useState<ServerTableState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const profile = await fetchCurrentUser();
        if (!cancelled) {
          setCurrentUser(profile);
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
        if (!cancelled) {
          setError('Не удалось получить профиль игрока');
          setConnectionStatus('error');
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    const url = buildWsUrl(SERVER_WS_URL, tableId, currentUser);
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'state') {
          setTableState(message.payload as ServerTableState);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    socket.onerror = (event) => {
      console.error('WebSocket error', event);
      setError('Ошибка подключения к серверу');
      setConnectionStatus('error');
    };

    socket.onclose = () => {
      setConnectionStatus('idle');
    };

    return () => {
      socket.close();
    };
  }, [currentUser, tableId]);

  const sendAction = useCallback((command: string, payload: Record<string, unknown> = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: 'action',
        payload: {
          command,
          ...payload,
        },
      }),
    );
  }, []);

  return {
    currentUser,
    tableState,
    connectionStatus,
    error,
    sendAction,
    socket: socketRef.current,
  };
};
