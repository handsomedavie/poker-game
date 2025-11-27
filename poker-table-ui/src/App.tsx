import { useState, useEffect, useCallback } from 'react';
import { PokerTable } from './components/PokerTable/PokerTable';
import { LobbyPage } from './components/Lobby';
import { MainMenu } from './components/MainMenu';

type AppView = 'menu' | 'table' | 'private-lobby';

function App() {
  const [view, setView] = useState<AppView>('menu');
  const [tableId, setTableId] = useState<string>('default');

  // Check for Telegram deep link on mount
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    
    console.log('🔗 App mount - Start param:', startParam);
    
    // If deep link contains lobby_, switch to private lobby view
    if (startParam && startParam.startsWith('lobby_')) {
      console.log('🎯 Detected lobby deep link, switching to private lobby view');
      setView('private-lobby');
    }
  }, []);

  // Handle joining a table from main menu
  const handleJoinTable = useCallback((id: string) => {
    console.log('🎮 Joining table:', id);
    setTableId(id);
    setView('table');
  }, []);

  // Handle switching to private lobby
  const handleCreatePrivate = useCallback(() => {
    setView('private-lobby');
  }, []);

  // Handle going back to menu
  const handleBackToMenu = useCallback(() => {
    setView('menu');
    setTableId('default');
  }, []);

  // Handle game start from private lobby
  const handleStartGame = useCallback((gameSessionId: string) => {
    console.log('🎮 Starting game from lobby:', gameSessionId);
    setTableId(gameSessionId);
    setView('table');
  }, []);

  // Main Menu
  if (view === 'menu') {
    return (
      <MainMenu
        onJoinTable={handleJoinTable}
        onCreatePrivate={handleCreatePrivate}
      />
    );
  }

  // Private Lobby
  if (view === 'private-lobby') {
    return (
      <LobbyPage
        onBackToTable={handleBackToMenu}
        onStartGame={handleStartGame}
      />
    );
  }

  // Poker Table
  return (
    <>
      <PokerTable tableId={tableId} />
      {/* Back to Menu Button */}
      <button
        onClick={handleBackToMenu}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          padding: '10px 16px',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid #475569',
          borderRadius: '10px',
          color: '#94a3b8',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        ← Menu
      </button>
    </>
  );
}

export default App;
