import { describe, it, expect, vi } from 'vitest';
import type { BountyDraft } from './bounty';

// ---------------------------------------------------------------------------
// Mock the ndk singleton so no real WebSocket connections are made.
// ---------------------------------------------------------------------------

vi.mock('./ndk', () => ({
  ndk: () => ({})
}));

// Import AFTER the mock is registered
const { buildBountyEvent } = await import('./bounty');

// ---------------------------------------------------------------------------

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
