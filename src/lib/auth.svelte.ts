import {
  NDKNip07Signer,
  type NDKUser,
  type NDKUserProfile
} from '@nostr-dev-kit/ndk';
import { ndk } from './ndk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: NDKUser | null;
  profile: NDKUserProfile | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes — importable anywhere)
// ---------------------------------------------------------------------------

export const authState: AuthState = $state({
  status: 'idle',
  user: null,
  profile: null,
  error: null
});

// ---------------------------------------------------------------------------
// Persistence key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'satcode:auth:method';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the best available display name from a profile + user, in priority
 * order. Never returns undefined or an empty string.
 *
 * Priority:
 *   1. profile.displayName
 *   2. profile.name
 *   3. First 8 chars of the npub + "…"
 *   4. "Anon" (absolute fallback)
 */
export function resolveDisplayName(
  profile: NDKUserProfile | null | undefined,
  user: NDKUser | null | undefined
): string {
  if (profile?.displayName?.trim()) return profile.displayName.trim();
  if (profile?.name?.trim()) return profile.name.trim();
  if (user) {
    try {
      const npub = user.npub;
      if (npub) return npub.slice(0, 8) + '…';
    } catch {
      // npub getter can throw if pubkey is malformed
    }
  }
  return 'Anon';
}

// ---------------------------------------------------------------------------
// Core auth actions
// ---------------------------------------------------------------------------

/**
 * Trigger a NIP-07 login. Assigns the signer to the NDK singleton, fetches the
 * user and their kind-0 profile, then persists the login method so the session
 * can be restored on the next page load.
 */
export async function login(): Promise<void> {
  authState.status = 'loading';
  authState.error = null;

  try {
    const signer = new NDKNip07Signer();
    const ndkInstance = ndk();
    ndkInstance.signer = signer;

    const user = await signer.blockUntilReady();
    user.ndk = ndkInstance;
    authState.user = user;

    const profile = await user.fetchProfile();
    authState.profile = profile ?? null;

    authState.status = 'ready';

    // Persist the login method (no secrets stored — the extension handles auth)
    try {
      localStorage.setItem(STORAGE_KEY, 'nip07');
    } catch {
      // localStorage may be unavailable in some environments
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    authState.status = 'error';
    authState.error = message;
    ndk().signer = undefined;
  }
}

/**
 * Silently restore a previous NIP-07 session on page load.
 * Only attempts re-login if:
 *   - A login method flag is present in localStorage
 *   - window.nostr is available (extension is installed + unlocked)
 *
 * Failures are silent — the user just stays logged out.
 */
export async function restoreSession(): Promise<void> {
  let storedMethod: string | null;
  try {
    storedMethod = localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }

  if (storedMethod !== 'nip07') return;

  // Give the extension a moment to inject window.nostr
  await new Promise<void>((resolve) => setTimeout(resolve, 100));

  if (typeof window === 'undefined' || !window.nostr) {
    // Extension is gone / locked — clean up stale flag
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }

  // Silent restore — errors are swallowed so the UI just stays logged out
  try {
    await login();
  } catch {
    // ignore
  }
}

/**
 * Log out: clear reactive state, remove the NDK signer, and wipe the
 * persistence flag.
 */
export function logout(): void {
  authState.status = 'idle';
  authState.user = null;
  authState.profile = null;
  authState.error = null;

  ndk().signer = undefined;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
