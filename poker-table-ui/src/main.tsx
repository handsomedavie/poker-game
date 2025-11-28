import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// Debug helper - runs immediately
const debug = (msg: string) => {
  console.log('[main] ' + msg);
  (window as any).addDebug?.(msg);
};

debug('main.tsx LOADED');

// Ultra-minimal app - no heavy imports
function MinimalApp() {
  debug('MinimalApp rendering');
  
  const tg = (window as any).Telegram?.WebApp;
  const userName = tg?.initDataUnsafe?.user?.first_name || 'Guest';
  
  useEffect(() => {
    debug('App MOUNTED');
    // Hide loading screen
    (window as any).hideLoading?.();
  }, []);
  
  return (
    <div style={{
      background: '#0f172a',
      color: 'white',
      padding: '40px 20px',
      textAlign: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ color: '#22c55e', marginBottom: '20px' }}>
        🎉 It Works!
      </h1>
      <p style={{ fontSize: '18px', marginBottom: '10px' }}>
        Hello, {userName}!
      </p>
      <p style={{ color: '#94a3b8', marginBottom: '30px' }}>
        React is running on mobile
      </p>
      <button
        onClick={() => alert('Button clicked!')}
        style={{
          padding: '15px 40px',
          fontSize: '18px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Test Button
      </button>
    </div>
  );
}

// Render immediately
debug('Creating root');
try {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('No root element');
  
  debug('Rendering...');
  createRoot(rootEl).render(
    <StrictMode>
      <MinimalApp />
    </StrictMode>
  );
  debug('Render complete');
} catch (e) {
  debug('ERROR: ' + (e as Error).message);
  (window as any).showLoadingError?.('Error: ' + (e as Error).message);
}
