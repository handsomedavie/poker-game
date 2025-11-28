import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Helper to update loading progress
const updateProgress = (text: string) => {
  console.log('📊 ' + text);
  (window as any).updateLoadingProgress?.(text);
};

const showError = (message: string) => {
  console.error('❌ ' + message);
  (window as any).showLoadingError?.(message);
};

// Start loading
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
  
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  
  // Hide loading screen after React renders
  console.log('✅ React rendered successfully');
  (window as any).hideLoading?.();
  
} catch (error) {
  const errorMessage = (error as Error).message || 'Unknown error';
  showError('Failed to load: ' + errorMessage + '<br><br>Please tap Retry below.');
}
