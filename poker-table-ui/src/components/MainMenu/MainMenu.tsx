import { useState, useEffect, useCallback } from 'react';
import styles from './MainMenu.module.css';

type GameMode = 'tournament' | 'bounty' | 'sitgo';

interface TableInfo {
  id: string;
  name: string;
  icon: string;
  buyIn: number;
  players: number;
  maxPlayers: number;
  blinds: string;
  status: 'waiting' | 'running' | 'full';
}

interface UserProfile {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  balance: number;
}

// Mock tables data
const MOCK_TABLES: Record<GameMode, TableInfo[]> = {
  tournament: [
    { id: 't1', name: 'Diamond Championship', icon: '💎', buyIn: 500, players: 4, maxPlayers: 9, blinds: '25/50', status: 'waiting' },
    { id: 't2', name: 'Gold Rush', icon: '🏆', buyIn: 200, players: 7, maxPlayers: 9, blinds: '10/20', status: 'running' },
    { id: 't3', name: 'Silver League', icon: '🥈', buyIn: 100, players: 9, maxPlayers: 9, blinds: '5/10', status: 'full' },
    { id: 't4', name: 'Bronze Battle', icon: '🥉', buyIn: 50, players: 2, maxPlayers: 6, blinds: '2/5', status: 'waiting' },
  ],
  bounty: [
    { id: 'b1', name: 'Head Hunter Elite', icon: '🎯', buyIn: 300, players: 3, maxPlayers: 6, blinds: '15/30', status: 'waiting' },
    { id: 'b2', name: 'Bounty Blitz', icon: '💀', buyIn: 150, players: 5, maxPlayers: 8, blinds: '10/20', status: 'running' },
    { id: 'b3', name: 'Knockout Kings', icon: '👑', buyIn: 75, players: 1, maxPlayers: 6, blinds: '5/10', status: 'waiting' },
  ],
  sitgo: [
    { id: 's1', name: 'High Stakes Express', icon: '🔥', buyIn: 1000, players: 2, maxPlayers: 3, blinds: '50/100', status: 'waiting' },
    { id: 's2', name: 'Quick Fire 6-Max', icon: '⚡', buyIn: 100, players: 4, maxPlayers: 6, blinds: '10/20', status: 'running' },
    { id: 's3', name: 'Turbo Heads-Up', icon: '🚀', buyIn: 50, players: 1, maxPlayers: 2, blinds: '5/10', status: 'waiting' },
    { id: 's4', name: 'Standard 9-Max', icon: '🎰', buyIn: 25, players: 6, maxPlayers: 9, blinds: '2/5', status: 'running' },
  ],
};

const MODE_INFO: Record<GameMode, { title: string; icon: string; description: string }> = {
  tournament: { title: 'Tournament', icon: '🏆', description: 'Multi-table tournaments with prize pools' },
  bounty: { title: 'Bounty Hunter', icon: '🎯', description: 'Knock out players to win bounties' },
  sitgo: { title: 'Sit & Go', icon: '⚡', description: 'Quick single-table tournaments' },
};

interface MainMenuProps {
  onJoinTable: (tableId: string) => void;
  onCreatePrivate: () => void;
  onGameModes?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onJoinTable, onCreatePrivate, onGameModes }) => {
  const [activeMode, setActiveMode] = useState<GameMode>('tournament');
  const [tables, setTables] = useState<TableInfo[]>(MOCK_TABLES.tournament);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(false);
  const [user, setUser] = useState<UserProfile>({
    id: 0,
    firstName: 'Player',
    balance: 1000,
  });

  // Get Telegram user info
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    
    if (tgUser) {
      setUser({
        id: tgUser.id,
        firstName: tgUser.first_name || 'Player',
        lastName: tgUser.last_name,
        username: tgUser.username,
        photoUrl: tgUser.photo_url,
        balance: 1000, // TODO: fetch from server
      });
    }
  }, []);

  // Change game mode
  const handleModeChange = useCallback((mode: GameMode) => {
    setActiveMode(mode);
    setTables(MOCK_TABLES[mode]);
  }, []);

  // Join table
  const handleJoinTable = useCallback((tableId: string) => {
    console.log('🎮 Joining table:', tableId);
    onJoinTable(tableId);
  }, [onJoinTable]);

  const getStatusBadge = (status: TableInfo['status']) => {
    switch (status) {
      case 'waiting': return <span className={styles.statusWaiting}>Waiting</span>;
      case 'running': return <span className={styles.statusRunning}>Running</span>;
      case 'full': return <span className={styles.statusFull}>Full</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Game Mode Tabs */}
        <div className={styles.modeTabs}>
          {(Object.keys(MODE_INFO) as GameMode[]).map((mode) => (
            <button
              key={mode}
              className={`${styles.modeTab} ${activeMode === mode ? styles.modeTabActive : ''}`}
              onClick={() => handleModeChange(mode)}
            >
              <span className={styles.modeIcon}>{MODE_INFO[mode].icon}</span>
              <span className={styles.modeTitle}>{MODE_INFO[mode].title}</span>
            </button>
          ))}
        </div>

        {/* Mode Description */}
        <div className={styles.modeDescription}>
          {MODE_INFO[activeMode].description}
        </div>

        {/* Tables List */}
        <div className={styles.tablesList}>
          <h3 className={styles.tablesTitle}>Available Tables</h3>
          
          {tables.map((table) => (
            <div key={table.id} className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <span className={styles.tableIcon}>{table.icon}</span>
                <span className={styles.tableName}>{table.name}</span>
                {getStatusBadge(table.status)}
              </div>
              
              <div className={styles.tableInfo}>
                <div className={styles.tableDetail}>
                  <span className={styles.detailLabel}>Buy-in</span>
                  <span className={styles.detailValue}>${table.buyIn}</span>
                </div>
                <div className={styles.tableDetail}>
                  <span className={styles.detailLabel}>Players</span>
                  <span className={styles.detailValue}>{table.players}/{table.maxPlayers}</span>
                </div>
                <div className={styles.tableDetail}>
                  <span className={styles.detailLabel}>Blinds</span>
                  <span className={styles.detailValue}>{table.blinds}</span>
                </div>
              </div>
              
              <button
                className={`${styles.joinButton} ${table.status === 'full' ? styles.joinButtonDisabled : ''}`}
                onClick={() => handleJoinTable(table.id)}
                disabled={table.status === 'full'}
              >
                {table.status === 'full' ? 'Table Full' : 'Join Table'}
              </button>
            </div>
          ))}
        </div>

        {/* Game Mode Buttons */}
        <div className={styles.gameModesSection}>
          <button className={styles.gameModesButton} onClick={onGameModes}>
            🎮 Play Tournaments
          </button>
          <button className={styles.privateGameButton} onClick={onCreatePrivate}>
            🔐 Private Game
          </button>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className={styles.sidebar}>
        {/* Profile Section */}
        <div className={styles.profileSection}>
          <div className={styles.avatar}>
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="Avatar" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarInitial}>
                {user.firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className={styles.userName}>
            {user.firstName} {user.lastName || ''}
          </div>
          {user.username && (
            <div className={styles.userHandle}>@{user.username}</div>
          )}
        </div>

        {/* Balance Section - Clickable */}
        <div 
          className={styles.balanceSection}
          onClick={() => setBalanceSheetOpen(true)}
        >
          <div className={styles.balanceLabel}>Balance</div>
          <div className={styles.balanceAmount}>
            <span className={styles.balanceIcon}>💰</span>
            ${user.balance.toLocaleString()}
            <span className={styles.balanceArrow}>▼</span>
          </div>
        </div>

        {/* Balance Sheet Modal */}
        {balanceSheetOpen && (
          <div className={styles.balanceSheetOverlay} onClick={() => setBalanceSheetOpen(false)}>
            <div className={styles.balanceSheet} onClick={e => e.stopPropagation()}>
              <div className={styles.sheetHeader}>
                <span className={styles.sheetTitle}>Баланс</span>
                <button className={styles.sheetClose} onClick={() => setBalanceSheetOpen(false)}>×</button>
              </div>
              
              <div className={styles.sheetContent}>
                {/* Main Balance */}
                <div className={styles.balanceRow}>
                  <div className={styles.balanceItem}>
                    <span className={styles.balanceItemLabel}>Счёт • USD</span>
                    <div className={styles.balanceItemValue}>
                      <span className={styles.currencyIcon}>💵</span>
                      {user.balance.toFixed(2)}
                    </div>
                  </div>
                  <div className={styles.balanceItem}>
                    <span className={styles.balanceItemLabel}>Chips</span>
                    <div className={styles.balanceItemValue}>
                      <span className={styles.currencyIcon}>🪙</span>
                      {(user.balance * 100).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {/* Bonus Balance */}
                <div className={styles.bonusRow}>
                  <div className={styles.bonusItem}>
                    <span className={styles.bonusLabel}>Бонусный счёт</span>
                    <span className={styles.bonusValue}>0.00$</span>
                  </div>
                  <span className={styles.bonusArrow}>›</span>
                </div>
                
                {/* Wallet Button */}
                <button className={styles.walletButton}>
                  💳 Кошелёк
                </button>
                
                {/* Quick Actions */}
                <div className={styles.quickActions}>
                  <button className={styles.quickAction}>
                    <span className={styles.quickIcon}>➕</span>
                    <span>Deposit</span>
                  </button>
                  <button className={styles.quickAction}>
                    <span className={styles.quickIcon}>➖</span>
                    <span>Withdraw</span>
                  </button>
                  <button className={styles.quickAction}>
                    <span className={styles.quickIcon}>📜</span>
                    <span>History</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.sidebarButtons}>
          <button className={styles.sidebarButton}>
            <span className={styles.buttonIcon}>💳</span>
            Deposit
          </button>
          <button className={styles.sidebarButton}>
            <span className={styles.buttonIcon}>💸</span>
            Withdraw
          </button>
          <button className={styles.sidebarButton}>
            <span className={styles.buttonIcon}>📜</span>
            History
          </button>
          <button className={styles.sidebarButton}>
            <span className={styles.buttonIcon}>⚙️</span>
            Settings
          </button>
        </div>

        {/* Stats */}
        <div className={styles.statsSection}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>24</span>
            <span className={styles.statLabel}>Games</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>58%</span>
            <span className={styles.statLabel}>Win Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
