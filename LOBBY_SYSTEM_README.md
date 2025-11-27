# 🎰 Private Lobby System for Poker Mini App

## Overview

Complete Telegram-based private lobby invitation system. Players can create private poker lobbies, generate unique invite links, share via Telegram, and auto-join friends who click the link.

---

## 📁 Created Files

### Backend (Python/FastAPI)
- **`lobby_db.py`** - In-memory lobby database with:
  - `Lobby` and `LobbyPlayer` dataclasses
  - Lobby code generator (6-char unique codes)
  - CRUD operations for lobbies

### Server Endpoints (added to `server.py`)
- **`POST /api/lobby/create`** - Create new private lobby
- **`GET /api/lobby/{code}`** - Get lobby details
- **`POST /api/lobby/{code}/join`** - Join existing lobby
- **`POST /api/lobby/{code}/leave`** - Leave lobby
- **`POST /api/lobby/{code}/start`** - Start game (host only)
- **`GET /api/my-lobbies`** - Get user's lobbies
- **`WS /ws/lobby/{code}`** - Real-time lobby updates

### Frontend (React/TypeScript)
- **`src/components/Lobby/`**
  - `CreateLobby.tsx` - Create lobby form
  - `LobbyRoom.tsx` - Waiting room with player list
  - `LobbyPage.tsx` - Main lobby navigation + deep link handling
  - `lobby.module.css` - Styles matching poker theme
  - `index.ts` - Exports

### App Integration
- **`App.tsx`** - Updated with lobby navigation and deep link detection

---

## 🚀 How It Works

### User Flow:
```
1. User A clicks "🎰 Private Games" button
2. User A clicks "➕ Create New Game"
3. User A sets buy-in ($10-$1000) and max players (2-9)
4. Lobby created with unique code (e.g., "A7K9X2")
5. User A clicks "📤 Invite Friends"
6. Share dialog opens in Telegram
7. User B receives invite link
8. User B clicks link → Mini App opens
9. User B auto-joins the lobby
10. User A (host) clicks "🚀 Start Game"
11. Both players enter the poker game
```

### Deep Link Format:
```
https://t.me/BOT_USERNAME?start=lobby_A7K9X2
```

---

## 🔧 API Reference

### Create Lobby
```http
POST /api/lobby/create
Content-Type: application/json

{
  "lobbyName": "Friday Night Poker",
  "buyIn": 100,
  "maxPlayers": 6,
  "initData": "<telegram_init_data>"
}

Response:
{
  "success": true,
  "lobbyCode": "A7K9X2",
  "inviteLink": "https://t.me/poker_game_bot?start=lobby_A7K9X2",
  "lobby": { ... }
}
```

### Get Lobby
```http
GET /api/lobby/A7K9X2

Response:
{
  "success": true,
  "lobby": {
    "id": "uuid",
    "lobbyCode": "A7K9X2",
    "hostTelegramId": 123456789,
    "lobbyName": "Friday Night Poker",
    "maxPlayers": 6,
    "buyIn": 100,
    "status": "waiting",
    "playerCount": 2,
    "availableSeats": 4,
    "players": [...]
  },
  "inviteLink": "..."
}
```

### Join Lobby
```http
POST /api/lobby/A7K9X2/join
Content-Type: application/json

{
  "initData": "<telegram_init_data>"
}

Response:
{
  "success": true,
  "message": "Joined successfully",
  "lobby": { ... }
}
```

### Start Game (Host Only)
```http
POST /api/lobby/A7K9X2/start
Content-Type: application/json

{
  "initData": "<telegram_init_data>"
}

Response:
{
  "success": true,
  "gameSessionId": "game_A7K9X2_1732735200",
  "lobby": { ... }
}
```

---

## 📡 WebSocket Events

### Server → Client:
- `lobbyState` - Current lobby state
- `playerJoined` - New player joined
- `playerLeft` - Player left
- `playerReady` - Player ready status changed
- `gameStarted` - Game has started

### Client → Server:
- `ping` - Keep-alive
- `ready` - Toggle ready status

---

## 🎨 Styling

Uses existing poker theme:
- **Royal Blue** (#1e40af) - backgrounds
- **Gold** (#fbbf24) - accents, host badge
- **Dark Overlay** (rgba(0,0,0,0.85))
- **Border Radius** - 12-16px
- **Mobile-first** - Touch-friendly (min 48px targets)

---

## 🔒 Security

- Telegram initData verification for authenticated actions
- Guest mode for development/testing
- Host-only game start
- Lobby expiration (24 hours)
- Unique 6-character codes (no confusing chars: 0,O,1,I,L)

---

## 📱 Telegram Integration

### WebApp SDK:
```javascript
// Get user info
const user = window.Telegram.WebApp.initDataUnsafe.user;

// Get deep link parameter
const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;

// Share via Telegram
window.Telegram.WebApp.openTelegramLink(shareUrl);

// Get init data for auth
const initData = window.Telegram.WebApp.initData;
```

---

## 🧪 Testing

### Start Server:
```bash
cd poker
python server.py
```

### Start Frontend:
```bash
cd poker-table-ui
npm run dev
```

### Test Flow:
1. Open http://localhost:5173
2. Click "🎰 Private Games"
3. Create a lobby
4. Copy invite link
5. Open in new incognito tab
6. Join as second player
7. Start game from host tab

---

## 📝 Environment Variables

```env
BOT_USERNAME=your_poker_bot        # Telegram bot username
TELEGRAM_TOKEN=your_bot_token      # For initData verification
```

---

## 🔮 Future Enhancements

- [ ] PostgreSQL persistent storage
- [ ] Lobby chat
- [ ] Player ready toggle
- [ ] Tournament mode
- [ ] Lobby password protection
- [ ] Spectator mode
- [ ] Rematch button after game ends
