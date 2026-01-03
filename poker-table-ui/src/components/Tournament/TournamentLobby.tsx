import React, { useState, useEffect, useCallback } from 'react';
import styles from './tournament.module.css';

// Types
interface Tournament {
  tournamentId: string;
  name: string;
  mode: 'tournament' | 'bounty' | 'sitgo';
  buyIn: number;
  startingChips: number;
  minPlayers: number;
  maxPlayers: number;
  status: string;
  blindStructure: string;
  currentLevel: number;
  currentBlinds: {
    sb: number;
    bb: number;
    ante: number;
    duration: number;
  };
  timeToNextLevel: number;
  prizePool: number;
  rakePercent: number;
  bountyPercent: number;
  sngFormat: string | null;
  playersPerTable: number;
  registeredCount: number;
  playersRemaining: number;
  averageStack: number;
  totalChips: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lateRegLevels: number;
  tablesCount: number;
  players?: TournamentPlayer[];
  payouts?: Record<string, number>;
}

interface TournamentPlayer {
  telegramId: number;
  username: string | null;
  firstName: string;
  chips: number;
  bounty: number;
  tableId: string | null;
  seat: number;
  position: number;
  isEliminated: boolean;
  eliminatedAt: number | null;
  totalBountyWon: number;
}

interface TournamentLobbyProps {
  mode: 'tournament' | 'bounty' | 'sitgo';
  telegramId: number;
  username?: string;
  firstName: string;
  onBack: () => void;
  onJoinTable: (tournamentId: string, tableId: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://poker-backend-g2p6.onrender.com';

const getModeTitle = (mode: string): string => {
  switch (mode) {
    case 'tournament': return '🏆 Tournament';
    case 'bounty': return '🎯 Bounty Hunter';
    case 'sitgo': return '⚡ Sit & Go';
    default: return 'Lobby';
  }
};

const getModeDescription = (mode: string): string => {
  switch (mode) {
    case 'tournament': 
      return 'Multi-table tournaments with prize pools. Compete against many players for big prizes!';
    case 'bounty': 
      return 'Progressive Knockout - Win bounties for eliminating players! 50% cash, 50% added to your bounty.';
    case 'sitgo': 
      return 'Fast single-table tournaments. Start as soon as the table fills up!';
    default: 
      return '';
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatMoney = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const TournamentLobby: React.FC<TournamentLobbyProps> = ({
  mode,
  telegramId,
  username,
  firstName,
  onBack,
  onJoinTable,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'registering' | 'running'>('all');

  // Fetch tournaments
  const fetchTournaments = useCallback(async () => {
    try {
      const statusParam = filter === 'registering' ? '&status=registering' : '';
      const response = await fetch(`${API_BASE}/api/tournaments?mode=${mode}${statusParam}`);
      const data = await response.json();
      
      if (data.success) {
        setTournaments(data.tournaments);
      }
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, [mode, filter]);

  // Fetch tournament details
  const fetchTournamentDetails = useCallback(async (tournamentId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/tournaments/${tournamentId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedTournament(data.tournament);
      }
    } catch (err) {
      console.error('Failed to fetch tournament details:', err);
    }
  }, []);

  // Register for tournament
  const handleRegister = async (tournamentId: string) => {
    setRegistering(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          telegram_id: telegramId,
          username: username,
          first_name: firstName,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh tournament list
        await fetchTournaments();
        if (selectedTournament?.tournamentId === tournamentId) {
          await fetchTournamentDetails(tournamentId);
        }
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  // Unregister from tournament
  const handleUnregister = async (tournamentId: string) => {
    setRegistering(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/unregister?telegram_id=${telegramId}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchTournaments();
        if (selectedTournament?.tournamentId === tournamentId) {
          await fetchTournamentDetails(tournamentId);
        }
      } else {
        setError(data.detail || 'Unregistration failed');
      }
    } catch (err) {
      console.error('Unregistration error:', err);
      setError('Failed to unregister');
    } finally {
      setRegistering(false);
    }
  };

  // Check if player is registered
  const isRegistered = (tournament: Tournament): boolean => {
    return tournament.players?.some(p => p.telegramId === telegramId) || false;
  };

  // Initial fetch
  useEffect(() => {
    fetchTournaments();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchTournaments, 10000);
    return () => clearInterval(interval);
  }, [fetchTournaments]);

  // Render tournament card
  const renderTournamentCard = (tournament: Tournament) => {
    const registered = isRegistered(tournament);
    const canRegister = tournament.status === 'registering' || tournament.status === 'late_reg';
    const isFull = tournament.registeredCount >= tournament.maxPlayers;
    
    return (
      <div 
        key={tournament.tournamentId} 
        className={`${styles.tournamentCard} ${registered ? styles.registered : ''}`}
        onClick={() => fetchTournamentDetails(tournament.tournamentId)}
      >
        <div className={styles.cardHeader}>
          <span className={styles.tournamentName}>{tournament.name}</span>
          <span className={`${styles.status} ${styles[tournament.status]}`}>
            {tournament.status === 'registering' ? '🟢 Open' : 
             tournament.status === 'late_reg' ? '🟡 Late Reg' :
             tournament.status === 'running' ? '🔴 Running' :
             tournament.status === 'final_table' ? '🏆 Final Table' :
             tournament.status}
          </span>
        </div>
        
        <div className={styles.cardBody}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Buy-in:</span>
            <span className={styles.value}>{formatMoney(tournament.buyIn)}</span>
          </div>
          
          <div className={styles.infoRow}>
            <span className={styles.label}>Prize Pool:</span>
            <span className={styles.value}>{formatMoney(tournament.prizePool)}</span>
          </div>
          
          <div className={styles.infoRow}>
            <span className={styles.label}>Players:</span>
            <span className={styles.value}>
              {tournament.registeredCount} / {tournament.maxPlayers}
            </span>
          </div>
          
          {mode === 'bounty' && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Starting Bounty:</span>
              <span className={styles.bountyValue}>
                🎯 {formatMoney(tournament.buyIn * (tournament.bountyPercent / 100))}
              </span>
            </div>
          )}
          
          {mode === 'sitgo' && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Format:</span>
              <span className={styles.value}>
                {tournament.playersPerTable}-max {tournament.sngFormat?.replace('_', ' ')}
              </span>
            </div>
          )}
          
          {tournament.status === 'running' && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Level:</span>
              <span className={styles.value}>
                {tournament.currentLevel + 1} ({tournament.currentBlinds.sb}/{tournament.currentBlinds.bb})
              </span>
            </div>
          )}
        </div>
        
        <div className={styles.cardFooter}>
          {canRegister && !registered && !isFull && (
            <button 
              className={styles.registerBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleRegister(tournament.tournamentId);
              }}
              disabled={registering}
            >
              {registering ? 'Registering...' : `Register ${formatMoney(tournament.buyIn)}`}
            </button>
          )}
          
          {canRegister && registered && (
            <button 
              className={styles.unregisterBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleUnregister(tournament.tournamentId);
              }}
              disabled={registering}
            >
              ✓ Registered (Click to unregister)
            </button>
          )}
          
          {isFull && !registered && (
            <button className={styles.fullBtn} disabled>
              Table Full
            </button>
          )}
          
          {tournament.status === 'running' && registered && (
            <button 
              className={styles.playBtn}
              onClick={(e) => {
                e.stopPropagation();
                const player = tournament.players?.find(p => p.telegramId === telegramId);
                if (player?.tableId) {
                  onJoinTable(tournament.tournamentId, player.tableId);
                }
              }}
            >
              🎮 Go to Table
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render tournament details modal
  const renderDetailsModal = () => {
    if (!selectedTournament) return null;
    
    const t = selectedTournament;
    const registered = isRegistered(t);
    
    return (
      <div className={styles.modalOverlay} onClick={() => setSelectedTournament(null)}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button className={styles.modalClose} onClick={() => setSelectedTournament(null)}>×</button>
          
          <h2 className={styles.modalTitle}>{t.name}</h2>
          
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Status</span>
              <span className={`${styles.detailValue} ${styles[t.status]}`}>{t.status}</span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Buy-in</span>
              <span className={styles.detailValue}>{formatMoney(t.buyIn)}</span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Prize Pool</span>
              <span className={styles.detailValue}>{formatMoney(t.prizePool)}</span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Players</span>
              <span className={styles.detailValue}>{t.registeredCount} / {t.maxPlayers}</span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Starting Stack</span>
              <span className={styles.detailValue}>{t.startingChips.toLocaleString()}</span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Blinds</span>
              <span className={styles.detailValue}>
                {t.currentBlinds.sb}/{t.currentBlinds.bb}
                {t.currentBlinds.ante > 0 && ` (Ante: ${t.currentBlinds.ante})`}
              </span>
            </div>
            
            {t.status === 'running' && (
              <>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Level</span>
                  <span className={styles.detailValue}>{t.currentLevel + 1}</span>
                </div>
                
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Next Level</span>
                  <span className={styles.detailValue}>{formatTime(t.timeToNextLevel)}</span>
                </div>
                
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Avg Stack</span>
                  <span className={styles.detailValue}>{t.averageStack.toLocaleString()}</span>
                </div>
                
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Remaining</span>
                  <span className={styles.detailValue}>{t.playersRemaining}</span>
                </div>
              </>
            )}
            
            {mode === 'bounty' && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Bounty</span>
                <span className={styles.bountyValue}>
                  🎯 {formatMoney(t.buyIn * (t.bountyPercent / 100))}
                </span>
              </div>
            )}
          </div>
          
          {/* Prize Structure */}
          {t.payouts && Object.keys(t.payouts).length > 0 && (
            <div className={styles.prizeSection}>
              <h3>Prize Structure</h3>
              <div className={styles.prizeList}>
                {Object.entries(t.payouts)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([position, amount]) => (
                    <div key={position} className={styles.prizeItem}>
                      <span className={styles.prizePosition}>#{position}</span>
                      <span className={styles.prizeAmount}>{formatMoney(amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* Players / Leaderboard */}
          {t.players && t.players.length > 0 && (
            <div className={styles.playersSection}>
              <h3>{t.status === 'running' ? 'Leaderboard' : 'Registered Players'}</h3>
              <div className={styles.playersList}>
                {t.players
                  .filter(p => !p.isEliminated)
                  .sort((a, b) => b.chips - a.chips)
                  .slice(0, 10)
                  .map((player, idx) => (
                    <div key={player.telegramId} className={`${styles.playerItem} ${player.telegramId === telegramId ? styles.you : ''}`}>
                      <span className={styles.playerRank}>#{idx + 1}</span>
                      <span className={styles.playerName}>
                        {player.firstName}
                        {player.telegramId === telegramId && ' (You)'}
                      </span>
                      {t.status === 'running' && (
                        <span className={styles.playerChips}>{player.chips.toLocaleString()}</span>
                      )}
                      {mode === 'bounty' && (
                        <span className={styles.playerBounty}>🎯 {formatMoney(player.bounty)}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className={styles.modalActions}>
            {(t.status === 'registering' || t.status === 'late_reg') && !registered && (
              <button 
                className={styles.registerBtnLarge}
                onClick={() => handleRegister(t.tournamentId)}
                disabled={registering}
              >
                Register for {formatMoney(t.buyIn)}
              </button>
            )}
            
            {(t.status === 'registering') && registered && (
              <button 
                className={styles.unregisterBtnLarge}
                onClick={() => handleUnregister(t.tournamentId)}
                disabled={registering}
              >
                Unregister
              </button>
            )}
            
            {t.status === 'running' && registered && (
              <button 
                className={styles.playBtnLarge}
                onClick={() => {
                  const player = t.players?.find(p => p.telegramId === telegramId);
                  if (player?.tableId) {
                    onJoinTable(t.tournamentId, player.tableId);
                  }
                }}
              >
                🎮 Go to Table
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.lobbyContainer}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h1 className={styles.title}>{getModeTitle(mode)}</h1>
      </div>
      
      {/* Description */}
      <p className={styles.description}>{getModeDescription(mode)}</p>
      
      {/* Filters */}
      <div className={styles.filters}>
        <button 
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={`${styles.filterBtn} ${filter === 'registering' ? styles.active : ''}`}
          onClick={() => setFilter('registering')}
        >
          Open
        </button>
        <button 
          className={`${styles.filterBtn} ${filter === 'running' ? styles.active : ''}`}
          onClick={() => setFilter('running')}
        >
          Running
        </button>
      </div>
      
      {/* Error */}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          Loading tournaments...
        </div>
      )}
      
      {/* Tournament list */}
      {!loading && tournaments.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎰</span>
          <p>No tournaments available</p>
          <p className={styles.emptyHint}>Check back later or try another filter</p>
        </div>
      )}
      
      {!loading && tournaments.length > 0 && (
        <div className={styles.tournamentGrid}>
          {tournaments.map(renderTournamentCard)}
        </div>
      )}
      
      {/* Details Modal */}
      {renderDetailsModal()}
    </div>
  );
};

export default TournamentLobby;
