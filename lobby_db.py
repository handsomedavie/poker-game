"""
Lobby Database Module
In-memory storage for private poker lobbies with Telegram integration
"""

import uuid
import time
import random
import string
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass
class LobbyPlayer:
    """Player in a lobby"""
    telegram_id: int
    username: Optional[str]
    first_name: str
    seat_number: int
    joined_at: float = field(default_factory=time.time)
    is_ready: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "telegramId": self.telegram_id,
            "username": self.username,
            "firstName": self.first_name,
            "seatNumber": self.seat_number,
            "joinedAt": int(self.joined_at * 1000),
            "isReady": self.is_ready,
        }


@dataclass
class Lobby:
    """Private poker lobby"""
    id: str
    lobby_code: str
    host_telegram_id: int
    lobby_name: str
    max_players: int
    buy_in: int
    game_mode: str  # 'cash' or 'tournament'
    status: str  # 'waiting', 'playing', 'finished'
    created_at: float = field(default_factory=time.time)
    expires_at: float = field(default_factory=lambda: time.time() + 24 * 60 * 60)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    players: Dict[int, LobbyPlayer] = field(default_factory=dict)
    game_session_id: Optional[str] = None
    
    def to_dict(self, include_players: bool = True) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "lobbyCode": self.lobby_code,
            "hostTelegramId": self.host_telegram_id,
            "lobbyName": self.lobby_name,
            "maxPlayers": self.max_players,
            "buyIn": self.buy_in,
            "gameMode": self.game_mode,
            "status": self.status,
            "createdAt": int(self.created_at * 1000),
            "expiresAt": int(self.expires_at * 1000),
            "startedAt": int(self.started_at * 1000) if self.started_at else None,
            "finishedAt": int(self.finished_at * 1000) if self.finished_at else None,
            "playerCount": len(self.players),
            "availableSeats": self.max_players - len(self.players),
            "gameSessionId": self.game_session_id,
        }
        if include_players:
            result["players"] = [p.to_dict() for p in sorted(self.players.values(), key=lambda x: x.seat_number)]
        return result
    
    def is_expired(self) -> bool:
        return time.time() > self.expires_at
    
    def is_full(self) -> bool:
        return len(self.players) >= self.max_players
    
    def get_next_seat(self) -> int:
        """Get next available seat number"""
        occupied = {p.seat_number for p in self.players.values()}
        for seat in range(1, self.max_players + 1):
            if seat not in occupied:
                return seat
        return -1


# In-memory storage
lobbies_db: Dict[str, Lobby] = {}  # lobby_id -> Lobby
lobby_codes: Dict[str, str] = {}  # lobby_code -> lobby_id


def generate_lobby_code() -> str:
    """
    Generate a unique 6-character lobby code.
    Format: A7K9X2 (letters and numbers, no confusing chars like 0,O,1,I,L)
    """
    # Exclude confusing characters
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=6))


def create_unique_lobby_code() -> str:
    """Generate a unique lobby code that doesn't exist in database"""
    for _ in range(100):  # Max attempts
        code = generate_lobby_code()
        if code not in lobby_codes:
            return code
    raise ValueError("Could not generate unique lobby code")


async def create_lobby(
    host_telegram_id: int,
    host_username: Optional[str],
    host_first_name: str,
    lobby_name: Optional[str] = None,
    buy_in: int = 100,
    max_players: int = 6,
    game_mode: str = "cash"
) -> Lobby:
    """
    Create a new private lobby.
    Host is automatically added as first player.
    """
    print(f"📋 LOBBY: Creating lobby for host {host_telegram_id} ({host_first_name})")
    
    # Validate inputs
    if max_players < 2 or max_players > 9:
        raise ValueError("Max players must be between 2 and 9")
    if buy_in < 10:
        raise ValueError("Buy-in must be at least 10")
    
    # Generate unique code and ID
    lobby_code = create_unique_lobby_code()
    lobby_id = str(uuid.uuid4())
    
    # Create lobby
    lobby = Lobby(
        id=lobby_id,
        lobby_code=lobby_code,
        host_telegram_id=host_telegram_id,
        lobby_name=lobby_name or f"{host_first_name}'s Game",
        max_players=max_players,
        buy_in=buy_in,
        game_mode=game_mode,
        status="waiting",
    )
    
    # Add host as first player
    host_player = LobbyPlayer(
        telegram_id=host_telegram_id,
        username=host_username,
        first_name=host_first_name,
        seat_number=1,
        is_ready=True,  # Host is always ready
    )
    lobby.players[host_telegram_id] = host_player
    
    # Store in database
    lobbies_db[lobby_id] = lobby
    lobby_codes[lobby_code] = lobby_id
    
    print(f"✅ LOBBY: Created lobby {lobby_code} (ID: {lobby_id})")
    return lobby


async def get_lobby_by_code(lobby_code: str) -> Optional[Lobby]:
    """Get lobby by its invite code"""
    lobby_code = lobby_code.upper()
    lobby_id = lobby_codes.get(lobby_code)
    if not lobby_id:
        return None
    return lobbies_db.get(lobby_id)


async def get_lobby_by_id(lobby_id: str) -> Optional[Lobby]:
    """Get lobby by its ID"""
    return lobbies_db.get(lobby_id)


async def join_lobby(
    lobby_code: str,
    telegram_id: int,
    username: Optional[str],
    first_name: str
) -> Tuple[bool, str, Optional[Lobby]]:
    """
    Join an existing lobby.
    Returns: (success, message, lobby)
    """
    print(f"📋 LOBBY: Player {telegram_id} ({first_name}) trying to join {lobby_code}")
    
    lobby = await get_lobby_by_code(lobby_code)
    
    if not lobby:
        return False, "Lobby not found", None
    
    if lobby.is_expired():
        return False, "Lobby has expired", None
    
    if lobby.status != "waiting":
        return False, "Game has already started", None
    
    if lobby.is_full():
        return False, "Lobby is full", None
    
    if telegram_id in lobby.players:
        return True, "Already in lobby", lobby  # Not an error, just return success
    
    # Add player
    seat = lobby.get_next_seat()
    if seat == -1:
        return False, "No seats available", None
    
    player = LobbyPlayer(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        seat_number=seat,
    )
    lobby.players[telegram_id] = player
    
    print(f"✅ LOBBY: Player {telegram_id} joined lobby {lobby_code} at seat {seat}")
    return True, "Joined successfully", lobby


async def leave_lobby(lobby_code: str, telegram_id: int) -> Tuple[bool, str]:
    """
    Leave a lobby.
    If host leaves, lobby is deleted.
    """
    lobby = await get_lobby_by_code(lobby_code)
    
    if not lobby:
        return False, "Lobby not found"
    
    if telegram_id not in lobby.players:
        return False, "Not in lobby"
    
    # If host leaves, delete lobby
    if telegram_id == lobby.host_telegram_id:
        del lobbies_db[lobby.id]
        del lobby_codes[lobby.lobby_code]
        print(f"🗑️ LOBBY: Lobby {lobby_code} deleted (host left)")
        return True, "Lobby deleted"
    
    # Remove player
    del lobby.players[telegram_id]
    print(f"👋 LOBBY: Player {telegram_id} left lobby {lobby_code}")
    return True, "Left lobby"


async def start_game(lobby_code: str, host_telegram_id: int) -> Tuple[bool, str, Optional[str]]:
    """
    Start the game. Only host can start.
    Returns: (success, message, game_session_id)
    """
    lobby = await get_lobby_by_code(lobby_code)
    
    if not lobby:
        return False, "Lobby not found", None
    
    if lobby.host_telegram_id != host_telegram_id:
        return False, "Only host can start the game", None
    
    if len(lobby.players) < 2:
        return False, "Need at least 2 players", None
    
    if lobby.status != "waiting":
        return False, "Game already started", None
    
    # Generate game session ID
    game_session_id = f"game_{lobby.lobby_code}_{int(time.time())}"
    
    # Update lobby status
    lobby.status = "playing"
    lobby.started_at = time.time()
    lobby.game_session_id = game_session_id
    
    print(f"🎮 LOBBY: Game started for lobby {lobby_code}, session: {game_session_id}")
    return True, "Game started", game_session_id


async def finish_game(lobby_code: str) -> bool:
    """Mark game as finished"""
    lobby = await get_lobby_by_code(lobby_code)
    if not lobby:
        return False
    
    lobby.status = "finished"
    lobby.finished_at = time.time()
    return True


async def get_player_lobbies(telegram_id: int) -> List[Lobby]:
    """Get all lobbies a player is in"""
    return [
        lobby for lobby in lobbies_db.values()
        if telegram_id in lobby.players and not lobby.is_expired()
    ]


async def cleanup_expired_lobbies() -> int:
    """Remove expired lobbies. Returns count of removed."""
    expired = [
        lobby_id for lobby_id, lobby in lobbies_db.items()
        if lobby.is_expired() or lobby.status == "finished"
    ]
    
    for lobby_id in expired:
        lobby = lobbies_db.get(lobby_id)
        if lobby:
            del lobby_codes[lobby.lobby_code]
        del lobbies_db[lobby_id]
    
    if expired:
        print(f"🧹 LOBBY: Cleaned up {len(expired)} expired lobbies")
    
    return len(expired)
