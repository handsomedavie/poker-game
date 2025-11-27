export const SERVER_HTTP_URL = import.meta.env.VITE_SERVER_HTTP_URL ?? 'http://localhost:8000';
export const SERVER_WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:8000';
export const DEBUG_MODE = (import.meta.env.VITE_DEBUG_TABLE ?? 'false').toLowerCase() === 'true';
