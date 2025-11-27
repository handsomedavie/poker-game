import React, { useEffect, useState } from 'react';
import styles from './showdown_decision.module.css';

export interface ShowdownDecisionProps {
  onShowCards: (show: boolean) => void;
  autoHideSeconds?: number;
}

/**
 * ShowdownDecision Component
 * 
 * Displays after showdown when current player loses.
 * Gives player choice to reveal or hide (muck) their cards.
 * 
 * Poker Rules:
 * - Winner: Always shows cards (mandatory)
 * - Losers: Can choose to Show or Muck
 */
export const ShowdownDecision: React.FC<ShowdownDecisionProps> = ({
  onShowCards,
  autoHideSeconds = 10,
}) => {
  const [timeLeft, setTimeLeft] = useState(autoHideSeconds);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-muck after timeout
    const autoMuckTimer = setTimeout(() => {
      onShowCards(false); // Default to hiding cards
    }, autoHideSeconds * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(autoMuckTimer);
    };
  }, [autoHideSeconds, onShowCards]);

  const handleShow = () => {
    onShowCards(true);
  };

  const handleMuck = () => {
    onShowCards(false);
  };

  return (
    <div className={styles.showdownDecisionPanel}>
      <div className={styles.questionText}>
        You lost this hand. Reveal your cards?
      </div>
      
      <div className={styles.timer}>
        Auto-muck in {timeLeft}s
      </div>

      <div className={styles.buttonContainer}>
        <button 
          className={`${styles.decisionButton} ${styles.showButton}`}
          onClick={handleShow}
          title="Show your cards to all players"
        >
          <span className={styles.buttonIcon}>👁️</span>
          <span className={styles.buttonText}>SHOW</span>
        </button>
        
        <button 
          className={`${styles.decisionButton} ${styles.muckButton}`}
          onClick={handleMuck}
          title="Hide your cards (muck)"
        >
          <span className={styles.buttonIcon}>🙈</span>
          <span className={styles.buttonText}>MUCK</span>
        </button>
      </div>

      <div className={styles.hint}>
        Choose wisely - other players are watching
      </div>
    </div>
  );
};

export default ShowdownDecision;
