# Poker House - Telegram Mini App

A multiplayer Texas Hold'em poker game as a Telegram Mini App.

## Features

- **Private Games** - Create private lobbies and invite friends via Telegram
- **Public Tables** - Join tournament tables with other players
- **Game Modes**:
  - 🏆 Tournament - Multi-table tournaments with prize pools
  - 🎯 Bounty Hunter - Knockout format
  - ⚡ Sit & Go - Quick games

## Tech Stack

### Frontend (Netlify)
- React + TypeScript + Vite
- Telegram Mini App SDK
- WebSocket for real-time gameplay

### Backend (Railway)
- FastAPI + Python
- WebSocket for multiplayer
- SQLite for data storage

### Telegram Bot
- python-telegram-bot
- Mini App integration

## Project Structure

```
poker/
├── poker-table-ui/     # React frontend
├── server.py           # FastAPI backend
├── bot.py              # Telegram bot
├── db.py               # User database
├── lobby_db.py         # Lobby/game database
├── requirements.txt    # Python dependencies
└── Procfile            # Railway deployment
```

## Deployment

### Frontend (Netlify)
- URL: https://dapper-heliotrope-03aa40.netlify.app
- Auto-deploys from GitHub

### Backend (Railway)
- URL: https://poker-game-poker-game.up.railway.app
- Auto-deploys from GitHub

### Environment Variables

**Netlify:**
- `VITE_API_URL` - Backend API URL
- `VITE_WS_URL` - WebSocket URL
- `VITE_BOT_USERNAME` - Telegram bot username

**Railway:**
- `BOT_USERNAME` - Telegram bot username
- `TELEGRAM_TOKEN` - Bot token from @BotFather
- `PORT` - Server port (auto-set by Railway)

## Telegram Bot

Bot: @pokerhouse77bot

Commands:
- `/start` - Open the game
- `/help` - Show help

## Local Development

```bash
# Backend
cd poker
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend
cd poker-table-ui
npm install
npm run dev

# Bot
python bot.py
```
