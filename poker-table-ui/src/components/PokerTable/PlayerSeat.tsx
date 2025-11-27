import React, { useMemo } from 'react';
import type { PlayerSeatProps } from '../../types/player.types';
import styles from './poker_table.module.css';
import { Card } from '../cards/Card';

const positionClass: Record<PlayerSeatProps['position'], string> = {
  1: styles.seat1,
  2: styles.seat2,
  3: styles.seat3,
  4: styles.seat4,
  5: styles.seat5,
  6: styles.seat6,
};

const TIMER_PADDING = 2;
const TIMER_CORNER = 18;

const getTimerColor = (remainingMs: number, totalMs: number): string => {
  if (totalMs <= 0) {
    return '#10b981';
  }
  const ratio = remainingMs / totalMs;
  if (ratio > 0.5) {
    return '#10b981';
  }
  if (ratio > 0.2) {
    return '#f59e0b';
  }
  return '#ef4444';
};

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  position,
  layoutPosition,
  player,
  currentUserId,
  isActive,
  revealCards,
  isWinner,
  isHero,
  timeRemainingMs,
  actionTimeoutMs,
  highlightedCards,
}) => {
  const visualPosition = layoutPosition ?? position;
  
  // Debug winner highlight
  if (isWinner && player) {
    console.log(`🌟 PlayerSeat ${position} (${player.nickname}) has isWinner=true - applying seatWinner class!`);
  }
  
  const className = [
    styles.seat,
    positionClass[visualPosition],
    isHero ? styles.seatHero : '',
    isWinner ? styles.seatWinner : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!player) {
    return <div className={className}>Свободно</div>;
  }

  const isCurrentUser = player.id === currentUserId;
  const showCards = (player.hasCards || revealCards) && player.cards && player.cards.length > 0;
  const showTimer = Boolean(isActive && typeof timeRemainingMs === 'number' && actionTimeoutMs);
  const { dashOffset, timerColor, perimeter } = useMemo(() => {
    const width = 160;
    const height = 86;
    const corner = TIMER_CORNER;
    // Calculate perimeter of the rounded rectangle
    const straightSides = 2 * (width + height - 2 * corner);
    const cornerArcs = 2 * Math.PI * corner;
    const perimeterLength = straightSides + cornerArcs;
    if (!showTimer || !actionTimeoutMs) {
      return { dashOffset: perimeterLength, timerColor: '#10b981', perimeter: perimeterLength };
    }
    const totalMs = actionTimeoutMs;
    const remaining = Math.max(0, Math.min(timeRemainingMs ?? 0, totalMs));
    const ratio = totalMs > 0 ? remaining / totalMs : 0;
    const offset = perimeterLength * (1 - ratio);
    const color = getTimerColor(remaining, totalMs);
    return { dashOffset: offset, timerColor: color, perimeter: perimeterLength };
  }, [showTimer, timeRemainingMs, actionTimeoutMs]);

  const blindClasses = useMemo(() => {
    if (player.isSmallBlind) {
      return [styles.blindChip, styles.blindChipSmall, styles[`blindChipPos${visualPosition}`]];
    }
    if (player.isBigBlind) {
      return [styles.blindChip, styles.blindChipBig, styles[`blindChipPos${visualPosition}`]];
    }
    return null;
  }, [player.isSmallBlind, player.isBigBlind, visualPosition]);

  return (
    <div className={className}>
      {showTimer && (
        <div className={styles.seatTimerOverlay}>
          <svg className={styles.seatTimerSvg} viewBox="0 0 160 86">
            <rect
              className={styles.seatTimerPath}
              x={TIMER_PADDING}
              y={TIMER_PADDING}
              rx={TIMER_CORNER}
              ry={TIMER_CORNER}
              width={160 - TIMER_PADDING * 2}
              height={86 - TIMER_PADDING * 2}
              strokeDasharray={perimeter}
              strokeDashoffset={dashOffset}
              stroke={timerColor}
              strokeWidth={4}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 12px ${timerColor})` }}
            />
          </svg>
        </div>
      )}
      <div className={styles.seatAvatarWrapper}>
        <div className={styles.seatAvatar}>
          {player.nickname
            .split(' ')
            .map((p) => p[0]?.toUpperCase())
            .join('')
            .slice(0, 2)}
        </div>
        {player.isDealer && <div className={styles.dealerChip}>D</div>}
      </div>
      {blindClasses && (
        <div className={blindClasses.filter(Boolean).join(' ')}>
          <span>{player.isSmallBlind ? 'SB' : 'BB'}</span>
          {typeof player.blindAmount === 'number' && player.blindAmount > 0 && <strong>${player.blindAmount}</strong>}
        </div>
      )}
      <div className={styles.seatTextBlock}>
        <div className={styles.seatName}>{player.nickname}</div>
        <div className={styles.seatStack}>${player.stack.toLocaleString()}</div>
      </div>
      {isWinner && <div className={styles.winnerBadge}>WIN</div>}
      {showCards && (
        <div className={styles.seatCardsRow}>
          {player.cards?.map((card, idx) => {
            const isHighlighted = highlightedCards?.some(
              (hc) => hc.rank === card.rank && hc.suit === card.suit
            ) ?? false;
            const shouldShowEffect = isCurrentUser || revealCards;
            
            return (
              <Card
                key={idx}
                rank={card.rank}
                suit={card.suit}
                faceDown={!isCurrentUser && !revealCards}
                size="small"
                highlighted={isHighlighted && shouldShowEffect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
