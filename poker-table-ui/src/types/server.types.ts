import type { SeatPosition, Card } from './player.types';

export interface ServerPlayerState {
  userId: string;
  displayName: string;
  seat: SeatPosition;
  stack: number;
  hasFolded: boolean;
  cards: Card[];
  cardCount: number;
  hasActed?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  blindAmount?: number;
  isBusted?: boolean;
  bustDeadlineMs?: number | null;
}

export type GameStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type TableEventType = 'chat' | 'system' | 'action';

export interface TableEvent {
  type: TableEventType;
  userId?: string;
  message?: string;
  action?: string;
  amount?: number;
  timestamp?: number;
}

export interface ServerTableState {
  tableId: string;
  players: ServerPlayerState[];
  communityCards: Card[];
  pot: number;
  stage: GameStage;
  buttonUserId?: string | null;
  activeUserId?: string | null;
  events: TableEvent[];
  currentBet?: number;
  playerBets?: Record<string, number>;
  turnDeadlineMs?: number | null;
  actionTimeoutMs?: number;
  smallBlind?: number;
  bigBlind?: number;
  sidePotSummary?: { amount: number; eligible: string[] }[];
  minRaiseIncrement?: number;
  minRaiseTotal?: number;
}

export interface CurrentUserProfile {
  userId: string;
  displayName: string;
  balance: number;
}
