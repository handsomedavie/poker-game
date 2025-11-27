import type { WinnerData } from '../components/WinnerAnimation/WinnerAnimation';

/**
 * Test utility to trigger winner animation without server
 * Call from browser console: window.testWinner()
 */

// Sample winner data for testing
export const sampleWinnerData: Record<string, WinnerData> = {
  // Single winner - Flush
  singleWinnerShowdown: {
    winners: ['1'], // Default user ID
    winType: 'showdown',
    potAmount: 500,
    potPerWinner: 500,
    winningHand: {
      rank: '6',
      name: 'Flush',
      cards: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'hearts' },
        { rank: '10', suit: 'hearts' },
        { rank: '7', suit: 'hearts' },
        { rank: '3', suit: 'hearts' },
      ],
    },
    allHandsRevealed: [
      {
        playerId: '1',
        hand: { rank: '6', name: 'Flush' },
        cards: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'hearts' },
        ],
      },
      {
        playerId: '2',
        hand: { rank: '2', name: 'Pair of Kings' },
        cards: [
          { rank: 'K', suit: 'diamonds' },
          { rank: 'K', suit: 'clubs' },
        ],
      },
    ],
  },

  // Split pot
  splitPot: {
    winners: ['1', '2'],
    winType: 'showdown',
    potAmount: 1000,
    potPerWinner: 500,
    winningHand: {
      rank: '8',
      name: 'Straight Flush',
      cards: [
        { rank: '9', suit: 'spades' },
        { rank: '8', suit: 'spades' },
        { rank: '7', suit: 'spades' },
        { rank: '6', suit: 'spades' },
        { rank: '5', suit: 'spades' },
      ],
    },
    allHandsRevealed: [
      {
        playerId: '1',
        hand: { rank: '8', name: 'Straight Flush' },
        cards: [
          { rank: '9', suit: 'spades' },
          { rank: '8', suit: 'spades' },
        ],
      },
      {
        playerId: '2',
        hand: { rank: '8', name: 'Straight Flush' },
        cards: [
          { rank: '7', suit: 'spades' },
          { rank: '6', suit: 'spades' },
        ],
      },
    ],
  },

  // Win by fold
  winByFold: {
    winners: ['1'],
    winType: 'fold',
    potAmount: 250,
    potPerWinner: 250,
  },

  // Royal Flush (big win)
  royalFlush: {
    winners: ['1'],
    winType: 'showdown',
    potAmount: 2500,
    potPerWinner: 2500,
    winningHand: {
      rank: '9',
      name: 'Royal Flush',
      cards: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
        { rank: 'J', suit: 'spades' },
        { rank: '10', suit: 'spades' },
      ],
    },
  },

  // Four of a Kind
  fourOfAKind: {
    winners: ['1'],
    winType: 'showdown',
    potAmount: 800,
    potPerWinner: 800,
    winningHand: {
      rank: '7',
      name: 'Four of a Kind - Aces',
      cards: [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'A', suit: 'diamonds' },
        { rank: 'A', suit: 'clubs' },
        { rank: 'K', suit: 'spades' },
      ],
    },
  },
};

/**
 * Trigger test winner animation
 * Usage in browser console:
 * 
 * // Single winner
 * window.testWinner()
 * 
 * // Split pot
 * window.testWinner('splitPot')
 * 
 * // Win by fold
 * window.testWinner('winByFold')
 * 
 * // Royal Flush
 * window.testWinner('royalFlush')
 */
export const setupTestWinnerAnimation = () => {
  if (typeof window === 'undefined') return;

  (window as any).testWinner = (scenario: keyof typeof sampleWinnerData = 'singleWinnerShowdown') => {
    const data = sampleWinnerData[scenario];
    
    if (!data) {
      console.error(`❌ Unknown scenario: ${scenario}`);
      console.log('Available scenarios:', Object.keys(sampleWinnerData));
      return;
    }

    console.log(`🎰 Testing winner animation: ${scenario}`);
    console.log('Winner data:', data);

    // Create custom event
    const event = new CustomEvent('test-winner', {
      detail: data,
    });

    window.dispatchEvent(event);
  };

  // List available scenarios
  (window as any).listWinnerScenarios = () => {
    console.log('📋 Available winner scenarios:');
    Object.keys(sampleWinnerData).forEach(key => {
      const data = sampleWinnerData[key as keyof typeof sampleWinnerData];
      console.log(`  - ${key}: ${data.winType} (${data.winners.length} winner${data.winners.length > 1 ? 's' : ''}, $${data.potAmount})`);
    });
    console.log('\nUsage: window.testWinner("scenarioName")');
  };

  console.log('🎮 Winner animation test utilities loaded!');
  console.log('  window.testWinner() - Test single winner');
  console.log('  window.testWinner("splitPot") - Test split pot');
  console.log('  window.listWinnerScenarios() - List all scenarios');
};

// Auto-setup in browser
if (typeof window !== 'undefined') {
  // Setup on window load
  if (document.readyState === 'complete') {
    setupTestWinnerAnimation();
  } else {
    window.addEventListener('load', setupTestWinnerAnimation);
  }
}
