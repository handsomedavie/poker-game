import React, { useState, useEffect, useCallback } from 'react';
import { CreateLobby } from './CreateLobby';
import { LobbyRoom } from './LobbyRoom';
import styles from './lobby.module.css';
import { api } from '../../config/api';

type View = 'menu' | 'create' | 'lobby' | 'game';

interface LobbyPageProps {
  onBackToTable: () => void;
  onStartGame: (tableId: string) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ onBackToTable, onStartGame }) => {
  const [view, setView] = useState<View>('menu');
  const [currentLobbyCode, setCurrentLobbyCode] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Handle Telegram deep links on mount
  useEffect(() => {
    const checkDeepLink = async () => {
      console.log('🔗 Checking for Telegram deep link...');
      
      // Get start parameter from Telegram WebApp
      const tg = (window as any).Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;
      
      console.log('📦 Start parameter:', startParam);
      
      if (startParam && startParam.startsWith('lobby_')) {
        const lobbyCode = startParam.replace('lobby_', '').toUpperCase();
        console.log('🎯 Deep link detected! Lobby code:', lobbyCode);
        
        // Auto-join the lobby
        await handleAutoJoin(lobbyCode);
      }
    };

    checkDeepLink();
  }, []);

  // Auto-join lobby from deep link
  const handleAutoJoin = useCallback(async (lobbyCode: string) => {
    console.log('🚀 Auto-joining lobby:', lobbyCode);
    setIsJoining(true);
    setJoinError(null);

    try {
      const initData = (window as any).Telegram?.WebApp?.initData || '';

      const response = await fetch(api.lobby.join(lobbyCode), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to join lobby');
      }

      console.log('✅ Auto-joined lobby:', data);
      setCurrentLobbyCode(lobbyCode);
      setView('lobby');
    } catch (err) {
      console.error('❌ Error auto-joining:', err);
      setJoinError(err instanceof Error ? err.message : 'Failed to join lobby');
    } finally {
      setIsJoining(false);
    }
  }, []);

  // Handle lobby creation
  const handleLobbyCreated = useCallback((lobbyCode: string) => {
    console.log('✅ Lobby created:', lobbyCode);
    setCurrentLobbyCode(lobbyCode);
    setView('lobby');
  }, []);

  // Handle game start
  const handleGameStart = useCallback((gameSessionId: string) => {
    console.log('🎮 Game starting:', gameSessionId);
    // Navigate to the game table
    onStartGame(gameSessionId);
  }, [onStartGame]);

  // Handle leave lobby
  const handleLeaveLobby = useCallback(() => {
    setCurrentLobbyCode(null);
    setView('menu');
  }, []);

  // Loading state for deep link join
  if (isJoining) {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.loadingSpinner}>
          ⏳ Joining lobby...
        </div>
      </div>
    );
  }

  // Error from deep link join
  if (joinError && view === 'menu') {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.errorContainer}>
          <h2>❌ Could not join</h2>
          <p>{joinError}</p>
          <button onClick={() => setJoinError(null)} className={styles.leaveButton}>
            Try Again
          </button>
          <button onClick={onBackToTable} className={styles.leaveButton}>
            ← Back to Table
          </button>
        </div>
      </div>
    );
  }

  // Main menu
  if (view === 'menu') {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.menuContainer}>
          <h1 className={styles.menuTitle}>🎰 Private Games</h1>
          <p className={styles.menuSubtitle}>
            Create a private lobby and invite friends via Telegram!
          </p>

          <div className={styles.menuButtons}>
            <button
              onClick={() => setView('create')}
              className={styles.menuButton}
            >
              ➕ Create New Game
            </button>
            
            <button
              onClick={onBackToTable}
              className={styles.menuButtonSecondary}
            >
              🎯 Join Public Table
            </button>
          </div>

          <div className={styles.menuInfo}>
            <h3>How it works:</h3>
            <ol>
              <li>Create a private game</li>
              <li>Share the invite link with friends</li>
              <li>Friends click link to auto-join</li>
              <li>Host starts the game when ready</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Create lobby form
  if (view === 'create') {
    return (
      <CreateLobby
        onLobbyCreated={handleLobbyCreated}
        onCancel={() => setView('menu')}
      />
    );
  }

  // Lobby room (waiting for players)
  if (view === 'lobby' && currentLobbyCode) {
    return (
      <LobbyRoom
        lobbyCode={currentLobbyCode}
        onGameStart={handleGameStart}
        onLeave={handleLeaveLobby}
      />
    );
  }

  return null;
};

export default LobbyPage;
