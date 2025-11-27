import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './lobby.module.css';
import { api, API_URL, WS_URL } from '../../config/api';

interface LobbyPlayer {
  telegramId: number;
  username: string | null;
  firstName: string;
  seatNumber: number;
  joinedAt: number;
  isReady: boolean;
}

interface LobbyData {
  id: string;
  lobbyCode: string;
  hostTelegramId: number;
  lobbyName: string;
  maxPlayers: number;
  buyIn: number;
  gameMode: string;
  status: string;
  playerCount: number;
  availableSeats: number;
  players: LobbyPlayer[];
  gameSessionId?: string;
}

interface LobbyRoomProps {
  lobbyCode: string;
  onGameStart: (gameSessionId: string) => void;
  onLeave: () => void;
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({ lobbyCode, onGameStart, onLeave }) => {
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const currentUserId = useRef<number | null>(null);

  // Get current Telegram user
  useEffect(() => {
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      currentUserId.current = tgUser.id;
    }
  }, []);

  // Fetch lobby data
  const fetchLobby = useCallback(async () => {
    console.log('📡 Fetching lobby:', lobbyCode);
    
    try {
      const response = await fetch(api.lobby.get(lobbyCode));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch lobby');
      }

      console.log('✅ Lobby data:', data);
      setLobby(data.lobby);
      setInviteLink(data.inviteLink);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching lobby:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lobby');
    } finally {
      setIsLoading(false);
    }
  }, [lobbyCode]);

  // Connect to WebSocket
  useEffect(() => {
    fetchLobby();

    const wsUrl = api.ws.lobby(lobbyCode);
    
    console.log('🔌 Connecting to lobby WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Lobby WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📩 Lobby WS message:', message);

        switch (message.type) {
          case 'lobbyState':
            setLobby(message.lobby);
            break;
          case 'playerJoined':
            setLobby(prev => {
              if (!prev) return prev;
              const exists = prev.players.some(p => p.telegramId === message.player.telegramId);
              if (exists) return prev;
              return {
                ...prev,
                players: [...prev.players, message.player],
                playerCount: message.playerCount,
                availableSeats: prev.maxPlayers - message.playerCount,
              };
            });
            break;
          case 'playerLeft':
            setLobby(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.filter(p => p.telegramId !== message.telegramId),
                playerCount: prev.playerCount - 1,
                availableSeats: prev.availableSeats + 1,
              };
            });
            break;
          case 'gameStarted':
            console.log('🎮 Game started:', message.gameSessionId);
            onGameStart(message.gameSessionId);
            break;
          case 'error':
            setError(message.message);
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔌 Lobby WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('❌ Lobby WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [lobbyCode, fetchLobby, onGameStart]);

  // Share invite link via Telegram
  const handleShare = useCallback(() => {
    if (!lobby) return;

    const shareMessage = 
      `🎰 Join my poker game!\n\n` +
      `🏷️ ${lobby.lobbyName}\n` +
      `💰 Buy-in: $${lobby.buyIn}\n` +
      `👥 ${lobby.playerCount}/${lobby.maxPlayers} players\n\n` +
      `👉 Tap to join!`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareMessage)}`;

    // Try Telegram WebApp API first
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      // Fallback to opening in new window
      window.open(shareUrl, '_blank');
    }

    console.log('📤 Sharing lobby invite');
  }, [lobby, inviteLink]);

  // Copy invite link
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log('📋 Copied invite link');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [inviteLink]);

  // Start game (host only)
  const handleStartGame = useCallback(async () => {
    if (!lobby) return;
    
    setIsStarting(true);
    console.log('🚀 Starting game...');

    try {
      const initData = (window as any).Telegram?.WebApp?.initData || '';

      const response = await fetch(api.lobby.start(lobbyCode), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start game');
      }

      console.log('✅ Game started:', data);
      // onGameStart will be called via WebSocket
    } catch (err) {
      console.error('❌ Error starting game:', err);
      setError(err instanceof Error ? err.message : 'Failed to start game');
      setIsStarting(false);
    }
  }, [lobby, lobbyCode]);

  // Check if current user is host
  const isHost = lobby && currentUserId.current === lobby.hostTelegramId;
  const canStart = lobby && lobby.playerCount >= 2 && lobby.status === 'waiting';

  if (isLoading) {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.loadingSpinner}>
          ⏳ Loading lobby...
        </div>
      </div>
    );
  }

  if (error && !lobby) {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.errorContainer}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button onClick={onLeave} className={styles.leaveButton}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!lobby) return null;

  return (
    <div className={styles.lobbyContainer}>
      <div className={styles.lobbyHeader}>
        <button onClick={onLeave} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.lobbyInfo}>
          <h1 className={styles.lobbyTitle}>{lobby.lobbyName}</h1>
          <div className={styles.lobbyCode}>
            Code: <span>{lobby.lobbyCode}</span>
          </div>
        </div>
      </div>

      <div className={styles.lobbyStats}>
        <div className={styles.stat}>
          <span className={styles.statIcon}>💰</span>
          <span className={styles.statValue}>${lobby.buyIn}</span>
          <span className={styles.statLabel}>Buy-in</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statIcon}>👥</span>
          <span className={styles.statValue}>{lobby.playerCount}/{lobby.maxPlayers}</span>
          <span className={styles.statLabel}>Players</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statIcon}>🎮</span>
          <span className={styles.statValue}>{lobby.gameMode}</span>
          <span className={styles.statLabel}>Mode</span>
        </div>
      </div>

      {/* Player List */}
      <div className={styles.playerList}>
        <h3 className={styles.playerListTitle}>Players</h3>
        {lobby.players.map((player) => (
          <div key={player.telegramId} className={styles.playerItem}>
            <div className={styles.playerAvatar}>
              {player.firstName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>
                {player.firstName}
                {player.telegramId === lobby.hostTelegramId && (
                  <span className={styles.hostBadge}>👑 Host</span>
                )}
              </span>
              {player.username && (
                <span className={styles.playerUsername}>@{player.username}</span>
              )}
            </div>
            <div className={styles.playerSeat}>
              Seat {player.seatNumber}
            </div>
          </div>
        ))}

        {/* Empty Seats */}
        {Array.from({ length: lobby.availableSeats }).map((_, i) => (
          <div key={`empty-${i}`} className={`${styles.playerItem} ${styles.emptySeat}`}>
            <div className={styles.emptyAvatar}>?</div>
            <span className={styles.emptyText}>Waiting for player...</span>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBanner}>
          ❌ {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.lobbyActions}>
        <button onClick={handleShare} className={styles.inviteButton}>
          📤 Invite Friends
        </button>
        
        <button onClick={handleCopyLink} className={styles.copyButton}>
          {copied ? '✅ Copied!' : '📋 Copy Link'}
        </button>

        {isHost && (
          <button
            onClick={handleStartGame}
            className={`${styles.startButton} ${!canStart ? styles.startButtonDisabled : ''}`}
            disabled={!canStart || isStarting}
          >
            {isStarting ? '⏳ Starting...' : '🚀 Start Game'}
          </button>
        )}

        {!isHost && (
          <div className={styles.waitingMessage}>
            ⏳ Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  );
};

export default LobbyRoom;
