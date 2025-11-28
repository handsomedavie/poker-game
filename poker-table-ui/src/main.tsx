import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Helper to update loading progress
const debug = (msg: string) => {
  console.log('[main.tsx] ' + msg);
  (window as any).addDebug?.(msg);
};

const updateProgress = (text: string) => {
  debug(text);
  (window as any).updateLoadingProgress?.(text);
};

const showError = (message: string) => {
  debug('ERROR: ' + message);
  (window as any).showLoadingError?.(message);
};

// Start loading
debug('main.tsx executing');
updateProgress('Starting app...');

// Debug: Log environment and device info
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
console.log('🔧 Environment:', {
  API_URL: import.meta.env.VITE_API_URL || 'not set',
  WS_URL: import.meta.env.VITE_WS_URL || 'not set',
  MODE: import.meta.env.MODE,
  isMobile,
});

updateProgress('Checking Telegram...');

// Telegram WebApp should already be initialized in index.html
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  console.log('✅ Telegram WebApp ready, user:', tg.initDataUnsafe?.user?.first_name || 'Guest');
  updateProgress('Telegram connected');
} else {
  console.log('⚠️ Not in Telegram WebApp (browser mode)');
  updateProgress('Browser mode');
}

// Render app
updateProgress('Loading components...');

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root element not found');
  }
  
  updateProgress('Rendering app...');
  
  // Create wrapper component that hides loading after mount
  const AppWithLoading = () => {
    React.useEffect(() => {
      console.log('✅ App mounted successfully');
      (window as any).hideLoading?.();
    }, []);
    return <App />;
  };
  
  createRoot(rootEl).render(
    <StrictMode>
      <AppWithLoading />
    </StrictMode>,
  );
  
} catch (error) {
  const errorMessage = (error as Error).message || 'Unknown error';
  showError('Failed to load: ' + errorMessage + '<br><br>Please tap Retry below.');
}
