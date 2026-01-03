"""
Tournament Engine for Poker
Supports: Tournament (MTT), Bounty Hunter (PKO), Sit & Go (SnG)
"""

import random
import time
import asyncio
import uuid
from typing import Dict, List, Optional, Any, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS AND CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

class TournamentMode(Enum):
    TOURNAMENT = "tournament"      # Multi-table tournament (MTT)
    BOUNTY_HUNTER = "bounty"       # Progressive Knockout (PKO)
    SIT_AND_GO = "sitgo"           # Single table tournament


class TournamentStatus(Enum):
    REGISTERING = "registering"    # Open for registration
    LATE_REG = "late_reg"          # Late registration period
    RUNNING = "running"            # Tournament in progress
    FINAL_TABLE = "final_table"    # Final table stage
    FINISHED = "finished"          # Tournament completed
    CANCELLED = "cancelled"        # Cancelled (not enough players)


class SnGFormat(Enum):
    WINNER_TAKES_ALL = "winner_takes_all"
    TOP_3_PAID = "top_3"
    TOP_2_PAID = "top_2"
    DOUBLE_OR_NOTHING = "double_or_nothing"


# Blind level structure for tournaments
BLIND_STRUCTURES = {
    "standard": [
        {"sb": 25, "bb": 50, "ante": 0, "duration": 900},      # 15 min
        {"sb": 50, "bb": 100, "ante": 0, "duration": 900},
        {"sb": 75, "bb": 150, "ante": 0, "duration": 900},
        {"sb": 100, "bb": 200, "ante": 0, "duration": 900},
        {"sb": 150, "bb": 300, "ante": 25, "duration": 900},
        {"sb": 200, "bb": 400, "ante": 50, "duration": 900},
        {"sb": 300, "bb": 600, "ante": 75, "duration": 900},
        {"sb": 400, "bb": 800, "ante": 100, "duration": 900},
        {"sb": 600, "bb": 1200, "ante": 150, "duration": 900},
        {"sb": 800, "bb": 1600, "ante": 200, "duration": 900},
        {"sb": 1000, "bb": 2000, "ante": 250, "duration": 900},
        {"sb": 1500, "bb": 3000, "ante": 400, "duration": 900},
        {"sb": 2000, "bb": 4000, "ante": 500, "duration": 900},
        {"sb": 3000, "bb": 6000, "ante": 750, "duration": 900},
        {"sb": 4000, "bb": 8000, "ante": 1000, "duration": 900},
    ],
    "turbo": [
        {"sb": 10, "bb": 20, "ante": 0, "duration": 300},      # 5 min
        {"sb": 15, "bb": 30, "ante": 0, "duration": 300},
        {"sb": 25, "bb": 50, "ante": 0, "duration": 300},
        {"sb": 50, "bb": 100, "ante": 0, "duration": 300},
        {"sb": 75, "bb": 150, "ante": 15, "duration": 300},
        {"sb": 100, "bb": 200, "ante": 20, "duration": 300},
        {"sb": 150, "bb": 300, "ante": 30, "duration": 300},
        {"sb": 200, "bb": 400, "ante": 40, "duration": 300},
        {"sb": 300, "bb": 600, "ante": 60, "duration": 300},
        {"sb": 400, "bb": 800, "ante": 80, "duration": 300},
        {"sb": 600, "bb": 1200, "ante": 120, "duration": 300},
        {"sb": 800, "bb": 1600, "ante": 160, "duration": 300},
    ],
    "hyper_turbo": [
        {"sb": 10, "bb": 20, "ante": 0, "duration": 180},      # 3 min
        {"sb": 20, "bb": 40, "ante": 0, "duration": 180},
        {"sb": 30, "bb": 60, "ante": 0, "duration": 180},
        {"sb": 50, "bb": 100, "ante": 10, "duration": 180},
        {"sb": 75, "bb": 150, "ante": 15, "duration": 180},
        {"sb": 100, "bb": 200, "ante": 20, "duration": 180},
        {"sb": 150, "bb": 300, "ante": 30, "duration": 180},
        {"sb": 200, "bb": 400, "ante": 40, "duration": 180},
        {"sb": 300, "bb": 600, "ante": 60, "duration": 180},
        {"sb": 500, "bb": 1000, "ante": 100, "duration": 180},
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TournamentPlayer:
    """Player registered in a tournament"""
    telegram_id: int
    username: Optional[str]
    first_name: str
    chips: int = 0
    bounty: float = 0.0              # Current bounty value (for PKO)
    starting_bounty: float = 0.0     # Initial bounty (for PKO)
    table_id: Optional[str] = None   # Current table assignment
    seat: int = 0                    # Seat at current table
    position: int = 0                # Current tournament position
    eliminated_at: Optional[float] = None
    eliminated_by: Optional[int] = None  # telegram_id of eliminator
    total_bounty_won: float = 0.0    # Total bounty earned (for PKO)
    registered_at: float = field(default_factory=time.time)
    
    def is_eliminated(self) -> bool:
        return self.eliminated_at is not None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "telegramId": self.telegram_id,
            "username": self.username,
            "firstName": self.first_name,
            "chips": self.chips,
            "bounty": self.bounty,
            "tableId": self.table_id,
            "seat": self.seat,
            "position": self.position,
            "isEliminated": self.is_eliminated(),
            "eliminatedAt": int(self.eliminated_at * 1000) if self.eliminated_at else None,
            "totalBountyWon": self.total_bounty_won,
        }


@dataclass
class TournamentTable:
    """A poker table within a tournament"""
    table_id: str
    tournament_id: str
    seats: Dict[int, Optional[int]] = field(default_factory=dict)  # seat -> telegram_id
    max_seats: int = 9
    game_session_id: Optional[str] = None
    is_active: bool = True
    
    def __post_init__(self):
        if not self.seats:
            self.seats = {i: None for i in range(1, self.max_seats + 1)}
    
    def get_player_count(self) -> int:
        return sum(1 for p in self.seats.values() if p is not None)
    
    def get_empty_seats(self) -> List[int]:
        return [seat for seat, player in self.seats.items() if player is None]
    
    def add_player(self, telegram_id: int) -> Optional[int]:
        """Add player to table, returns seat number or None if full"""
        empty = self.get_empty_seats()
        if not empty:
            return None
        seat = random.choice(empty)
        self.seats[seat] = telegram_id
        return seat
    
    def remove_player(self, telegram_id: int) -> bool:
        """Remove player from table"""
        for seat, player_id in self.seats.items():
            if player_id == telegram_id:
                self.seats[seat] = None
                return True
        return False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tableId": self.table_id,
            "tournamentId": self.tournament_id,
            "seats": {str(k): v for k, v in self.seats.items()},
            "playerCount": self.get_player_count(),
            "maxSeats": self.max_seats,
            "gameSessionId": self.game_session_id,
            "isActive": self.is_active,
        }


@dataclass
class Tournament:
    """Tournament instance"""
    tournament_id: str
    name: str
    mode: TournamentMode
    buy_in: float                    # Entry fee in USD
    starting_chips: int              # Chips given to each player
    min_players: int
    max_players: int
    status: TournamentStatus = TournamentStatus.REGISTERING
    
    # Blind structure
    blind_structure: str = "standard"  # Key in BLIND_STRUCTURES
    current_level: int = 0
    level_started_at: float = 0.0
    
    # Prize structure
    prize_pool: float = 0.0
    rake_percent: float = 10.0       # Platform commission (%)
    
    # Bounty (for PKO mode)
    bounty_percent: float = 50.0     # % of buy-in that goes to bounty
    
    # SnG specific
    sng_format: SnGFormat = SnGFormat.TOP_3_PAID
    players_per_table: int = 9       # 6 or 9 for SnG
    
    # Timing
    created_at: float = field(default_factory=time.time)
    registration_ends_at: Optional[float] = None
    late_reg_levels: int = 3         # Late reg available for first N levels
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    
    # Players and tables
    players: Dict[int, TournamentPlayer] = field(default_factory=dict)
    tables: Dict[str, TournamentTable] = field(default_factory=dict)
    
    # Results
    payouts: Dict[int, float] = field(default_factory=dict)  # position -> payout
    final_positions: Dict[int, int] = field(default_factory=dict)  # telegram_id -> position
    
    def get_players_remaining(self) -> int:
        return sum(1 for p in self.players.values() if not p.is_eliminated())
    
    def get_average_stack(self) -> int:
        active = [p for p in self.players.values() if not p.is_eliminated()]
        if not active:
            return 0
        return sum(p.chips for p in active) // len(active)
    
    def get_total_chips(self) -> int:
        return sum(p.chips for p in self.players.values())
    
    def get_current_blinds(self) -> Dict[str, int]:
        structure = BLIND_STRUCTURES.get(self.blind_structure, BLIND_STRUCTURES["standard"])
        if self.current_level >= len(structure):
            return structure[-1]
        return structure[self.current_level]
    
    def get_time_to_next_level(self) -> int:
        """Returns seconds until next blind level"""
        if not self.level_started_at:
            return 0
        blinds = self.get_current_blinds()
        elapsed = time.time() - self.level_started_at
        return max(0, int(blinds["duration"] - elapsed))
    
    def calculate_prize_structure(self) -> Dict[int, float]:
        """Calculate payout for each position"""
        total_players = len(self.players)
        net_pool = self.prize_pool * (1 - self.rake_percent / 100)
        
        # For Bounty Hunter, only 50% goes to regular prizes
        if self.mode == TournamentMode.BOUNTY_HUNTER:
            net_pool = net_pool * (1 - self.bounty_percent / 100)
        
        # ITM = top 15% (at least 1)
        itm_count = max(1, total_players * 15 // 100)
        
        if total_players <= 6:
            # Small SnG
            if self.sng_format == SnGFormat.WINNER_TAKES_ALL:
                return {1: net_pool}
            elif self.sng_format == SnGFormat.TOP_2_PAID:
                return {1: net_pool * 0.65, 2: net_pool * 0.35}
            elif self.sng_format == SnGFormat.TOP_3_PAID:
                return {1: net_pool * 0.50, 2: net_pool * 0.30, 3: net_pool * 0.20}
            elif self.sng_format == SnGFormat.DOUBLE_OR_NOTHING:
                half = total_players // 2
                payout = net_pool / half
                return {i: payout for i in range(1, half + 1)}
        
        # Standard tournament payout structure
        payouts = {}
        if itm_count >= 15:
            payouts = {
                1: net_pool * 0.30,
                2: net_pool * 0.20,
                3: net_pool * 0.15,
            }
            for i in range(4, 7):
                payouts[i] = net_pool * 0.08
            for i in range(7, 10):
                payouts[i] = net_pool * 0.05
            remaining = net_pool * (1 - 0.30 - 0.20 - 0.15 - 0.08*3 - 0.05*3)
            for i in range(10, itm_count + 1):
                payouts[i] = remaining / (itm_count - 9)
        elif itm_count >= 9:
            payouts = {
                1: net_pool * 0.35,
                2: net_pool * 0.22,
                3: net_pool * 0.15,
            }
            for i in range(4, 7):
                payouts[i] = net_pool * 0.06
            for i in range(7, itm_count + 1):
                payouts[i] = net_pool * 0.04
        elif itm_count >= 3:
            payouts = {
                1: net_pool * 0.50,
                2: net_pool * 0.30,
                3: net_pool * 0.20,
            }
        else:
            payouts = {1: net_pool}
        
        self.payouts = payouts
        return payouts
    
    def to_dict(self, include_players: bool = True) -> Dict[str, Any]:
        blinds = self.get_current_blinds()
        
        result = {
            "tournamentId": self.tournament_id,
            "name": self.name,
            "mode": self.mode.value,
            "buyIn": self.buy_in,
            "startingChips": self.starting_chips,
            "minPlayers": self.min_players,
            "maxPlayers": self.max_players,
            "status": self.status.value,
            "blindStructure": self.blind_structure,
            "currentLevel": self.current_level,
            "currentBlinds": blinds,
            "timeToNextLevel": self.get_time_to_next_level(),
            "prizePool": self.prize_pool,
            "rakePercent": self.rake_percent,
            "bountyPercent": self.bounty_percent if self.mode == TournamentMode.BOUNTY_HUNTER else 0,
            "sngFormat": self.sng_format.value if self.mode == TournamentMode.SIT_AND_GO else None,
            "playersPerTable": self.players_per_table,
            "registeredCount": len(self.players),
            "playersRemaining": self.get_players_remaining(),
            "averageStack": self.get_average_stack(),
            "totalChips": self.get_total_chips(),
            "createdAt": int(self.created_at * 1000),
            "startedAt": int(self.started_at * 1000) if self.started_at else None,
            "finishedAt": int(self.finished_at * 1000) if self.finished_at else None,
            "lateRegLevels": self.late_reg_levels,
            "tablesCount": len(self.tables),
        }
        
        if include_players:
            # Sort by chips (descending) for leaderboard
            sorted_players = sorted(
                self.players.values(),
                key=lambda p: (not p.is_eliminated(), p.chips),
                reverse=True
            )
            result["players"] = [p.to_dict() for p in sorted_players]
            result["payouts"] = {str(k): v for k, v in self.payouts.items()}
        
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# TOURNAMENT MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class TournamentManager:
    """Manages all tournaments"""
    
    def __init__(self):
        self.tournaments: Dict[str, Tournament] = {}
        self.player_tournaments: Dict[int, List[str]] = {}  # telegram_id -> tournament_ids
        self._blind_tasks: Dict[str, asyncio.Task] = {}
        self._callbacks: Dict[str, List[Callable]] = {}
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TOURNAMENT CREATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def create_tournament(
        self,
        name: str,
        mode: TournamentMode,
        buy_in: float,
        starting_chips: int = 10000,
        min_players: int = 18,
        max_players: int = 180,
        blind_structure: str = "standard",
        late_reg_levels: int = 3,
        **kwargs
    ) -> Tournament:
        """Create a new tournament"""
        tournament_id = f"t_{mode.value}_{int(time.time())}_{random.randint(1000, 9999)}"
        
        tournament = Tournament(
            tournament_id=tournament_id,
            name=name,
            mode=mode,
            buy_in=buy_in,
            starting_chips=starting_chips,
            min_players=min_players,
            max_players=max_players,
            blind_structure=blind_structure,
            late_reg_levels=late_reg_levels,
            **kwargs
        )
        
        # For Bounty Hunter, set bounty values
        if mode == TournamentMode.BOUNTY_HUNTER:
            tournament.bounty_percent = kwargs.get("bounty_percent", 50.0)
        
        # For Sit & Go, set format
        if mode == TournamentMode.SIT_AND_GO:
            tournament.sng_format = kwargs.get("sng_format", SnGFormat.TOP_3_PAID)
            tournament.players_per_table = kwargs.get("players_per_table", 9)
            tournament.min_players = tournament.players_per_table
            tournament.max_players = tournament.players_per_table
            tournament.blind_structure = kwargs.get("blind_structure", "turbo")
        
        self.tournaments[tournament_id] = tournament
        print(f"🏆 TOURNAMENT: Created {mode.value} tournament '{name}' (ID: {tournament_id})")
        
        return tournament
    
    def create_sit_and_go(
        self,
        buy_in: float,
        players_per_table: int = 9,
        sng_format: SnGFormat = SnGFormat.TOP_3_PAID,
        blind_structure: str = "turbo",
        starting_chips: int = 1500
    ) -> Tournament:
        """Quick create a Sit & Go table"""
        name = f"Sit & Go ${buy_in} ({players_per_table}-max)"
        
        return self.create_tournament(
            name=name,
            mode=TournamentMode.SIT_AND_GO,
            buy_in=buy_in,
            starting_chips=starting_chips,
            min_players=players_per_table,
            max_players=players_per_table,
            blind_structure=blind_structure,
            sng_format=sng_format,
            players_per_table=players_per_table,
            late_reg_levels=0,  # No late reg in SnG
        )
    
    def create_bounty_tournament(
        self,
        name: str,
        buy_in: float,
        bounty_percent: float = 50.0,
        starting_chips: int = 10000,
        min_players: int = 18,
        max_players: int = 100,
        blind_structure: str = "standard"
    ) -> Tournament:
        """Create a Bounty Hunter (PKO) tournament"""
        return self.create_tournament(
            name=name,
            mode=TournamentMode.BOUNTY_HUNTER,
            buy_in=buy_in,
            starting_chips=starting_chips,
            min_players=min_players,
            max_players=max_players,
            blind_structure=blind_structure,
            bounty_percent=bounty_percent,
            late_reg_levels=4,  # Slightly more late reg for bounty
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PLAYER REGISTRATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def register_player(
        self,
        tournament_id: str,
        telegram_id: int,
        username: Optional[str],
        first_name: str
    ) -> Tuple[bool, str, Optional[Tournament]]:
        """Register a player for a tournament"""
        tournament = self.tournaments.get(tournament_id)
        
        if not tournament:
            return False, "Tournament not found", None
        
        # Check if registration is open
        if tournament.status not in [TournamentStatus.REGISTERING, TournamentStatus.LATE_REG]:
            return False, "Registration is closed", None
        
        if len(tournament.players) >= tournament.max_players:
            return False, "Tournament is full", None
        
        if telegram_id in tournament.players:
            return True, "Already registered", tournament
        
        # Calculate starting bounty for PKO
        starting_bounty = 0.0
        if tournament.mode == TournamentMode.BOUNTY_HUNTER:
            starting_bounty = tournament.buy_in * (tournament.bounty_percent / 100)
        
        # Create player
        player = TournamentPlayer(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            chips=tournament.starting_chips,
            bounty=starting_bounty,
            starting_bounty=starting_bounty,
        )
        
        tournament.players[telegram_id] = player
        tournament.prize_pool += tournament.buy_in
        
        # Track player's tournaments
        if telegram_id not in self.player_tournaments:
            self.player_tournaments[telegram_id] = []
        self.player_tournaments[telegram_id].append(tournament_id)
        
        print(f"🏆 TOURNAMENT: Player {telegram_id} registered for {tournament.name}")
        
        # Check if SnG should auto-start
        if tournament.mode == TournamentMode.SIT_AND_GO:
            if len(tournament.players) >= tournament.max_players:
                await self.start_tournament(tournament_id)
        
        return True, "Registered successfully", tournament
    
    async def unregister_player(
        self,
        tournament_id: str,
        telegram_id: int
    ) -> Tuple[bool, str]:
        """Unregister a player from a tournament (only during registration)"""
        tournament = self.tournaments.get(tournament_id)
        
        if not tournament:
            return False, "Tournament not found"
        
        if tournament.status not in [TournamentStatus.REGISTERING]:
            return False, "Cannot unregister after tournament started"
        
        if telegram_id not in tournament.players:
            return False, "Not registered"
        
        del tournament.players[telegram_id]
        tournament.prize_pool -= tournament.buy_in
        
        if telegram_id in self.player_tournaments:
            self.player_tournaments[telegram_id].remove(tournament_id)
        
        print(f"🏆 TOURNAMENT: Player {telegram_id} unregistered from {tournament.name}")
        return True, "Unregistered successfully"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TOURNAMENT LIFECYCLE
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def start_tournament(self, tournament_id: str) -> Tuple[bool, str]:
        """Start a tournament"""
        tournament = self.tournaments.get(tournament_id)
        
        if not tournament:
            return False, "Tournament not found"
        
        if tournament.status != TournamentStatus.REGISTERING:
            return False, "Tournament already started"
        
        if len(tournament.players) < tournament.min_players:
            return False, f"Need at least {tournament.min_players} players"
        
        tournament.status = TournamentStatus.RUNNING
        tournament.started_at = time.time()
        tournament.level_started_at = time.time()
        tournament.current_level = 0
        
        # Calculate prize structure
        tournament.calculate_prize_structure()
        
        # Create tables and seat players
        await self._seat_players(tournament)
        
        # Start blind timer
        await self._start_blind_timer(tournament_id)
        
        print(f"🏆 TOURNAMENT: Started {tournament.name} with {len(tournament.players)} players")
        return True, "Tournament started"
    
    async def _seat_players(self, tournament: Tournament):
        """Distribute players to tables"""
        players = list(tournament.players.values())
        random.shuffle(players)
        
        seats_per_table = tournament.players_per_table
        num_tables = (len(players) + seats_per_table - 1) // seats_per_table
        
        for i in range(num_tables):
            table_id = f"{tournament.tournament_id}_table_{i + 1}"
            table = TournamentTable(
                table_id=table_id,
                tournament_id=tournament.tournament_id,
                max_seats=seats_per_table,
            )
            tournament.tables[table_id] = table
        
        # Distribute players evenly
        table_list = list(tournament.tables.values())
        for i, player in enumerate(players):
            table = table_list[i % len(table_list)]
            seat = table.add_player(player.telegram_id)
            player.table_id = table.table_id
            player.seat = seat
        
        print(f"🏆 TOURNAMENT: Seated {len(players)} players across {len(table_list)} tables")
    
    async def _start_blind_timer(self, tournament_id: str):
        """Start the blind level timer"""
        async def blind_timer():
            while True:
                tournament = self.tournaments.get(tournament_id)
                if not tournament or tournament.status in [TournamentStatus.FINISHED, TournamentStatus.CANCELLED]:
                    break
                
                blinds = tournament.get_current_blinds()
                await asyncio.sleep(blinds["duration"])
                
                # Increase blind level
                tournament.current_level += 1
                tournament.level_started_at = time.time()
                
                # Check if late reg should end
                if tournament.current_level > tournament.late_reg_levels:
                    if tournament.status == TournamentStatus.LATE_REG:
                        tournament.status = TournamentStatus.RUNNING
                
                new_blinds = tournament.get_current_blinds()
                print(f"🏆 TOURNAMENT: Level {tournament.current_level} - Blinds {new_blinds['sb']}/{new_blinds['bb']} (Ante: {new_blinds['ante']})")
                
                # Notify via callback
                await self._notify("blind_increase", tournament_id, new_blinds)
        
        task = asyncio.create_task(blind_timer())
        self._blind_tasks[tournament_id] = task
    
    async def eliminate_player(
        self,
        tournament_id: str,
        eliminated_id: int,
        eliminator_id: int
    ) -> Tuple[bool, str, Optional[Dict]]:
        """Handle player elimination"""
        tournament = self.tournaments.get(tournament_id)
        
        if not tournament:
            return False, "Tournament not found", None
        
        eliminated = tournament.players.get(eliminated_id)
        eliminator = tournament.players.get(eliminator_id)
        
        if not eliminated or not eliminator:
            return False, "Player not found", None
        
        if eliminated.is_eliminated():
            return False, "Player already eliminated", None
        
        # Record elimination
        remaining = tournament.get_players_remaining()
        eliminated.eliminated_at = time.time()
        eliminated.eliminated_by = eliminator_id
        eliminated.position = remaining
        tournament.final_positions[eliminated_id] = remaining
        
        # Handle bounty for PKO mode
        bounty_result = None
        if tournament.mode == TournamentMode.BOUNTY_HUNTER and eliminated.bounty > 0:
            # 50% cash, 50% added to eliminator's bounty
            cash_bounty = eliminated.bounty / 2
            added_bounty = eliminated.bounty / 2
            
            eliminator.total_bounty_won += cash_bounty
            eliminator.bounty += added_bounty
            
            bounty_result = {
                "cashBounty": cash_bounty,
                "addedBounty": added_bounty,
                "newBounty": eliminator.bounty,
                "eliminatedPlayer": eliminated.first_name,
                "eliminatorPlayer": eliminator.first_name,
            }
            
            print(f"🏆 BOUNTY: {eliminator.first_name} won ${cash_bounty} bounty, new bounty: ${eliminator.bounty}")
        
        # Remove from table
        table = tournament.tables.get(eliminated.table_id)
        if table:
            table.remove_player(eliminated_id)
        
        eliminated.table_id = None
        eliminated.seat = 0
        
        # Check if payout earned
        payout = tournament.payouts.get(remaining, 0)
        if payout > 0:
            print(f"🏆 TOURNAMENT: {eliminated.first_name} finished #{remaining}, wins ${payout}")
        
        # Check for tournament end
        remaining_now = tournament.get_players_remaining()
        if remaining_now == 1:
            await self.finish_tournament(tournament_id)
        elif remaining_now <= tournament.players_per_table:
            # Final table
            tournament.status = TournamentStatus.FINAL_TABLE
            await self._balance_tables(tournament)
        else:
            # Balance tables if needed
            await self._balance_tables(tournament)
        
        print(f"🏆 TOURNAMENT: {eliminated.first_name} eliminated by {eliminator.first_name}, position #{remaining}")
        
        return True, "Player eliminated", bounty_result
    
    async def _balance_tables(self, tournament: Tournament):
        """Balance players across tables"""
        active_tables = [t for t in tournament.tables.values() if t.is_active]
        
        if len(active_tables) <= 1:
            return
        
        # Calculate target players per table
        total_players = tournament.get_players_remaining()
        target_per_table = total_players // len(active_tables)
        
        # Close tables with too few players
        for table in active_tables:
            if table.get_player_count() < 3 and len(active_tables) > 1:
                # Move all players to other tables
                for seat, player_id in list(table.seats.items()):
                    if player_id:
                        await self._move_player_to_table(tournament, player_id)
                table.is_active = False
                active_tables.remove(table)
        
        # Balance remaining tables
        for table in active_tables:
            while table.get_player_count() > target_per_table + 1:
                # Find player to move
                for seat, player_id in table.seats.items():
                    if player_id:
                        await self._move_player_to_table(tournament, player_id)
                        break
    
    async def _move_player_to_table(self, tournament: Tournament, telegram_id: int):
        """Move a player to a table with fewest players"""
        player = tournament.players.get(telegram_id)
        if not player:
            return
        
        # Remove from current table
        old_table = tournament.tables.get(player.table_id)
        if old_table:
            old_table.remove_player(telegram_id)
        
        # Find table with fewest players
        active_tables = [t for t in tournament.tables.values() if t.is_active and t.table_id != player.table_id]
        if not active_tables:
            return
        
        target_table = min(active_tables, key=lambda t: t.get_player_count())
        seat = target_table.add_player(telegram_id)
        
        if seat:
            player.table_id = target_table.table_id
            player.seat = seat
            print(f"🏆 TOURNAMENT: Moved {player.first_name} to table {target_table.table_id}")
    
    async def finish_tournament(self, tournament_id: str) -> Tuple[bool, str]:
        """Finish a tournament"""
        tournament = self.tournaments.get(tournament_id)
        
        if not tournament:
            return False, "Tournament not found"
        
        tournament.status = TournamentStatus.FINISHED
        tournament.finished_at = time.time()
        
        # Find winner
        winner = None
        for player in tournament.players.values():
            if not player.is_eliminated():
                winner = player
                player.position = 1
                tournament.final_positions[player.telegram_id] = 1
                break
        
        # Stop blind timer
        task = self._blind_tasks.get(tournament_id)
        if task:
            task.cancel()
            del self._blind_tasks[tournament_id]
        
        print(f"🏆 TOURNAMENT: {tournament.name} finished! Winner: {winner.first_name if winner else 'N/A'}")
        
        await self._notify("tournament_finished", tournament_id, {
            "winner": winner.to_dict() if winner else None,
            "payouts": tournament.payouts,
        })
        
        return True, "Tournament finished"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # QUERIES
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_tournament(self, tournament_id: str) -> Optional[Tournament]:
        return self.tournaments.get(tournament_id)
    
    def get_active_tournaments(self, mode: Optional[TournamentMode] = None) -> List[Tournament]:
        """Get all active tournaments, optionally filtered by mode"""
        tournaments = [
            t for t in self.tournaments.values()
            if t.status not in [TournamentStatus.FINISHED, TournamentStatus.CANCELLED]
        ]
        
        if mode:
            tournaments = [t for t in tournaments if t.mode == mode]
        
        return sorted(tournaments, key=lambda t: t.created_at, reverse=True)
    
    def get_registering_tournaments(self, mode: Optional[TournamentMode] = None) -> List[Tournament]:
        """Get tournaments open for registration"""
        tournaments = [
            t for t in self.tournaments.values()
            if t.status in [TournamentStatus.REGISTERING, TournamentStatus.LATE_REG]
        ]
        
        if mode:
            tournaments = [t for t in tournaments if t.mode == mode]
        
        return sorted(tournaments, key=lambda t: t.created_at, reverse=True)
    
    def get_player_tournaments(self, telegram_id: int) -> List[Tournament]:
        """Get all tournaments a player is registered in"""
        tournament_ids = self.player_tournaments.get(telegram_id, [])
        return [self.tournaments[tid] for tid in tournament_ids if tid in self.tournaments]
    
    def get_leaderboard(self, tournament_id: str, limit: int = 10) -> List[Dict]:
        """Get tournament leaderboard (top players by chips)"""
        tournament = self.tournaments.get(tournament_id)
        if not tournament:
            return []
        
        active_players = [p for p in tournament.players.values() if not p.is_eliminated()]
        sorted_players = sorted(active_players, key=lambda p: p.chips, reverse=True)
        
        return [
            {
                "position": i + 1,
                "player": p.to_dict(),
            }
            for i, p in enumerate(sorted_players[:limit])
        ]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CALLBACKS / EVENTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def on_event(self, event_type: str, callback: Callable):
        """Register callback for tournament events"""
        if event_type not in self._callbacks:
            self._callbacks[event_type] = []
        self._callbacks[event_type].append(callback)
    
    async def _notify(self, event_type: str, tournament_id: str, data: Any):
        """Notify all registered callbacks"""
        callbacks = self._callbacks.get(event_type, [])
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(tournament_id, data)
                else:
                    callback(tournament_id, data)
            except Exception as e:
                print(f"❌ Callback error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL INSTANCE
# ═══════════════════════════════════════════════════════════════════════════════

tournament_manager = TournamentManager()


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS FOR INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def create_default_tournaments():
    """Create some default tournaments for testing"""
    # Sit & Go tables
    for buy_in in [5, 10, 25]:
        tournament_manager.create_sit_and_go(
            buy_in=buy_in,
            players_per_table=6,
            sng_format=SnGFormat.TOP_2_PAID,
            blind_structure="turbo",
        )
        tournament_manager.create_sit_and_go(
            buy_in=buy_in,
            players_per_table=9,
            sng_format=SnGFormat.TOP_3_PAID,
            blind_structure="turbo",
        )
    
    # Tournament
    tournament_manager.create_tournament(
        name="Daily $10 Tournament",
        mode=TournamentMode.TOURNAMENT,
        buy_in=10,
        starting_chips=10000,
        min_players=18,
        max_players=100,
    )
    
    # Bounty Hunter
    tournament_manager.create_bounty_tournament(
        name="$20 Bounty Hunter",
        buy_in=20,
        bounty_percent=50,
        min_players=18,
        max_players=50,
    )
    
    print("🏆 Created default tournaments")
