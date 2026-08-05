import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted to the top of the module by Vitest.
// NDK and NDKCacheAdapterDexie are used with `new`, so their mocks must be
// proper constructors (regular functions, not arrow functions).
// ---------------------------------------------------------------------------

vi.mock('@nostr-dev-kit/ndk', () => {
  const MockNDK = vi.fn(function (
    this: Record<string, unknown>,
    opts: unknown
  ) {
    this.connect = vi.fn();
    this.relayAuthDefaultPolicy = undefined;
    this._opts = opts;
  });
  return {
    default: MockNDK,
    NDKRelayAuthPolicies: {
      signIn: vi.fn().mockReturnValue('mock-auth-policy')
    }
  };
});

vi.mock('@nostr-dev-kit/ndk-cache-dexie', () => ({
  default: vi.fn(function () {
    /* no-op constructor */
  })
}));

// ---------------------------------------------------------------------------
// Re-import the module under test fresh for every test so the module-level
// `ndkInstance` singleton is reset to `undefined` between tests.
// vi.resetModules() clears the module registry; the top-level vi.mock() calls
// above are re-applied automatically to each fresh import.
// ---------------------------------------------------------------------------

let ndkFn: typeof import('./ndk').ndk;
let DEFAULT_RELAYS: string[];

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('./ndk');
  ndkFn = mod.ndk;
  DEFAULT_RELAYS = mod.DEFAULT_RELAYS;
});

// ---------------------------------------------------------------------------

describe('ndk singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = ndkFn();
    const b = ndkFn();
    expect(a).toBe(b);
  });

  it('throws when options are passed after the first initialisation', () => {
    ndkFn();
    expect(() => ndkFn({ explicitRelayUrls: [] })).toThrow(
      'NDK instance already initialized'
    );
  });

  it('calls connect() exactly once on the NDK instance', () => {
    const instance = ndkFn();
    expect(instance.connect).toHaveBeenCalledOnce();
  });

  it('does not call connect() again on subsequent calls', () => {
    const instance = ndkFn();
    ndkFn();
    ndkFn();
    expect(instance.connect).toHaveBeenCalledOnce();
  });

  it('initialises with DEFAULT_RELAYS when no options are provided', async () => {
    ndkFn();
    const { default: MockNDK } = await import('@nostr-dev-kit/ndk');
    expect(MockNDK).toHaveBeenCalledWith(
      expect.objectContaining({ explicitRelayUrls: DEFAULT_RELAYS })
    );
  });

  it('DEFAULT_RELAYS contains at least one wss:// relay URL', () => {
    expect(DEFAULT_RELAYS.length).toBeGreaterThan(0);
    for (const url of DEFAULT_RELAYS) {
      expect(url).toMatch(/^wss:\/\//);
    }
  });

  it('accepts custom relay options on the first call', async () => {
    const customRelays = ['wss://custom.relay.example'];
    ndkFn({ explicitRelayUrls: customRelays });
    const { default: MockNDK } = await import('@nostr-dev-kit/ndk');
    expect(MockNDK).toHaveBeenCalledWith(
      expect.objectContaining({ explicitRelayUrls: customRelays })
    );
  });

  it('sets relayAuthDefaultPolicy on the instance', () => {
    const instance = ndkFn();
    expect(instance.relayAuthDefaultPolicy).toBe('mock-auth-policy');
  });
});
