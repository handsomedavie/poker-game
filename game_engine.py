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
    min_raise: int = 0  # Last raise delta (for calculating min raise)
    last_raiser_seat: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    max_players: int = 2  # How many players expected
    connected_count: int = 0  # How many have connected
    winner_seat: Optional[int] = None  # Winner's seat number
    winner_hand: Optional[str] = None  # Winner's hand name
    # Tournament configuration
    buy_in_usd: float = 1.0  # Entry fee in USD
    starting_chips: int = 1000  # Chips given for buy-in
    
    def to_dict(self, for_seat: Optional[int] = None) -> Dict[str, Any]:
        """Convert to dict. If for_seat is set, show only that player's cards."""
        players_list = []
        for seat, p in sorted(self.players.items()):
            # Only show cards if it's the requesting player or showdown
            is_showdown = self.phase in [GamePhase.SHOWDOWN, GamePhase.FINISHED]
            hide = for_seat != seat and not is_showdown
            player_dict = p.to_dict(hide_cards=hide)
            
            # Add hand name at showdown for each active player
            if is_showdown and not p.is_folded and len(p.cards) >= 2 and len(self.community_cards) >= 3:
                all_cards = p.cards + self.community_cards
                hand = evaluate_hand(all_cards)
                player_dict["handName"] = hand[2]  # e.g., "Pair", "Two Pair", etc.
            
            players_list.append(player_dict)
        
        # Calculate minimum raise TO amount (not delta)
        # If no bet yet: min bet = big blind
        # If bet exists: min raise TO = current_bet + last_raise_delta (at least BB)
        if self.current_bet == 0:
            min_raise_to = self.big_blind
        else:
            min_raise_to = self.current_bet + max(self.min_raise, self.big_blind)
        
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
            "minRaise": self.min_raise,  # Last raise delta
            "minRaiseTo": min_raise_to,  # Minimum total bet for raise
            "maxPlayers": self.max_players,
            "connectedCount": self.connected_count,
            "winnerSeat": self.winner_seat,
            "winnerHand": self.winner_hand,
            # Tournament config
            "buyInUsd": self.buy_in_usd,
            "startingChips": self.starting_chips,
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
    
    # Create player slots by SEAT number with telegram_id from lobby
    players = {}
    for i, p in enumerate(players_data):
        seat = i + 1
        player = Player(
            telegram_id=p.get("telegram_id", 0),  # Use telegram_id from lobby data
            name=p.get("first_name", p.get("username", f"Player{seat}")),
            seat=seat,
            chips=1000,  # Starting chips
            cards=[],
        )
        players[seat] = player  # Key is SEAT, telegram_id stored in player
        print(f"🎮 Created player: seat={seat}, telegram_id={player.telegram_id}, name={player.name}")
    
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
    
    # Normalize action names
    if action == "bet":
        action = "raise"  # Bet is same as raise
    
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
        # Amount is the TOTAL bet the player wants to make (not additional raise)
        # Example: current_bet=40, player_current_bet=20, amount=100 means raise TO $100
        
        # Calculate minimum valid amount based on Texas Hold'em rules
        if game.current_bet == 0:
            # This is a BET (first bet on the street) - minimum is big blind
            min_total = game.big_blind
        else:
            # This is a RAISE - minimum is current bet + last raise size (or big blind if first raise)
            min_total = game.current_bet + game.min_raise
        
        # Allow all-in for less if player doesn't have enough chips
        if amount < min_total and amount < player.chips + player.current_bet:
            return False, f"Minimum bet ${min_total}", None
        
        # Calculate how much player needs to put in
        chips_needed = amount - player.current_bet
        
        if chips_needed > player.chips:
            return False, "Not enough chips", None
        
        if chips_needed <= 0:
            return False, "Bet amount must be higher than current bet", None
        
        # Calculate raise increment for min_raise tracking
        # Only update min_raise if this is an actual raise (not just matching)
        if amount > game.current_bet:
            raise_increment = amount - game.current_bet
            # min_raise should be at least big_blind
            game.min_raise = max(raise_increment, game.big_blind)
        
        player.chips -= chips_needed
        player.current_bet = amount
        game.pot += chips_needed
        game.current_bet = amount
        game.last_raiser_seat = player_seat
        
        if player.chips == 0:
            player.is_all_in = True
        
        action_name = "bets" if game.current_bet == amount else "raises to"
        print(f"🎮 GAME: Seat {player_seat} ({player.name}) {action_name} ${amount}")
        
    elif action == "all_in":
        all_in_amount = player.chips
        new_total_bet = player.current_bet + all_in_amount
        
        player.chips = 0
        player.current_bet = new_total_bet
        game.pot += all_in_amount
        player.is_all_in = True
        
        # Update game state if this is a raise
        if new_total_bet > game.current_bet:
            # Calculate raise increment for min_raise tracking
            raise_increment = new_total_bet - game.current_bet
            # Only update min_raise if it's a full raise (>= current min_raise)
            # If it's a "short all-in" (less than min raise), it doesn't reopen betting
            if raise_increment >= game.min_raise or raise_increment >= game.big_blind:
                game.min_raise = max(raise_increment, game.big_blind)
            
            game.current_bet = new_total_bet
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
    
    # Get next player to act
    next_seat = get_next_player_seat(game)
    
    # Track actions per round - all players who can act must have acted
    # For preflop: SB calls, BB checks = round done
    # For other phases: everyone checks or calls to current bet = round done
    
    players_acted = getattr(game, 'players_acted_this_round', set())
    players_acted.add(game.current_player_seat)
    game.players_acted_this_round = players_acted
    
    all_can_act_seats = set(p.seat for p in can_act)
    everyone_acted = all_can_act_seats.issubset(players_acted)
    
    print(f"🎮 ROUND CHECK: matched={all_matched}, everyone_acted={everyone_acted}, players_acted={players_acted}, can_act={all_can_act_seats}")
    
    if all_matched and everyone_acted:
        # Move to next phase
        game.players_acted_this_round = set()  # Reset for next round
        _advance_phase(game)
    elif next_seat == game.last_raiser_seat:
        # Back to the raiser, round complete
        game.players_acted_this_round = set()
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
    game.min_raise = game.big_blind  # Reset min raise to big blind for new street
    
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


def evaluate_hand(cards: List[Card]) -> Tuple[int, List[int], str]:
    """
    Evaluate a poker hand and return (rank, tiebreakers, name)
    Rank: 1=High Card, 2=Pair, 3=Two Pair, 4=Three of a Kind, 
          5=Straight, 6=Flush, 7=Full House, 8=Four of a Kind, 
          9=Straight Flush, 10=Royal Flush
    """
    if len(cards) < 5:
        return (0, [0], "Incomplete")
    
    ranks = sorted([c.rank for c in cards], reverse=True)
    suits = [c.suit for c in cards]
    
    # Check for flush
    suit_counts = {}
    for s in suits:
        suit_counts[s] = suit_counts.get(s, 0) + 1
    is_flush = any(count >= 5 for count in suit_counts.values())
    
    # Check for straight
    unique_ranks = sorted(set(ranks), reverse=True)
    is_straight = False
    straight_high = 0
    
    for i in range(len(unique_ranks) - 4):
        if unique_ranks[i] - unique_ranks[i+4] == 4:
            is_straight = True
            straight_high = unique_ranks[i]
            break
    
    # Check for wheel (A-2-3-4-5)
    if set([14, 2, 3, 4, 5]).issubset(set(ranks)):
        is_straight = True
        straight_high = 5
    
    # Count rank occurrences
    rank_counts = {}
    for r in ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1
    
    counts = sorted(rank_counts.values(), reverse=True)
    
    # Determine hand
    if is_straight and is_flush:
        if straight_high == 14:
            return (10, [14], "Royal Flush")
        return (9, [straight_high], "Straight Flush")
    
    if counts[0] == 4:
        four_rank = [r for r, c in rank_counts.items() if c == 4][0]
        return (8, [four_rank], "Four of a Kind")
    
    if counts[0] == 3 and counts[1] >= 2:
        three_rank = [r for r, c in rank_counts.items() if c == 3][0]
        pair_rank = [r for r, c in rank_counts.items() if c >= 2 and r != three_rank][0]
        return (7, [three_rank, pair_rank], "Full House")
    
    if is_flush:
        return (6, ranks[:5], "Flush")
    
    if is_straight:
        return (5, [straight_high], "Straight")
    
    if counts[0] == 3:
        three_rank = [r for r, c in rank_counts.items() if c == 3][0]
        return (4, [three_rank] + [r for r in ranks if r != three_rank][:2], "Three of a Kind")
    
    if counts[0] == 2 and counts[1] == 2:
        pairs = sorted([r for r, c in rank_counts.items() if c == 2], reverse=True)
        kicker = [r for r in ranks if r not in pairs][0]
        return (3, pairs + [kicker], "Two Pair")
    
    if counts[0] == 2:
        pair_rank = [r for r, c in rank_counts.items() if c == 2][0]
        kickers = [r for r in ranks if r != pair_rank][:3]
        return (2, [pair_rank] + kickers, "Pair")
    
    return (1, ranks[:5], "High Card")


def _determine_winner(game: GameState):
    """Determine winner using proper hand evaluation"""
    active = get_active_players(game)
    
    if len(active) == 1:
        winner = active[0]
        hand_name = "Last Standing"
    else:
        # Evaluate all hands
        best_player = None
        best_hand = (0, [0], "")
        
        for player in active:
            all_cards = player.cards + game.community_cards
            hand = evaluate_hand(all_cards)
            
            print(f"🎮 HAND: {player.name} has {hand[2]} ({hand[0]})")
            
            if hand[0] > best_hand[0]:
                best_hand = hand
                best_player = player
            elif hand[0] == best_hand[0]:
                # Compare tiebreakers
                if hand[1] > best_hand[1]:
                    best_hand = hand
                    best_player = player
        
        winner = best_player
        hand_name = best_hand[2]
    
    winner.chips += game.pot
    game.winner_seat = winner.seat
    game.winner_hand = hand_name
    print(f"🎮 GAME: {winner.name} wins ${game.pot} with {hand_name}!")
    
    game.pot = 0
    game.phase = GamePhase.FINISHED


def start_new_hand(session_id: str) -> Optional[GameState]:
    """Start a new hand in an existing game"""
    game = active_games.get(session_id)
    if not game:
        return None
    
    # Reset for new hand
    game.deck = create_deck()
    game.community_cards = []
    game.pot = 0
    game.current_bet = 0
    game.phase = GamePhase.PRE_FLOP
    game.winner_seat = None
    game.winner_hand = None
    game.last_raiser_seat = None
    game.players_acted_this_round = set()
    
    # Reset players
    for player in game.players.values():
        player.cards = []
        player.is_folded = False
        player.is_all_in = False
        player.current_bet = 0
        player.is_active = player.chips > 0
    
    # Deal cards
    active = get_active_players(game)
    for player in active:
        player.cards = [game.deck.pop(), game.deck.pop()]
    
    # Post blinds
    if len(active) >= 2:
        sb_player = active[0]
        bb_player = active[1]
        
        sb_amount = min(game.small_blind, sb_player.chips)
        sb_player.chips -= sb_amount
        sb_player.current_bet = sb_amount
        game.pot += sb_amount
        
        bb_amount = min(game.big_blind, bb_player.chips)
        bb_player.chips -= bb_amount
        bb_player.current_bet = bb_amount
        game.pot += bb_amount
        game.current_bet = bb_amount
        
        # First to act
        if len(active) > 2:
            game.current_player_seat = active[2].seat
        else:
            game.current_player_seat = sb_player.seat
    
    print(f"🎮 GAME: New hand started!")
    return game


def get_game(session_id: str) -> Optional[GameState]:
    """Get game by session ID"""
    return active_games.get(session_id)


def end_game(session_id: str) -> bool:
    """End and remove a game"""
    if session_id in active_games:
        del active_games[session_id]
        return True
    return False
