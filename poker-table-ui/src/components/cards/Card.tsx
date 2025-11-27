import React from 'react';
import styles from './card.module.css';

type CardRank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
type CardSuit = 'hearts'|'diamonds'|'clubs'|'spades';

interface CardProps {
  rank: CardRank;
  suit: CardSuit;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  highlighted?: boolean;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const rankSymbols = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
} as const;

const Card: React.FC<CardProps> = ({ rank, suit, faceDown = false, size = 'medium', className = '', highlighted = false }) => {
  if (faceDown) {
    return <CardBack size={size} className={className} />;
  }

  const isRed = suit === 'hearts' || suit === 'diamonds';
  const colorClass = isRed ? styles.cardRankRed : '';
  const highlightClass = highlighted ? styles.highlighted : '';
  const rankText = rankSymbols[rank];
  const suitSymbol = suitSymbols[suit];

  return (
    <div 
      className={`${styles.card} ${styles[`card_${size}`]} ${colorClass} ${highlightClass} ${className}`}
      data-suit={suit}
    >
      <div className={styles.cardCorner}>
        <div className={styles.rank}>{rankText}</div>
        <div className={styles.suit}>{suitSymbol}</div>
      </div>
      <div className={styles.cardCenter}>
        <div className={styles.suitLarge}>{suitSymbol}</div>
      </div>
    </div>
  );
};

interface CardBackProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const CardBack: React.FC<CardBackProps> = ({ 
  size = 'medium',
  className = ''
}) => {
  return (
    <div className={`${styles.card} ${styles.cardBack} ${styles[`card_${size}`]} ${className}`}>
      <svg 
        className={styles.cardBackSvg} 
        viewBox="0 0 100 140" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Royal Blue Gradient */}
          <linearGradient id="cardBackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#1e3a8a', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#1e3a8a', stopOpacity: 1 }} />
          </linearGradient>
          
          {/* Gold Accent Gradient */}
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 0.8 }} />
            <stop offset="50%" style={{ stopColor: '#d4af37', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#b8860b', stopOpacity: 0.8 }} />
          </linearGradient>
          
          {/* Noise Texture */}
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 0.05" />
            </feComponentTransfer>
          </filter>
          
          {/* Diamond Pattern */}
          <pattern id="diamondPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path 
              d="M 10 0 L 20 10 L 10 20 L 0 10 Z" 
              fill="none" 
              stroke="url(#goldGradient)" 
              strokeWidth="0.5" 
              opacity="0.3"
            />
          </pattern>
          
          {/* Ornate Circle Pattern */}
          <pattern id="circlePattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="8" fill="none" stroke="url(#goldGradient)" strokeWidth="0.4" opacity="0.2" />
            <circle cx="20" cy="20" r="4" fill="none" stroke="url(#goldGradient)" strokeWidth="0.3" opacity="0.25" />
            <path 
              d="M 20 12 L 20 28 M 12 20 L 28 20" 
              stroke="url(#goldGradient)" 
              strokeWidth="0.3" 
              opacity="0.15"
            />
          </pattern>
        </defs>
        
        {/* Background */}
        <rect width="100" height="140" fill="url(#cardBackGradient)" />
        
        {/* Noise Texture Overlay */}
        <rect width="100" height="140" filter="url(#noise)" opacity="0.15" />
        
        {/* Diamond Lattice Pattern */}
        <rect width="100" height="140" fill="url(#diamondPattern)" />
        
        {/* Circle Pattern Overlay */}
        <rect width="100" height="140" fill="url(#circlePattern)" />
        
        {/* Decorative Border */}
        <rect 
          x="3" y="3" 
          width="94" height="134" 
          fill="none" 
          stroke="url(#goldGradient)" 
          strokeWidth="0.8" 
          rx="4"
          opacity="0.6"
        />
        <rect 
          x="5" y="5" 
          width="90" height="130" 
          fill="none" 
          stroke="url(#goldGradient)" 
          strokeWidth="0.4" 
          rx="3"
          opacity="0.4"
        />
        
        {/* Center Mandala */}
        <g transform="translate(50, 70)">
          {/* Outer circle */}
          <circle r="18" fill="none" stroke="url(#goldGradient)" strokeWidth="0.6" opacity="0.5" />
          <circle r="16" fill="none" stroke="url(#goldGradient)" strokeWidth="0.4" opacity="0.4" />
          
          {/* Inner decorative elements */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <g key={i} transform={`rotate(${angle})`}>
              <line x1="0" y1="-12" x2="0" y2="-16" stroke="url(#goldGradient)" strokeWidth="0.6" opacity="0.6" />
              <circle cy="-14" r="1" fill="url(#goldGradient)" opacity="0.7" />
            </g>
          ))}
          
          {/* Center logo placeholder */}
          <circle r="8" fill="rgba(30, 58, 138, 0.8)" stroke="url(#goldGradient)" strokeWidth="0.8" />
          
          {/* Poker suits in center */}
          <text 
            x="0" 
            y="3" 
            fontSize="8" 
            fontFamily="serif" 
            fontWeight="bold"
            fill="url(#goldGradient)" 
            textAnchor="middle"
          >
            ♠♥
          </text>
          <text 
            x="0" 
            y="11" 
            fontSize="8" 
            fontFamily="serif" 
            fontWeight="bold"
            fill="url(#goldGradient)" 
            textAnchor="middle"
          >
            ♦♣
          </text>
        </g>
        
        {/* Corner ornaments */}
        <g opacity="0.4">
          {/* Top-left */}
          <path d="M 8 8 L 12 8 L 8 12 Z" fill="url(#goldGradient)" />
          {/* Top-right */}
          <path d="M 92 8 L 88 8 L 92 12 Z" fill="url(#goldGradient)" />
          {/* Bottom-left */}
          <path d="M 8 132 L 12 132 L 8 128 Z" fill="url(#goldGradient)" />
          {/* Bottom-right */}
          <path d="M 92 132 L 88 132 L 92 128 Z" fill="url(#goldGradient)" />
        </g>
      </svg>
    </div>
  );
};

export { Card, CardBack };
export type { CardSuit, CardRank };
