import React from 'react';
import styles from './chip_stack.module.css';

export interface ChipStackProps {
  amount: number;
  isBet?: boolean;
}

interface ChipVisual {
  value: number;
  className: string;
}

const CHIP_DENOMS: ChipVisual[] = [
  { value: 10000, className: `${styles.chip} ${styles.chipPurple}` },
  { value: 1000, className: `${styles.chip} ${styles.chipBlack}` },
  { value: 100, className: `${styles.chip} ${styles.chipGreen}` },
  { value: 25, className: `${styles.chip} ${styles.chipRed}` },
  { value: 5, className: `${styles.chip} ${styles.chipWhite}` },
];

export const ChipStack: React.FC<ChipStackProps> = ({ amount, isBet }) => {
  if (amount <= 0) return null;

  let remaining = amount;
  const chips: { key: string; className: string }[] = [];

  for (const denom of CHIP_DENOMS) {
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        chips.push({ key: `${denom.value}-${i}-${chips.length}`, className: denom.className });
      }
      remaining -= denom.value * count;
    }
  }

  const stackClass = isBet ? `${styles.chipStack} ${styles.chipStackBet}` : styles.chipStack;

  return (
    <div className={stackClass}>
      {chips.map((chip) => (
        <div key={chip.key} className={chip.className} />
      ))}
    </div>
  );
};

export default ChipStack;
