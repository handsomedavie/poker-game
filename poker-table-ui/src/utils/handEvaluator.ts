import type { Card } from '../types/player.types';

export type HandRank = 
  | 'Royal Flush'
  | 'Straight Flush'
  | 'Four of a Kind'
  | 'Full House'
  | 'Flush'
  | 'Straight'
  | 'Three of a Kind'
  | 'Two Pair'
  | 'Pair'
  | 'High Card';

export interface EvaluatedHand {
  rank: HandRank;
  cards: Card[];
  description: string;
}

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_NAMES: Record<number, string> = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
  9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
  4: 'Four', 3: 'Three', 2: 'Two'
};

const SUIT_SYMBOLS: Record<string, string> = {
  'hearts': '♥',
  'diamonds': '♦',
  'clubs': '♣',
  'spades': '♠'
};

/**
 * Get numeric value of a card rank
 */
function getCardValue(card: Card): number {
  return RANK_VALUES[card.rank];
}

/**
 * Sort cards by value (descending)
 */
function sortByValue(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getCardValue(b) - getCardValue(a));
}

/**
 * Check if all cards have the same suit (Flush)
 */
function isFlush(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const suit = cards[0].suit;
  return cards.every(card => card.suit === suit);
}

/**
 * Check if cards form a sequence (Straight)
 * Returns the highest card in the straight, or null if not a straight
 */
function isStraight(cards: Card[]): Card | null {
  if (cards.length !== 5) return null;
  
  const sorted = sortByValue(cards);
  const values = sorted.map(c => getCardValue(c));
  
  // Check for regular straight
  for (let i = 0; i < 4; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // Check for A-2-3-4-5 (wheel)
      if (i === 0 && values[0] === 14 && values[4] === 2) {
        // Special case: wheel straight (A-2-3-4-5)
        for (let j = 1; j < 4; j++) {
          if (values[j] - values[j + 1] !== 1) return null;
        }
        return sorted[4]; // Return the 5 as the "high" card in wheel
      }
      return null;
    }
  }
  
  return sorted[0]; // Return highest card
}

/**
 * Group cards by rank
 */
function groupByRank(cards: Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>();
  for (const card of cards) {
    const value = getCardValue(card);
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(card);
  }
  return groups;
}

/**
 * Evaluate a 5-card hand
 */
function evaluateFiveCards(cards: Card[]): EvaluatedHand | null {
  if (cards.length !== 5) return null;

  const sorted = sortByValue(cards);
  const groups = groupByRank(cards);
  const groupSizes = Array.from(groups.values()).map(g => g.length).sort((a, b) => b - a);
  
  const flush = isFlush(cards);
  const straight = isStraight(cards);
  
  // Royal Flush
  if (flush && straight) {
    const highCard = getCardValue(sorted[0]);
    if (highCard === 14 && getCardValue(sorted[4]) === 10) {
      return {
        rank: 'Royal Flush',
        cards: sorted,
        description: `Royal Flush in ${SUIT_SYMBOLS[cards[0].suit]}`
      };
    }
    // Straight Flush
    return {
      rank: 'Straight Flush',
      cards: sorted,
      description: `Straight Flush, ${RANK_NAMES[getCardValue(straight)]} high`
    };
  }
  
  // Four of a Kind
  if (groupSizes[0] === 4) {
    const quadGroup = Array.from(groups.values()).find(g => g.length === 4)!;
    // Return only the 4 cards of the quad (no kicker)
    return {
      rank: 'Four of a Kind',
      cards: quadGroup,
      description: `Four ${RANK_NAMES[getCardValue(quadGroup[0])]}s`
    };
  }
  
  // Full House
  if (groupSizes[0] === 3 && groupSizes[1] === 2) {
    const tripGroup = Array.from(groups.values()).find(g => g.length === 3)!;
    const pairGroup = Array.from(groups.values()).find(g => g.length === 2)!;
    return {
      rank: 'Full House',
      cards: [...tripGroup, ...pairGroup],
      description: `${RANK_NAMES[getCardValue(tripGroup[0])]}s full of ${RANK_NAMES[getCardValue(pairGroup[0])]}s`
    };
  }
  
  // Flush
  if (flush) {
    return {
      rank: 'Flush',
      cards: sorted,
      description: `Flush, ${RANK_NAMES[getCardValue(sorted[0])]} high`
    };
  }
  
  // Straight
  if (straight) {
    return {
      rank: 'Straight',
      cards: sorted,
      description: `Straight, ${RANK_NAMES[getCardValue(straight)]} high`
    };
  }
  
  // Three of a Kind
  if (groupSizes[0] === 3) {
    const tripGroup = Array.from(groups.values()).find(g => g.length === 3)!;
    // Return only the 3 cards of the set (no kickers)
    return {
      rank: 'Three of a Kind',
      cards: tripGroup,
      description: `Three ${RANK_NAMES[getCardValue(tripGroup[0])]}s`
    };
  }
  
  // Two Pair
  if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    const pairs = Array.from(groups.values())
      .filter(g => g.length === 2)
      .sort((a, b) => getCardValue(b[0]) - getCardValue(a[0]));
    // Return only the 4 cards of both pairs (no kicker)
    return {
      rank: 'Two Pair',
      cards: [...pairs[0], ...pairs[1]],
      description: `Two Pair, ${RANK_NAMES[getCardValue(pairs[0][0])]}s and ${RANK_NAMES[getCardValue(pairs[1][0])]}s`
    };
  }
  
  // Pair
  if (groupSizes[0] === 2) {
    const pairGroup = Array.from(groups.values()).find(g => g.length === 2)!;
    // Return only the 2 cards of the pair (no kickers)
    return {
      rank: 'Pair',
      cards: pairGroup,
      description: `Pair of ${RANK_NAMES[getCardValue(pairGroup[0])]}s`
    };
  }
  
  // High Card - return only the highest card
  return {
    rank: 'High Card',
    cards: [sorted[0]],
    description: `${RANK_NAMES[getCardValue(sorted[0])]} high`
  };
}

/**
 * Get all possible 5-card combinations from an array of cards
 */
function getCombinations(cards: Card[], size: number): Card[][] {
  if (size === 1) return cards.map(c => [c]);
  if (size > cards.length) return [];
  
  const result: Card[][] = [];
  
  for (let i = 0; i <= cards.length - size; i++) {
    const head = cards[i];
    const tailCombos = getCombinations(cards.slice(i + 1), size - 1);
    for (const tail of tailCombos) {
      result.push([head, ...tail]);
    }
  }
  
  return result;
}

/**
 * Compare two hands and return the better one
 * Returns 1 if hand1 is better, -1 if hand2 is better, 0 if equal
 */
function compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
  const rankOrder: HandRank[] = [
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
  
  const rank1Index = rankOrder.indexOf(hand1.rank);
  const rank2Index = rankOrder.indexOf(hand2.rank);
  
  if (rank1Index < rank2Index) return 1;
  if (rank1Index > rank2Index) return -1;
  
  // Same rank, compare by card values
  for (let i = 0; i < Math.min(hand1.cards.length, hand2.cards.length); i++) {
    const val1 = getCardValue(hand1.cards[i]);
    const val2 = getCardValue(hand2.cards[i]);
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  
  return 0;
}

/**
 * Find the best 5-card poker hand from a set of cards (2-7 cards)
 * Returns the hand evaluation and the specific 5 cards that make it up
 */
export function evaluateBestHand(cards: Card[]): EvaluatedHand | null {
  if (cards.length < 5) return null;
  
  // If exactly 5 cards, evaluate directly
  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }
  
  // For more than 5 cards, find all 5-card combinations and evaluate each
  const combinations = getCombinations(cards, 5);
  let bestHand: EvaluatedHand | null = null;
  
  for (const combo of combinations) {
    const evaluated = evaluateFiveCards(combo);
    if (!evaluated) continue;
    
    if (!bestHand || compareHands(evaluated, bestHand) > 0) {
      bestHand = evaluated;
    }
  }
  
  return bestHand;
}

/**
 * Check if a specific card is part of the best hand
 */
export function isCardInBestHand(card: Card, bestHand: EvaluatedHand | null): boolean {
  if (!bestHand) return false;
  return bestHand.cards.some(c => c.rank === card.rank && c.suit === card.suit);
}
