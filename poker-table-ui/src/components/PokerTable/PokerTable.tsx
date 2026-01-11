import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import styles from './poker_table.module.css';
import { PlayerSeat } from './PlayerSeat';
import type { PlayerSeatProps, SeatPosition, Card } from '../../types/player.types';
import { CardBack } from '../cards/Card';
import FlippableCard from '../cards/FlippableCard';
import { BettingControls } from './BettingControls';
import { usePokerSocket } from '../../hooks/usePokerSocket';
import type { ServerPlayerState, TableEvent } from '../../types/server.types';
import { DEBUG_MODE } from '../../config/env';
import { evaluateBestHand, type EvaluatedHand } from '../../utils/handEvaluator';
import HandStrengthHUD from '../HandStrengthHUD/HandStrengthHUD';
import WinnerAnimation, { type WinnerData } from '../WinnerAnimation/WinnerAnimation';
import ChipAnimation from '../WinnerAnimation/ChipAnimation';
import TestControls from '../TestControls/TestControls';
import ShowdownDecision from './ShowdownDecision';
import PlayerHandTimer from './PlayerHandTimer';

// Test utilities (auto-loads in development)
import '../../utils/testWinnerAnimation';
import { sampleWinnerData } from '../../utils/testWinnerAnimation';

const DEFAULT_TABLE_ID = 'main';
const FALLBACK_USER_ID = '1';
const SEAT_POSITIONS: SeatPosition[] = [1, 2, 3, 4, 5, 6];

// FEATURE FLAGS - Control optional features
const FEATURES = {
  WIN_ANIMATION: false,  // TEMPORARILY DISABLED - Set to true to re-enable
  TEST_BUTTON: false,    // TEMPORARILY DISABLED - Set to true to re-enable
};

const getRelativePosition = (seatIndex: number, heroIndex: number | null, totalSeats: number): number => {
  if (heroIndex === null) {
    return seatIndex;
  }
  return (seatIndex - heroIndex + totalSeats) % totalSeats;
};

interface FlyingCard {
  id: string;
  position: SeatPosition;
  cardIndex: number;
  tx: number;
  ty: number;
  delayMs: number;
}

const CARD_FLIGHT_DELAY_STEP = 180;
const CARD_FLIGHT_DURATION = 650;

type GameStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

const ranks: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];

const createShuffledDeck = (): Card[] => {
  const deck: Card[] = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({ rank, suit });
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

const formatStageLabel = (stage: GameStage): string => {
  switch (stage) {
    case 'preflop':
      return 'Pre-flop';
    case 'flop':
      return 'Flop';
    case 'turn':
      return 'Turn';
    case 'river':
      return 'River';
    case 'showdown':
      return 'Showdown';
    default:
      return '';
  }
};

const createEmptyBets = (): Partial<Record<SeatPosition, number>> => ({});

const initialSeats: PlayerSeatProps[] = [
  {
    position: 1,
    player: {
      id: '1',
      nickname: 'hopin1116',
      stack: 7364,
      isDealer: false,
      cards: [
        { rank: 'K', suit: 'hearts' },
        { rank: 'J', suit: 'hearts' },
      ],
    },
  },
  {
    position: 2,
    player: {
      id: '2',
      nickname: 'BigPatrem',
      stack: 1099,
      isDealer: true,
      cards: [
        { rank: '9', suit: 'spades' },
        { rank: '9', suit: 'clubs' },
      ],
    },
  },
  { position: 3, player: { id: '3', nickname: 'Master piece', stack: 761 } },
  { position: 4, player: { id: '4', nickname: 'Alex Wedige', stack: 1243 } },
  { position: 5, player: { id: '5', nickname: 'A Cvetkovic', stack: 1107 } },
  { position: 6, player: null },
];

const initialDealerIndex = (() => {
  const idx = initialSeats.findIndex((seat) => seat.player?.isDealer);
  return idx >= 0 ? idx : null;
})();

interface PokerTableProps {
  tableId?: string;
}

export const PokerTable: React.FC<PokerTableProps> = ({ tableId }) => {
  const effectiveTableId = tableId || DEFAULT_TABLE_ID;
  const { currentUser, tableState, connectionStatus, error: socketError, sendAction, socket } = usePokerSocket(effectiveTableId);
  const currentUserId = currentUser?.userId ?? FALLBACK_USER_ID;

  const [seats, setSeats] = useState<PlayerSeatProps[]>(
    initialSeats.map((seat) => ({
      ...seat,
      player: seat.player
        ? {
            ...seat.player,
            hasCards: false,
            cards: undefined,
          }
        : null,
      layoutPosition: seat.position,
      isHero: false,
    })),
  );
  const [isDealing, setIsDealing] = useState(false);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [currentBet, setCurrentBet] = useState(100);

  const heroPlayerData = useMemo(() => {
    if (!tableState || !currentUserId) return null;
    return tableState.players.find(p => p.userId === currentUserId);
  }, [tableState, currentUserId]);

  const heroContribution = useMemo(() => {
    if (!heroPlayerData || !tableState) return 0;
    return tableState.playerBets?.[heroPlayerData.userId] ?? 0;
  }, [heroPlayerData, tableState]);

  const callAmount = useMemo(() => {
    if (!heroPlayerData || !tableState || tableState.currentBet === undefined) return 0;
    const amountToCall = Math.max(0, (tableState.currentBet ?? 0) - heroContribution);
    return Math.min(amountToCall, heroPlayerData.stack);
  }, [heroPlayerData, tableState, heroContribution]);

  const fallbackBlind = tableState?.bigBlind ?? 20;

  const minRaiseIncrement = useMemo(() => {
    if (!tableState) return fallbackBlind;
    return tableState.minRaiseIncrement ?? fallbackBlind;
  }, [tableState, fallbackBlind]);

  const minRaiseTarget = useMemo(() => {
    if (!tableState) return fallbackBlind;
    if (tableState.minRaiseTotal && tableState.minRaiseTotal > 0) {
      return tableState.minRaiseTotal;
    }
    const currentServerBet = tableState.currentBet ?? 0;
    if (currentServerBet > 0) {
      return currentServerBet + minRaiseIncrement;
    }
    return minRaiseIncrement;
  }, [tableState, minRaiseIncrement, fallbackBlind]);

  // minBet is the DELTA (amount to add to current bet), not total contribution
  const minBet = useMemo(() => {
    if (!heroPlayerData) return minRaiseTarget;
    const heroStack = heroPlayerData.stack;
    
    // If player can't raise (only call/all-in), return 0
    if (heroStack <= callAmount) {
      return 0;
    }
    
    // Calculate how much player needs to ADD to reach minRaiseTarget
    const deltaToReachMin = Math.max(minRaiseTarget - heroContribution, 0);
    
    // Can't bet more than available stack
    return Math.min(deltaToReachMin, heroStack);
  }, [heroPlayerData, minRaiseTarget, heroContribution, callAmount, minRaiseIncrement]);

  const maxBet = useMemo(() => {
    return heroPlayerData?.stack ?? 1000;
  }, [heroPlayerData]);

  useEffect(() => {
    if (!heroPlayerData) return;
    if (minBet <= 0) {
      // Can't raise, set to 0
      setCurrentBet(0);
      return;
    }
    setCurrentBet((prev) => {
      // Clamp between minBet and stack
      const clamped = Math.min(Math.max(prev, minBet), heroPlayerData.stack);
      return clamped;
    });
  }, [minBet, heroPlayerData]);

  const [deck, setDeck] = useState<Card[]>([]);
  const [gameStage, setGameStage] = useState<GameStage>('preflop');
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [isCommunityDealing, setIsCommunityDealing] = useState(false);
  const [hasDealtPlayers, setHasDealtPlayers] = useState(false);
  const [pot, setPot] = useState(0);
  const [currentRoundBet, setCurrentRoundBet] = useState(0);
  const [playerBets, setPlayerBets] = useState<Partial<Record<SeatPosition, number>>>(createEmptyBets);
  const [activeSeatIndex, setActiveSeatIndex] = useState<number | null>(null);
  const [foldedPositions, setFoldedPositions] = useState<SeatPosition[]>([]);
  const [dealerIndex, setDealerIndex] = useState<number | null>(initialDealerIndex);
  const [showdownRevealed, setShowdownRevealed] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState<SeatPosition[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [heroBestHand, setHeroBestHand] = useState<EvaluatedHand | null>(null);
  const [sidePotTotal, setSidePotTotal] = useState(0);
  
  // Winner Animation state
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  
  // Showdown Decision state (for losing players)
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);
  const [isLoserInShowdown, setIsLoserInShowdown] = useState(false);
  
  // Track revealed cards from other players (for Show/Muck feature)
  // Key: playerId, Value: { show: boolean, cards: Card[] | null }
  const [revealedCards, setRevealedCards] = useState<Record<string, { show: boolean; cards: Card[] | null }>>({});
  
  // Debug: Log state changes for Show/Muck panel
  useEffect(() => {
    console.log(`📊 Decision Panel State: showDecisionPanel=${showDecisionPanel}, isLoserInShowdown=${isLoserInShowdown}`);
    if (showDecisionPanel && isLoserInShowdown) {
      console.log('✅ Both conditions TRUE - ShowdownDecision component SHOULD render!');
    }
  }, [showDecisionPanel, isLoserInShowdown]);
  
  // Debug: Log revealed cards changes
  useEffect(() => {
    if (Object.keys(revealedCards).length > 0) {
      console.log('👁️ Revealed cards updated:', revealedCards);
    }
  }, [revealedCards]);
  
  // Refs for chip animation
  const potRef = useRef<HTMLDivElement>(null);
  const winnerSeatRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Track cards that have already been animated (using state for reactivity)
  const [animatedCardIds, setAnimatedCardIds] = useState<Set<string>>(new Set());

  // Reset animated cards when new game starts (community cards cleared)
  useEffect(() => {
    if (communityCards.length === 0) {
      setAnimatedCardIds(new Set());
      if (DEBUG_MODE) {
        console.log('🔄 Cleared animated cards (new game)');
      }
    }
  }, [communityCards.length]);

  // Mark new community cards for animation
  useEffect(() => {
    const newCards = communityCards.filter(card => {
      const cardId = `${card.rank}-${card.suit}`;
      return !animatedCardIds.has(cardId);
    });

    if (newCards.length > 0) {
      if (DEBUG_MODE) {
        console.log(`🎴 New cards to animate:`, newCards.map(c => `${c.rank}-${c.suit}`));
      }
      
      // Mark as animated after a short delay to ensure render happens first
      setTimeout(() => {
        setAnimatedCardIds(prev => {
          const updated = new Set(prev);
          newCards.forEach(card => {
            const cardId = `${card.rank}-${card.suit}`;
            updated.add(cardId);
            if (DEBUG_MODE) {
              console.log(`✅ Marked ${cardId} as animated`);
            }
          });
          return updated;
        });
      }, 1000); // After animation completes
    }
  }, [communityCards, animatedCardIds]);

  // Evaluate hero's best hand whenever cards change
  useEffect(() => {
    const heroSeat = seats.find((s) => s.player?.id === currentUserId);
    if (!heroSeat?.player?.cards || heroSeat.player.cards.length === 0 || communityCards.length < 3) {
      setHeroBestHand(null);
      return;
    }

    const combinedCards = [...heroSeat.player.cards, ...communityCards];
    const bestHand = evaluateBestHand(combinedCards);
    setHeroBestHand(bestHand);
  }, [seats, currentUserId, communityCards]);

  const heroServerPlayer: ServerPlayerState | null = useMemo(() => {
    if (!tableState) return null;
    return tableState.players.find((p) => p.userId === currentUserId) ?? null;
  }, [tableState, currentUserId]);

  const heroIsBusted = Boolean(heroServerPlayer?.isBusted);
  const heroBustDeadlineMs = heroServerPlayer?.bustDeadlineMs ?? null;

  const isRemoteControlled = tableState !== null && connectionStatus === 'connected';
  const turnDeadlineMs = tableState?.turnDeadlineMs ?? null;
  const actionTimeoutMs = tableState?.actionTimeoutMs ?? null;

  const heroSeat = useMemo(() => seats.find((seat) => seat.player?.id === currentUserId) ?? null, [seats, currentUserId]);
  const opponentSeats = useMemo(
    () => seats.filter((seat) => seat.player?.id !== currentUserId),
    [seats, currentUserId],
  );

  // Helper: Get player names for winner animation
  const getPlayerNames = useCallback((): Record<string, string> => {
    const names: Record<string, string> = {};
    seats.forEach(seat => {
      if (seat.player) {
        names[seat.player.id] = seat.player.nickname || 'Unknown';
      }
    });
    return names;
  }, [seats]);

  // Handler: Trigger test animation (for debug UI)
  // TEMPORARILY DISABLED - Stub function to avoid TypeScript errors
  const handleTestAnimation = useCallback((_scenario: keyof typeof sampleWinnerData) => {
    // Feature disabled - no action
    if (DEBUG_MODE) {
      console.log('🔒 Win animation feature is currently disabled');
    }
  }, []);

  // Handler for show/hide cards decision after showdown
  // IMPORTANT: Only hide panel, do NOT clear any state - server controls timing!
  const handleShowCardsDecision = useCallback((show: boolean) => {
    console.log('=== 📤 SENDING SHOW/MUCK DECISION ===');
    console.log(`Decision: ${show ? 'SHOW' : 'MUCK'}`);
    console.log(`Current User ID: ${currentUserId}`);
    
    sendAction('showcards', { show });
    console.log('✅ Sent showcards action to server');
    
    // Only hide the decision panel - DO NOT clear any other state!
    // Server will start new hand and state will be cleared on 'preflop' stage
    setShowDecisionPanel(false);
    setIsLoserInShowdown(false);
    console.log('👁️ Panel hidden - waiting for server to start new hand');
  }, [sendAction, currentUserId]);

  // Listen for showdown and winner highlight events from server
  useEffect(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const handleShowdown = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Listen for handComplete event (winner information)
        if (message.type === 'handComplete') {
          const { winners, winType, potAmount } = message;
          
          // ALWAYS log for debugging
          console.log('=== 🏆 HAND COMPLETE EVENT ===' );
          console.log('Winners (user IDs):', winners);
          console.log('Win Type:', winType);
          console.log('Pot Amount:', potAmount);
          console.log('Current seats:', seats.map(s => ({ pos: s.position, playerId: s.player?.id })));
          
          // Convert winner user IDs to seat positions
          if (winners && Array.isArray(winners)) {
            const winnerSeats: SeatPosition[] = [];
            winners.forEach((winnerId: string) => {
              console.log('Looking for winner:', winnerId);
              const seat = seats.find(s => s.player?.id === winnerId);
              console.log('Found seat:', seat?.position, 'player:', seat?.player?.id);
              if (seat) {
                winnerSeats.push(seat.position);
              }
            });
            
            console.log('Winner seats to highlight:', winnerSeats);
            
            if (winnerSeats.length > 0) {
              setShowdownWinners(winnerSeats);
              setShowdownRevealed(true);
              console.log('👑 WINNER HIGHLIGHT ACTIVATED! Seats:', winnerSeats);
              
              // Auto-clear winner highlight after 5 seconds
              setTimeout(() => {
                setShowdownWinners([]);
                setShowdownRevealed(false);
                console.log('Winner highlight cleared after 5 seconds');
              }, 5000);
            } else {
              console.warn('⚠️ No winner seats found! Check if player IDs match.');
            }
          }
        }
        
        // Listen for showdown complete event (for show/hide cards feature)
        if (message.type === 'showdownComplete') {
          const { losers, winnerId, winners } = message;
          
          // ALWAYS log for debugging
          console.log('=== 😢 SHOWDOWN COMPLETE EVENT ===');
          console.log('Winner ID:', winnerId);
          console.log('Winners:', winners);
          console.log('Losers:', losers);
          console.log('Current User ID:', currentUserId);
          console.log('Losers player IDs:', losers?.map((l: any) => l.playerId));
          
          // Check if current player is a loser
          const isLoser = losers?.some((l: any) => l.playerId === currentUserId);
          console.log('Am I a loser?', isLoser);
          
          if (isLoser) {
            setIsLoserInShowdown(true);
            setShowDecisionPanel(true);
            console.log('🟢 SHOWING DECISION PANEL - Show/Muck buttons should appear!');
          } else {
            console.log('❌ NOT showing buttons - I am winner or not in losers list');
          }
        }
        
        // Listen for playerCardsVisibility - when player shows/mucks cards
        if (message.type === 'playerCardsVisibility') {
          const { playerId, nickname, show, cards } = message;
          console.log('============================================');
          console.log('=== 🃏 PLAYER CARDS VISIBILITY RECEIVED ===');
          console.log('============================================');
          console.log(`Player ID: ${playerId}`);
          console.log(`Nickname: ${nickname}`);
          console.log(`Decision: ${show ? 'SHOW' : 'MUCK'}`);
          console.log('Cards data:', JSON.stringify(cards));
          console.log('Current User ID:', currentUserId);
          console.log('Is this me?:', playerId === currentUserId);
          
          if (!cards && show) {
            console.error('❌ BUG: show=true but cards is null/empty!');
          }
          
          // Update revealed cards state - DO NOT clear anything else!
          setRevealedCards(prev => {
            const updated = {
              ...prev,
              [playerId]: {
                show,
                cards: cards ? cards.map((c: any) => ({ rank: c.rank, suit: c.suit })) : null
              }
            };
            console.log('📊 Updated revealedCards state:', JSON.stringify(updated));
            return updated;
          });
          console.log('✅ State update dispatched - cards should appear now');
        }
        
        // Listen for new hand - reset all showdown state
        // Server sends: {type: "state", payload: {stage: "preflop", ...}}
        if (message.type === 'state' && message.payload?.stage === 'preflop') {
          // New hand started - clear all showdown state
          console.log('============================================');
          console.log('=== 🔄 NEW HAND STARTED - CLEARING ALL ===');
          console.log('============================================');
          console.log('Clearing: showDecisionPanel, isLoserInShowdown, showdownRevealed, showdownWinners, revealedCards');
          setShowDecisionPanel(false);
          setIsLoserInShowdown(false);
          setShowdownRevealed(false);
          setShowdownWinners([]);
          setRevealedCards({});  // Clear revealed cards for new hand
          console.log('✅ All showdown state cleared!');
        }
        
        // Log all state messages for debugging
        if (message.type === 'state') {
          console.log(`📡 State received: stage=${message.payload?.stage}`);
        }
      } catch (err) {
        console.error('Error parsing showdown message:', err);
      }
    };

    socket.addEventListener('message', handleShowdown);
    return () => socket.removeEventListener('message', handleShowdown);
  }, [socket, currentUserId, seats]);

  // Socket listener for hand completion
  /* TEMPORARILY DISABLED - Win animation socket integration
  useEffect(() => {
    if (!FEATURES.WIN_ANIMATION) return;
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Socket not ready:', socket?.readyState);
      return;
    }

    console.log('🎧 Listening for handComplete events...');

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // DEBUG: Log all socket messages
        if (DEBUG_MODE) {
          console.log('📥 Socket message received:', message.type || message.event, message);
        }
        
        // Listen for handComplete event
        if (message.type === 'handComplete' || message.event === 'handComplete') {
          const data = message.payload || message.data || message;
          console.log('✅ handComplete EVENT RECEIVED!');
          console.log('🏆 Winner data:', data);
          console.log('📊 Winners:', data.winners);
          console.log('💰 Pot amount:', data.potAmount);
          
          setWinnerData(data as WinnerData);
          setShowWinAnimation(true);
          console.log('🎬 Win banner should now be visible!');
        }
      } catch (err) {
        console.error('❌ Failed to parse winner message', err);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      console.log('🔌 Removing handComplete listener');
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);
  */

  // Test event listener (for development testing without server)
  /* TEMPORARILY DISABLED - Test event system
  useEffect(() => {
    if (!FEATURES.WIN_ANIMATION) return;
    
    const handleTestWinner = (event: Event) => {
      const customEvent = event as CustomEvent<WinnerData>;
      if (DEBUG_MODE) {
        console.log('🧪 Test winner event triggered:', customEvent.detail);
      }
      setWinnerData(customEvent.detail);
      setShowWinAnimation(true);
    };

    window.addEventListener('test-winner', handleTestWinner);

    return () => {
      window.removeEventListener('test-winner', handleTestWinner);
    };
  }, []);
  */

  // Auto-trigger win animation when showdown winners are determined
  /* TEMPORARILY DISABLED - Auto-trigger on showdown
  useEffect(() => {
    if (!FEATURES.WIN_ANIMATION) return;
    
    if (showdownRevealed && showdownWinners.length > 0 && gameStage === 'showdown' && !showWinAnimation) {
      // Wait a bit for cards to be revealed
      const timer = setTimeout(() => {
        // Get winner player IDs
        const winnerPlayerIds = showdownWinners
          .map(pos => seats.find(s => s.position === pos && s.player)?.player?.id)
          .filter((id): id is string => id !== undefined);

        if (winnerPlayerIds.length === 0) return;

        // Get winner hands
        const winnerHands = showdownWinners.map(pos => {
          const seat = seats.find(s => s.position === pos);
          if (!seat?.player?.cards || seat.player.cards.length === 0) return null;
          
          // Combine player cards with community cards
          const allCards = [...seat.player.cards, ...communityCards];
          const hand = evaluateBestHand(allCards);
          return hand;
        }).filter(h => h !== null) as EvaluatedHand[];

        const bestHand = winnerHands[0]; // First winner's hand

        // Create winner data
        const data: WinnerData = {
          winners: winnerPlayerIds,
          winType: 'showdown',
          potAmount: pot,
          potPerWinner: Math.floor(pot / winnerPlayerIds.length),
          winningHand: bestHand ? {
            rank: bestHand.rank,
            name: bestHand.description,
            cards: bestHand.cards,
          } : undefined,
        };

        if (DEBUG_MODE) {
          console.log('🏆 Auto-triggering win animation:', data);
        }

        setWinnerData(data);
        setShowWinAnimation(true);
      }, 1500); // Wait 1.5s for card reveal

      return () => clearTimeout(timer);
    }
  }, [showdownRevealed, showdownWinners, gameStage, showWinAnimation, seats, communityCards, pot]);
  */

  const seatOffset = (position: SeatPosition): { tx: number; ty: number } => {
    // смещения от центра стола (px) для полёта карты к каждому месту
    switch (position) {
      case 1: // bottom-center (self)
        return { tx: 0, ty: 170 };
      case 2: // left-bottom
        return { tx: -260, ty: 120 };
      case 3: // left-top
        return { tx: -280, ty: -40 };
      case 4: // top-center
        return { tx: 0, ty: -140 };
      case 5: // right-top
        return { tx: 280, ty: -40 };
      case 6: // right-bottom
        return { tx: 260, ty: 120 };
      default:
        return { tx: 0, ty: 0 };
    }
  };

  const hasAnyPlayers = (predicate: (seat: PlayerSeatProps) => boolean) => seats.some((seat) => seat.player && predicate(seat));

  const getNextOccupiedIndex = (startIndex: number | null): number | null => {
    if (!hasAnyPlayers(() => true)) {
      return null;
    }

    for (let offset = 1; offset <= seats.length; offset += 1) {
      const baseIndex = startIndex ?? -1;
      const candidateIndex = ((baseIndex + offset) % seats.length + seats.length) % seats.length;
      const candidateSeat = seats[candidateIndex];
      if (candidateSeat?.player) {
        return candidateIndex;
      }
    }

    return null;
  };

  const getNextActiveIndex = (startIndex: number | null): number | null => {
    if (!hasAnyPlayers((seat) => !foldedPositions.includes(seat.position))) {
      return null;
    }

    for (let offset = 1; offset <= seats.length; offset += 1) {
      const baseIndex = startIndex ?? -1;
      const candidateIndex = ((baseIndex + offset) % seats.length + seats.length) % seats.length;
      const candidateSeat = seats[candidateIndex];
      if (candidateSeat?.player && !foldedPositions.includes(candidateSeat.position)) {
        return candidateIndex;
      }
    }

    return null;
  };

  const startNextBettingRound = () => {
    const startingIndex = dealerIndex !== null ? getNextActiveIndex(dealerIndex) : getNextActiveIndex(null);
    setPlayerBets(createEmptyBets());
    setCurrentRoundBet(0);
    setActiveSeatIndex(startingIndex);
  };

  const determineShowdownWinners = (contenders: PlayerSeatProps[]): SeatPosition[] => {
    const rankOrder: EvaluatedHand['rank'][] = [
      'Royal Flush',
      'Straight Flush',
      'Four of a Kind',
      'Full House',
      'Flush',
      'Straight',
      'Three of a Kind',
      'Two Pair',
      'Pair',
      'High Card'
    ];

    let bestHand: EvaluatedHand | null = null;
    const winnerPositions: SeatPosition[] = [];

    contenders.forEach((seat) => {
      if (!seat.player?.cards || seat.player.cards.length === 0) {
        return;
      }
      const combinedCards = [...seat.player.cards, ...communityCards];
      const evaluated = evaluateBestHand(combinedCards);
      if (!evaluated) {
        return;
      }

      if (!bestHand) {
        bestHand = evaluated;
        winnerPositions.length = 0;
        winnerPositions.push(seat.position);
        return;
      }

      // Compare hands by rank
      const rank1Index = rankOrder.indexOf(evaluated.rank);
      const rank2Index = rankOrder.indexOf(bestHand.rank);

      if (rank1Index < rank2Index) {
        bestHand = evaluated;
        winnerPositions.length = 0;
        winnerPositions.push(seat.position);
      } else if (rank1Index === rank2Index) {
        // Same rank - it's a tie (simplified for now)
        winnerPositions.push(seat.position);
      }
    });

    return winnerPositions;
  };

  const startShowdown = () => {
    const activePlayers = seats.filter((seat) => seat.player && !foldedPositions.includes(seat.position));
    const contenders = activePlayers.length > 0 ? activePlayers : seats.filter((seat) => seat.player);
    const winners = determineShowdownWinners(contenders);
    setGameStage('showdown');
    setShowdownRevealed(true);
    setShowdownWinners(winners);
    setActiveSeatIndex(null);
  };

  const queueFlyingCard = (seat: PlayerSeatProps, cardIndex: number, delayMs: number) => {
    const visualPosition = seat.layoutPosition ?? seat.position;
    const offset = seatOffset(visualPosition);
    setFlyingCards((prev) => [
      ...prev,
      {
        id: `card-${seat.position}-${cardIndex}-${delayMs}`,
        position: seat.position,
        cardIndex,
        tx: offset.tx,
        ty: offset.ty,
        delayMs,
      },
    ]);
  };

  const dealCards = () => {
    if (isRemoteControlled) {
      sendAction('start_hand');
      return;
    }
    if (isDealing || isCommunityDealing) return;
    setIsDealing(true);
    setHasDealtPlayers(false);
    setCommunityCards([]);
    setGameStage('preflop');
    setFlyingCards([]);
    setPot(0);
    setCurrentRoundBet(0);
    setPlayerBets(createEmptyBets());
    setFoldedPositions([]);
    setActiveSeatIndex(null);
    setShowdownRevealed(false);
    setShowdownWinners([]);

    const shuffledDeck = createShuffledDeck();

    const resolvedDealerIndex = (() => {
      if (dealerIndex === null) {
        return getNextOccupiedIndex(null);
      }
      const nextIndex = getNextOccupiedIndex(dealerIndex);
      return nextIndex !== null ? nextIndex : getNextOccupiedIndex(null);
    })();

    const smallBlindIndex = resolvedDealerIndex !== null ? getNextOccupiedIndex(resolvedDealerIndex) : null;
    const bigBlindIndex = smallBlindIndex !== null ? getNextOccupiedIndex(smallBlindIndex) : null;
    const firstToActIndex = bigBlindIndex !== null ? getNextOccupiedIndex(bigBlindIndex) : resolvedDealerIndex;
    const smallBlindValue = Math.max(1, Math.floor(minBet / 2));
    const bigBlindValue = minBet;
    const bigBlindPosition = bigBlindIndex !== null ? seats[bigBlindIndex]?.position ?? null : null;
    const forcedBets: Partial<Record<SeatPosition, number>> = {};
    let forcedPot = 0;

    // Reset all player cards first and assign roles/blinds
    setSeats((prevSeats) =>
      prevSeats.map((seat, index) => {
        if (!seat.player) {
          return seat;
        }

        const isDealerSeat = resolvedDealerIndex !== null && index === resolvedDealerIndex;
        const isSmallBlindSeat = smallBlindIndex !== null && index === smallBlindIndex;
        const isBigBlindSeat = bigBlindIndex !== null && index === bigBlindIndex;
        const targetBlind = isSmallBlindSeat ? smallBlindValue : isBigBlindSeat ? bigBlindValue : 0;
        const contribution = Math.min(targetBlind, seat.player.stack);

        if (contribution > 0) {
          forcedPot += contribution;
          forcedBets[seat.position] = contribution;
        }

        return {
          ...seat,
          player: {
            ...seat.player,
            stack: Math.max(0, seat.player.stack - contribution),
            hasCards: false,
            cards: undefined,
            isDealer: isDealerSeat,
            isSmallBlind: isSmallBlindSeat,
            isBigBlind: isBigBlindSeat,
          },
        };
      }),
    );

    setPot(forcedPot);
    setPlayerBets(forcedBets);
    setCurrentRoundBet(bigBlindPosition ? forcedBets[bigBlindPosition] ?? 0 : 0);
    setDealerIndex(resolvedDealerIndex);

    // Get only seats with players
    const seatsWithPlayers = seats.filter((s) => s.player);
    const playerCards = new Map<SeatPosition, [Card, Card]>();

    seatsWithPlayers.forEach((seat) => {
      const firstCard = shuffledDeck.pop();
      const secondCard = shuffledDeck.pop();
      if (firstCard && secondCard) {
        playerCards.set(seat.position, [firstCard, secondCard]);
      }
    });

    setDeck([...shuffledDeck]);

    const firstCardBaseDelay = 0;
    seatsWithPlayers.forEach((seat, index) => {
      queueFlyingCard(seat, 0, firstCardBaseDelay + index * CARD_FLIGHT_DELAY_STEP);
    });

    const secondCardBaseDelay = seatsWithPlayers.length * CARD_FLIGHT_DELAY_STEP + 200;
    seatsWithPlayers.forEach((seat, index) => {
      queueFlyingCard(seat, 1, secondCardBaseDelay + index * CARD_FLIGHT_DELAY_STEP);
    });

    const totalAnimationTime = secondCardBaseDelay + seatsWithPlayers.length * CARD_FLIGHT_DELAY_STEP + CARD_FLIGHT_DURATION;

    // After all cards are dealt, update the seats to show cards
    setTimeout(() => {
      setSeats((prevSeats) =>
        prevSeats.map((seat) =>
          seat.player
            ? {
                ...seat,
                player: {
                  ...seat.player!,
                  cards: playerCards.get(seat.position) ?? seat.player.cards,
                  hasCards: true,
                },
              }
            : seat,
        ),
      );
      setFlyingCards([]);
      setIsDealing(false);
      setHasDealtPlayers(true);
      setActiveSeatIndex(firstToActIndex ?? resolvedDealerIndex ?? null);
    }, totalAnimationTime + 200);
  };

  const dealCommunityCards = (count: number, nextStage: GameStage) => {
    if (isRemoteControlled) {
      sendAction('advance_stage');
      return;
    }
    if (isCommunityDealing || deck.length < count) return;
    setIsCommunityDealing(true);

    const newCards = deck.slice(0, count);
    setCommunityCards((prev) => [...prev, ...newCards]);
    setDeck((prev) => prev.slice(count));

    setTimeout(() => {
      setGameStage(nextStage);
      if (nextStage !== 'showdown') {
        startNextBettingRound();
      }
      setIsCommunityDealing(false);
    }, count * 250 + 200);
  };


  const renderBoard = () => {
    // Determine which cards should animate (cards NOT yet in animatedCardIds)
    const cardsToAnimate = communityCards.filter(card => {
      const cardId = `${card.rank}-${card.suit}`;
      const shouldAnimate = !animatedCardIds.has(cardId);
      if (DEBUG_MODE && shouldAnimate) {
        console.log(`🎴 Card ${cardId} will animate`);
      }
      return shouldAnimate;
    });
    
    return (
      <div className={styles.boardArea}>
        <div ref={potRef} className={styles.potDisplay}>
          ${pot.toLocaleString()}
          {sidePotTotal > 0 && <span className={styles.sidePotDisplay}>+ Side pot ${sidePotTotal.toLocaleString()}</span>}
        </div>
        <div className={styles.boardRow}>
          {communityCards.map((card, index) => {
            const isHighlighted = heroBestHand?.cards.some(
              (hc) => hc.rank === card.rank && hc.suit === card.suit
            ) ?? false;
            
            const cardId = `${card.rank}-${card.suit}`;
            
            // Check if this card should animate
            const shouldAnimate = cardsToAnimate.some(c => 
              `${c.rank}-${c.suit}` === cardId
            );
            
            // Calculate animation delay for flop (first 3 cards)
            let animationDelay = 0;
            if (shouldAnimate && index < 3 && communityCards.length <= 3) {
              // Flop: stagger the 3 cards
              animationDelay = index * 200;
              if (DEBUG_MODE) {
                console.log(`🎬 Card ${cardId} delay: ${animationDelay}ms`);
              }
            }
            
            // Removed spam log - was causing console flood
            
            return (
              <FlippableCard
                key={cardId}
                rank={card.rank}
                suit={card.suit}
                size="medium"
                highlighted={isHighlighted}
                animationDelay={animationDelay}
                startFlipped={shouldAnimate}
                className={styles.communityCard}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Handle bet amount changes
  const handleBetChange = useCallback((amount: number) => {
    setCurrentBet(amount);
  }, []);

  const activeSeat = useMemo(() => (activeSeatIndex !== null ? seats[activeSeatIndex] : null), [activeSeatIndex, seats]);
  const activeSeatPosition = activeSeat?.position;
  const activeSeatContribution = activeSeatPosition ? playerBets[activeSeatPosition] ?? 0 : 0;
  const requiredCallAmount = Math.max(0, currentRoundBet - activeSeatContribution);
  const heroIsActiveOnServer = Boolean(tableState?.activeUserId && heroPlayerData?.userId === tableState?.activeUserId);
  const serverCanCheck = callAmount === 0;

  const localControlsActive = Boolean(activeSeat && !foldedPositions.includes(activeSeat?.position ?? -1));
  const controlsAreActive = isRemoteControlled ? (heroIsActiveOnServer && !heroIsBusted) : localControlsActive;
  const heroStack = isRemoteControlled ? heroPlayerData?.stack ?? 0 : heroSeat?.player?.stack ?? 0;
  const canAllIn = controlsAreActive && heroStack > 0 && !heroIsBusted;
  const canCheck = isRemoteControlled ? serverCanCheck : requiredCallAmount === 0;
  
  // Can raise if: active, has stack > call amount, and minBet is valid
  const canRaise = useMemo(() => {
    if (!controlsAreActive || heroIsBusted) return false;
    if (minBet <= 0) return false; // Can't raise
    if (heroStack <= callAmount) return false; // Can only call/all-in
    return true;
  }, [controlsAreActive, heroIsBusted, heroStack, callAmount, minBet]);

  // Debug: log controls state
  useEffect(() => {
    console.log('[DEBUG] Controls State:', {
      isRemoteControlled,
      heroIsActiveOnServer,
      localControlsActive,
      controlsAreActive,
      heroIsBusted,
      callAmount,
      canCheck,
      canRaise,
      minBet,
      maxBet,
      currentBet,
      heroContribution,
      minRaiseTarget,
      heroStack,
      heroSeat: heroSeat?.player?.id,
      activeUserId: tableState?.activeUserId,
    });
  }, [isRemoteControlled, heroIsActiveOnServer, localControlsActive, controlsAreActive, heroIsBusted, callAmount, canCheck, canRaise, minBet, maxBet, currentBet, heroContribution, minRaiseTarget, heroStack, heroSeat, tableState?.activeUserId]);

  const advanceToNextPlayer = () => {
    if (activeSeatIndex === null) {
      return;
    }

    const nextIndex = getNextActiveIndex(activeSeatIndex);
    if (nextIndex === null) {
      setActiveSeatIndex(null);
      return;
    }

    setActiveSeatIndex(nextIndex);
  };

  const updateSeatStack = (position: SeatPosition, delta: number) => {
    setSeats((prevSeats) =>
      prevSeats.map((seat) =>
        seat.position === position && seat.player
          ? {
              ...seat,
              player: {
                ...seat.player,
                stack: Math.max(0, seat.player.stack + delta),
              },
            }
          : seat,
      ),
    );
  };

  const trackPlayerBet = (position: SeatPosition, amount: number) => {
    setPlayerBets((prev) => ({
      ...prev,
      [position]: (prev[position] ?? 0) + amount,
    }));
  };

  const withActiveSeat = (action: (seatPosition: SeatPosition) => void) => {
    if (!activeSeat || !activeSeat.player) return;
    action(activeSeat.position);
    advanceToNextPlayer();
  };

  // Handle call/check action
  const handleCall = () => {
    if (isRemoteControlled) {
      const action = callAmount > 0 ? 'call' : 'check';
      sendAction(action);
      return;
    }
    if (requiredCallAmount === 0) {
      handleCheck();
      return;
    }

    withActiveSeat((position) => {
      const seatData = seats.find((seat) => seat.position === position);
      if (!seatData || !seatData.player) return;

      const amountPaid = Math.min(requiredCallAmount, seatData.player.stack);
      if (amountPaid <= 0) return;

      updateSeatStack(position, -amountPaid);
      trackPlayerBet(position, amountPaid);
      setPot((prev) => prev + amountPaid);
    });
  };

  // Handle fold action
  const handleFold = () => {
    if (isRemoteControlled) {
      sendAction('fold');
      return;
    }

    withActiveSeat((position) => {
      setFoldedPositions((prev) => (prev.includes(position) ? prev : [...prev, position]));
    });
  };

  // Handle raise action
  const handleRaise = () => {
    if (isRemoteControlled) {
      sendAction('raise', { amount: currentBet });
      return;
    }
    withActiveSeat((position) => {
      const seatData = seats.find((seat) => seat.position === position);
      if (!seatData || !seatData.player) return;

      const betAmount = Math.min(currentBet, seatData.player.stack);
      if (betAmount <= 0) return;

      updateSeatStack(position, -betAmount);
      trackPlayerBet(position, betAmount);
      setPot((prev) => prev + betAmount);
      setCurrentRoundBet((playerBets[position] ?? 0) + betAmount);
    });
  };

  // Handle check action
  const handleCheck = () => {
    if (isRemoteControlled) {
      sendAction('check');
      return;
    }
    withActiveSeat(() => undefined);
  };

  const applyRelativeLayout = (baseSeats: PlayerSeatProps[], heroIndex: number | null): PlayerSeatProps[] => {
    const totalSeats = baseSeats.length;
    if (heroIndex === null) {
      return baseSeats.map((seat, index) => ({
        ...seat,
        layoutPosition: SEAT_POSITIONS[index],
        isHero: seat.player?.id === currentUserId,
      }));
    }

    const rotated: Array<PlayerSeatProps | null> = new Array(totalSeats).fill(null);
    baseSeats.forEach((seat, index) => {
      const relative = getRelativePosition(index, heroIndex, totalSeats);
      rotated[relative] = seat;
    });

    return rotated.map((seat, index) => {
      const seatData = seat ?? { position: SEAT_POSITIONS[index], player: null };
      return {
        ...seatData,
        layoutPosition: SEAT_POSITIONS[index],
        isHero: seatData.player?.id === currentUserId,
      };
    });
  };

  useEffect(() => {
    if (!tableState) {
      return;
    }

    const heroSeatIndex = (() => {
      if (!currentUserId) return null;
      const seatIndex = tableState.players.findIndex((player) => player.userId === currentUserId);
      if (seatIndex === -1) return null;
      const seatPosition = tableState.players[seatIndex].seat as SeatPosition;
      const positionIndex = SEAT_POSITIONS.indexOf(seatPosition);
      return positionIndex >= 0 ? positionIndex : null;
    })();

    const updatedSeats: PlayerSeatProps[] = SEAT_POSITIONS.map((position) => {
      const serverPlayer = tableState.players.find((player) => player.seat === position);
      if (!serverPlayer) {
        return { position, player: null };
      }

      return {
        position,
        player: {
          id: serverPlayer.userId,
          nickname: serverPlayer.displayName,
          stack: serverPlayer.stack,
          cards: (serverPlayer.cards ?? []) as Card[],
          hasCards: serverPlayer.cardCount > 0,
          isDealer: tableState.buttonUserId === serverPlayer.userId,
          isActive: tableState.activeUserId === serverPlayer.userId,
          hasActed: serverPlayer.hasActed ?? false,
          isSmallBlind: serverPlayer.isSmallBlind,
          isBigBlind: serverPlayer.isBigBlind,
          blindAmount: serverPlayer.blindAmount,
        },
      };
    });

    const visualSeats = applyRelativeLayout(updatedSeats, heroSeatIndex);

    setSeats(visualSeats);
    setCommunityCards(tableState.communityCards as Card[]);
    setPot(tableState.pot);
    const isShowdownStage = tableState.stage === 'showdown';
    setGameStage(tableState.stage as GameStage);
    setHasDealtPlayers(tableState.players.some((player) => player.cardCount > 0));
    setFoldedPositions(
      tableState.players.filter((player) => player.hasFolded).map((player) => player.seat as SeatPosition),
    );
    setPlayerBets(
      tableState.players.reduce<Partial<Record<SeatPosition, number>>>((acc, player) => {
        const seatPosition = player.seat as SeatPosition;
        const playerBet = tableState.playerBets?.[player.userId] ?? 0;
        acc[seatPosition] = playerBet;
        return acc;
      }, {}),
    );

    if (isShowdownStage) {
      const contenders = updatedSeats.filter(
        (seat) => seat.player && !tableState.players.find((p) => p.seat === seat.position)?.hasFolded,
      );
      setShowdownWinners(determineShowdownWinners(contenders));
    } else {
      setShowdownWinners([]);
    }

    const sideSummary = tableState.sidePotSummary ?? [];
    const totalSide = sideSummary.reduce((sum, potInfo) => sum + (potInfo?.amount ?? 0), 0);
    setSidePotTotal(totalSide);
  }, [tableState, currentUserId]);

  useEffect(() => {
    if (!tableState?.turnDeadlineMs) {
      setNowTs(Date.now());
      return;
    }
    const tick = () => setNowTs(Date.now());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [tableState?.turnDeadlineMs]);

  const formatEventTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatEventMessage = (event: TableEvent) => {
    if (event.type === 'system') {
      return event.message ?? 'System update';
    }

    const playerName = event.userId
      ? tableState?.players.find((player) => player.userId === event.userId)?.displayName ?? 'Player'
      : 'Player';

    if (event.type === 'chat') {
      return `${playerName}: ${event.message ?? ''}`;
    }

    if (event.type === 'action') {
      const amountSuffix = event.amount ? ` ${event.amount}` : '';
      return `${playerName} ${event.action ?? ''}${amountSuffix}`;
    }

    return event.message ?? '';
  };

  const renderEventLog = () => {
    if (!tableState?.events?.length) {
      return null;
    }

    return (
      <div className={styles.eventLog}>
        <div className={styles.eventLogHeader}>Table Activity</div>
        <ul className={styles.eventLogList}>
          {[...tableState.events].reverse().map((event) => (
            <li key={`${event.timestamp}-${event.userId}-${event.message ?? event.action}`} className={styles.eventLogItem}>
              <span className={styles.eventLogTime}>{formatEventTime(event.timestamp)}</span>
              <span className={styles.eventLogText}>{formatEventMessage(event)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const handleAllIn = () => {
    if (!isRemoteControlled) return;
    sendAction('all_in');
  };

  const renderBustoutModal = () => {
    if (!heroIsBusted) return null;
    const deadline = heroBustDeadlineMs ?? null;
    const remainingMs = deadline ? Math.max(0, deadline - nowTs) : null;
    const remainingSec = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

    const handleRebuy = () => {
      if (!isRemoteControlled) return;
      sendAction('rebuy');
    };

    const handleLeave = () => {
      if (!isRemoteControlled) return;
      sendAction('leave_table');
    };

    return (
      <div className={styles.bustoutOverlay}>
        <div className={styles.bustoutModal}>
          <div className={styles.bustoutTitle}>Вы выбилились из игры</div>
          <div className={styles.bustoutText}>
            {remainingSec !== null
              ? `Вы будете автоматически удалены со стола через ${remainingSec} c.`
              : 'Вы можете сделать ребай или выйти со стола.'}
          </div>
          <div className={styles.bustoutButtons}>
            <button type="button" className={styles.bustoutRebuyButton} onClick={handleRebuy}>
              Rebuy
            </button>
            <button type="button" className={styles.bustoutLeaveButton} onClick={handleLeave}>
              Leave table
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.appRoot}>
      <div className={styles.tableWrapper}>
        <div className={styles.tableOuter}>
          <div className={styles.tableRail}>
            <div className={styles.tableFelt}>
              {renderBoard()}
            </div>
          </div>
        </div>

        {/* слой анимации раздачи из центра стола */}
        <div className={styles.dealLayer}>
          {flyingCards.map((fc) => (
            <div
              key={fc.id}
              className={styles.flyingCard}
              style={{
                // смещения от центра стола к месту игрока
                '--tx': `${fc.tx}px`,
                '--ty': `${fc.ty}px`,
                '--delay': `${fc.delayMs}ms`,
              } as React.CSSProperties}
            >
              <CardBack size="small" />
            </div>
          ))}
        </div>

        {heroSeat && heroSeat.player && (
          <div ref={el => { if (heroSeat.player) winnerSeatRefs.current[heroSeat.player.id] = el; }}>
            <PlayerSeat
              key={`hero-${heroSeat.position}`}
              position={heroSeat.position}
              layoutPosition={heroSeat.layoutPosition}
              player={heroSeat.player}
              currentUserId={currentUserId}
              isActive={heroSeat.player.id === tableState?.activeUserId}
              revealCards={showdownRevealed && gameStage === 'showdown' && !foldedPositions.includes(heroSeat.position)}
              isWinner={showdownWinners.includes(heroSeat.position)}
              isHero
              timeRemainingMs={heroSeat.player.id === tableState?.activeUserId && turnDeadlineMs ? Math.max(0, turnDeadlineMs - nowTs) : null}
              actionTimeoutMs={actionTimeoutMs ?? undefined}
              highlightedCards={heroBestHand?.cards}
            />
          </div>
        )}

        {opponentSeats.map((seat) => {
          const visualPosition = seat.layoutPosition ?? seat.position;
          const seatPosition = seat.position;
          const folded = foldedPositions.includes(seatPosition);
          const isWinner = showdownWinners.includes(seatPosition);
          
          // Determine if cards should be revealed:
          // 1. Winner always shows cards
          // 2. Player chose SHOW via revealedCards
          // 3. Showdown revealed state (for current player)
          const playerId = seat.player?.id;
          const playerRevealData = playerId ? revealedCards[playerId] : null;
          const revealCards = isWinner || 
                              playerRevealData?.show === true || 
                              (showdownRevealed && gameStage === 'showdown' && !folded);
          
          // If player chose SHOW, use their revealed cards
          const hasRevealedCards = !!(playerRevealData?.show && playerRevealData.cards && playerRevealData.cards.length > 0);
          
          if (hasRevealedCards) {
            console.log(`🎴 RENDERING REVEALED CARDS for ${seat.player?.nickname}:`, playerRevealData!.cards);
          }
          
          const displayPlayer = seat.player ? {
            ...seat.player,
            cards: hasRevealedCards ? (playerRevealData!.cards as Card[]) : seat.player.cards,
            hasCards: seat.player.hasCards || hasRevealedCards  // Important: set hasCards true when revealed
          } : seat.player;

          return (
            <div 
              key={`${seatPosition}-${visualPosition}`}
              ref={el => { if (seat.player) winnerSeatRefs.current[seat.player.id] = el; }}
            >
              <PlayerSeat
                position={seatPosition}
                layoutPosition={visualPosition}
                player={displayPlayer}
                currentUserId={currentUserId}
                isActive={seat.player?.id === tableState?.activeUserId}
                revealCards={revealCards}
                isWinner={isWinner}
                timeRemainingMs={seat.player?.id === tableState?.activeUserId && turnDeadlineMs ? Math.max(0, turnDeadlineMs - nowTs) : null}
                actionTimeoutMs={actionTimeoutMs ?? undefined}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.controlsContainer}>
        <div className={styles.bettingControlsContainer}>
          <div className={styles.gameStageIndicator}>{formatStageLabel(gameStage)}</div>
          
          {/* Player Hand Timer - Shows when it's hero's turn */}
          <PlayerHandTimer
            isActive={heroSeat?.player?.id === tableState?.activeUserId && !heroIsBusted}
            duration={20}
            onTimeout={() => {
              // Auto-fold on timeout
              if (isRemoteControlled) {
                sendAction('fold');
              }
            }}
          />
          
          <BettingControls
            minBet={minBet}
            maxBet={maxBet}
            currentBet={currentBet}
            onBetChange={handleBetChange}
            callAmount={callAmount}
            onCall={handleCall}
            onFold={handleFold}
            onCheck={handleCheck}
            onRaise={handleRaise}
            canCheck={canCheck}
            isActive={controlsAreActive && !heroIsBusted}
            canRaise={canRaise}
            onAllIn={canAllIn ? handleAllIn : undefined}
            canAllIn={canAllIn}
            onTimeout={() => {
              // Auto-fold on timeout
              if (isRemoteControlled) {
                sendAction('fold');
              }
            }}
          />
          {socketError && <div className={styles.connectionError}>{socketError}</div>}
        </div>
      </div>

      {renderEventLog()}
      {renderBustoutModal()}
      
      {/* Best Hand Visualizer HUD */}
      {heroBestHand && (
        <HandStrengthHUD
          handRank={heroBestHand.rank}
          description={heroBestHand.description}
        />
      )}

      {/* Winner Animation - TEMPORARILY DISABLED */}
      {/* Set FEATURES.WIN_ANIMATION = true to re-enable */}
      {FEATURES.WIN_ANIMATION && showWinAnimation && winnerData && (
        <>
          <WinnerAnimation
            winnerData={winnerData}
            playerNames={getPlayerNames()}
            currentUserId={currentUserId}
            onComplete={() => {
              if (DEBUG_MODE) {
                console.log('🎉 Winner animation complete');
              }
              setShowWinAnimation(false);
              setWinnerData(null);
              // Reset for next hand
              setShowdownRevealed(false);
              setShowdownWinners([]);
            }}
          />
          
          {/* Chip Animation for each winner */}
          {winnerData.winners.map(winnerId => (
            <ChipAnimation
              key={`chip-${winnerId}`}
              fromElement={potRef.current}
              toElement={winnerSeatRefs.current[winnerId] || null}
              chipCount={15}
            />
          ))}
        </>
      )}

      {/* Test Controls (Debug UI) - TEMPORARILY DISABLED */}
      {/* Set FEATURES.TEST_BUTTON = true to re-enable */}
      {DEBUG_MODE && FEATURES.TEST_BUTTON && (
        <TestControls onTriggerAnimation={handleTestAnimation} />
      )}

      {/* Showdown Decision Panel - Show/Hide Cards */}
      {showDecisionPanel && isLoserInShowdown && (
        <ShowdownDecision
          onShowCards={handleShowCardsDecision}
          autoHideSeconds={5}
        />
      )}
    </div>
  );
};

export default PokerTable;
