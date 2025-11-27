# ⚡ Quick Re-Enable Guide - Win Animation

**Time Required:** 5 minutes  
**Difficulty:** Easy  
**Files to Edit:** 1 file (PokerTable.tsx)

---

## 🚀 2-Step Re-Enable

### Step 1: Enable Feature Flags (30 seconds)

```typescript
// File: poker-table-ui/src/components/PokerTable/PokerTable.tsx
// Lines: 26-27

// Change from:
const FEATURES = {
  WIN_ANIMATION: false,  // ← Currently disabled
  TEST_BUTTON: false,    // ← Currently disabled
};

// To:
const FEATURES = {
  WIN_ANIMATION: true,   // ✅ ENABLED
  TEST_BUTTON: true,     // ✅ ENABLED
};
```

### Step 2: Uncomment Code Blocks (2 minutes)

#### Block 1: Socket Listener (Lines 339-385)
```typescript
// Remove the opening /* and closing */

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
      
      if (DEBUG_MODE) {
        console.log('📥 Socket message received:', message.type || message.event, message);
      }
      
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
```

#### Block 2: Test Event Listener (Lines 389-407)
```typescript
// Remove the opening /* and closing */

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
```

#### Block 3: Auto-Trigger (Lines 411-461)
```typescript
// Remove the opening /* and closing */

useEffect(() => {
  if (!FEATURES.WIN_ANIMATION) return;
  
  if (showdownRevealed && showdownWinners.length > 0 && gameStage === 'showdown' && !showWinAnimation) {
    const timer = setTimeout(() => {
      const winnerPlayerIds = showdownWinners
        .map(pos => seats.find(s => s.position === pos && s.player)?.player?.id)
        .filter((id): id is string => id !== undefined);

      if (winnerPlayerIds.length === 0) return;

      const winnerHands = showdownWinners.map(pos => {
        const seat = seats.find(s => s.position === pos);
        if (!seat?.player?.cards || seat.player.cards.length === 0) return null;
        
        const allCards = [...seat.player.cards, ...communityCards];
        const hand = evaluateBestHand(allCards);
        return hand;
      }).filter(h => h !== null) as EvaluatedHand[];

      const bestHand = winnerHands[0];

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
    }, 1500);

    return () => clearTimeout(timer);
  }
}, [showdownRevealed, showdownWinners, gameStage, showWinAnimation, seats, communityCards, pot]);
```

### Step 3: Replace Stub Function (Lines 329-336)
```typescript
// Change from:
const handleTestAnimation = useCallback((_scenario: keyof typeof sampleWinnerData) => {
  // Feature disabled - no action
  if (DEBUG_MODE) {
    console.log('🔒 Win animation feature is currently disabled');
  }
}, []);

// To:
const handleTestAnimation = useCallback((scenario: keyof typeof sampleWinnerData) => {
  const data = sampleWinnerData[scenario];
  if (DEBUG_MODE) {
    console.log(`🧪 Triggering test animation: ${scenario}`, data);
  }
  setWinnerData(data);
  setShowWinAnimation(true);
}, []);
```

---

## ✅ Test After Re-Enable

```powershell
# Restart the app
npm start
```

### Expected Results:

1. **Test Button Appears**
   - Top-right corner
   - Click → Select scenario → Banner shows

2. **Socket Listener Active**
   - Console: `🎧 Listening for handComplete events...`

3. **Win Banner Works**
   - Shows on hand completion
   - Royal blue-gold design
   - 3-second animation
   - Disappears automatically

4. **No Errors**
   - TypeScript compiles
   - No console errors
   - Smooth animations

---

## 🔍 Troubleshooting

### Test button doesn't appear
- Check `FEATURES.TEST_BUTTON = true`
- Check `DEBUG_MODE = true` in env config
- Restart app

### Banner doesn't show
- Check `FEATURES.WIN_ANIMATION = true`
- Check all 3 useEffect blocks uncommented
- Check server emits handComplete event
- Check console for logs

### TypeScript errors
- Make sure ALL multi-line comments removed
- Make sure stub function replaced
- Run `npm run build` to verify

---

## 📋 Quick Checklist

Before re-enabling:
- [ ] Backup current working code (optional)
- [ ] Read this guide fully

Re-enable steps:
- [ ] Set `FEATURES.WIN_ANIMATION = true`
- [ ] Set `FEATURES.TEST_BUTTON = true`
- [ ] Uncomment socket listener (lines 339-385)
- [ ] Uncomment test listener (lines 389-407)
- [ ] Uncomment auto-trigger (lines 411-461)
- [ ] Replace stub function (lines 329-336)

Test:
- [ ] Run `npm start`
- [ ] No TypeScript errors
- [ ] Test button appears
- [ ] Click test button → Banner shows
- [ ] Play real hand → Banner appears
- [ ] Check console logs

If all checked: ✅ Feature re-enabled successfully!

---

## 🎯 One-Line Summary

**To re-enable:** Set flags to `true`, uncomment 3 useEffect blocks, replace stub function, restart.

---

**Time:** ~5 minutes  
**Difficulty:** Easy  
**Risk:** Low (all code preserved)

For detailed info: See `🔒_FEATURE_FROZEN.md`
