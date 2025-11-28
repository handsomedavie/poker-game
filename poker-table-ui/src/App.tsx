import { useState, useEffect, useCallback, Suspense, lazy } from 'react';

// Lazy load heavy components - they will be loaded on demand
const PokerTable = lazy(() => import('./components/PokerTable/PokerTable').then(m => ({ default: m.PokerTable })));
const LobbyPage = lazy(() => import('./components/Lobby').then(m => ({ default: m.LobbyPage })));

// MainMenu loads immediately as it's the first screen
import { MainMenu } from './components/MainMenu';

type AppView = 'menu' | 'table' | 'private-lobby';

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0f172a',
    color: 'white',
    fontSize: '18px',
    gap: '15px'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTopColor: '#22c55e',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <span>Loading...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  const [view, setView] = useState<AppView>('menu');
  const [tableId, setTableId] = useState<string>('default');
  const [error, setError] = useState<string | null>(null);

  // Check for Telegram deep link on mount
  useEffect(() => {
    try {
      console.log('📱 App component mounted');
      const tg = (window as any).Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;
      
      console.log('🔗 App mount - Start param:', startParam);
      
      // If deep link contains lobby_, switch to private lobby view
      if (startParam && startParam.startsWith('lobby_')) {
        console.log('🎯 Detected lobby deep link, switching to private lobby view');
        setView('private-lobby');
      }
    } catch (err) {
      console.error('❌ Error in App useEffect:', err);
      setError((err as Error).message);
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

  // Show error if any
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#ef4444', marginTop: '10px' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#22c55e',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Reload App
        </button>
      </div>
    );
  }

  // Main Menu
  if (view === 'menu') {
    console.log('📺 Rendering MainMenu');
    return (
      <MainMenu
        onJoinTable={handleJoinTable}
        onCreatePrivate={handleCreatePrivate}
      />
    );
  }

  // Private Lobby (lazy loaded)
  if (view === 'private-lobby') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LobbyPage
          onBackToTable={handleBackToMenu}
          onStartGame={handleStartGame}
        />
      </Suspense>
    );
  }

  // Poker Table (lazy loaded)
  return (
    <Suspense fallback={<LoadingFallback />}>
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
    </Suspense>
  );
}

export default App;
