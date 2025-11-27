export type SeatPosition = 1 | 2 | 3 | 4 | 5 | 6;

export interface Card {
  rank: '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  faceUp?: boolean;
}

export interface Player {
  id: string;
  nickname: string;
  avatarUrl?: string;
  stack: number;
  cards?: Card[];
  hasCards?: boolean;
  isDealer?: boolean;
  isActive?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  blindAmount?: number;
  hasActed?: boolean;
}

export interface PlayerSeatProps {
  position: SeatPosition;
  player: Player | null;
  currentUserId?: string;
  isActive?: boolean;
  revealCards?: boolean;
  isWinner?: boolean;
  layoutPosition?: SeatPosition;
  isHero?: boolean;
  timeRemainingMs?: number | null;
  actionTimeoutMs?: number;
  highlightedCards?: Card[];
}
