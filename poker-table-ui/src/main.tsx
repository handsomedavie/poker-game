import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug: Log environment variables
console.log('🔧 Environment:', {
  API_URL: import.meta.env.VITE_API_URL || 'not set',
  WS_URL: import.meta.env.VITE_WS_URL || 'not set',
  BOT_USERNAME: import.meta.env.VITE_BOT_USERNAME || 'not set',
  MODE: import.meta.env.MODE,
});

// Initialize Telegram WebApp
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  console.log('✅ Telegram WebApp detected');
  tg.ready();
  tg.expand();
  console.log('📱 WebApp expanded, user:', tg.initDataUnsafe?.user);
} else {
  console.log('⚠️ Not running in Telegram WebApp');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
