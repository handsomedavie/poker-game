// API Configuration
// Uses environment variables for different environments

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
export const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'Pokergamebot';

// Helper to build API endpoints
export const api = {
  lobby: {
    create: `${API_URL}/api/lobby/create`,
    get: (code: string) => `${API_URL}/api/lobby/${code}`,
    join: (code: string) => `${API_URL}/api/lobby/${code}/join`,
    leave: (code: string) => `${API_URL}/api/lobby/${code}/leave`,
    start: (code: string) => `${API_URL}/api/lobby/${code}/start`,
  },
  ws: {
    lobby: (code: string) => `${WS_URL}/ws/lobby/${code}`,
    table: (tableId: string) => `${WS_URL}/ws/${tableId}`,
  },
};

// Generate invite link for Telegram
export const getInviteLink = (lobbyCode: string) => {
  return `https://t.me/${BOT_USERNAME}?start=lobby_${lobbyCode}`;
};
