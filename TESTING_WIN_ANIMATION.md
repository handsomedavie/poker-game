# 🧪 Testing Win Animation - Quick Guide

## 🎯 Как Протестировать Анимацию Победы

Система включает встроенные тестовые утилиты для проверки анимации **БЕЗ СЕРВЕРА**.

---

## 🚀 Быстрый Старт

### 1. Запустите Приложение
```powershell
cd c:\Users\DAVIE\Desktop\windsurf ai\poker\poker-table-ui
npm start
```

### 2. Откройте DevTools Console
```
F12 → Console tab
```

### 3. Запустите Тест
```javascript
// Простой победитель (Flush)
window.testWinner()

// Разделённый банк (Split Pot)
window.testWinner('splitPot')

// Победа фолдом
window.testWinner('winByFold')

// Royal Flush (большой выигрыш)
window.testWinner('royalFlush')

// Four of a Kind
window.testWinner('fourOfAKind')
```

### 4. Посмотрите Список Сценариев
```javascript
window.listWinnerScenarios()
```

---

## 📋 Доступные Тестовые Сценарии

### 1. **singleWinnerShowdown** (по умолчанию)
```javascript
window.testWinner()
// или
window.testWinner('singleWinnerShowdown')
```

**Параметры:**
- Winners: 1 игрок (текущий пользователь)
- Win Type: Showdown
- Pot: $500
- Winning Hand: Flush

**Ожидаемый Результат:**
- ✅ Banner: "Unknown wins with Flush!"
- ✅ Pot Amount: $500
- ✅ 15 chips fly to winner
- ✅ "YOU WIN!" + confetti (если вы победитель)

---

### 2. **splitPot**
```javascript
window.testWinner('splitPot')
```

**Параметры:**
- Winners: 2 игрока
- Win Type: Showdown
- Pot: $1000
- Per Winner: $500
- Winning Hand: Straight Flush

**Ожидаемый Результат:**
- ✅ Banner: "Unknown & Unknown win with Straight Flush!"
- ✅ Total Pot: $1000
- ✅ Split Pot: $500 each
- ✅ Chips fly to both winners

---

### 3. **winByFold**
```javascript
window.testWinner('winByFold')
```

**Параметры:**
- Winners: 1 игрок
- Win Type: Fold
- Pot: $250

**Ожидаемый Результат:**
- ✅ Banner: "Unknown wins by fold!"
- ✅ Pot Amount: $250
- ✅ No winning hand display
- ✅ Chips fly to winner

---

### 4. **royalFlush**
```javascript
window.testWinner('royalFlush')
```

**Параметры:**
- Winners: 1 игрок
- Win Type: Showdown
- Pot: $2500
- Winning Hand: Royal Flush (A♠ K♠ Q♠ J♠ 10♠)

**Ожидаемый Результат:**
- ✅ Banner: "Unknown wins with Royal Flush!"
- ✅ Pot Amount: $2500
- ✅ "YOU WIN!" + celebration

---

### 5. **fourOfAKind**
```javascript
window.testWinner('fourOfAKind')
```

**Параметры:**
- Winners: 1 игрок
- Win Type: Showdown
- Pot: $800
- Winning Hand: Four of a Kind - Aces

**Ожидаемый Результат:**
- ✅ Banner: "Unknown wins with Four of a Kind - Aces!"
- ✅ Pot Amount: $800

---

## 🎬 Последовательность Анимации

При вызове `window.testWinner()` вы увидите:

```
t=0s:     🃏 Stage 1: REVEAL
          └─ Раскрываются карты всех игроков

t=1s:     ✨ Stage 2: HIGHLIGHT
          └─ Золотое свечение на месте победителя

t=1.5s:   📢 Stage 3: WIN TEXT
          └─ Появляется баннер с результатом

t=2.5s:   💰 Stage 4: CHIPS
          └─ 15 фишек летят от банка к победителю

t=4s:     🎉 Stage 5: CELEBRATE
          └─ "YOU WIN!" + 50 конфетти (если вы победитель)

t=6s:     ✅ Stage 6: DONE
          └─ Cleanup и возврат к игре
```

---

## 🔍 Проверка в Console

### Успешный Запуск:
```
🎮 Winner animation test utilities loaded!
  window.testWinner() - Test single winner
  window.testWinner("splitPot") - Test split pot
  window.listWinnerScenarios() - List all scenarios
```

### При Вызове Теста:
```
🎰 Testing winner animation: singleWinnerShowdown
Winner data: { winners: ["1"], winType: "showdown", ... }
🧪 Test winner event triggered: { winners: ["1"], ... }
```

### После Завершения:
```
🎉 Winner animation complete
```

---

## 🐛 Troubleshooting

### Тестовые функции не загружены
```javascript
// Проверьте в console:
typeof window.testWinner
// Должно быть: "function"

// Если "undefined", проверьте:
// 1. Страница полностью загружена?
// 2. Нет ошибок в console?
// 3. Импорт testWinnerAnimation.ts правильный?
```

### Анимация не запускается
```javascript
// 1. Проверьте что событие отправлено:
window.dispatchEvent(new CustomEvent('test-winner', {
  detail: {
    winners: ['1'],
    winType: 'showdown',
    potAmount: 500,
    potPerWinner: 500
  }
}));

// 2. Проверьте listener:
// В PokerTable.tsx должен быть useEffect с window.addEventListener('test-winner')
```

### Фишки не летят
```javascript
// Проверьте refs в console:
// Откройте React DevTools → Components → PokerTable
// Найдите: potRef.current и winnerSeatRefs.current

// Должны быть HTMLDivElement, не null
```

### Конфетти не появляется
```javascript
// Конфетти показывается только если:
// 1. currentUserId совпадает с winners[0]
// 2. isUserWinner === true

// Проверьте в console:
// currentUserId должен быть '1' (FALLBACK_USER_ID)
```

---

## 📸 Визуальная Проверка

### Checklist:
- [ ] **Banner появляется** - Золотой баннер с текстом победителя
- [ ] **Banner пульсирует** - Золотое свечение мигает
- [ ] **Текст мерцает** - Shine эффект на тексте
- [ ] **Pot amount видно** - Сумма банка отображается
- [ ] **Split pot (если есть)** - "Split Pot: $X each"
- [ ] **Фишки летят** - 15 красных фишек движутся к победителю
- [ ] **Параболическая траектория** - Фишки летят дугой, не прямо
- [ ] **Staggered delays** - Фишки летят с задержкой (60ms)
- [ ] **Конфетти (если выиграл ты)** - 50 разноцветных частиц падают
- [ ] **"YOU WIN!" (если выиграл ты)** - Большой текст появляется с bounce
- [ ] **Cleanup после 6s** - Всё исчезает, состояние сбрасывается

---

## 🎨 Кастомный Тест

Создайте свой тестовый сценарий:

```javascript
// В console:
const customWinner = {
  winners: ['1', '3'],  // Multiple winners
  winType: 'showdown',
  potAmount: 1500,
  potPerWinner: 750,
  winningHand: {
    rank: '5',
    name: 'Full House',
    cards: [
      { rank: 'K', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
      { rank: '10', suit: 'spades' },
      { rank: '10', suit: 'hearts' },
    ]
  }
};

// Trigger animation
window.dispatchEvent(new CustomEvent('test-winner', {
  detail: customWinner
}));
```

---

## 📊 Performance Check

### FPS Monitor:
```javascript
// Откройте DevTools → More Tools → Rendering
// Enable "Frame Rendering Stats"

// Во время анимации FPS должен быть:
// ✅ 60 FPS - Отлично
// ⚠️  30-60 FPS - Хорошо
// ❌ <30 FPS - Проблема производительности
```

### Memory Check:
```javascript
// DevTools → Memory → Take snapshot
// После анимации memory не должна расти
// Все particles должны быть очищены
```

---

## 🎯 Next Steps

### Когда Тесты Работают:
1. ✅ Настройте сервер для отправки `handComplete` events
2. ✅ Протестируйте с реальными игроками
3. ✅ Добавьте звуковые эффекты (опционально)
4. ✅ Настройте анимацию под свой стиль

### Server Integration:
```javascript
// Backend должен отправить:
socket.send(JSON.stringify({
  type: 'handComplete',
  payload: {
    winners: ['player_123'],
    winType: 'showdown',
    potAmount: 500,
    potPerWinner: 500,
    winningHand: {
      rank: '6',
      name: 'Flush',
      cards: [...]
    }
  }
}));
```

---

## 📝 Summary

**Тестовые утилиты позволяют:**
- ✅ Проверить анимацию БЕЗ сервера
- ✅ Тестировать разные сценарии (single, split, fold)
- ✅ Быстро итерировать дизайн
- ✅ Отлаживать проблемы визуально
- ✅ Демонстрировать функционал заказчику

**Команды:**
```javascript
window.testWinner()                 // Быстрый тест
window.testWinner('splitPot')       // Конкретный сценарий
window.listWinnerScenarios()        // Список всех сценариев
```

**🎉 Happy Testing!** 🎰💰✨
