# 🚨 КРИТИЧНО: Серверная Интеграция Win Banner

## ❌ ПРОБЛЕМА:
Баннер победы работает на тестовой кнопке, но **НЕ появляется в реальной игре** когда hand завершается.

## 🔍 ПРИЧИНА:
Сервер **НЕ отправляет** событие `handComplete` когда раунд завершается.

Клиент готов и слушает событие, но сервер его не посылает!

---

## ✅ РЕШЕНИЕ: Добавить Emit на Сервере

### 📍 Где Добавить:
Найдите функцию которая определяет победителя (обычно `resolveShowdown`, `completeHand`, или `determineWinner`).

### 📡 Код Для Сервера:

#### Вариант 1 - Win by Fold (Все Сфолдили):
```javascript
// После того как все кроме одного сфолдили
function handleAllFolded(gameState, tableId, io) {
  const activePlayers = gameState.players.filter(p => !p.folded && !p.busted);
  
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    
    console.log('📡 SERVER: Emitting handComplete (fold)');
    
    // ВАЖНО: Отправить всем клиентам
    io.to(tableId).emit('handComplete', {
      winners: [winner.id],            // Array of winner IDs
      potAmount: gameState.pot,        // Total pot for THIS hand
      potPerWinner: gameState.pot,     // Same if single winner
      winType: 'fold'                  // Type: 'fold' or 'showdown'
    });
    
    // Подождать 3 секунды для анимации, затем новая раздача
    setTimeout(() => {
      startNewHand(gameState, tableId, io);
    }, 3000);
  }
}
```

#### Вариант 2 - Win at Showdown (Лучшая Рука):
```javascript
// После river когда все карты открыты
function resolveShowdown(gameState, tableId, io) {
  const activePlayers = gameState.players.filter(p => !p.folded && !p.busted);
  
  // Оценить руки всех игроков
  const results = evaluateHands(activePlayers, gameState.communityCards);
  results.sort((a, b) => b.handRank - a.handRank); // Лучшая рука сверху
  
  const topRank = results[0].handRank;
  const winners = results.filter(r => r.handRank === topRank);
  
  console.log('📡 SERVER: Emitting handComplete (showdown)');
  console.log('🏆 Winners:', winners.map(w => w.player.nickname));
  
  const potPerWinner = Math.floor(gameState.pot / winners.length);
  
  io.to(tableId).emit('handComplete', {
    winners: winners.map(w => w.player.id),
    potAmount: gameState.pot,
    potPerWinner: potPerWinner,
    winType: 'showdown',
    winningHand: {
      rank: results[0].handRankName,
      name: results[0].handName,           // e.g., "Royal Flush"
      cards: results[0].bestCards
    }
  });
  
  // Раздать выигрыш и подождать 3 секунды
  winners.forEach(w => {
    w.player.chips += potPerWinner;
  });
  
  setTimeout(() => {
    startNewHand(gameState, tableId, io);
  }, 3000);
}
```

#### Вариант 3 - Split Pot (Несколько Победителей):
```javascript
function handleSplitPot(winners, gameState, tableId, io) {
  const potPerWinner = Math.floor(gameState.pot / winners.length);
  
  console.log('📡 SERVER: Emitting handComplete (split pot)');
  
  io.to(tableId).emit('handComplete', {
    winners: winners.map(w => w.id),
    potAmount: gameState.pot,
    potPerWinner: potPerWinner,
    winType: 'showdown',
    winningHand: {
      rank: winners[0].handRank,
      name: winners[0].handName,
      cards: winners[0].bestCards
    }
  });
  
  setTimeout(() => {
    startNewHand(gameState, tableId, io);
  }, 3000);
}
```

---

## 📨 Формат Сообщения (Важно!):

### WebSocket Message Structure:
```json
{
  "type": "handComplete",
  "winners": ["player-id-1"],
  "potAmount": 2500,
  "potPerWinner": 2500,
  "winType": "showdown",
  "winningHand": {
    "rank": "9",
    "name": "Royal Flush",
    "cards": [
      {"rank": "A", "suit": "hearts"},
      {"rank": "K", "suit": "hearts"}
    ]
  }
}
```

### Альтернативный Формат (тоже работает):
```json
{
  "event": "handComplete",
  "payload": {
    "winners": ["player-id-1"],
    "potAmount": 2500,
    ...
  }
}
```

Клиент поддерживает оба формата!

---

## 🔍 Как Проверить (Debugging):

### 1. На Сервере:
Добавьте console.log перед emit:
```javascript
console.log('📡 SERVER: About to emit handComplete');
console.log('📊 Data:', JSON.stringify(data, null, 2));
io.to(tableId).emit('handComplete', data);
console.log('✅ SERVER: handComplete emitted');
```

### 2. На Клиенте:
Откройте браузер console (F12) во время игры:
```
Ожидаемые логи:
✅ 🎧 Listening for handComplete events...
✅ 📥 Socket message received: handComplete
✅ ✅ handComplete EVENT RECEIVED!
✅ 🏆 Winner data: {...}
✅ 🎬 Win banner should now be visible!
```

### 3. Что Проверить:
```
1. Сыграть hand до конца (все до river или fold)
2. F12 → Console
3. Искать: "📡 SERVER" и "📥 Socket message"
4. Если НЕТ "📡 SERVER" → проблема на сервере
5. Если НЕТ "📥 Socket message" → проблема с WebSocket
6. Если есть оба → баннер должен появиться!
```

---

## 🎯 Быстрый Тест:

### Создайте Тестовый Endpoint:
```javascript
// Временный тест - эмулировать победу
app.post('/test/trigger-win', (req, res) => {
  const tableId = 'test-table-1';
  
  io.to(tableId).emit('handComplete', {
    winners: ['test-player-1'],
    potAmount: 999,
    potPerWinner: 999,
    winType: 'fold'
  });
  
  res.json({ message: 'Win event emitted' });
});
```

Затем вызвать:
```bash
curl -X POST http://localhost:3001/test/trigger-win
```

Если баннер появляется → проблема в игровой логике сервера.
Если НЕ появляется → проблема в WebSocket соединении.

---

## 📋 Checklist Интеграции:

### Сервер:
- [ ] Найдена функция определения победителя
- [ ] Добавлен `io.to(tableId).emit('handComplete', data)`
- [ ] Emit вызывается для fold и showdown
- [ ] Формат данных правильный
- [ ] Добавлены console.log для debug
- [ ] Таймер 3 секунды перед новой раздачей

### Клиент:
- [x] Socket listener установлен
- [x] Обрабатывает 'handComplete' event
- [x] Console.log добавлены
- [x] Баннер появляется через state
- [x] Auto-hide через 3 секунды

### Тест:
- [ ] Открыть F12 Console
- [ ] Сыграть hand до конца
- [ ] Проверить логи
- [ ] Баннер должен появиться!

---

## 🚨 Критические Моменты:

### 1. **Emit После Определения Победителя**
```javascript
// ✅ ПРАВИЛЬНО
function completeHand() {
  const winner = determineWinner();
  distributeChips(winner);
  io.to(tableId).emit('handComplete', data);  // ← Здесь!
  setTimeout(() => startNewHand(), 3000);
}

// ❌ НЕПРАВИЛЬНО
function completeHand() {
  const winner = determineWinner();
  distributeChips(winner);
  startNewHand();  // Сразу новая раздача - баннера не видно!
}
```

### 2. **Правильный Table ID**
```javascript
// Убедитесь что используется правильный tableId
io.to(tableId).emit('handComplete', data);
// НЕ: io.emit() - отправит всем!
```

### 3. **Формат Winners - Array**
```javascript
// ✅ ПРАВИЛЬНО
winners: [winner.id]  // Array, даже для одного

// ❌ НЕПРАВИЛЬНО
winners: winner.id    // String - клиент ожидает array!
```

---

## 💡 Примеры Из Реальной Игры:

### PokerStars Style:
```javascript
function endHand(table) {
  // Evaluate
  const winners = getWinners(table);
  
  // Show cards
  revealCards(table);
  
  // Emit win event
  io.to(table.id).emit('handComplete', {
    winners: winners.map(w => w.id),
    potAmount: table.pot,
    potPerWinner: Math.floor(table.pot / winners.length),
    winType: table.showdownReached ? 'showdown' : 'fold',
    winningHand: winners[0].hand
  });
  
  // Distribute
  distributeWinnings(table, winners);
  
  // Wait for animation, then new hand
  setTimeout(() => {
    clearTable(table);
    dealNewHand(table);
  }, 3000);
}
```

---

## 🔧 Если Всё Ещё Не Работает:

### Проверка 1: WebSocket Connection
```javascript
// Client console
console.log('Socket state:', socket.readyState);
// Должно быть: 1 (OPEN)
```

### Проверка 2: Event Name
```javascript
// Убедитесь что используется правильное имя
// Клиент слушает: 'handComplete'
// Сервер должен emit: 'handComplete'
// (не 'hand_complete', не 'handDone', не 'gameOver')
```

### Проверка 3: Data Format
```javascript
// Клиент ожидает:
{
  winners: string[],      // Array of player IDs
  potAmount: number,      // Total pot
  potPerWinner: number,   // Per winner share
  winType: 'fold' | 'showdown'
}
```

---

## 📞 Помощь:

Если проблема остаётся:
1. Откройте F12 Console
2. Скопируйте ВСЕ логи от начала hand до конца
3. Найдите:
   - "📡 SERVER" логи
   - "📥 Socket message" логи
   - Любые ошибки

Это поможет определить точное место проблемы.

---

## 🎉 После Успешной Интеграции:

Вы должны увидеть:
```
1. Игра до showdown/fold
2. 📡 SERVER: Emitting handComplete
3. 📥 CLIENT: Received handComplete
4. 🎬 Баннер появляется над картами
5. ⏱️ 3 секунды анимация
6. 🃏 Новая раздача начинается
```

**Баннер теперь работает в реальной игре!** 🎊

---

Made with ❤️ by Windsurf AI  
Server Integration Guide - November 26, 2025

🚨 КРИТИЧНО: БЕЗ ЭТОГО БАННЕР НЕ РАБОТАЕТ! 🚨
