import React from 'react';
import styles from './win_banner_compact.module.css';

interface WinBannerCompactProps {
  winnerName: string;
  potAmount: number;
}

/**
 * Compact win banner matching card back design
 * Simple, elegant, royal blue styling
 */
const WinBannerCompact: React.FC<WinBannerCompactProps> = ({
  winnerName,
  potAmount,
}) => {
  return (
    <div className={styles.winBannerCompact}>
      {/* Header */}
      <div className={styles.winHeader}>
        🏆 WINNER! 🏆
      </div>

      {/* Winner Name */}
      <div className={styles.winPlayerName}>
        {winnerName}
      </div>

      {/* Pot Amount */}
      <div className={styles.winPotAmount}>
        ${potAmount.toLocaleString()}
      </div>
    </div>
  );
};

export default WinBannerCompact;
