import React, { useEffect, useState } from 'react';
import styles from './winner_animation.module.css';

interface ChipAnimationProps {
  fromElement: HTMLElement | null; // Pot position
  toElement: HTMLElement | null;   // Winner seat position
  chipCount?: number;              // Number of chips to animate
  onComplete?: () => void;
}

interface ChipParticle {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
}

/**
 * Animates chips flying from pot to winner's seat
 * Creates multiple chip particles with staggered delays
 */
const ChipAnimation: React.FC<ChipAnimationProps> = ({
  fromElement,
  toElement,
  chipCount = 15,
  onComplete,
}) => {
  const [particles, setParticles] = useState<ChipParticle[]>([]);

  useEffect(() => {
    if (!fromElement || !toElement) return;

    // Get positions
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    const fromX = fromRect.left + fromRect.width / 2;
    const fromY = fromRect.top + fromRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;

    // Create chip particles
    const newParticles: ChipParticle[] = Array.from({ length: chipCount }, (_, i) => {
      // Add some randomness to spread
      const spreadX = (Math.random() - 0.5) * 40;
      const spreadY = (Math.random() - 0.5) * 40;

      return {
        id: i,
        startX: fromX + spreadX,
        startY: fromY + spreadY,
        endX: toX + (Math.random() - 0.5) * 20,
        endY: toY + (Math.random() - 0.5) * 20,
        delay: i * 60, // 60ms between each chip
      };
    });

    setParticles(newParticles);

    // Complete callback after all chips finish
    const totalDuration = 1500 + (chipCount * 60);
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, totalDuration);

    return () => clearTimeout(timer);
  }, [fromElement, toElement, chipCount, onComplete]);

  return (
    <div className={styles.chipAnimationContainer}>
      {particles.map((particle) => {
        const deltaX = particle.endX - particle.startX;
        const deltaY = particle.endY - particle.startY;
        
        // Calculate parabolic arc
        const midX = deltaX / 2;
        const midY = deltaY / 2 - 100; // Arc height

        return (
          <div
            key={particle.id}
            className={`${styles.chipParticle} ${styles.animating}`}
            style={{
              left: `${particle.startX}px`,
              top: `${particle.startY}px`,
              animationDelay: `${particle.delay}ms`,
              '--chip-mid-x': `${midX}px`,
              '--chip-mid-y': `${midY}px`,
              '--chip-end-x': `${deltaX}px`,
              '--chip-end-y': `${deltaY}px`,
            } as React.CSSProperties}
          >
            {/* Chip visual */}
            <div className={styles.chipInner}>$</div>
          </div>
        );
      })}
    </div>
  );
};

export default ChipAnimation;
