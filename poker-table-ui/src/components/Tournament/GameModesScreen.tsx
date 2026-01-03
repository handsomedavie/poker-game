import React, { useState } from 'react';
import { TournamentLobby } from './TournamentLobby';
import styles from './gameModes.module.css';

interface GameModesScreenProps {
  telegramId: number;
  username?: string;
  firstName: string;
  onBack: () => void;
  onJoinTable: (tournamentId: string, tableId: string) => void;
  onPrivateGame: () => void;
}

type GameMode = 'select' | 'tournament' | 'bounty' | 'sitgo';

export const GameModesScreen: React.FC<GameModesScreenProps> = ({
  telegramId,
  username,
  firstName,
  onBack,
  onJoinTable,
  onPrivateGame,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('select');

  // If a mode is selected, show the lobby for that mode
  if (selectedMode !== 'select') {
    return (
      <TournamentLobby
        mode={selectedMode}
        telegramId={telegramId}
        username={username}
        firstName={firstName}
        onBack={() => setSelectedMode('select')}
        onJoinTable={onJoinTable}
      />
    );
  }

  // Mode selection screen
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h1 className={styles.title}>🎰 Game Modes</h1>
      </div>

      <p className={styles.subtitle}>Choose your preferred poker format</p>

      {/* Game Mode Cards */}
      <div className={styles.modesGrid}>
        {/* Tournament */}
        <div 
          className={styles.modeCard}
          onClick={() => setSelectedMode('tournament')}
        >
          <div className={styles.modeIconWrapper}>
            <span className={styles.modeIcon}>🏆</span>
          </div>
          <div className={styles.modeContent}>
            <h2 className={styles.modeName}>Tournament</h2>
            <p className={styles.modeDescription}>
              Multi-table tournaments with increasing blinds. 
              Compete against many players for big prize pools!
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>📊 Multiple Tables</span>
              <span className={styles.feature}>⏱️ Blind Levels</span>
              <span className={styles.feature}>💰 Prize Pool</span>
            </div>
          </div>
          <div className={styles.modeArrow}>→</div>
        </div>

        {/* Bounty Hunter */}
        <div 
          className={styles.modeCard}
          onClick={() => setSelectedMode('bounty')}
        >
          <div className={`${styles.modeIconWrapper} ${styles.bounty}`}>
            <span className={styles.modeIcon}>🎯</span>
          </div>
          <div className={styles.modeContent}>
            <h2 className={styles.modeName}>Bounty Hunter</h2>
            <p className={styles.modeDescription}>
              Progressive Knockout (PKO) format. Win bounties for eliminating players - 
              50% cash, 50% added to your bounty!
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>🎯 Bounties</span>
              <span className={styles.feature}>💵 Instant Cash</span>
              <span className={styles.feature}>🔥 Action Packed</span>
            </div>
          </div>
          <div className={styles.modeArrow}>→</div>
        </div>

        {/* Sit & Go */}
        <div 
          className={styles.modeCard}
          onClick={() => setSelectedMode('sitgo')}
        >
          <div className={`${styles.modeIconWrapper} ${styles.sitgo}`}>
            <span className={styles.modeIcon}>⚡</span>
          </div>
          <div className={styles.modeContent}>
            <h2 className={styles.modeName}>Sit & Go</h2>
            <p className={styles.modeDescription}>
              Fast single-table tournaments. Start immediately when the table fills up. 
              Perfect for quick games!
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>⚡ Quick Start</span>
              <span className={styles.feature}>👥 6-9 Players</span>
              <span className={styles.feature}>🕐 15-60 min</span>
            </div>
          </div>
          <div className={styles.modeArrow}>→</div>
        </div>

        {/* Private Game */}
        <div 
          className={`${styles.modeCard} ${styles.privateCard}`}
          onClick={onPrivateGame}
        >
          <div className={`${styles.modeIconWrapper} ${styles.private}`}>
            <span className={styles.modeIcon}>🔐</span>
          </div>
          <div className={styles.modeContent}>
            <h2 className={styles.modeName}>Private Game</h2>
            <p className={styles.modeDescription}>
              Create or join a private table with friends using a lobby code. 
              Customize your own game settings!
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>👥 With Friends</span>
              <span className={styles.feature}>🔑 Invite Code</span>
              <span className={styles.feature}>⚙️ Custom Rules</span>
            </div>
          </div>
          <div className={styles.modeArrow}>→</div>
        </div>
      </div>

      {/* Info Section */}
      <div className={styles.infoSection}>
        <h3 className={styles.infoTitle}>💡 How it works</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoNumber}>1</span>
            <span className={styles.infoText}>Choose a game mode</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoNumber}>2</span>
            <span className={styles.infoText}>Register for a tournament</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoNumber}>3</span>
            <span className={styles.infoText}>Wait for the game to start</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoNumber}>4</span>
            <span className={styles.infoText}>Play and win prizes!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameModesScreen;
