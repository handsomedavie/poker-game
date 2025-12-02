"""
Poker Game Engine for Multiplayer
Manages game state, card dealing, and player actions
"""

import random
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum


class Suit(Enum):
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"
    SPADES = "spades"


class GamePhase(Enum):
    WAITING = "waiting"
    PRE_FLOP = "pre-flop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"
    FINISHED = "finished"


@dataclass
class Card:
    rank: int  # 2-14 (11=J, 12=Q, 13=K, 14=A)
    suit: str
    
    def to_dict(self) -> Dict[str, Any]:
        rank_names = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'}
        return {
            "rank": rank_names.get(self.rank, str(self.rank)),
            "suit": self.suit,
            "value": self.rank
        }


@dataclass
class Player:
    telegram_id: int
    name: str
    seat: int
    chips: int
    cards: List[Card] = field(default_factory=list)
    current_bet: int = 0
    is_folded: bool = False
    is_all_in: bool = False
    is_active: bool = True
    
    def to_dict(self, hide_cards: bool = True) -> Dict[str, Any]:
        return {
            "telegramId": self.telegram_id,
            "name": self.name,
            "seat": self.seat,
            "chips": self.chips,
            "currentBet": self.current_bet,
            "isFolded": self.is_folded,
            "isAllIn": self.is_all_in,
            "isActive": self.is_active,
            "cards": [] if hide_cards else [c.to_dict() for c in self.cards],
            "hasCards": len(self.cards) > 0
        }


@dataclass 
class GameState:
    session_id: str
    lobby_code: str
    players: Dict[int, Player]  # seat_number -> Player (NOT telegram_id!)
    deck: List[Card] = field(default_factory=list)
    community_cards: List[Card] = field(default_factory=list)
    pot: int = 0
    current_bet: int = 0
    small_blind: int = 10
    big_blind: int = 20
    dealer_seat: int = 0
    current_player_seat: Optional[int] = None  # Current player's SEAT number
    phase: GamePhase = GamePhase.WAITING
    min_raise: int = 0
    last_raiser_seat: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    max_players: int = 2  # How many players expected
    connected_count: int = 0  # How many have connected
    
    def to_dict(self, for_seat: Optional[int] = None) -> Dict[str, Any]:
        """Convert to dict. If for_seat is set, show only that player's cards."""
        players_list = []
        for seat, p in sorted(self.players.items()):
            # Only show cards if it's the requesting player or showdown
            hide = for_seat != seat and self.phase != GamePhase.SHOWDOWN
            players_list.append(p.to_dict(hide_cards=hide))
        
        return {
            "sessionId": self.session_id,
            "lobbyCode": self.lobby_code,
            "players": players_list,
            "communityCards": [c.to_dict() for c in self.community_cards],
            "pot": self.pot,
            "currentBet": self.current_bet,
            "smallBlind": self.small_blind,
            "bigBlind": self.big_blind,
            "dealerSeat": self.dealer_seat,
            "currentPlayerSeat": self.current_player_seat,
            "phase": self.phase.value,
            "minRaise": self.min_raise,
            "maxPlayers": self.max_players,
            "connectedCount": self.connected_count,
        }


# In-memory game storage
active_games: Dict[str, GameState] = {}  # session_id -> GameState


def create_deck() -> List[Card]:
    """Create and shuffle a standard 52-card deck"""
    deck = []
    for suit in ["hearts", "diamonds", "clubs", "spades"]:
        for rank in range(2, 15):  # 2-14 (A=14)
            deck.append(Card(rank=rank, suit=suit))
    random.shuffle(deck)
    return deck


def create_game(session_id: str, lobby_code: str, players_data: List[Dict], 
                small_blind: int = 10, big_blind: int = 20) -> GameState:
    """Create a new game from lobby players"""
    
    num_players = len(players_data)
    
    # Create empty player slots by SEAT number
    players = {}
    for i, p in enumerate(players_data):
        seat = i + 1
        player = Player(
            telegram_id=0,  # Will be set when player connects
            name=p.get("first_name", p.get("username", f"Player{seat}")),
            seat=seat,
            chips=1000,  # Starting chips
            cards=[],
        )
        players[seat] = player  # Key is SEAT, not telegram_id!
    
    game = GameState(
        session_id=session_id,
        lobby_code=lobby_code,
        players=players,
        small_blind=small_blind,
        big_blind=big_blind,
        dealer_seat=1,
        max_players=num_players,
        connected_count=0,
    )
    
    active_games[session_id] = game
    print(f"🎮 GAME: Created game {session_id} with {num_players} seats")
    
    return game


def start_hand(session_id: str) -> Optional[GameState]:
    """Start a new hand - deal cards, post blinds"""
    game = active_games.get(session_id)
    if not game:
        return None
    
    # Reset for new hand
    game.deck = create_deck()
    game.community_cards = []
    game.pot = 0
    game.current_bet = 0
    game.last_raiser_seat = None
    
    # Reset players
    active_players = []
    for p in game.players.values():
        p.cards = []
        p.current_bet = 0
        p.is_folded = False
        p.is_all_in = False
        if p.chips > 0:
            p.is_active = True
            active_players.append(p)
        else:
            p.is_active = False
    
    if len(active_players) < 2:
        game.phase = GamePhase.FINISHED
        return game
    
    # Sort by seat
    active_players.sort(key=lambda x: x.seat)
    
    # Deal 2 cards to each player
    for _ in range(2):
        for p in active_players:
            if game.deck:
                p.cards.append(game.deck.pop())
    
    # Post blinds
    sb_player = active_players[0]
    bb_player = active_players[1] if len(active_players) > 1 else active_players[0]
    
    # Small blind
    sb_amount = min(game.small_blind, sb_player.chips)
    sb_player.chips -= sb_amount
    sb_player.current_bet = sb_amount
    game.pot += sb_amount
    
    # Big blind  
    bb_amount = min(game.big_blind, bb_player.chips)
    bb_player.chips -= bb_amount
    bb_player.current_bet = bb_amount
    game.pot += bb_amount
    
    game.current_bet = game.big_blind
    game.min_raise = game.big_blind
    game.phase = GamePhase.PRE_FLOP
    
    # First to act is after big blind (or small blind in heads-up)
    # Use SEAT number, not telegram_id!
    if len(active_players) > 2:
        game.current_player_seat = active_players[2].seat
    else:
        game.current_player_seat = sb_player.seat
    
    print(f"🎮 GAME: Hand started, {len(active_players)} players, pot=${game.pot}, first to act: seat {game.current_player_seat}")
    return game


def get_active_players(game: GameState) -> List[Player]:
    """Get list of players still in the hand"""
    return [p for p in game.players.values() if p.is_active and not p.is_folded and p.chips >= 0]


def get_next_player_seat(game: GameState) -> Optional[int]:
    """Get next player's SEAT to act"""
    active = get_active_players(game)
    if len(active) <= 1:
        return None
    
    # Filter out all-in players
    can_act = [p for p in active if not p.is_all_in]
    if not can_act:
        return None
    
    current_seat = game.current_player_seat or 0
    
    # Find next player by seat order
    can_act.sort(key=lambda x: x.seat)
    for p in can_act:
        if p.seat > current_seat:
            return p.seat
    
    # Wrap around
    return can_act[0].seat if can_act else None


def process_action(session_id: str, player_seat: int, action: str, amount: int = 0) -> Tuple[bool, str, Optional[GameState]]:
    """
    Process player action: fold, check, call, raise, all_in
    player_seat is the SEAT NUMBER, not telegram_id!
    Returns: (success, message, updated_game_state)
    """
    game = active_games.get(session_id)
    if not game:
        return False, "Game not found", None
    
    player = game.players.get(player_seat)
    if not player:
        return False, f"No player at seat {player_seat}", None
    
    if game.current_player_seat != player_seat:
        return False, f"Not your turn (current: seat {game.current_player_seat}, you: seat {player_seat})", None
    
    if player.is_folded or player.is_all_in:
        return False, "Cannot act", None
    
    action = action.lower()
    
    if action == "fold":
        player.is_folded = True
        print(f"🎮 GAME: Seat {player_seat} ({player.name}) folds")
        
    elif action == "check":
        if game.current_bet > player.current_bet:
            return False, "Cannot check, must call or fold", None
        print(f"🎮 GAME: Seat {player_seat} ({player.name}) checks")
        
    elif action == "call":
        call_amount = game.current_bet - player.current_bet
        
        # If nothing to call, treat as check
        if call_amount <= 0:
            print(f"🎮 GAME: Seat {player_seat} ({player.name}) checks (call with 0 amount)")
        else:
            actual_call = min(call_amount, player.chips)
            player.chips -= actual_call
            player.current_bet += actual_call
            game.pot += actual_call
            
            if player.chips == 0:
                player.is_all_in = True
            
            print(f"🎮 GAME: Seat {player_seat} ({player.name}) calls ${actual_call}")
        
    elif action == "raise":
        if amount < game.min_raise:
            return False, f"Minimum raise is ${game.min_raise}", None
        
        call_amount = game.current_bet - player.current_bet
        total_needed = call_amount + amount
        
        if total_needed > player.chips:
            return False, "Not enough chips", None
        
        player.chips -= total_needed
        player.current_bet += total_needed
        game.pot += total_needed
        game.current_bet = player.current_bet
        game.min_raise = amount
        game.last_raiser_seat = player_seat
        
        if player.chips == 0:
            player.is_all_in = True
        
        print(f"🎮 GAME: Seat {player_seat} ({player.name}) raises to ${player.current_bet}")
        
    elif action == "all_in":
        all_in_amount = player.chips
        player.chips = 0
        player.current_bet += all_in_amount
        game.pot += all_in_amount
        player.is_all_in = True
        
        if player.current_bet > game.current_bet:
            game.current_bet = player.current_bet
            game.last_raiser_seat = player_seat
        
        print(f"🎮 GAME: Seat {player_seat} ({player.name}) goes ALL IN for ${all_in_amount}")
    
    else:
        return False, "Unknown action", None
    
    # Check if round is complete
    _check_round_complete(game)
    
    return True, "Action processed", game


def _check_round_complete(game: GameState):
    """Check if betting round is complete and advance phase"""
    active = get_active_players(game)
    
    # Only one player left = winner
    if len(active) <= 1:
        game.phase = GamePhase.SHOWDOWN
        _determine_winner(game)
        return
    
    # Check if all active players have matched the current bet
    can_act = [p for p in active if not p.is_all_in]
    
    if not can_act:
        # Everyone is all-in, deal remaining cards
        _deal_remaining_cards(game)
        return
    
    # Check if betting round is complete
    all_matched = all(p.current_bet == game.current_bet or p.is_all_in for p in active)
    
    # If we went around and everyone matched
    next_seat = get_next_player_seat(game)
    
    if all_matched and (next_seat == game.last_raiser_seat or game.last_raiser_seat is None):
        # Move to next phase
        _advance_phase(game)
    else:
        # Next player's turn
        game.current_player_seat = next_seat


def _advance_phase(game: GameState):
    """Advance to next betting phase"""
    # Reset bets for new round
    for p in game.players.values():
        p.current_bet = 0
    game.current_bet = 0
    game.last_raiser_seat = None
    
    active = get_active_players(game)
    if active:
        game.current_player_seat = active[0].seat  # Use seat, not telegram_id!
    
    if game.phase == GamePhase.PRE_FLOP:
        # Deal flop (3 cards)
        game.phase = GamePhase.FLOP
        for _ in range(3):
            if game.deck:
                game.community_cards.append(game.deck.pop())
        print(f"🎮 GAME: Flop dealt")
        
    elif game.phase == GamePhase.FLOP:
        # Deal turn (1 card)
        game.phase = GamePhase.TURN
        if game.deck:
            game.community_cards.append(game.deck.pop())
        print(f"🎮 GAME: Turn dealt")
        
    elif game.phase == GamePhase.TURN:
        # Deal river (1 card)
        game.phase = GamePhase.RIVER
        if game.deck:
            game.community_cards.append(game.deck.pop())
        print(f"🎮 GAME: River dealt")
        
    elif game.phase == GamePhase.RIVER:
        # Showdown
        game.phase = GamePhase.SHOWDOWN
        _determine_winner(game)


def _deal_remaining_cards(game: GameState):
    """Deal remaining community cards when everyone is all-in"""
    while len(game.community_cards) < 5 and game.deck:
        game.community_cards.append(game.deck.pop())
    game.phase = GamePhase.SHOWDOWN
    _determine_winner(game)


def _determine_winner(game: GameState):
    """Determine winner and award pot (simplified - just picks a random active player)"""
    active = get_active_players(game)
    
    if len(active) == 1:
        winner = active[0]
    else:
        # TODO: Implement proper hand evaluation
        # For now, random winner among active players
        winner = random.choice(active)
    
    winner.chips += game.pot
    print(f"🎮 GAME: {winner.name} wins ${game.pot}!")
    
    game.pot = 0
    game.phase = GamePhase.FINISHED


def get_game(session_id: str) -> Optional[GameState]:
    """Get game by session ID"""
    return active_games.get(session_id)


def end_game(session_id: str) -> bool:
    """End and remove a game"""
    if session_id in active_games:
        del active_games[session_id]
        return True
    return False
