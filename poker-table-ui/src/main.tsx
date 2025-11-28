import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug: Log environment and device info
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
console.log('🔧 App starting...', {
  API_URL: import.meta.env.VITE_API_URL || 'not set',
  WS_URL: import.meta.env.VITE_WS_URL || 'not set',
  MODE: import.meta.env.MODE,
  isMobile,
  userAgent: navigator.userAgent.substring(0, 50),
});

// Telegram WebApp should already be initialized in index.html
// Double check here
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  console.log('✅ Telegram WebApp ready, user:', tg.initDataUnsafe?.user?.first_name || 'Guest');
} else {
  console.log('⚠️ Not in Telegram WebApp');
}

// Render app
try {
  console.log('🚀 Rendering React app...');
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  
  // Hide loading screen after React renders
  console.log('✅ React rendered successfully');
  (window as any).hideLoading?.();
  
} catch (error) {
  console.error('❌ Failed to render app:', error);
  // Show error on loading screen
  const errorEl = document.getElementById('loading-error');
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Error: ' + (error as Error).message;
  }
}
