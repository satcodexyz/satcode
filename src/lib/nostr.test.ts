import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NDKEvent, NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

// ---------------------------------------------------------------------------
// Mock the ndk singleton so no real WebSocket connections are made.
// ---------------------------------------------------------------------------

type SubscribeOpts = NDKSubscriptionOptions & {
  onEvent?: (event: NDKEvent) => void;
  onEose?: () => void;
};

let mockEvents: Partial<NDKEvent>[] = [];
const mockStop = vi.fn();
const mockSubscribe = vi.fn();

vi.mock('./ndk', () => ({
  ndk: () => ({ subscribe: mockSubscribe })
}));

// Import AFTER the mock is registered
const { fetchLatestEvent } = await import('./nostr');

// ---------------------------------------------------------------------------

function makeEvent(created_at: number | undefined): Partial<NDKEvent> {
  return { created_at } as Partial<NDKEvent>;
}

/** Default subscribe implementation: fires onEvent for each mockEvent then onEose.
 *  onEose is deferred with queueMicrotask so that the `sub` variable in nostr.ts
 *  is fully assigned before the callback runs (it closes over `sub`).
 */
function defaultSubscribeImpl(_filter: NDKFilter, opts: SubscribeOpts) {
  const sub = { stop: mockStop };
  for (const event of mockEvents) {
    opts.onEvent?.(event as NDKEvent);
  }
  queueMicrotask(() => opts.onEose?.());
  return sub;
}

describe('fetchLatestEvent', () => {
  beforeEach(() => {
    mockEvents = [];
    mockStop.mockClear();
    mockSubscribe.mockClear();
    mockSubscribe.mockImplementation(defaultSubscribeImpl);
  });

  it('resolves null when EOSE fires with no events', async () => {
    const result = await fetchLatestEvent({ kinds: [1] });
    expect(result).toBeNull();
  });

  it('resolves the single event when only one event is received', async () => {
    const event = makeEvent(1000);
    mockEvents = [event];

    const result = await fetchLatestEvent({ kinds: [1] });
    expect(result).toBe(event);
  });

  it('resolves the event with the highest created_at among multiple events', async () => {
    const older = makeEvent(1000);
    const newest = makeEvent(3000);
    const middle = makeEvent(2000);
    mockEvents = [older, newest, middle];

    const result = await fetchLatestEvent({ kinds: [1] });
    expect(result).toBe(newest);
  });

  it('treats undefined created_at as 0 when comparing', async () => {
    const withTimestamp = makeEvent(500);
    const withoutTimestamp = makeEvent(undefined);
    mockEvents = [withoutTimestamp, withTimestamp];

    const result = await fetchLatestEvent({ kinds: [1] });
    expect(result).toBe(withTimestamp);
  });

  it('always passes closeOnEose: true to ndk().subscribe, even when caller passes false', async () => {
    await fetchLatestEvent({ kinds: [1] }, { closeOnEose: false });

    const opts: SubscribeOpts = mockSubscribe.mock.calls[0][1];
    expect(opts.closeOnEose).toBe(true);
  });

  it('calls sub.stop() after resolving when events are present', async () => {
    mockEvents = [makeEvent(1000)];

    await fetchLatestEvent({ kinds: [1] });

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('does not call sub.stop() when no events are received', async () => {
    await fetchLatestEvent({ kinds: [1] });

    expect(mockStop).not.toHaveBeenCalled();
  });
});
