import { SERVER_HTTP_URL } from '../config/env';
import type { CurrentUserProfile } from '../types/server.types';

export const fetchCurrentUser = async (): Promise<CurrentUserProfile> => {
  const response = await fetch(`${SERVER_HTTP_URL}/api/me`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initData: '' }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }

  const payload = await response.json();
  return {
    userId: payload.user_id,
    displayName: payload.display_name,
    balance: payload.balance,
  };
};
