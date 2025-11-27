import React from 'react';
import styles from './hand_strength_hud.module.css';
import type { HandRank } from '../../utils/handEvaluator';

interface HandStrengthHUDProps {
  handRank: HandRank | null;
  description: string;
}

const HandStrengthHUD: React.FC<HandStrengthHUDProps> = ({ handRank, description }) => {
  if (!handRank) return null;

  // Map hand ranks to colors and icons
  const getRankColor = (rank: HandRank): string => {
    switch (rank) {
      case 'Royal Flush':
      case 'Straight Flush':
        return styles.legendary;
      case 'Four of a Kind':
      case 'Full House':
        return styles.epic;
      case 'Flush':
      case 'Straight':
        return styles.rare;
      case 'Three of a Kind':
      case 'Two Pair':
        return styles.uncommon;
      case 'Pair':
      case 'High Card':
        return styles.common;
      default:
        return styles.common;
    }
  };

  const getRankIcon = (rank: HandRank): string => {
    switch (rank) {
      case 'Royal Flush':
        return '👑';
      case 'Straight Flush':
        return '💎';
      case 'Four of a Kind':
        return '🔥';
      case 'Full House':
        return '🏠';
      case 'Flush':
        return '♠️';
      case 'Straight':
        return '📊';
      case 'Three of a Kind':
        return '🎯';
      case 'Two Pair':
        return '👥';
      case 'Pair':
        return '🎲';
      case 'High Card':
        return '🃏';
      default:
        return '🃏';
    }
  };

  const colorClass = getRankColor(handRank);
  const icon = getRankIcon(handRank);

  return (
    <div className={`${styles.hudContainer} ${colorClass}`}>
      <div className={styles.hudIcon}>{icon}</div>
      <div className={styles.hudContent}>
        <div className={styles.hudRank}>{handRank}</div>
        <div className={styles.hudDescription}>{description}</div>
      </div>
    </div>
  );
};

export default HandStrengthHUD;
