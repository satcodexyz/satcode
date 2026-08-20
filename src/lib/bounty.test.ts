import { describe, it, expect, vi } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { BountyDraft } from './bounty';
import type { Bounty } from './types/bounty';

// ---------------------------------------------------------------------------
// Mock the ndk singleton so no real WebSocket connections are made.
// ---------------------------------------------------------------------------

vi.mock('./ndk', () => ({
  ndk: () => ({})
}));

// Import AFTER the mock is registered
const {
  buildBountyEvent,
  parseBountyEvent,
  recordDeletion,
  upsertBounty,
  visibleBounties
} = await import('./bounty');

// ---------------------------------------------------------------------------

const MAKER = 'a'.repeat(64);
const IMPOSTOR = 'b'.repeat(64);

interface BountyEventOverrides {
  id?: string;
  pubkey?: string;
  createdAt?: number;
  /** `null` omits the tag entirely. */
  d?: string | null;
  title?: string | null;
  amount?: string | null;
  amountTag?: 'amount_sats' | 'amount';
  status?: string | null;
  topics?: string[];
  resolutionMode?: string | null;
  /** Omitted by default, as `buildBountyEvent` omits it. */
  checkInDays?: string | null;
  content?: string;
}

/** A kind-30050 event carrying only the tags `buildBountyEvent` emits. */
function makeBountyEvent(overrides: BountyEventOverrides = {}): NDKEvent {
  const {
    id = 'event-1',
    pubkey = MAKER,
    createdAt = 1_700_000_000,
    d = 'bounty-1',
    title = 'Fix memory leak',
    amount = '250000',
    amountTag = 'amount_sats',
    status = 'open',
    topics = [],
    resolutionMode = 'A',
    checkInDays = null,
    content = ''
  } = overrides;

  const tags: string[][] = [];
  if (d !== null) tags.push(['d', d]);
  if (title !== null) tags.push(['title', title]);
  if (amount !== null) tags.push([amountTag, amount]);
  if (status !== null) tags.push(['s', status]);
  if (resolutionMode !== null) tags.push(['resolution_mode', resolutionMode]);
  if (checkInDays !== null) tags.push(['check_in_days', checkInDays]);
  for (const topic of topics) tags.push(['t', topic]);

  return new NDKEvent(undefined, {
    id,
    pubkey,
    created_at: createdAt,
    kind: 30050,
    content,
    sig: '',
    tags
  });
}

/** A kind-5 deletion request, as `NDKEvent.delete()` would build it. */
function makeDeletionEvent(
  targets: { addresses?: string[]; ids?: string[] },
  overrides: { pubkey?: string; createdAt?: number } = {}
): NDKEvent {
  const { pubkey = MAKER, createdAt = 1_700_000_100 } = overrides;
  return new NDKEvent(undefined, {
    id: 'deletion-1',
    pubkey,
    created_at: createdAt,
    kind: 5,
    content: 'test event',
    sig: '',
    tags: [
      ...(targets.addresses ?? []).map((address) => ['a', address]),
      ...(targets.ids ?? []).map((id) => ['e', id]),
      ['k', '30050']
    ]
  });
}

function parseOrThrow(event: NDKEvent): Bounty {
  const bounty = parseBountyEvent(event);
  if (!bounty) throw new Error('fixture failed to parse');
  return bounty;
}

/** Index bounties the way the listing does. */
function index(...bounties: Bounty[]): Map<string, Bounty> {
  const byAddress = new Map<string, Bounty>();
  for (const bounty of bounties) upsertBounty(bounty, byAddress);
  return byAddress;
}

function makeDraft(overrides: Partial<BountyDraft> = {}): BountyDraft {
  return {
    title: 'Fix memory leak',
    description: 'Find and fix the leak.',
    amountSats: 250000,
    deadline: '2026-08-20',
    topics: '',
    ...overrides
  };
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

describe('buildBountyEvent', () => {
  it('builds a kind-30050 event with the trimmed description as content', () => {
    const event = buildBountyEvent(
      makeDraft({ description: '  Find and fix the leak.  ' })
    );

    expect(event.kind).toBe(30050);
    expect(event.content).toBe('Find and fix the leak.');
  });

  it('uses a fresh UUID as the d tag on every call', () => {
    const first = tagValue(buildBountyEvent(makeDraft()).tags, 'd');
    const second = tagValue(buildBountyEvent(makeDraft()).tags, 'd');

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(first).toMatch(uuid);
    expect(second).toMatch(uuid);
    expect(first).not.toBe(second);
  });

  it('sets title (trimmed), amount_sats, s and resolution_mode tags', () => {
    const { tags } = buildBountyEvent(
      makeDraft({ title: '  Fix memory leak  ', amountSats: 21000 })
    );

    expect(tagValue(tags, 'title')).toBe('Fix memory leak');
    expect(tagValue(tags, 'amount_sats')).toBe('21000');
    expect(tagValue(tags, 's')).toBe('open');
    expect(tagValue(tags, 'resolution_mode')).toBe('A');
  });

  it('sets bounty_deadline to 23:59:59 local time of the picked date', () => {
    const { tags } = buildBountyEvent(makeDraft({ deadline: '2026-08-20' }));

    const endOfDay = new Date(2026, 7, 20, 23, 59, 59);
    expect(tagValue(tags, 'bounty_deadline')).toBe(
      String(Math.floor(endOfDay.getTime() / 1000))
    );
  });

  it('lowercases, trims and dedupes topics into t tags', () => {
    const { tags } = buildBountyEvent(
      makeDraft({ topics: 'TypeScript, nostr,, NOSTR , ' })
    );

    expect(tags.filter((tag) => tag[0] === 't')).toEqual([
      ['t', 'typescript'],
      ['t', 'nostr']
    ]);
  });

  it('emits no t tags when topics is empty', () => {
    const { tags } = buildBountyEvent(makeDraft({ topics: '' }));

    expect(tags.filter((tag) => tag[0] === 't')).toEqual([]);
  });
});

describe('parseBountyEvent', () => {
  it('parses a well-formed event', () => {
    const event = makeBountyEvent({
      topics: ['rust', 'bitcoin'],
      content: '  Heap grows without bound.  ',
      checkInDays: '7'
    });

    expect(parseBountyEvent(event)).toEqual({
      id: 'event-1',
      address: `30050:${MAKER}:bounty-1`,
      makerPubkey: MAKER,
      createdAt: 1_700_000_000,
      title: 'Fix memory leak',
      description: 'Heap grows without bound.',
      amountSats: 250000,
      status: 'open',
      resolutionMode: 'A',
      checkInIntervalDays: 7,
      tags: ['rust', 'bitcoin']
    });
  });

  it('reads the oracle resolution mode', () => {
    const event = makeBountyEvent({ resolutionMode: 'B' });

    expect(parseBountyEvent(event)?.resolutionMode).toBe('B');
  });

  it.each([
    ['a missing tag', null],
    ['a blank tag', ''],
    ['an out-of-range value', '0'],
    ['a non-numeric value', 'weekly'],
    ['a fractional value', '1.5']
  ] satisfies [string, string | null][])(
    'leaves the check-in interval unset for %s',
    (_label, checkInDays) => {
      const event = makeBountyEvent({ checkInDays });

      expect(parseBountyEvent(event)?.checkInIntervalDays).toBeUndefined();
    }
  );

  it('caps the description', () => {
    const event = makeBountyEvent({ content: 'x'.repeat(20_001) });

    expect(parseBountyEvent(event)?.description).toBe('x'.repeat(20_000));
  });

  it('reads back an event built by buildBountyEvent', () => {
    // buildBountyEvent omits gov_key_*, refund_address and check_in_days, which
    // the spec marks required — the parser must not reject the app's own writes.
    const built = buildBountyEvent(makeDraft({ topics: 'rust' }));
    const event = new NDKEvent(undefined, {
      ...built,
      id: 'event-1',
      pubkey: MAKER,
      created_at: 1_700_000_000,
      sig: ''
    });

    expect(parseBountyEvent(event)).toMatchObject({
      title: 'Fix memory leak',
      description: 'Find and fix the leak.',
      amountSats: 250000,
      status: 'open',
      resolutionMode: 'A',
      checkInIntervalDays: undefined,
      tags: ['rust']
    });
  });

  it('falls back to the legacy amount tag', () => {
    const event = makeBountyEvent({ amount: '500000', amountTag: 'amount' });

    expect(parseBountyEvent(event)?.amountSats).toBe(500000);
  });

  it('trims and caps the title', () => {
    const event = makeBountyEvent({ title: `  ${'x'.repeat(300)}  ` });

    expect(parseBountyEvent(event)?.title).toBe('x'.repeat(200));
  });

  it('caps topic tags', () => {
    const topics = Array.from({ length: 20 }, (_, i) => `topic-${i}`);
    const event = makeBountyEvent({ topics });

    expect(parseBountyEvent(event)?.tags).toHaveLength(8);
  });

  it.each([
    ['a missing d tag', { d: null }],
    ['a blank title', { title: '   ' }],
    ['a missing title', { title: null }],
    ['a missing id', { id: '' }],
    ['a non-numeric amount', { amount: 'lots' }],
    ['an empty amount', { amount: '' }],
    ['a negative amount', { amount: '-1' }],
    ['a fractional amount', { amount: '1.5' }],
    ['a missing amount', { amount: null }],
    // An unrecognized status would reach BountyCard's statusBadge lookup and
    // throw, blanking the whole listing.
    ['an unrecognized status', { status: 'pwned' }],
    ['a missing status', { status: null }],
    // An unrecognized mode would fall through to the detail page's `{:else}`
    // and mislabel the bounty as Mode A · Juror.
    ['an unrecognized resolution mode', { resolutionMode: 'C' }],
    ['a missing resolution mode', { resolutionMode: null }]
  ] satisfies [string, BountyEventOverrides][])(
    'returns null for %s',
    (_label, overrides) => {
      expect(parseBountyEvent(makeBountyEvent(overrides))).toBeNull();
    }
  );
});

describe('upsertBounty', () => {
  it('keeps a single entry when a newer revision arrives', () => {
    const older = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const newer = parseOrThrow(
      makeBountyEvent({ id: 'event-2', createdAt: 200, status: 'claimed' })
    );

    const byAddress = index(older, newer);

    expect([...byAddress.values()]).toEqual([newer]);
  });

  it('ignores a stale revision arriving after a newer one', () => {
    const newer = parseOrThrow(makeBountyEvent({ createdAt: 200 }));
    const older = parseOrThrow(
      makeBountyEvent({ id: 'event-2', createdAt: 100, status: 'claimed' })
    );

    const byAddress = index(newer, older);

    expect([...byAddress.values()]).toEqual([newer]);
  });

  it('keeps bounties at different addresses side by side', () => {
    const first = parseOrThrow(makeBountyEvent({ d: 'bounty-1' }));
    const second = parseOrThrow(
      makeBountyEvent({ id: 'event-2', d: 'bounty-2' })
    );

    expect(index(first, second).size).toBe(2);
  });
});

describe('visibleBounties', () => {
  function record(...events: NDKEvent[]): Map<string, number> {
    const deletions = new Map<string, number>();
    for (const event of events) recordDeletion(event, deletions);
    return deletions;
  }

  it('returns bounties newest first', () => {
    const older = parseOrThrow(makeBountyEvent({ d: 'a', createdAt: 100 }));
    const newer = parseOrThrow(
      makeBountyEvent({ id: 'event-2', d: 'b', createdAt: 200 })
    );

    expect(visibleBounties(index(older, newer), new Map())).toEqual([
      newer,
      older
    ]);
  });

  it('hides a bounty deleted by address', () => {
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const deletions = record(
      makeDeletionEvent({ addresses: [bounty.address] }, { createdAt: 200 })
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([]);
  });

  it('hides a bounty deleted by event id', () => {
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const deletions = record(
      makeDeletionEvent({ ids: [bounty.id] }, { createdAt: 200 })
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([]);
  });

  it('hides a bounty whose deletion was recorded before it arrived', () => {
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const deletions = record(
      makeDeletionEvent(
        { addresses: [`30050:${MAKER}:bounty-1`] },
        { createdAt: 200 }
      )
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([]);
  });

  it('ignores a deletion signed by anyone but the maker', () => {
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const deletions = record(
      makeDeletionEvent(
        { addresses: [bounty.address], ids: [bounty.id] },
        { pubkey: IMPOSTOR, createdAt: 200 }
      )
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([bounty]);
  });

  it('keeps a maker deletion a later impostor request targets', () => {
    // Keyed by target alone, the impostor's newer request would evict the
    // maker's and put the retracted bounty back on the listing.
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 100 }));
    const deletions = record(
      makeDeletionEvent({ addresses: [bounty.address] }, { createdAt: 200 }),
      makeDeletionEvent(
        { addresses: [bounty.address], ids: [bounty.id] },
        { pubkey: IMPOSTOR, createdAt: 300 }
      )
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([]);
  });

  it('ignores an address deletion older than the revision it targets', () => {
    // NIP-09: an `a` request only deletes versions created before it, so a
    // republished bounty outlives an earlier retraction.
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 300 }));
    const deletions = record(
      makeDeletionEvent({ addresses: [bounty.address] }, { createdAt: 200 })
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([bounty]);
  });

  it('keeps the newest deletion when requests arrive out of order', () => {
    const bounty = parseOrThrow(makeBountyEvent({ createdAt: 300 }));
    const deletions = record(
      makeDeletionEvent({ addresses: [bounty.address] }, { createdAt: 400 }),
      makeDeletionEvent({ addresses: [bounty.address] }, { createdAt: 200 })
    );

    expect(visibleBounties(index(bounty), deletions)).toEqual([]);
  });
});
