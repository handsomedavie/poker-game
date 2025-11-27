import React, { useState, useEffect } from 'react';
import { Card, CardBack } from './Card';
import type { CardRank, CardSuit } from './Card';
import styles from './flippable_card.module.css';

interface FlippableCardProps {
  rank: CardRank;
  suit: CardSuit;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  highlighted?: boolean;
  animationDelay?: number; // in ms
  startFlipped?: boolean; // Start as face-down
}

/**
 * FlippableCard component that animates from back to front (face-down to face-up)
 * Used for community cards reveal animation
 */
const FlippableCard: React.FC<FlippableCardProps> = ({
  rank,
  suit,
  size = 'medium',
  className = '',
  highlighted = false,
  animationDelay = 0,
  startFlipped = false,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFront, setShowFront] = useState(!startFlipped);

  useEffect(() => {
    console.log(`🎴 FlippableCard ${rank}${suit}: startFlipped=${startFlipped}, delay=${animationDelay}ms`);
    
    if (startFlipped) {
      console.log(`⏱️  Starting animation for ${rank}${suit} after ${animationDelay}ms`);
      
      // Trigger animation after delay
      const timer = setTimeout(() => {
        console.log(`🎬 Animation START for ${rank}${suit}`);
        setIsAnimating(true);
        
        // After animation completes, update state
        setTimeout(() => {
          console.log(`✅ Animation END for ${rank}${suit}`);
          setIsAnimating(false);
          setShowFront(true);
        }, 600); // Animation duration
      }, animationDelay);

      return () => clearTimeout(timer);
    } else {
      console.log(`📋 ${rank}${suit} showing front immediately (no animation)`);
    }
  }, [startFlipped, animationDelay, rank, suit]);

  return (
    <div 
      className={`${styles.cardContainer} ${className}`}
    >
      <div 
        className={`
          ${styles.cardInner} 
          ${!showFront ? styles.flipped : ''} 
          ${isAnimating ? styles.animating : ''}
        `}
      >
        {/* Back face (рубашка) */}
        <div className={styles.cardFace} data-face="back">
          <CardBack size={size} />
        </div>
        
        {/* Front face (лицо карты) */}
        <div className={styles.cardFace} data-face="front">
          <Card 
            rank={rank} 
            suit={suit} 
            size={size} 
            highlighted={highlighted}
          />
        </div>
      </div>
    </div>
  );
};

export default FlippableCard;
export type { FlippableCardProps };
