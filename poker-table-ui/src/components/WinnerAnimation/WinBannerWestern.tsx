import React from 'react';
import styles from './win_banner_western.module.css';

interface WinBannerWesternProps {
  winnerName: string;
  winningHand?: string;
  potAmount: number;
  winType: 'showdown' | 'fold';
}

/**
 * Western-themed win banner with cowgirl dealer character
 * Features wooden sign board and celebratory animations
 */
const WinBannerWestern: React.FC<WinBannerWesternProps> = ({
  winnerName,
  winningHand,
  potAmount,
  winType,
}) => {
  return (
    <div className={styles.westernWinBanner}>
      {/* Cowgirl Dealer Character (Emoji-based) */}
      <div className={styles.dealerCharacter}>
        <div className={styles.characterBody}>
          {/* Cowboy Hat */}
          <div className={styles.cowboyHat}>🤠</div>
          
          {/* Dealer Face */}
          <div className={styles.dealerFace}>
            <div className={styles.face}>👩‍🦰</div>
          </div>
          
          {/* Arms holding sign (decorative) */}
          <div className={styles.arms}>
            <span className={styles.leftArm}>👈</span>
            <span className={styles.rightArm}>👉</span>
          </div>
        </div>
      </div>

      {/* Wooden Sign Board */}
      <div className={styles.winSignBoard}>
        {/* Rope decoration at top corners */}
        <div className={styles.ropeLeft}>🪢</div>
        <div className={styles.ropeRight}>🪢</div>
        
        {/* Sign Header */}
        <div className={styles.signHeader}>
          <span className={styles.trophy}>🏆</span>
          <span className={styles.headerText}>WINNER!</span>
          <span className={styles.trophy}>🏆</span>
        </div>

        {/* Sign Content Card */}
        <div className={styles.signContent}>
          <h2 className={styles.winnerName}>{winnerName}</h2>
          
          {winType === 'showdown' && winningHand ? (
            <p className={styles.winDescription}>
              wins with{' '}
              <span className={styles.handHighlight}>{winningHand}</span>!
            </p>
          ) : (
            <p className={styles.winDescription}>
              wins by fold!
            </p>
          )}

          {/* Pot Amount - Big and Prominent */}
          <div className={styles.potAmount}>
            ${potAmount.toLocaleString()}
          </div>
        </div>

        {/* Sign Footer */}
        <div className={styles.signFooter}>
          🎰 ★ 🃏 ★ 🎰
        </div>
      </div>

      {/* Sparkles for big wins */}
      {potAmount >= 500 && (
        <div className={styles.sparkles}>
          <span className={styles.sparkle} style={{ left: '10%', animationDelay: '0s' }}>✨</span>
          <span className={styles.sparkle} style={{ left: '25%', animationDelay: '0.2s' }}>⭐</span>
          <span className={styles.sparkle} style={{ left: '75%', animationDelay: '0.4s' }}>✨</span>
          <span className={styles.sparkle} style={{ left: '90%', animationDelay: '0.6s' }}>⭐</span>
        </div>
      )}
    </div>
  );
};

export default WinBannerWestern;
