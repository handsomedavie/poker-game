import React, { useEffect, useState } from 'react';
import styles from './winner_animation.module.css';
import WinBannerCompact from './WinBannerCompact';

export interface WinnerData {
  winners: string[]; // Player IDs
  winType: 'showdown' | 'fold';
  potAmount: number;
  potPerWinner: number;
  winningHand?: {
    rank: string;
    name: string;
    cards: Array<{ rank: string; suit: string }>;
  };
  allHandsRevealed?: Array<{
    playerId: string;
    hand: { rank: string; name: string };
    cards: Array<{ rank: string; suit: string }>;
  }>;
}

interface WinnerAnimationProps {
  winnerData: WinnerData;
  playerNames: Record<string, string>; // Map player ID to name
  onComplete: () => void;
  currentUserId?: string;
}

/**
 * Multi-stage winner animation sequence:
 * 1. Reveal all player cards (1s)
 * 2. Highlight winner(s) with golden glow (0.5s)
 * 3. Show winning hand text (1s)
 * 4. Animate chips flying to winner (1.5s)
 * 5. Celebration effect if current user won (2s)
 * Total: ~6 seconds
 */
const WinnerAnimation: React.FC<WinnerAnimationProps> = ({
  winnerData,
  playerNames,
  onComplete,
  currentUserId,
}) => {
  const [stage, setStage] = useState<'reveal' | 'highlight' | 'winText' | 'chips' | 'celebrate' | 'done'>('reveal');
  const [isUserWinner, setIsUserWinner] = useState(false);

  useEffect(() => {
    // Check if current user is a winner
    const userWon = currentUserId && winnerData.winners.includes(currentUserId);
    setIsUserWinner(!!userWon);

    // Stage timing - Total 3 seconds
    const timers: number[] = [];

    // Stage 1: Reveal cards (500ms)
    timers.push(setTimeout(() => setStage('highlight'), 500));

    // Stage 2: Highlight winners (250ms)
    timers.push(setTimeout(() => setStage('winText'), 750));

    // Stage 3: Show win text (1250ms)
    timers.push(setTimeout(() => setStage('chips'), 2000));

    // Stage 4: Chips animation (500ms)
    timers.push(setTimeout(() => setStage('celebrate'), 2500));

    // Stage 5: Complete (500ms) - Total 3 seconds
    timers.push(setTimeout(() => {
      setStage('done');
      onComplete();
    }, 3000));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [winnerData, currentUserId, onComplete]);

  const getWinnerNames = () => {
    return winnerData.winners.map(id => playerNames[id] || 'Unknown').join(' & ');
  };

  return (
    <div className={styles.winnerAnimationOverlay}>
      {/* Stage 2-3: Compact Winner Banner (Royal Blue Style) */}
      {(stage === 'highlight' || stage === 'winText' || stage === 'chips' || stage === 'celebrate') && (
        <WinBannerCompact
          winnerName={getWinnerNames()}
          potAmount={winnerData.potAmount}
        />
      )}

      {/* Stage 5: Celebration Effect */}
      {stage === 'celebrate' && isUserWinner && (
        <div className={styles.celebrationContainer}>
          <div className={styles.celebrationText}>YOU WIN!</div>
          <div className={styles.confettiContainer}>
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className={styles.confetti}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'][Math.floor(Math.random() * 5)],
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WinnerAnimation;
export type { WinnerAnimationProps };
