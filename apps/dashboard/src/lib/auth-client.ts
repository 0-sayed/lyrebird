import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: window.location.origin, // Vite proxies /api/* to the gateway
});

export const { useSession, signIn, signOut } = authClient;
