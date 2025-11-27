import React, { useState, useEffect } from 'react';
import styles from './poker_table.module.css';

export interface BettingControlsProps {
  minBet: number;
  maxBet: number;
  currentBet: number;
  onBetChange: (amount: number) => void;
  callAmount: number;
  onCall: () => void;
  onFold: () => void;
  onCheck: () => void;
  onRaise: () => void;
  canCheck: boolean;
  isActive: boolean;
  canRaise: boolean;
  onAllIn?: () => void;
  canAllIn?: boolean;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
  minBet,
  maxBet,
  currentBet,
  onBetChange,
  callAmount,
  onCall,
  onFold,
  onCheck,
  onRaise,
  canCheck,
  isActive,
  canRaise,
  onAllIn,
  canAllIn,
}) => {
  const [betAmount, setBetAmount] = useState<number>(minBet);
  const [isAllIn, setIsAllIn] = useState<boolean>(false);

  // Slider minimum is the min bet required (for bet/raise)
  const sliderMin = Math.max(minBet, 1);

  // Update bet amount when external currentBet changes or thresholds shift
  useEffect(() => {
    const clamped = Math.min(Math.max(currentBet, sliderMin), maxBet);
    setBetAmount(clamped);
    setIsAllIn(clamped === maxBet);
    if (clamped !== currentBet) {
      onBetChange(clamped);
    }
  }, [currentBet, sliderMin, maxBet, onBetChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBetAmount(value);
    onBetChange(value);
  };

  const handleQuickBet = (multiplier: number) => {
    const base = quickBase;
    const newBet = Math.min(Math.floor(base * multiplier), maxBet);
    setBetAmount(newBet);
    onBetChange(newBet);
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Calculate quick bet values
  const quickBase = Math.max(sliderMin, 1);
  const quickBets = [1, 1.5, 2, 3].map((mult) => ({
    label: `${mult}x`,
    value: Math.min(Math.floor(quickBase * mult), maxBet),
    isAllIn: Math.floor(quickBase * mult) >= maxBet
  }));

  const raiseDisabled = !isActive || !canRaise || betAmount < sliderMin || betAmount > maxBet || sliderMin > maxBet;

  // Get the appropriate button text based on the action
  const getActionButtonText = (): string => {
    if (callAmount === 0) {
      return canCheck ? 'Check' : 'Call';
    }
    return `Call $${formatNumber(callAmount)}`;
  };

  return (
    <div className={`${styles.bettingControls} ${!isActive ? styles.disabled : ''}`}>
      <div className={styles.betControlsRow}>
        {/* Action Buttons - Moved to top */}
        <div className={styles.actionButtons}>
          <button
            className={`${styles.actionButton} ${styles.fold}`}
            onClick={onFold}
            disabled={!isActive}
          >
            Fold
          </button>
          <button
            className={`${styles.actionButton} ${canCheck ? styles.check : styles.call}`}
            onClick={() => {
              if (canCheck) {
                onCheck();
              } else {
                onCall();
              }
            }}
            disabled={!isActive}
          >
            {getActionButtonText()}
          </button>
          <button
            className={`${styles.actionButton} ${styles.raise}`}
            onClick={onRaise}
            disabled={raiseDisabled}
          >
            {callAmount > 0 ? `Raise $${formatNumber(betAmount)}` : `Bet $${formatNumber(betAmount)}`}
          </button>
          {onAllIn && (
            <button
              className={`${styles.actionButton} ${styles.allIn}`}
              onClick={onAllIn}
              disabled={!isActive || canAllIn === false}
            >
              All In
            </button>
          )}
        </div>

        {/* Bet Amount Display */}
        <div className={styles.betAmountDisplay}>
          <div className={styles.betAmountValue}>
            ${formatNumber(betAmount)}
            {isAllIn && <span className={styles.allInBadge}>ALL IN</span>}
          </div>
          <div className={styles.betLimits}>
            <span>${formatNumber(minBet)}</span>
            <span>${formatNumber(maxBet)}</span>
          </div>
        </div>
      </div>

      {/* Bet Slider and Quick Buttons in one row */}
      <div className={styles.betSliderRow}>
        <input
          type="range"
          min={sliderMin}
          max={maxBet}
          step={1}
          value={betAmount}
          onChange={handleSliderChange}
          className={styles.betSlider}
          disabled={!isActive || !canRaise}
        />
        <div className={styles.quickBetButtons}>
          {quickBets.map((bet, index) => (
            <button
              key={index}
              className={`${styles.quickBetButton} ${
                betAmount === bet.value ? styles.active : ''
              }`}
              onClick={() => handleQuickBet(index + 1)}
              disabled={!isActive || !canRaise}
              title={bet.isAllIn ? 'All In' : `Bet ${bet.label}`}
            >
              {bet.isAllIn ? 'All In' : bet.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BettingControls;
