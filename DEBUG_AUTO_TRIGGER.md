# 🔍 Debug Guide: Auto-Trigger Win Banner

## 🎯 Цель:
Выяснить почему баннер не появляется в реальной игре.

---

## ✅ Что Уже Работает:

### 1. Тестовая Кнопка ✅
```
Кнопка "Test Win Animation" → Баннер появляется
```
**Значит:** Клиент и баннер работают идеально!

### 2. Socket Listener ✅
```typescript
socket.on('handComplete', (data) => {
  console.log('✅ handComplete EVENT RECEIVED!');
  setShowWinAnimation(true);
});
```
**Значит:** Клиент готов получать события!

### 3. Debug Логи ✅
```typescript
console.log('🎧 Listening for handComplete events...');
console.log('📥 Socket message received:', message);
console.log('🏆 Winner data:', data);
```
**Значит:** Можем отследить где останавливается!

---

## 🔍 Как Проверить (Пошагово):

### Шаг 1: Запустите Игру
```powershell
cd poker-table-ui
npm start
```

### Шаг 2: Откройте Console
```
F12 → Console
```

### Шаг 3: Сыграйте Hand
```
1. Зайдите в игру
2. Сыграйте до showdown или fold
3. Смотрите console
```

### Шаг 4: Анализ Логов

#### СЦЕНАРИЙ A: Всё Работает ✅
```
🎧 Listening for handComplete events...
📥 Socket message received: handComplete
✅ handComplete EVENT RECEIVED!
🏆 Winner data: {...}
💰 Pot amount: 2500
🎬 Win banner should now be visible!

→ БАННЕР ПОЯВИЛСЯ! 🎉
```

#### СЦЕНАРИЙ B: Сервер Не Отправляет ❌
```
🎧 Listening for handComplete events...
...тишина...

→ НЕТ "📥 Socket message"
→ ПРОБЛЕМА: Сервер не emit 'handComplete'!
```

#### СЦЕНАРИЙ C: WebSocket Не Подключен ❌
```
⚠️ Socket not ready: undefined

→ WebSocket не инициализирован!
→ ПРОБЛЕМА: Соединение не установлено
```

#### СЦЕНАРИЙ D: Неправильный Формат ❌
```
📥 Socket message received: someOtherEvent
📥 Socket message received: gameUpdate
...но НЕТ handComplete...

→ Сервер отправляет другие события
→ ПРОБЛЕМА: Неправильное имя события
```

---

## 🛠️ Решение Проблем:

### Проблема: Сервер Не Отправляет

#### Решение - Добавить на Сервере:
```javascript
// В функции определения победителя
function completeHand(gameState, tableId, io) {
  // ... определяем победителя ...
  
  // ДОБАВИТЬ ЭТО:
  console.log('📡 SERVER: Emitting handComplete');
  io.to(tableId).emit('handComplete', {
    winners: [winner.id],
    potAmount: gameState.pot,
    potPerWinner: gameState.pot,
    winType: 'fold'
  });
  
  // Подождать 3 секунды для анимации
  setTimeout(() => {
    startNewHand(gameState);
  }, 3000);
}
```

#### Проверка:
Теперь в консоли должно появиться:
```
SERVER CONSOLE:
📡 SERVER: Emitting handComplete

CLIENT CONSOLE:
📥 Socket message received: handComplete
✅ handComplete EVENT RECEIVED!
```

---

### Проблема: WebSocket Не Подключен

#### Диагностика:
```javascript
// В браузере console
console.log('Socket:', socket);
console.log('ReadyState:', socket?.readyState);
// Должно быть: 1 (OPEN)
```

#### Решение:
Проверьте `usePokerSocket` хук:
```typescript
const { socket } = usePokerSocket();
// socket должен быть не null
// readyState должен быть 1
```

---

### Проблема: Неправильное Имя События

#### Проверка - Что Сервер Отправляет:
```javascript
// Сервер должен:
io.to(tableId).emit('handComplete', data);

// НЕ:
io.to(tableId).emit('hand_complete', data);  // ❌ Underscore
io.to(tableId).emit('handDone', data);       // ❌ Другое имя
io.to(tableId).emit('gameOver', data);       // ❌ Неправильно
```

#### Клиент Слушает:
```typescript
socket.on('handComplete', ...)  // Точное совпадение!
```

---

## 🧪 Тестирование Без Сервера:

### Эмулировать Socket Event:
```javascript
// В браузере console
const event = new MessageEvent('message', {
  data: JSON.stringify({
    type: 'handComplete',
    winners: ['test-player'],
    potAmount: 999,
    potPerWinner: 999,
    winType: 'fold'
  })
});

socket.dispatchEvent(event);
```

Если баннер появляется:
- ✅ Клиент работает
- ✅ Socket listener работает
- ❌ Проблема на сервере

---

## 📊 Debug Checklist:

### Клиент:
- [ ] Console открыт (F12)
- [ ] Видно "🎧 Listening for handComplete events..."
- [ ] Socket.readyState === 1 (OPEN)
- [ ] Игра запущена и работает

### Игра:
- [ ] Hand сыгран до конца
- [ ] Победитель определён
- [ ] Pot показывается правильно

### Логи:
- [ ] "📡 SERVER" в server console
- [ ] "📥 Socket message" в client console
- [ ] "✅ handComplete EVENT RECEIVED!"
- [ ] "🎬 Win banner should now be visible!"

### Баннер:
- [ ] Появляется автоматически
- [ ] Над картами (top: 32%)
- [ ] Royal blue-gold градиент
- [ ] Исчезает через 3 секунды

---

## 💡 Quick Fix Commands:

### В Client Console:
```javascript
// Проверить socket
console.log('Socket state:', socket?.readyState);

// Проверить listener
socket.eventListeners('message');

// Проверить WinnerData state
// (в React DevTools)
```

### В Server:
```javascript
// Добавить временный log всех emit
const originalEmit = io.to(tableId).emit;
io.to(tableId).emit = function(...args) {
  console.log('📡 Emitting:', args[0], args[1]);
  return originalEmit.apply(this, args);
};
```

---

## 🎯 Итоговая Проверка:

### Test Flow:
```
1. npm start
   ↓
2. F12 → Console
   ↓
3. Зайти в игру
   ↓
4. Проверить "🎧 Listening..."
   ↓
5. Сыграть до showdown
   ↓
6. Искать "📡 SERVER"
   ↓
7. Искать "📥 Socket message"
   ↓
8. Искать "✅ handComplete"
   ↓
9. Баннер должен появиться!
```

### Если Нет "📡 SERVER":
→ **ПРОБЛЕМА НА СЕРВЕРЕ**
→ Читайте `SERVER_INTEGRATION_REQUIRED.md`
→ Добавьте `io.to(tableId).emit('handComplete', ...)`

### Если Есть "📡" Но Нет "📥":
→ **ПРОБЛЕМА С WEBSOCKET**
→ Проверьте tableId
→ Проверьте socket connection

### Если Есть "📥" Но Нет "✅":
→ **ПРОБЛЕМА С ФОРМАТОМ**
→ Проверьте имя события
→ Проверьте структуру данных

---

## 📞 Нужна Помощь?

### Скопируйте и Пришлите:
```
1. Все логи из console (Ctrl+A, Ctrl+C)
2. Socket.readyState значение
3. Серверный код где определяется победитель
```

Это поможет точно определить проблему!

---

## 🎉 Success Criteria:

Баннер работает если:
- ✅ Появляется автоматически после showdown
- ✅ Показывает правильного победителя
- ✅ Показывает правильную сумму pot
- ✅ Позиция над картами (не весь экран)
- ✅ Royal blue-gold градиент виден
- ✅ Исчезает через 3 секунды
- ✅ Новая раздача начинается сразу после

**Если все ✅ → ВСЁ РАБОТАЕТ!** 🎊

---

Made with ❤️ by Windsurf AI  
Debug Guide - November 26, 2025

🔍 Найдите Проблему • Исправьте • Профит! 🎉
