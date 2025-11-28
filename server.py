import os
import hmac
import hashlib
import urllib.parse
import asyncio
import random
import time
from collections import Counter
from dataclasses import dataclass, field
from itertools import combinations
from typing import Dict, Any, List, Optional, Set, Tuple

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️ python-dotenv not installed, using system env vars")

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import get_user, top_balances, set_display_name
from lobby_db import (
    create_lobby, get_lobby_by_code, get_lobby_by_id,
    join_lobby, leave_lobby, start_game, finish_game,
    get_player_lobbies, cleanup_expired_lobbies, Lobby
)
import json

APP_DIR = os.path.join(os.path.dirname(__file__), "webapp")
START_BALANCE = 1000

app = FastAPI(title="Poker Mini App Server")

# CORS for production
ALLOWED_ORIGINS = [
    "https://*.netlify.app",
    "https://*.vercel.app",
    "https://t.me",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

# In production, be more restrictive; in dev, allow all
if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PRODUCTION"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Serve static assets
app.mount("/webapp", StaticFiles(directory=APP_DIR), name="webapp")


@app.get("/")
async def index():
    """API Root - returns server status"""
    return JSONResponse({
        "status": "ok",
        "app": "Poker Mini App API",
        "version": "1.0.0",
        "endpoints": {
            "lobby": "/api/lobby",
            "user": "/api/me",
            "websocket": "/ws/lobby/{code}"
        }
    })


def _parse_init_data(init_data: str) -> Dict[str, str]:
    # initData is URL-encoded key=value pairs separated by &
    parsed = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
    return {k: v for k, v in parsed}


def _check_telegram_auth(init_data: str, bot_token: str) -> Dict[str, Any]:
    if not init_data:
        raise HTTPException(status_code=401, detail="missing initData")
    data = _parse_init_data(init_data)
    if "hash" not in data:
        raise HTTPException(status_code=401, detail="missing hash")
    tg_hash = data.pop("hash")

    # Build data-check-string in alphabetical order by key
    data_check_arr = [f"{k}={v}" for k, v in sorted(data.items())]
    data_check_string = "\n".join(data_check_arr)

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(h, tg_hash):
        raise HTTPException(status_code=401, detail="bad signature")

    # Extract user JSON if present
    user_json = data.get("user")
    user: Dict[str, Any] = {}
    if user_json:
        import json
        try:
            user = json.loads(user_json)
        except Exception:
            user = {}
    return {"data": data, "user": user}


RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
SUITS = ["hearts", "diamonds", "clubs", "spades"]
MAX_PLAYERS = 6
STAGES = ["preflop", "flop", "turn", "river", "showdown"]

RANK_VALUES = {rank: idx + 2 for idx, rank in enumerate(RANKS)}
HAND_STRENGTH = {
    "HIGH_CARD": 0,
    "ONE_PAIR": 1,
    "TWO_PAIR": 2,
    "THREE_OF_A_KIND": 3,
    "STRAIGHT": 4,
    "FLUSH": 5,
    "FULL_HOUSE": 6,
    "FOUR_OF_A_KIND": 7,
    "STRAIGHT_FLUSH": 8,
}

BETTING_ROUND_DELAY = 1.5
SHOWDOWN_DELAY = 5.0
ACTION_TIMEOUT_SECONDS = 30
SMALL_BLIND = 10
BIG_BLIND = 20
BUSTOUT_TIMEOUT_SECONDS = 30


def create_shuffled_deck() -> List[Dict[str, str]]:
    deck = [{"rank": rank, "suit": suit} for suit in SUITS for rank in RANKS]
    random.shuffle(deck)
    return deck


def _detect_straight_high(values: List[int]) -> Optional[int]:
    if len(values) < 5:
        return None
    unique = sorted(set(values), reverse=True)
    if 14 in unique:
        unique.append(1)
    for i in range(len(unique) - 4):
        window = unique[i : i + 5]
        if all(window[j] - 1 == window[j + 1] for j in range(4)):
            if window[0] == 5 and window[4] == 1:
                return 5
            return window[0]
    return None


def _evaluate_five_cards(cards: List[Dict[str, str]]) -> Tuple[int, List[int]]:
    values = sorted([RANK_VALUES[card["rank"]] for card in cards], reverse=True)
    suits = [card["suit"] for card in cards]
    counts = Counter(values)
    sorted_counts = sorted(counts.items(), key=lambda item: (-item[1], -item[0]))
    is_flush = len(set(suits)) == 1
    straight_high = _detect_straight_high(values)
    is_straight = straight_high is not None

    if is_flush and is_straight:
        return HAND_STRENGTH["STRAIGHT_FLUSH"], [straight_high or 0]

    if sorted_counts[0][1] == 4:
        quad = sorted_counts[0][0]
        kicker = next(val for val in values if val != quad)
        return HAND_STRENGTH["FOUR_OF_A_KIND"], [quad, kicker]

    if sorted_counts[0][1] == 3 and sorted_counts[1][1] == 2:
        return HAND_STRENGTH["FULL_HOUSE"], [sorted_counts[0][0], sorted_counts[1][0]]

    if is_flush:
        return HAND_STRENGTH["FLUSH"], values

    if is_straight:
        return HAND_STRENGTH["STRAIGHT"], [straight_high or 0]

    if sorted_counts[0][1] == 3:
        trips = sorted_counts[0][0]
        kickers = [val for val in values if val != trips][:2]
        return HAND_STRENGTH["THREE_OF_A_KIND"], [trips, *kickers]

    if sorted_counts[0][1] == 2 and sorted_counts[1][1] == 2:
        top_pair = sorted_counts[0][0]
        second_pair = sorted_counts[1][0]
        kicker = next(val for val in values if val not in (top_pair, second_pair))
        return HAND_STRENGTH["TWO_PAIR"], [top_pair, second_pair, kicker]

    if sorted_counts[0][1] == 2:
        pair = sorted_counts[0][0]
        kickers = [val for val in values if val != pair][:3]
        return HAND_STRENGTH["ONE_PAIR"], [pair, *kickers]

    return HAND_STRENGTH["HIGH_CARD"], values[:5]


def _evaluate_best_hand(cards: List[Dict[str, str]]) -> Tuple[int, List[int]]:
    if len(cards) < 5:
        return 0, [0, 0, 0, 0, 0]
    best_rank: Optional[Tuple[int, List[int]]] = None
    for combo in combinations(cards, 5):
        evaluation = _evaluate_five_cards(list(combo))
        if best_rank is None or _compare_hands(evaluation, best_rank) > 0:
            best_rank = evaluation
    assert best_rank is not None
    return best_rank


def _compare_hands(a: Tuple[int, List[int]], b: Tuple[int, List[int]]) -> int:
    if a[0] != b[0]:
        return 1 if a[0] > b[0] else -1
    max_len = max(len(a[1]), len(b[1]))
    for idx in range(max_len):
        av = a[1][idx] if idx < len(a[1]) else 0
        bv = b[1][idx] if idx < len(b[1]) else 0
        if av != bv:
            return 1 if av > bv else -1
    return 0


@dataclass
class TablePlayer:
    user_id: str
    display_name: str
    seat: int
    stack: int = START_BALANCE
    cards: List[Dict[str, str]] = field(default_factory=list)
    has_folded: bool = False
    has_acted: bool = False
    is_small_blind: bool = False
    is_big_blind: bool = False
    blind_amount: int = 0
    is_all_in: bool = False
    is_busted: bool = False
    bust_deadline_ms: Optional[int] = None


class TableSession:
    def __init__(self, table_id: str):
        self.table_id = table_id
        self.players: Dict[str, TablePlayer] = {}
        self.connections: Dict[str, WebSocket] = {}
        self.community_cards: List[Dict[str, str]] = []
        self.pot: int = 0
        self.stage: str = "preflop"
        self.button_user_id: Optional[str] = None
        self.active_user_id: Optional[str] = None
        self.deck: List[Dict[str, str]] = []
        self.lock = asyncio.Lock()
        self.event_log: List[Dict[str, Any]] = []
        self.current_bet: int = 0
        self.player_bets: Dict[str, int] = {}
        self.hand_contributions: Dict[str, int] = {}
        self.pots: List[Dict[str, Any]] = []
        self.side_pot_summary: List[Dict[str, Any]] = []
        self.last_raise_amount: int = BIG_BLIND
        self.pending_auto_showdown: bool = False
        self.bustout_tasks: Dict[str, asyncio.Task] = {}
        self.round_transition_task: Optional[asyncio.Task] = None
        self.new_hand_task: Optional[asyncio.Task] = None
        self.action_timer_task: Optional[asyncio.Task] = None
        self.turn_deadline_ms: Optional[int] = None
        self.showdown_card_decisions: Dict[str, bool] = {}  # Track show/hide decisions after showdown
        self.showdown_saved_cards: Dict[str, List[Tuple[str, str]]] = {}  # Save cards before clearing for Show/Muck

    def _ordered_players(self) -> List[TablePlayer]:
        return [player for player in sorted(self.players.values(), key=lambda p: p.seat)]

    def _next_seat(self) -> int:
        occupied = {player.seat for player in self.players.values()}
        for seat in range(1, MAX_PLAYERS + 1):
            if seat not in occupied:
                return seat
        raise ValueError("table is full")

    def _rotate_button(self):
        ordered = self._ordered_players()
        if not ordered:
            self.button_user_id = None
            return
        if self.button_user_id not in self.players:
            self.button_user_id = ordered[0].user_id
            return
        current_index = next((idx for idx, player in enumerate(ordered) if player.user_id == self.button_user_id), 0)
        next_index = (current_index + 1) % len(ordered)
        self.button_user_id = ordered[next_index].user_id

    def _ensure_deck(self):
        if not self.deck:
            self.deck = create_shuffled_deck()

    def _deal_hole_cards(self):
        self._ensure_deck()
        for player in self._ordered_players():
            needed = 2 - len(player.cards)
            for _ in range(max(0, needed)):
                if self.deck:
                    player.cards.append(self.deck.pop())

    def _deal_community_cards(self, count: int):
        self._ensure_deck()
        for _ in range(count):
            if self.deck:
                self.community_cards.append(self.deck.pop())

    def _collect_bets_to_pot(self):
        """Collect all player bets from in front of them into the central pot."""
        for user_id, bet_amount in self.player_bets.items():
            self.pot += bet_amount

    def _reset_round(self):
        self._cancel_round_transition_task()
        self._cancel_new_hand_task()
        self._cancel_action_timer()
        self.deck = create_shuffled_deck()
        self.community_cards = []
        self.pot = 0
        self.stage = "preflop"
        self.current_bet = 0
        self.player_bets = {}
        self.hand_contributions = {}
        self.pots = []
        self.side_pot_summary = []
        self.last_raise_amount = BIG_BLIND
        self.pending_auto_showdown = False
        # Clear showdown state for new hand
        self.showdown_card_decisions = {}
        self.showdown_saved_cards = {}
        print("🔄 SERVER: New hand started - cleared showdown state")
        for player in self.players.values():
            player.cards = []
            player.has_folded = False
            player.has_acted = False
            player.is_small_blind = False
            player.is_big_blind = False
            player.blind_amount = 0
            player.is_all_in = False
            if player.stack <= 0:
                player.is_busted = True
            player.bust_deadline_ms = None
        self._rotate_button()
        self._post_blinds()
        self._deal_hole_cards()

    def _advance_stage(self):
        try:
            idx = STAGES.index(self.stage)
        except ValueError:
            idx = 0
        if idx >= len(STAGES) - 1:
            self.stage = "showdown"
            return
        next_stage = STAGES[idx + 1]
        self.stage = next_stage
        if next_stage == "flop":
            self._deal_community_cards(3)
        elif next_stage in ("turn", "river"):
            self._deal_community_cards(1)
        elif next_stage == "showdown":
            pass
        
        # Collect all bets into pot at end of betting round
        self._collect_bets_to_pot()
        
        self.current_bet = 0
        self.last_raise_amount = BIG_BLIND
        self.player_bets = {}
        for player in self.players.values():
            if player.has_folded:
                continue
            player.has_acted = player.is_all_in

        if next_stage == "showdown":
            self._set_active_user(None)
            self._cancel_action_timer()
            self._resolve_showdown()
            self._schedule_new_hand()
            return

        next_actor: Optional[str]
        if next_stage == "preflop":
            next_actor = self.active_user_id
        else:
            next_actor = self._first_to_act_postflop()
        self._set_active_user(next_actor)

    def _run_out_board(self):
        while self.stage != "showdown":
            self._advance_stage()
        self._resolve_showdown()
        self._schedule_new_hand()

    def _active_players(self) -> List[TablePlayer]:
        return [player for player in self._ordered_players() if not player.has_folded]

    def _actionable_players(self) -> List[TablePlayer]:
        return [player for player in self._active_players() if not player.is_all_in and player.stack > 0]

    def _required_to_call(self, player: TablePlayer) -> int:
        return max(0, self.current_bet - self._player_contribution(player.user_id))

    def _current_min_raise_increment(self) -> int:
        """Returns the minimum increment required for the next raise."""
        return max(self.last_raise_amount, BIG_BLIND)

    def _current_min_raise_total(self) -> int:
        """Returns the minimum total contribution a player must reach to raise."""
        increment = self._current_min_raise_increment()
        if self.current_bet <= 0:
            return increment
        return self.current_bet + increment

    def _find_next_actionable(self, start_index: int, ordered: Optional[List[TablePlayer]] = None) -> Optional[str]:
        ordered_players = ordered or self._ordered_players()
        if not ordered_players:
            return None
        for offset in range(len(ordered_players)):
            candidate = ordered_players[(start_index + offset) % len(ordered_players)]
            if candidate.has_folded or candidate.is_all_in or candidate.stack <= 0:
                continue
            return candidate.user_id
        return None

    def _first_to_act_postflop(self) -> Optional[str]:
        ordered = self._ordered_players()
        if not ordered:
            return None
        button_idx = next((idx for idx, player in enumerate(ordered) if player.user_id == self.button_user_id), 0)
        return self._find_next_actionable((button_idx + 1) % len(ordered), ordered)

    def _cancel_round_transition_task(self):
        if self.round_transition_task:
            self.round_transition_task.cancel()
            self.round_transition_task = None

    def _cancel_new_hand_task(self):
        if self.new_hand_task:
            self.new_hand_task.cancel()
            self.new_hand_task = None

    def _all_bets_settled(self, active_players: Optional[List[TablePlayer]] = None) -> bool:
        players = active_players or self._active_players()
        if not players:
            return False
        target = self.current_bet
        for player in players:
            contribution = self._player_contribution(player.user_id)
            # All-in players and players with 0 stack don't need to match the bet
            if player.is_all_in or player.stack == 0:
                continue
            if contribution < target:
                return False
        return True

    def _schedule_round_transition(self):
        if self.round_transition_task or self.stage == "showdown":
            return
        self.round_transition_task = asyncio.create_task(self._auto_advance_after_delay(self.stage))

    def _schedule_new_hand(self):
        if self.new_hand_task:
            print("⚠️ SERVER: New hand task already scheduled, skipping")
            return
        if self.stage != "showdown":
            print(f"⚠️ SERVER: Cannot schedule new hand - stage is {self.stage}")
            return
        if len(self.players) < 2:
            print(f"⚠️ SERVER: Cannot schedule new hand - only {len(self.players)} players")
            return
        print("📅 SERVER: Scheduling new hand task")
        self.new_hand_task = asyncio.create_task(self._auto_start_new_hand())

    def _set_active_user(self, user_id: Optional[str]):
        self.active_user_id = user_id
        self._restart_action_timer()

    def _restart_action_timer(self):
        if self.action_timer_task:
            self.action_timer_task.cancel()
            self.action_timer_task = None
        self.turn_deadline_ms = None
        active_id = self.active_user_id
        if not active_id or self.stage == "showdown":
            return
        player = self.players.get(active_id)
        if not player or player.has_folded:
            return
        deadline = int((time.time() + ACTION_TIMEOUT_SECONDS) * 1000)
        self.turn_deadline_ms = deadline
        self.action_timer_task = asyncio.create_task(self._auto_fold_after_timeout(active_id, deadline))

    def _post_blinds(self):
        ordered = self._ordered_players()
        if len(ordered) < 2:
            self._set_active_user(self.button_user_id)
            return

        button_idx = next((idx for idx, player in enumerate(ordered) if player.user_id == self.button_user_id), 0)
        total = len(ordered)
        if total == 2:
            small_idx = button_idx
            big_idx = (button_idx + 1) % total
            first_idx = small_idx  # HEADS-UP: SB (button) acts first preflop
        else:
            small_idx = (button_idx + 1) % total
            big_idx = (small_idx + 1) % total
            first_idx = (big_idx + 1) % total  # 3+: UTG acts first

        for player in ordered:
            player.is_small_blind = False
            player.is_big_blind = False
            player.blind_amount = 0

        now = int(time.time() * 1000)
        small_player = ordered[small_idx]
        big_player = ordered[big_idx]

        sb_amount = self._deduct_stack(small_player, SMALL_BLIND)
        bb_amount = self._deduct_stack(big_player, BIG_BLIND)
        small_player.is_small_blind = True
        big_player.is_big_blind = True
        small_player.blind_amount = sb_amount
        big_player.blind_amount = bb_amount

        if sb_amount:
            self.event_log.append({
                "type": "action",
                "userId": small_player.user_id,
                "action": "post_small_blind",
                "amount": sb_amount,
                "timestamp": now,
            })
        if bb_amount:
            self.event_log.append({
                "type": "action",
                "userId": big_player.user_id,
                "action": "post_big_blind",
                "amount": bb_amount,
                "timestamp": now,
            })

        # Current bet is the BB player's contribution (handles all-in for less)
        self.current_bet = self._player_contribution(big_player.user_id)
        self.last_raise_amount = BIG_BLIND

        for offset in range(len(ordered)):
            idx = (first_idx + offset) % len(ordered)
            candidate = ordered[idx]
            if candidate.has_folded or candidate.is_all_in or candidate.stack <= 0:
                continue
            self._set_active_user(candidate.user_id)
            break
        else:
            self._set_active_user(None)

    def _cancel_action_timer(self):
        if self.action_timer_task:
            self.action_timer_task.cancel()
            self.action_timer_task = None
        self.turn_deadline_ms = None

    def _is_betting_round_complete(self, active_players: List[TablePlayer]) -> bool:
        """
        Determines if the current betting round is complete.
        Rules:
        1. All active players must have acted (has_acted = True)
        2. All bets must be settled (equal contributions or all-in)
        3. PREFLOP SPECIAL: BB Option - if no one raised, BB must act
        """
        if not active_players:
            return True
        
        # Check if all bets are settled (equal or all-in)
        if not self._all_bets_settled(active_players):
            return False
        
        # Check if everyone has acted
        everybody_acted = all(player.has_acted for player in active_players)
        if not everybody_acted:
            return False
        
        # PREFLOP SPECIAL CASE: BB Option
        # If we're on preflop and no one raised above BB,
        # BB must have explicitly acted (checked or raised)
        if self.stage == "preflop":
            # Find BB player
            bb_player = next((p for p in self.players.values() if p.is_big_blind), None)
            if bb_player and not bb_player.has_folded and not bb_player.is_all_in:
                # BB option applies only if BB posted full blind
                bb_posted_full = bb_player.blind_amount >= BIG_BLIND
                # Check if there were any raises above BB
                no_raises = self.current_bet <= BIG_BLIND
                if bb_posted_full and no_raises:
                    # BB must have acted (checked or raised)
                    if not bb_player.has_acted:
                        return False
        
        return True

    async def _maybe_trigger_round_completion(self):
        active_players = self._active_players()
        # Only 1 or 0 active players left - hand is over
        if len(active_players) <= 1:
            if self.stage != "showdown":
                # Collect all remaining bets to pot before awarding winner
                self._collect_bets_to_pot()
                
                winner_player = active_players[0] if active_players else None
                winner_name = winner_player.display_name if winner_player else None
                pot_amount = self.pot
                if winner_player:
                    winner_player.stack += self.pot
                    self.event_log.append({
                        "type": "system",
                        "message": f"{winner_name} wins the pot",
                        "timestamp": int(time.time() * 1000),
                    })
                    # Emit handComplete event for win by fold
                    asyncio.create_task(self._emit_hand_complete([winner_player.user_id], pot_amount, "fold"))
                self.pot = 0
                self.hand_contributions = {}
                self.player_bets = {}
                self.pots = []
                self.side_pot_summary = []
                self.stage = "showdown"
                now = int(time.time() * 1000)
                if not winner_player:
                    self.event_log.append({"type": "system", "message": "Hand ended", "timestamp": now})
                self._cancel_action_timer()
            self._schedule_new_hand()
            return

        if self.stage == "showdown":
            self._schedule_new_hand()
            return

        # Check if betting round is complete
        if self._is_betting_round_complete(active_players):
            self._schedule_round_transition()
        else:
            self._cancel_round_transition_task()

    async def _auto_advance_after_delay(self, stage_snapshot: str):
        try:
            await asyncio.sleep(BETTING_ROUND_DELAY)
            async with self.lock:
                if self.stage != stage_snapshot:
                    return
                self._advance_stage()
                now = int(time.time() * 1000)
                self.event_log.append({"type": "system", "message": f"Stage -> {self.stage}", "timestamp": now})
                await self._maybe_trigger_round_completion()
                await self._broadcast_state_locked()
        except asyncio.CancelledError:
            return
        finally:
            self.round_transition_task = None

    async def _auto_start_new_hand(self):
        try:
            print(f"⏳ SERVER: Waiting {SHOWDOWN_DELAY} seconds before new hand...")
            await asyncio.sleep(SHOWDOWN_DELAY)
            async with self.lock:
                print(f"🔍 SERVER: Checking conditions - stage={self.stage}, players={len(self.players)}")
                if self.stage != "showdown":
                    print(f"❌ SERVER: Cannot start new hand - stage is {self.stage}, not showdown")
                    return
                if len(self.players) < 2:
                    print(f"❌ SERVER: Cannot start new hand - only {len(self.players)} players")
                    return
                print("🎲 SERVER: Starting new hand!")
                self._reset_round()
                now = int(time.time() * 1000)
                self.event_log.append({"type": "system", "message": "New hand started", "timestamp": now})
                print("📡 SERVER: Broadcasting new game state (preflop)")
                await self._broadcast_state_locked()
        except asyncio.CancelledError:
            print("⚠️ SERVER: New hand task was cancelled")
            return
        finally:
            self.new_hand_task = None

    async def _auto_fold_after_timeout(self, user_id: str, deadline_ms: int):
        try:
            await asyncio.sleep(ACTION_TIMEOUT_SECONDS)
            async with self.lock:
                if self.active_user_id != user_id or self.turn_deadline_ms != deadline_ms:
                    return
                player = self.players.get(user_id)
                if not player or player.has_folded:
                    return
                player.has_folded = True
                self._record_action(user_id)
                now = int(time.time() * 1000)
                self.event_log.append({
                    "type": "action",
                    "userId": user_id,
                    "action": "auto_fold",
                    "timestamp": now,
                })
                self._advance_active()
                await self._maybe_trigger_round_completion()
                await self._broadcast_state_locked()
        except asyncio.CancelledError:
            return
        finally:
            if self.action_timer_task and self.action_timer_task.done():
                self.action_timer_task = None
            if self.action_timer_task is None and self.active_user_id == user_id:
                self.turn_deadline_ms = None

    def _record_action(self, actor_id: str, *, resets_others: bool = False):
        player = self.players.get(actor_id)
        if not player:
            return
        player.has_acted = True
        if resets_others:
            for other in self._active_players():
                if other.user_id != actor_id:
                    other.has_acted = False

    async def add_player(self, user_id: str, display_name: str, websocket: WebSocket):
        async with self.lock:
            if user_id in self.players:
                # reconnect
                self.connections[user_id] = websocket
                return
            seat = self._next_seat()
            player = TablePlayer(user_id=user_id, display_name=display_name, seat=seat)
            self.players[user_id] = player
            self.connections[user_id] = websocket
            if len(self.players) == 1:
                self.button_user_id = user_id
                self.active_user_id = user_id
            should_auto_start = (
                len(self.players) >= 2
                and self.stage == "preflop"
                and not self.community_cards
                and all(len(p.cards) == 0 for p in self.players.values())
            )
            if should_auto_start:
                self._reset_round()
                now = int(time.time() * 1000)
                self.event_log.append({"type": "system", "message": "New hand started", "timestamp": now})
            await self._maybe_trigger_round_completion()
            await self._broadcast_state_locked()

    def _build_pots(self):
        contributions = {uid: amt for uid, amt in self.hand_contributions.items() if amt > 0}
        self.pots = []
        level = 0
        while contributions:
            eligible = [uid for uid in contributions if uid in self.players and not self.players[uid].has_folded]
            if not eligible:
                break
            min_contribution = min(contributions[uid] for uid in eligible)
            involved = [uid for uid in contributions if contributions[uid] > 0]
            pot_amount = min_contribution * len(involved)
            self.pots.append({
                "level": level,
                "amount": pot_amount,
                "eligible": set(eligible),
            })
            level += 1
            for uid in involved:
                contributions[uid] = max(0, contributions[uid] - min_contribution)
            contributions = {uid: amt for uid, amt in contributions.items() if amt > 0}
        self.side_pot_summary = [{"amount": pot["amount"], "eligible": list(pot["eligible"])} for pot in self.pots]

    async def _emit_hand_complete(self, winner_ids: List[str], pot_amount: int, win_type: str):
        """Emit handComplete event to all connected clients for win banner animation"""
        print(f"🏆 SERVER: Emitting handComplete - winners: {winner_ids}, pot: {pot_amount}, type: {win_type}")
        for user_id, ws in self.connections.items():
            try:
                await ws.send_json({
                    "type": "handComplete",
                    "winners": winner_ids,
                    "potAmount": pot_amount,
                    "potPerWinner": pot_amount // len(winner_ids) if winner_ids else 0,
                    "winType": win_type
                })
                print(f"✅ SERVER: Sent handComplete to {user_id}")
            except Exception as e:
                print(f"❌ SERVER: Failed to send handComplete to {user_id}: {e}")

    def _resolve_showdown(self):
        if self.stage != "showdown":
            return
        self._build_pots()
        contenders = [player for player in self.players.values() if not player.has_folded]
        evaluations: Dict[str, Tuple[int, List[int]]] = {}
        for player in contenders:
            cards = player.cards + self.community_cards
            evaluations[player.user_id] = _evaluate_best_hand(cards)
        winnings: Dict[str, int] = {player.user_id: 0 for player in contenders}
        winner_ids: List[str] = []
        total_pot = sum(pot["amount"] for pot in self.pots)
        
        for pot in self.pots:
            eligible_players = [uid for uid in pot["eligible"] if uid in evaluations]
            if not eligible_players:
                continue
            best = eligible_players[0]
            for uid in eligible_players[1:]:
                if _compare_hands(evaluations[uid], evaluations[best]) > 0:
                    best = uid
            winners = [uid for uid in eligible_players if _compare_hands(evaluations[uid], evaluations[best]) == 0]
            # Collect all unique winners for handComplete event
            for uid in winners:
                if uid not in winner_ids:
                    winner_ids.append(uid)
            share = pot["amount"] // len(winners)
            for uid in winners:
                winnings[uid] = winnings.get(uid, 0) + share
            remainder = pot["amount"] - share * len(winners)
            if remainder and winners:
                winnings[winners[0]] += remainder
        
        bust_outs = []
        for uid, amount in winnings.items():
            player = self.players.get(uid)
            if player:
                player.stack += amount
        self.pot = 0
        
        # CRITICAL: Save cards BEFORE clearing for Show/Muck feature
        self.showdown_saved_cards = {}
        for player in self.players.values():
            if player.cards:
                self.showdown_saved_cards[player.user_id] = player.cards.copy()
                print(f"💾 SERVER: Saved cards for {player.user_id}: {player.cards}")
        
        for player in self.players.values():
            player.cards = []
            if player.stack <= 0 and not player.is_busted:
                player.is_busted = True
                bust_outs.append(player)
        self.hand_contributions = {}
        self.player_bets = {}
        for busted in bust_outs:
            self.event_log.append({
                "type": "system",
                "message": f"{busted.display_name} busted out",
                "userId": busted.user_id,
                "timestamp": int(time.time() * 1000),
            })
        
        # Emit handComplete event for win banner animation
        if winner_ids and total_pot > 0:
            asyncio.create_task(self._emit_hand_complete(winner_ids, total_pot, "showdown"))
        
        # Emit showdownComplete with losers list for Show/Muck feature
        loser_ids = [uid for uid in evaluations.keys() if uid not in winner_ids]
        if loser_ids:
            asyncio.create_task(self._emit_showdown_complete(winner_ids, loser_ids, contenders))

    async def _emit_showdown_complete(self, winner_ids: List[str], loser_ids: List[str], contenders: List["TablePlayer"]):
        """Emit showdownComplete event with losers list for Show/Muck feature"""
        print(f"😢 SERVER: Emitting showdownComplete - winners: {winner_ids}, losers: {loser_ids}")
        
        losers_data = []
        for loser_id in loser_ids:
            player = next((p for p in contenders if p.user_id == loser_id), None)
            if player:
                losers_data.append({
                    "playerId": loser_id,
                    "nickname": player.display_name,
                    "cards": [{"rank": c["rank"], "suit": c["suit"]} for c in player.cards] if player.cards else [],
                    "showCards": False
                })
        
        for user_id, ws in self.connections.items():
            try:
                await ws.send_json({
                    "type": "showdownComplete",
                    "winnerId": winner_ids[0] if winner_ids else None,
                    "winners": winner_ids,
                    "losers": losers_data
                })
                print(f"✅ SERVER: Sent showdownComplete to {user_id}")
            except Exception as e:
                print(f"❌ SERVER: Failed to send showdownComplete to {user_id}: {e}")

    async def remove_player(self, user_id: str):
        async with self.lock:
            self.connections.pop(user_id, None)
            removed = self.players.pop(user_id, None)
            if removed and self.button_user_id == user_id:
                self._rotate_button()
            if self.active_user_id == user_id:
                fallback = self.button_user_id if self.button_user_id in self.players else None
                self._set_active_user(fallback)
            else:
                self._restart_action_timer()
            await self._maybe_trigger_round_completion()
            await self._broadcast_state_locked()

    def _player_contribution(self, user_id: str) -> int:
        return self.player_bets.get(user_id, 0)

    def _update_contribution(self, user_id: str, amount: int):
        self.player_bets[user_id] = self._player_contribution(user_id) + amount

    def _advance_active(self):
        ordered = self._ordered_players()
        if not ordered:
            self._set_active_user(None)
            return
        if self.active_user_id not in self.players:
            self._set_active_user(ordered[0].user_id)
            return
        start_index = next((idx for idx, player in enumerate(ordered) if player.user_id == self.active_user_id), 0)
        for offset in range(1, len(ordered) + 1):
            candidate = ordered[(start_index + offset) % len(ordered)]
            if candidate.has_folded or candidate.stack <= 0 or candidate.is_all_in:
                continue
            self._set_active_user(candidate.user_id)
            return
        self._set_active_user(ordered[start_index].user_id)
        self.turn_deadline_ms = None

    def _commit_to_amount(self, player: TablePlayer, desired_total: int) -> int:
        current = self._player_contribution(player.user_id)
        need = max(0, desired_total - current)
        return self._deduct_stack(player, need)

    def _is_player_turn(self, user_id: str) -> bool:
        return self.active_user_id == user_id

    def _append_action_event(self, user_id: str, action: str, timestamp: int, amount: Optional[int] = None):
        event: Dict[str, Any] = {
            "type": "action",
            "userId": user_id,
            "action": action,
            "timestamp": timestamp,
        }
        if amount is not None:
            event["amount"] = amount
        self.event_log.append(event)

    def _maybe_auto_showdown(self):
        if self.stage == "showdown" or self.pending_auto_showdown:
            return
        if not self._actionable_players():
            self.pending_auto_showdown = True
            self._run_out_board()

    def _process_fold(self, player: TablePlayer, timestamp: int):
        player.has_folded = True
        self._record_action(player.user_id)
        self._append_action_event(player.user_id, "fold", timestamp)
        self._advance_active()
        self._maybe_auto_showdown()

    def _process_check(self, player: TablePlayer, timestamp: int):
        # Can only check if contribution equals current bet (no one raised)
        if self._player_contribution(player.user_id) < self.current_bet:
            # Invalid check - ignore action (client should prevent this)
            return
        self._record_action(player.user_id)
        self._append_action_event(player.user_id, "check", timestamp)
        self._advance_active()

    def _process_call(self, player: TablePlayer, timestamp: int):
        to_call = self._required_to_call(player)
        paid = self._deduct_stack(player, to_call)
        self._record_action(player.user_id)
        self._append_action_event(player.user_id, "call", timestamp, amount=paid)
        self._advance_active()
        self._maybe_auto_showdown()

    def _process_bet_or_raise(self, player: TablePlayer, amount: int, command: str, timestamp: int):
        if amount <= 0 and player.stack > 0:
            return
        
        # Check minimum raise requirement BEFORE deducting
        previous_high = self.current_bet
        current_contrib = self._player_contribution(player.user_id)
        potential_total = current_contrib + min(amount, player.stack)
        increase = max(0, potential_total - previous_high)
        min_required = self.last_raise_amount if previous_high > 0 else BIG_BLIND
        
        # Validate: must be all-in OR meet minimum raise OR first bet
        will_be_all_in = amount >= player.stack
        if not will_be_all_in and previous_high > 0 and increase < min_required:
            # Invalid raise - ignore
            return
        
        contributed = self._deduct_stack(player, amount)
        if contributed <= 0 and not player.is_all_in:
            return
        player_total = self._player_contribution(player.user_id)
        increase = max(0, player_total - previous_high)

        reopened = False
        if player_total > self.current_bet:
            self.current_bet = player_total
            if increase >= min_required or player.is_all_in or previous_high == 0:
                self.last_raise_amount = max(self.last_raise_amount, increase or self.last_raise_amount)
                reopened = True

        self._append_action_event(player.user_id, command, timestamp, amount=contributed)
        self._record_action(player.user_id, resets_others=reopened)
        self._advance_active()
        self._maybe_auto_showdown()

    def _deduct_stack(self, player: TablePlayer, amount: int) -> int:
        """Deduct chips from player stack and add to their current bet.
        Chips stay 'in front of player' until end of betting round."""
        if amount <= 0:
            return 0
        actual = min(amount, player.stack)
        if actual <= 0:
            return 0
        player.stack -= actual
        if player.stack == 0:
            player.is_all_in = True
        # DON'T add to pot yet - chips stay in front of player (player_bets)
        self._update_contribution(player.user_id, actual)
        self.hand_contributions[player.user_id] = self.hand_contributions.get(player.user_id, 0) + actual
        return actual

    def _schedule_bustout(self, player: TablePlayer):
        self._cancel_bustout_task(player.user_id)
        deadline = int((time.time() + BUSTOUT_TIMEOUT_SECONDS) * 1000)
        player.bust_deadline_ms = deadline

        async def _auto_remove():
            try:
                await asyncio.sleep(BUSTOUT_TIMEOUT_SECONDS)
                should_remove = False
                async with self.lock:
                    if player.is_busted and player.user_id in self.players:
                        should_remove = True
                if should_remove:
                    await self.remove_player(player.user_id)
            except asyncio.CancelledError:
                return

        task = asyncio.create_task(_auto_remove())
        self.bustout_tasks[player.user_id] = task

    def _cancel_bustout_task(self, user_id: str):
        task = self.bustout_tasks.pop(user_id, None)
        if task:
            task.cancel()

    async def handle_action(self, user_id: str, payload: Dict[str, Any]):
        command = (payload.get("command") or "").lower()
        pending_removal = False
        async with self.lock:
            now = int(time.time() * 1000)

            if command == "start_hand":
                self._reset_round()
                self.event_log.append({"type": "system", "message": "New hand started", "timestamp": now})
                await self._broadcast_state_locked()
                return

            if command == "advance_stage":
                self._advance_stage()
                self.event_log.append({"type": "system", "message": f"Stage -> {self.stage}", "timestamp": now})
                await self._broadcast_state_locked()
                return

            if command == "chat":
                message = payload.get("message")
                if message:
                    self.event_log.append({"type": "chat", "userId": user_id, "message": message, "timestamp": now})
                    await self._broadcast_state_locked()
                return
            
            if command == "showcards":
                # Handle player decision to show or hide cards after showdown
                show = payload.get("show", False)
                player = self.players.get(user_id)
                print(f"🃏 SERVER: Player {user_id} chose to {'SHOW' if show else 'MUCK'} cards")
                print(f"📦 SERVER: showdown_saved_cards = {self.showdown_saved_cards}")
                
                if player:
                    self.showdown_card_decisions[user_id] = show
                    
                    # Use SAVED cards (player.cards is already cleared after showdown!)
                    saved_cards = self.showdown_saved_cards.get(user_id, [])
                    print(f"💾 SERVER: Retrieved saved cards for {user_id}: {saved_cards}")
                    
                    # Format cards for broadcast
                    # Cards are stored as dicts: {"rank": "A", "suit": "hearts"}
                    cards_data = None
                    if show and saved_cards:
                        cards_data = [{"rank": c["rank"], "suit": c["suit"]} for c in saved_cards]
                        print(f"📋 SERVER: Formatted cards_data: {cards_data}")
                    else:
                        print(f"⚠️ SERVER: No cards to show (show={show}, saved_cards={saved_cards})")
                    
                    # Broadcast visibility decision to ALL connected players
                    print(f"📡 SERVER: Broadcasting to {len(self.connections)} connected players")
                    for uid, ws in self.connections.items():
                        try:
                            message = {
                                "type": "playerCardsVisibility",
                                "playerId": user_id,
                                "nickname": player.display_name,
                                "show": show,
                                "cards": cards_data
                            }
                            await ws.send_json(message)
                            print(f"✅ SERVER: Sent playerCardsVisibility to {uid}: {message}")
                        except Exception as e:
                            print(f"❌ SERVER: Failed to send playerCardsVisibility to {uid}: {e}")
                else:
                    print(f"❌ SERVER: Player {user_id} not found!")
                return

            if command == "leave_table":
                pending_removal = True
                # broadcast will be handled in remove_player
                continue_loop = False
                break_placeholder = False
                pass

            player = self.players.get(user_id)
            if command == "leave_table":
                pending_removal = True
            
            if not player or player.has_folded or self.stage == "showdown":
                return

            if not self._is_player_turn(user_id):
                return
            if command == "fold":
                self._process_fold(player, now)
            elif command == "check":
                self._process_check(player, now)
            elif command == "call":
                self._process_call(player, now)
            elif command in {"bet", "raise", "all_in"}:
                amount = int(payload.get("amount") or 0)
                if command == "all_in":
                    # All-in means betting entire stack
                    amount = player.stack
                self._process_bet_or_raise(player, amount, command, now)
            elif command == "rebuy" and player.is_busted:
                self._cancel_bustout_task(user_id)
                player.stack = START_BALANCE
                player.is_busted = False
                player.bust_deadline_ms = None
                self.event_log.append({
                    "type": "system",
                    "message": f"{player.display_name} re-bought",
                    "timestamp": now,
                })
            elif command == "leave_table":
                pending_removal = True
            else:
                return

            await self._maybe_trigger_round_completion()
            await self._broadcast_state_locked()

        if pending_removal:
            await self.remove_player(user_id)

    def _player_payload(self, player: TablePlayer, viewer_id: str) -> Dict[str, Any]:
        can_see = viewer_id == player.user_id or self.stage == "showdown"
        return {
            "userId": player.user_id,
            "displayName": player.display_name,
            "seat": player.seat,
            "stack": player.stack,
            "hasFolded": player.has_folded,
            "cards": player.cards if can_see else [],
            "cardCount": len(player.cards),
            "hasActed": player.has_acted,
            "isSmallBlind": player.is_small_blind,
            "isBigBlind": player.is_big_blind,
            "blindAmount": player.blind_amount,
            "isBusted": player.is_busted,
            "bustDeadlineMs": player.bust_deadline_ms,
        }

    def _state_for_viewer(self, viewer_id: str) -> Dict[str, Any]:
        players = [self._player_payload(player, viewer_id) for player in self._ordered_players()]
        # Display total pot = central pot + all current bets
        current_bets_total = sum(self.player_bets.values())
        display_pot = self.pot + current_bets_total
        return {
            "tableId": self.table_id,
            "players": players,
            "communityCards": self.community_cards,
            "pot": display_pot,
            "stage": self.stage,
            "buttonUserId": self.button_user_id,
            "activeUserId": self.active_user_id,
            "events": self.event_log[-30:],
            "currentBet": self.current_bet,
            "playerBets": self.player_bets,
            "turnDeadlineMs": self.turn_deadline_ms,
            "actionTimeoutMs": int(ACTION_TIMEOUT_SECONDS * 1000),
            "smallBlind": SMALL_BLIND,
            "bigBlind": BIG_BLIND,
            "sidePotSummary": self.side_pot_summary,
            "minRaiseIncrement": self._current_min_raise_increment(),
            "minRaiseTotal": self._current_min_raise_total(),
        }

    async def _broadcast_state_locked(self):
        stale: Set[str] = set()
        for user_id, ws in self.connections.items():
            try:
                await ws.send_json({"type": "state", "payload": self._state_for_viewer(user_id)})
            except RuntimeError:
                stale.add(user_id)
            except Exception:
                stale.add(user_id)
        for user_id in stale:
            self.connections.pop(user_id, None)


class TableManager:
    def __init__(self):
        self.tables: Dict[str, TableSession] = {}
        self.lock = asyncio.Lock()

    async def get_table(self, table_id: str) -> TableSession:
        async with self.lock:
            if table_id not in self.tables:
                self.tables[table_id] = TableSession(table_id)
            return self.tables[table_id]


table_manager = TableManager()


@app.post("/api/me")
async def me(payload: Dict[str, str]):
    init_data = payload.get("initData", "")
    if not init_data:
        # Guest mode for local browser testing
        db_user = await get_user(0, START_BALANCE, "Guest")
        return {
            "user_id": db_user["user_id"],
            "display_name": db_user.get("display_name") or "Guest",
            "balance": db_user["balance"],
        }

    bot_token = os.getenv("TELEGRAM_TOKEN")
    if not bot_token:
        raise HTTPException(status_code=500, detail="server misconfigured: TELEGRAM_TOKEN not set")
    auth = _check_telegram_auth(init_data, bot_token)
    user = auth.get("user") or {}
    user_id = user.get("id") or 0
    display = user.get("first_name") or "Player"

    db_user = await get_user(user_id, START_BALANCE, display)
    if user_id:
        await set_display_name(user_id, display)
    return {
        "user_id": db_user["user_id"],
        "display_name": db_user.get("display_name") or display,
        "balance": db_user["balance"],
    }


@app.get("/api/top")
async def api_top():
    top = await top_balances(10)
    return {"top": top}


@app.websocket("/ws/tables/{table_id}")
async def table_websocket(websocket: WebSocket, table_id: str):
    await websocket.accept()
    user_id = websocket.query_params.get("user_id")
    display_name = websocket.query_params.get("display_name", "Guest")
    if not user_id:
        await websocket.close(code=4000)
        return
    table = await table_manager.get_table(table_id)
    try:
        await table.add_player(user_id=user_id, display_name=display_name, websocket=websocket)
        await websocket.send_json({"type": "welcome", "payload": {"tableId": table_id}})
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "action":
                payload = data.get("payload") or {}
                await table.handle_action(user_id, payload)
            else:
                continue
    except WebSocketDisconnect:
        await table.remove_player(user_id)
    except Exception:
        await table.remove_player(user_id)
        await websocket.close(code=1011)
        raise


# ============================================
# LOBBY API ENDPOINTS
# ============================================

BOT_USERNAME = os.environ.get("BOT_USERNAME", "Pokergamebot")
print(f"🤖 Using Telegram bot: @{BOT_USERNAME}")

# Lobby WebSocket connections
lobby_connections: Dict[str, Dict[str, WebSocket]] = {}  # lobby_code -> {user_id -> websocket}


def _extract_telegram_user(init_data: str) -> Dict[str, Any]:
    """Extract Telegram user from initData without strict validation (for development)"""
    if not init_data:
        return {}
    try:
        data = _parse_init_data(init_data)
        user_json = data.get("user", "{}")
        return json.loads(user_json) if user_json else {}
    except Exception:
        return {}


class CreateLobbyRequest(BaseModel):
    lobbyName: Optional[str] = None
    buyIn: int = 100
    maxPlayers: int = 6
    initData: str = ""

class JoinLobbyRequest(BaseModel):
    initData: str = ""

@app.post("/api/lobby/create")
async def api_create_lobby(request: CreateLobbyRequest):
    """
    Create a new private lobby.
    Telegram user info from initData.
    """
    lobbyName = request.lobbyName
    buyIn = request.buyIn
    maxPlayers = request.maxPlayers
    initData = request.initData
    print(f"🎯 API: Create lobby request - name={lobbyName}, buyIn={buyIn}, max={maxPlayers}")
    
    # Extract user from initData
    user = _extract_telegram_user(initData)
    if not user:
        # For development: create guest user
        user = {
            "id": random.randint(100000, 999999),
            "first_name": "Guest",
            "username": f"guest_{random.randint(1000, 9999)}"
        }
        print(f"⚠️ API: No Telegram user, using guest: {user}")
    
    telegram_id = user.get("id")
    username = user.get("username")
    first_name = user.get("first_name", "Player")
    
    try:
        lobby = await create_lobby(
            host_telegram_id=telegram_id,
            host_username=username,
            host_first_name=first_name,
            lobby_name=lobbyName,
            buy_in=buyIn,
            max_players=maxPlayers,
        )
        
        invite_link = f"https://t.me/{BOT_USERNAME}?start=lobby_{lobby.lobby_code}"
        
        return {
            "success": True,
            "lobbyCode": lobby.lobby_code,
            "inviteLink": invite_link,
            "lobby": lobby.to_dict(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/lobby/{lobby_code}")
async def api_get_lobby(lobby_code: str):
    """Get lobby details by code"""
    print(f"🎯 API: Get lobby {lobby_code}")
    
    lobby = await get_lobby_by_code(lobby_code)
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    if lobby.is_expired():
        raise HTTPException(status_code=410, detail="Lobby has expired")
    
    return {
        "success": True,
        "lobby": lobby.to_dict(),
        "inviteLink": f"https://t.me/{BOT_USERNAME}?start=lobby_{lobby.lobby_code}",
    }


@app.post("/api/lobby/{lobby_code}/join")
async def api_join_lobby(lobby_code: str, request: JoinLobbyRequest):
    """Join an existing lobby"""
    print(f"🎯 API: Join lobby {lobby_code}")
    
    user = _extract_telegram_user(request.initData)
    if not user:
        # For development: create guest user
        user = {
            "id": random.randint(100000, 999999),
            "first_name": "Guest",
            "username": f"guest_{random.randint(1000, 9999)}"
        }
    
    telegram_id = user.get("id")
    username = user.get("username")
    first_name = user.get("first_name", "Player")
    
    success, message, lobby = await join_lobby(
        lobby_code=lobby_code,
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Broadcast to lobby room
    await _broadcast_lobby_event(lobby_code, {
        "type": "playerJoined",
        "player": lobby.players[telegram_id].to_dict(),
        "playerCount": len(lobby.players),
    })
    
    return {
        "success": True,
        "message": message,
        "lobby": lobby.to_dict(),
    }


@app.post("/api/lobby/{lobby_code}/leave")
async def api_leave_lobby(lobby_code: str, request: JoinLobbyRequest):
    """Leave a lobby"""
    print(f"🎯 API: Leave lobby {lobby_code}")
    
    user = _extract_telegram_user(request.initData)
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    telegram_id = user.get("id")
    
    success, message = await leave_lobby(lobby_code, telegram_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Broadcast to lobby room
    await _broadcast_lobby_event(lobby_code, {
        "type": "playerLeft",
        "telegramId": telegram_id,
    })
    
    return {"success": True, "message": message}


@app.post("/api/lobby/{lobby_code}/start")
async def api_start_game(lobby_code: str, request: JoinLobbyRequest):
    """Start the game. Only host can start."""
    print(f"🎯 API: Start game in lobby {lobby_code}")
    
    user = _extract_telegram_user(request.initData)
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    telegram_id = user.get("id")
    
    success, message, game_session_id = await start_game(lobby_code, telegram_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    lobby = await get_lobby_by_code(lobby_code)
    
    # Broadcast game started to all players
    await _broadcast_lobby_event(lobby_code, {
        "type": "gameStarted",
        "gameSessionId": game_session_id,
        "lobby": lobby.to_dict() if lobby else None,
    })
    
    return {
        "success": True,
        "message": message,
        "gameSessionId": game_session_id,
        "lobby": lobby.to_dict() if lobby else None,
    }


@app.get("/api/my-lobbies")
async def api_get_my_lobbies(initData: str = ""):
    """Get all lobbies current user is in"""
    user = _extract_telegram_user(initData)
    if not user:
        return {"success": True, "lobbies": []}
    
    telegram_id = user.get("id")
    lobbies = await get_player_lobbies(telegram_id)
    
    return {
        "success": True,
        "lobbies": [l.to_dict() for l in lobbies],
    }


async def _broadcast_lobby_event(lobby_code: str, event: Dict[str, Any]):
    """Broadcast event to all connected clients in a lobby"""
    connections = lobby_connections.get(lobby_code, {})
    stale = []
    
    for user_id, ws in connections.items():
        try:
            await ws.send_json(event)
        except Exception:
            stale.append(user_id)
    
    for user_id in stale:
        connections.pop(user_id, None)


@app.websocket("/ws/lobby/{lobby_code}")
async def lobby_websocket(websocket: WebSocket, lobby_code: str):
    """WebSocket endpoint for lobby real-time updates"""
    await websocket.accept()
    
    lobby = await get_lobby_by_code(lobby_code)
    if not lobby:
        await websocket.send_json({"type": "error", "message": "Lobby not found"})
        await websocket.close()
        return
    
    # Get user ID from query params or generate temporary one
    user_id = str(random.randint(100000, 999999))
    
    # Add to lobby connections
    if lobby_code not in lobby_connections:
        lobby_connections[lobby_code] = {}
    lobby_connections[lobby_code][user_id] = websocket
    
    print(f"🔌 LOBBY WS: User {user_id} connected to lobby {lobby_code}")
    
    try:
        # Send current lobby state
        await websocket.send_json({
            "type": "lobbyState",
            "lobby": lobby.to_dict(),
        })
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "ready":
                # Player marks ready
                is_ready = data.get("ready", True)
                # TODO: Update player ready status
                await _broadcast_lobby_event(lobby_code, {
                    "type": "playerReady",
                    "userId": user_id,
                    "ready": is_ready,
                })
            else:
                continue
                
    except WebSocketDisconnect:
        print(f"🔌 LOBBY WS: User {user_id} disconnected from lobby {lobby_code}")
    except Exception as e:
        print(f"❌ LOBBY WS: Error for user {user_id}: {e}")
    finally:
        if lobby_code in lobby_connections:
            lobby_connections[lobby_code].pop(user_id, None)


# Run server
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting server on port {port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
