import React, { useState, useCallback } from 'react';
import styles from './lobby.module.css';
import { api } from '../../config/api';

interface CreateLobbyProps {
  onLobbyCreated: (lobbyCode: string) => void;
  onCancel: () => void;
}

const BUY_IN_OPTIONS = [
  { value: 10, label: '$10' },
  { value: 50, label: '$50' },
  { value: 100, label: '$100' },
  { value: 500, label: '$500' },
  { value: 1000, label: '$1,000' },
];

const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];

export const CreateLobby: React.FC<CreateLobbyProps> = ({ onLobbyCreated, onCancel }) => {
  const [lobbyName, setLobbyName] = useState('');
  const [buyIn, setBuyIn] = useState(100);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    console.log('🎯 Creating lobby:', { lobbyName, buyIn, maxPlayers });

    try {
      // Get Telegram initData if available
      const initData = (window as any).Telegram?.WebApp?.initData || '';

      const response = await fetch(api.lobby.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobbyName: lobbyName || undefined,
          buyIn,
          maxPlayers,
          initData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create lobby');
      }

      console.log('✅ Lobby created:', data);
      onLobbyCreated(data.lobbyCode);
    } catch (err) {
      console.error('❌ Error creating lobby:', err);
      setError(err instanceof Error ? err.message : 'Failed to create lobby');
    } finally {
      setIsLoading(false);
    }
  }, [lobbyName, buyIn, maxPlayers, onLobbyCreated]);

  return (
    <div className={styles.createLobbyOverlay}>
      <div className={styles.createLobbyModal}>
        <h2 className={styles.modalTitle}>🎰 Create Private Game</h2>
        
        <form onSubmit={handleSubmit} className={styles.createForm}>
          {/* Lobby Name */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Game Name (optional)</label>
            <input
              type="text"
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder="My Poker Night"
              className={styles.formInput}
              maxLength={50}
            />
          </div>

          {/* Buy-in */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>💰 Buy-in</label>
            <div className={styles.buyInOptions}>
              {BUY_IN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.buyInButton} ${buyIn === option.value ? styles.buyInButtonActive : ''}`}
                  onClick={() => setBuyIn(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Players */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>👥 Max Players</label>
            <div className={styles.maxPlayersOptions}>
              {MAX_PLAYERS_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`${styles.maxPlayersButton} ${maxPlayers === num ? styles.maxPlayersButtonActive : ''}`}
                  onClick={() => setMaxPlayers(num)}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorMessage}>
              ❌ {error}
            </div>
          )}

          {/* Buttons */}
          <div className={styles.formButtons}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.createButton}
              disabled={isLoading}
            >
              {isLoading ? '⏳ Creating...' : '🚀 Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLobby;
