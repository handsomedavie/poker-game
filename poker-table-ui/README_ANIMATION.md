# 🎉 Win Animation - Ready to Test!

## 🚀 Quick Start

```bash
npm start
```

Browser will open automatically at `http://localhost:5173`

## 🎮 How to Test

### Method 1: UI Button (Easiest!)

1. Look for **purple button** in top-right corner:
   ```
   🎮 Test Win Animation
   ```

2. Click it to open menu

3. Choose a scenario:
   - 🏆 Single Winner (Flush)
   - 🤝 Split Pot (2 Winners)
   - 🎯 Win by Fold
   - 👑 Royal Flush ($2500)
   - 🎴 Four of a Kind

4. Watch the animation! ✨

### Method 2: Browser Console

1. Open DevTools: `F12`
2. Go to Console tab
3. Type:
   ```javascript
   window.testWinner()
   // or
   window.testWinner('splitPot')
   // or
   window.testWinner('royalFlush')
   ```

## ✨ What You'll See

```
t=0s:   🃏 Cards reveal
t=1s:   ✨ Golden glow on winner
t=1.5s: 📢 Winner banner appears
t=2.5s: 💰 15 chips fly to winner
t=4s:   🎊 "YOU WIN!" + confetti
t=6s:   ✅ Clean up
```

## 🎨 Features

- ✅ Golden animated banner
- ✅ 15 flying chip particles
- ✅ Confetti celebration
- ✅ Smooth 60 FPS animation
- ✅ 6-second sequence
- ✅ Split pot support
- ✅ Win by fold support

## 🐛 Troubleshooting

### Button not visible?
```bash
# Restart the server:
Ctrl + C
npm start
```

### Animation not working?
```javascript
// In console, check if test function exists:
typeof window.testWinner
// Should return: "function"

// If undefined, hard refresh:
Ctrl + Shift + R
```

## 📚 More Info

See parent folder documentation:
- `../START_HERE.md` - Full guide
- `../READY_TO_VIEW.md` - Detailed checklist
- `../WIN_ANIMATION_SYSTEM.md` - Technical docs

## ✅ That's It!

Just run `npm start` and click the purple button! 🎉

🎰 💰 🎊
