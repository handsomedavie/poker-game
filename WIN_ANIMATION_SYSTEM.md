# 🎉 Win Animation & Pot Distribution System

## 📋 Overview

Полная система анимации победы с multi-stage последовательностью, показывающая:
- ✅ Раскрытие карт всех игроков
- ✅ Подсветка победителя(ей)
- ✅ Отображение выигрышной комбинации
- ✅ Анимация перемещения фишек к победителю
- ✅ Celebration эффект для текущего пользователя
- ✅ Split pot поддержка

**Время выполнения**: ~6 секунд  
**Сложность**: Medium

---

## 🎬 Animation Stages

### Полная Последовательность (6 секунд):

```
Stage 1: REVEAL (0-1s)
├─ Reveal all player cards (showdown only)
├─ Flip animations for opponent cards
└─ Duration: 1000ms

Stage 2: HIGHLIGHT (1-1.5s)
├─ Winner seats get golden glow
├─ Scale animation on winner
└─ Duration: 500ms

Stage 3: WIN TEXT (1.5-2.5s)
├─ Banner appears with winner name
├─ Shows winning hand type
├─ Displays pot amount
└─ Duration: 1000ms

Stage 4: CHIPS (2.5-4s)
├─ 15 chip particles fly from pot to winner
├─ Parabolic arc trajectory
├─ Staggered delays (60ms each)
└─ Duration: 1500ms

Stage 5: CELEBRATE (4-6s)
├─ "YOU WIN!" text (if current user won)
├─ 50 confetti particles falling
├─ Sound effect (optional)
└─ Duration: 2000ms

Stage 6: DONE (6s+)
└─ Clean up and callback onComplete()
```

---

## 🏗️ Architecture

### Component Structure

```
PokerTable
  └── WinnerAnimation (overlay)
       ├── Winner Banner (text & pot)
       ├── ChipAnimation (particles)
       └── Celebration (confetti + text)
  └── PlayerSeat (with winner glow)
```

### Data Flow

```
Server (gameLogic.js)
  ↓ 'handComplete' event
PokerTable (receives WinnerData)
  ↓ setState
WinnerAnimation (triggers multi-stage sequence)
  ↓ stages: reveal → highlight → winText → chips → celebrate → done
onComplete()
  ↓
Reset game state
```

---

## 📦 Components

### 1. WinnerAnimation.tsx

**Purpose**: Главный компонент анимации победы

**Props**:
```typescript
interface WinnerAnimationProps {
  winnerData: WinnerData;
  playerNames: Record<string, string>;
  onComplete: () => void;
  currentUserId?: string;
}
```

**WinnerData**:
```typescript
interface WinnerData {
  winners: string[];              // Player IDs
  winType: 'showdown' | 'fold';
  potAmount: number;
  potPerWinner: number;
  winningHand?: {
    rank: string;
    name: string;
    cards: Array<{ rank: string; suit: string }>;
  };
  allHandsRevealed?: Array<{
    playerId: string;
    hand: { rank: string; name: string };
    cards: Array<{ rank: string; suit: string }>;
  }>;
}
```

**State Management**:
```typescript
const [stage, setStage] = useState<
  'reveal' | 'highlight' | 'winText' | 'chips' | 'celebrate' | 'done'
>('reveal');

const [isUserWinner, setIsUserWinner] = useState(false);
```

**Stage Timing**:
```typescript
setTimeout(() => setStage('highlight'), 1000);   // +1s
setTimeout(() => setStage('winText'), 1500);     // +0.5s
setTimeout(() => setStage('chips'), 2500);       // +1s
setTimeout(() => setStage('celebrate'), 4000);   // +1.5s
setTimeout(() => {
  setStage('done');
  onComplete();
}, 6000);                                         // +2s
```

---

### 2. ChipAnimation.tsx

**Purpose**: Анимация фишек, летящих от банка к победителю

**Props**:
```typescript
interface ChipAnimationProps {
  fromElement: HTMLElement | null;  // Pot position
  toElement: HTMLElement | null;    // Winner seat position
  chipCount?: number;               // Default: 15
  onComplete?: () => void;
}
```

**Particle System**:
```typescript
interface ChipParticle {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;        // Stagger: i * 60ms
}
```

**Trajectory Calculation**:
```typescript
// Parabolic arc
const midX = deltaX / 2;
const midY = deltaY / 2 - 100;  // Arc height: 100px above

CSS:
--chip-mid-x: midX
--chip-mid-y: midY
--chip-end-x: deltaX
--chip-end-y: deltaY
```

**Animation**:
```css
@keyframes chipFly {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(var(--chip-mid-x), var(--chip-mid-y)) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translate(var(--chip-end-x), var(--chip-end-y)) scale(0.5);
  }
}
```

---

## 🎨 CSS Animations

### Winner Banner Entrance

```css
.winnerBanner {
  transform: scale(0) rotateZ(-180deg);
  opacity: 0;
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.winnerBanner.show {
  transform: scale(1) rotateZ(0deg);
  opacity: 1;
  animation: winnerPulse 2s ease-in-out infinite;
}
```

**Effect**: Банер вращается и масштабируется при появлении, затем пульсирует

### Text Shine Effect

```css
.winnerText {
  background: linear-gradient(90deg, 
    #1a1a1a 0%, 
    #4a4a4a 25%, 
    #fff 50%, 
    #4a4a4a 75%, 
    #1a1a1a 100%);
  background-size: 200% 100%;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: textShine 2s linear infinite;
}

@keyframes textShine {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

**Effect**: Текст мерцает, как неоновая вывеска

### Celebration Bounce

```css
@keyframes celebrationBounce {
  0% {
    transform: translateX(-50%) scale(0) rotateZ(-180deg);
    opacity: 0;
  }
  60% {
    transform: translateX(-50%) scale(1.2) rotateZ(10deg);
  }
  100% {
    transform: translateX(-50%) scale(1) rotateZ(0deg);
    opacity: 1;
  }
}
```

**Effect**: "YOU WIN!" текст появляется с вращением и отскоком

### Confetti Fall

```css
@keyframes confettiFall {
  0% {
    opacity: 1;
    transform: translateY(0) rotateZ(0deg);
  }
  100% {
    opacity: 0;
    transform: translateY(110vh) rotateZ(720deg);
  }
}
```

**Effect**: Конфетти падает сверху с вращением

### Winner Glow (PlayerSeat)

```css
@keyframes winnerGlowPulse {
  0%, 100% {
    box-shadow: 
      0 0 30px rgba(255, 215, 0, 0.8),
      0 0 60px rgba(255, 215, 0, 0.5);
    border: 3px solid #FFD700;
  }
  50% {
    box-shadow: 
      0 0 50px rgba(255, 215, 0, 1),
      0 0 100px rgba(255, 215, 0, 0.7),
      0 0 150px rgba(255, 215, 0, 0.5);
    border: 3px solid #FFF;
  }
}
```

**Effect**: Место победителя пульсирует золотым свечением

---

## 🔧 Integration in PokerTable

### State Management

```typescript
// In PokerTable.tsx
const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
const [showWinAnimation, setShowWinAnimation] = useState(false);

// Refs for chip animation
const potRef = useRef<HTMLDivElement>(null);
const winnerSeatRefs = useRef<Record<string, HTMLDivElement | null>>({});
```

### Socket Event Handler

```typescript
useEffect(() => {
  if (!socket) return;

  // Listen for hand completion
  socket.on('handComplete', (data: WinnerData) => {
    console.log('🏆 Hand complete:', data);
    
    // Set winner data
    setWinnerData(data);
    setShowWinAnimation(true);
    
    // Optional: Reveal all cards
    if (data.allHandsRevealed) {
      // Update player cards state to show revealed cards
      setRevealedCards(data.allHandsRevealed);
    }
  });

  return () => {
    socket.off('handComplete');
  };
}, [socket]);
```

### Render Winner Animation

```typescript
// In PokerTable render
return (
  <div className={styles.pokerTable}>
    {/* ... game content ... */}
    
    {/* Pot (ref for chip animation) */}
    <div ref={potRef} className={styles.potDisplay}>
      ${pot.toLocaleString()}
    </div>
    
    {/* Player Seats (refs for chip animation) */}
    {seats.map((seat, index) => (
      <div
        key={seat.position}
        ref={el => {
          if (seat.player) {
            winnerSeatRefs.current[seat.player.id] = el;
          }
        }}
        className={`
          ${styles.playerSeat}
          ${winnerData?.winners.includes(seat.player?.id || '') 
            ? styles.winnerGlow 
            : ''}
        `}
      >
        <PlayerSeat {...seat} />
      </div>
    ))}
    
    {/* Winner Animation Overlay */}
    {showWinAnimation && winnerData && (
      <>
        <WinnerAnimation
          winnerData={winnerData}
          playerNames={getPlayerNames()}
          currentUserId={currentUserId}
          onComplete={() => {
            setShowWinAnimation(false);
            setWinnerData(null);
            // Reset for next hand
            resetHandState();
          }}
        />
        
        {/* Chip Animation */}
        {winnerData.winners.map(winnerId => (
          <ChipAnimation
            key={winnerId}
            fromElement={potRef.current}
            toElement={winnerSeatRefs.current[winnerId]}
            chipCount={15}
          />
        ))}
      </>
    )}
  </div>
);
```

---

## 🖥️ Server-Side Implementation

### gameLogic.js - determineWinner()

```javascript
function determineWinner(gameState) {
  const activePlayers = gameState.players.filter(p => !p.folded);
  
  // Case 1: Everyone folded
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    
    return {
      winners: [winner.userId],
      winType: 'fold',
      potAmount: gameState.pot,
      potPerWinner: gameState.pot,
      winningHand: null,
      allHandsRevealed: null
    };
  }
  
  // Case 2: Showdown
  const handResults = activePlayers.map(player => ({
    playerId: player.userId,
    hand: evaluateHand(player.cards, gameState.communityCards),
    cards: player.cards
  }));
  
  // Sort by hand rank (best first)
  const sortedHands = handResults.sort((a, b) => 
    compareHands(b.hand, a.hand)
  );
  
  const bestHand = sortedHands[0].hand;
  
  // Find all winners (can be multiple for split pot)
  const winners = sortedHands.filter(h => 
    compareHands(h.hand, bestHand) === 0
  );
  
  const potPerWinner = Math.floor(gameState.pot / winners.length);
  
  return {
    winners: winners.map(w => w.playerId),
    winType: 'showdown',
    potAmount: gameState.pot,
    potPerWinner: potPerWinner,
    winningHand: {
      rank: bestHand.rank,
      name: bestHand.name,
      cards: bestHand.cards
    },
    allHandsRevealed: handResults
  };
}

// After hand completes
function completeHand(tableId) {
  const table = tables.get(tableId);
  const winnerData = determineWinner(table.gameState);
  
  // Award chips to winners
  winnerData.winners.forEach(winnerId => {
    const player = table.gameState.players.find(p => p.userId === winnerId);
    if (player) {
      player.chips += winnerData.potPerWinner;
    }
  });
  
  // Broadcast to all clients
  io.to(tableId).emit('handComplete', winnerData);
  
  // Reset for next hand after delay
  setTimeout(() => {
    resetHandState(tableId);
    io.to(tableId).emit('handReset');
  }, 7000); // After animation completes
}
```

### Hand Evaluation (evaluateHand)

```javascript
function evaluateHand(playerCards, communityCards) {
  const allCards = [...playerCards, ...communityCards];
  
  // Find best 5-card combination
  const bestHand = findBestHand(allCards);
  
  return {
    rank: bestHand.rank,        // 0-9 (High Card to Royal Flush)
    name: bestHand.name,        // "Pair of Aces"
    cards: bestHand.cards,      // 5 cards in the combination
    tiebreakers: bestHand.tiebreakers
  };
}

function compareHands(handA, handB) {
  if (handA.rank !== handB.rank) {
    return handA.rank - handB.rank;
  }
  
  // Same rank - compare tiebreakers
  for (let i = 0; i < handA.tiebreakers.length; i++) {
    if (handA.tiebreakers[i] !== handB.tiebreakers[i]) {
      return handA.tiebreakers[i] - handB.tiebreakers[i];
    }
  }
  
  return 0; // Perfect tie - split pot
}
```

---

## 🎮 Usage Examples

### Example 1: Single Winner (Showdown)

```typescript
// Server sends:
const winnerData = {
  winners: ['player_123'],
  winType: 'showdown',
  potAmount: 500,
  potPerWinner: 500,
  winningHand: {
    rank: 6,
    name: 'Flush',
    cards: [
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'hearts' },
      { rank: '10', suit: 'hearts' },
      { rank: '7', suit: 'hearts' },
      { rank: '3', suit: 'hearts' }
    ]
  },
  allHandsRevealed: [
    {
      playerId: 'player_123',
      hand: { rank: 6, name: 'Flush' },
      cards: [...]
    },
    {
      playerId: 'player_456',
      hand: { rank: 2, name: 'Pair of Kings' },
      cards: [...]
    }
  ]
};

// Client displays:
// Banner: "Alice wins with Flush!"
// Pot: $500
// Chips fly to Alice's seat
// Confetti if current user is Alice
```

### Example 2: Split Pot

```typescript
const winnerData = {
  winners: ['player_123', 'player_456'],
  winType: 'showdown',
  potAmount: 1000,
  potPerWinner: 500,
  winningHand: {
    rank: 8,
    name: 'Straight Flush',
    cards: [...]
  },
  allHandsRevealed: [...]
};

// Client displays:
// Banner: "Alice & Bob win with Straight Flush!"
// Pot: $1000
// Split Pot: $500 each
// Chips fly to both Alice and Bob
```

### Example 3: Win by Fold

```typescript
const winnerData = {
  winners: ['player_789'],
  winType: 'fold',
  potAmount: 250,
  potPerWinner: 250,
  winningHand: null,
  allHandsRevealed: null
};

// Client displays:
// Banner: "Charlie wins by fold!"
// Pot: $250
// No card reveal (opponent cards stay hidden)
// Chips fly to Charlie
```

---

## 🎯 Visual Effects

### Color Palette

```css
/* Gold - Winner theme */
--gold-primary: #FFD700;
--gold-light: #FFF;
--gold-dark: #d4af37;

/* Gradient - Banner background */
background: linear-gradient(135deg, 
  rgba(212, 175, 55, 0.95) 0%, 
  rgba(255, 215, 0, 0.95) 50%, 
  rgba(212, 175, 55, 0.95) 100%
);

/* Shadow - Glow effect */
box-shadow: 
  0 0 40px rgba(255, 215, 0, 0.8),
  0 0 80px rgba(255, 215, 0, 0.5);

/* Confetti colors */
colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
```

### Typography

```css
.winnerText {
  font-size: 3em;
  font-weight: bold;
  /* Shine gradient text */
}

.potAmount {
  font-size: 2.5em;
  font-weight: bold;
  color: #2d5016; /* Green for money */
}

.celebrationText {
  font-size: 6em;
  font-weight: bold;
  color: #FFD700;
}
```

### Responsive Design

```css
@media (max-width: 768px) {
  .winnerText { font-size: 2em; }
  .potAmount { font-size: 1.8em; }
  .celebrationText { font-size: 4em; }
  .winnerBanner { padding: 20px 30px; }
}
```

---

## ⚡ Performance Considerations

### Animation Optimization

```typescript
// Use CSS transforms (GPU-accelerated)
✅ transform: translate(), scale(), rotate()
❌ left/top (causes reflow)

// Use will-change for smooth animations
.chipParticle {
  will-change: transform, opacity;
}

// Cleanup particles after animation
useEffect(() => {
  const timer = setTimeout(() => {
    // Remove particles from DOM
    setParticles([]);
  }, totalDuration);
  
  return () => clearTimeout(timer);
}, []);
```

### Memory Management

```typescript
// Clean up timers
useEffect(() => {
  const timers = [];
  // ... create timers
  
  return () => {
    timers.forEach(t => clearTimeout(t));
  };
}, []);

// Reset state after animation
const handleComplete = () => {
  setShowWinAnimation(false);
  setWinnerData(null);
  setParticles([]);
};
```

---

## 🧪 Testing

### Test Cases

```typescript
// 1. Single winner - showdown
test('shows winner banner with hand name', () => {
  render(<WinnerAnimation winnerData={singleWinner} />);
  expect(screen.getByText(/wins with Flush/i)).toBeInTheDocument();
});

// 2. Split pot
test('shows split pot message', () => {
  render(<WinnerAnimation winnerData={splitPot} />);
  expect(screen.getByText(/Split Pot/i)).toBeInTheDocument();
});

// 3. Win by fold
test('shows fold message', () => {
  render(<WinnerAnimation winnerData={foldWin} />);
  expect(screen.getByText(/wins by fold/i)).toBeInTheDocument();
});

// 4. Current user wins - celebration
test('shows celebration for current user', () => {
  render(<WinnerAnimation winnerData={userWin} currentUserId="player_123" />);
  expect(screen.getByText('YOU WIN!')).toBeInTheDocument();
});

// 5. Chip animation
test('creates correct number of chip particles', () => {
  render(<ChipAnimation chipCount={15} />);
  const chips = screen.getAllByRole('presentation');
  expect(chips).toHaveLength(15);
});
```

---

## 🎉 Enhancements (Future)

### Sound Effects

```typescript
// In WinnerAnimation
useEffect(() => {
  if (stage === 'celebrate' && isUserWinner) {
    const audio = new Audio('/sounds/win.mp3');
    audio.volume = 0.5;
    audio.play();
  }
}, [stage, isUserWinner]);
```

### Fireworks Effect

```typescript
// Alternative to confetti
const Fireworks = () => {
  return (
    <div className={styles.fireworksContainer}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div 
          key={i} 
          className={styles.firework}
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.3}s`
          }}
        />
      ))}
    </div>
  );
};
```

### Hand History

```typescript
// Save to history
const saveHandHistory = (winnerData: WinnerData) => {
  const history = {
    timestamp: Date.now(),
    winners: winnerData.winners,
    pot: winnerData.potAmount,
    winningHand: winnerData.winningHand,
    allHands: winnerData.allHandsRevealed
  };
  
  // Store in localStorage or backend
  localStorage.setItem(`hand_${Date.now()}`, JSON.stringify(history));
};
```

### Animation Settings

```typescript
// User preferences
interface AnimationSettings {
  enabled: boolean;
  speed: 0.5 | 1 | 2;  // Slow/Normal/Fast
  confettiEnabled: boolean;
  soundEnabled: boolean;
}

// Apply speed multiplier
const duration = 6000 / settings.speed;
```

---

## 📝 Summary

### Created Files

1. ✅ `WinnerAnimation.tsx` - Main animation component
2. ✅ `ChipAnimation.tsx` - Chip particle system
3. ✅ `winner_animation.module.css` - All animations styles
4. ✅ `WIN_ANIMATION_SYSTEM.md` - Complete documentation

### Features Implemented

- ✅ Multi-stage animation sequence (6 stages)
- ✅ Winner banner with golden theme
- ✅ Text shine effect
- ✅ Chip flying animation with parabolic arc
- ✅ Confetti celebration for current user
- ✅ Split pot support
- ✅ Win by fold support
- ✅ Responsive design
- ✅ GPU-accelerated animations

### Integration Required

1. ⏳ Add socket event listener in PokerTable
2. ⏳ Add refs for pot and player seats
3. ⏳ Add winner glow CSS to PlayerSeat
4. ⏳ Server-side determineWinner() logic
5. ⏳ Test with multiplayer

---

**🎰 Win animation system готов к интеграции!** 🎉💰✨
