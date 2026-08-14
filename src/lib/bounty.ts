import { NDKEvent, type NDKKind } from '@nostr-dev-kit/ndk';
import { ndk } from './ndk';
import type { Bounty, BountyStatus, ResolutionMode } from './types/bounty';

// NDK's NDKKind enum doesn't enumerate the SatCode protocol kinds, and since
// TS 5 only declared members are assignable to an enum type — so the assertion
// is what lets this be used in an NDKFilter.
export const BOUNTY_KIND = 30050 as NDKKind;

export interface BountyDraft {
  title: string;
  description: string; // markdown
  amountSats: number;
  deadline: string; // YYYY-MM-DD, user's local time zone
  topics: string; // comma-separated, may be empty
}

export function buildBountyEvent(draft: BountyDraft): {
  kind: number;
  content: string;
  tags: string[][];
} {
  // End of the picked day (23:59:59) in the poster's local time zone —
  // new Date('YYYY-MM-DD') would parse as UTC midnight and shift the day.
  const [year, month, day] = draft.deadline.split('-').map(Number);
  const deadlineUnix = Math.floor(
    new Date(year, month - 1, day, 23, 59, 59).getTime() / 1000
  );
  const topics = [
    ...new Set(
      draft.topics
        .split(',')
        .map((topic) => topic.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
  return {
    kind: BOUNTY_KIND,
    content: draft.description.trim(),
    tags: [
      ['d', crypto.randomUUID()],
      ['title', draft.title.trim()],
      ['amount_sats', String(draft.amountSats)],
      ['s', 'open'],
      // Mode B (oracle) requires infrastructure that doesn't exist yet.
      ['resolution_mode', 'A'],
      ['bounty_deadline', String(deadlineUnix)],
      ...topics.map((topic) => ['t', topic])
    ]
  };
}

export async function publishBounty(draft: BountyDraft): Promise<NDKEvent> {
  const event = new NDKEvent(ndk(), buildBountyEvent(draft));
  await event.sign(); // NIP-07 extension prompt (signer set at login)
  await event.publish(); // throws NDKPublishError if no relay accepts
  return event;
}

// ---------------------------------------------------------------------------
// Reading bounties off the relays
// ---------------------------------------------------------------------------

/** Longest title we render. Relay titles are untrusted and unbounded. */
const MAX_TITLE_LENGTH = 200;

/** Longest description we render, for the same reason. */
const MAX_DESCRIPTION_LENGTH = 20_000;

/** Most topic chips a card shows. */
const MAX_TOPICS = 8;

/**
 * Every value the spec allows in the `s` tag.
 *
 * Also serves as a filter: kind 30050 is contested namespace — unrelated apps
 * publish key bundles, chat rooms and device handshakes on it, and on the
 * default relays they outnumber bounties ~50:1. Asking for `#s` narrows the
 * query to events carrying a bounty status, so those apps don't consume the
 * subscription's limit.
 */
export const BOUNTY_STATUSES: readonly BountyStatus[] = [
  'open',
  'in-progress',
  'in-dispute',
  'claimed',
  'cancelled'
];

function isBountyStatus(value: string | undefined): value is BountyStatus {
  return BOUNTY_STATUSES.some((status) => status === value);
}

function isResolutionMode(value: string | undefined): value is ResolutionMode {
  return value === 'A' || value === 'B';
}

/**
 * Parse a kind-30050 event into a `Bounty`, or `null` when it cannot be
 * rendered as one.
 *
 * Relays are untrusted input: an event carrying an unrecognized `s` or
 * `resolution_mode` tag would otherwise reach the status lookup and mode badge
 * and render wrong. Only the tags a bounty is unrenderable without are
 * required — `buildBountyEvent` omits `gov_key_*`, `refund_address` and
 * `check_in_days`, so requiring those would stop the app reading its own
 * writes.
 */
export function parseBountyEvent(event: NDKEvent): Bounty | null {
  const { id, pubkey, created_at: createdAt } = event;
  const title = event.tagValue('title')?.trim();
  const status = event.tagValue('s');
  const resolutionMode = event.tagValue('resolution_mode');

  if (!id || !pubkey || !createdAt || !event.dTag || !title) return null;
  if (!isBountyStatus(status)) return null;
  if (!isResolutionMode(resolutionMode)) return null;

  // 'amount_sats' is canonical; 'amount' is accepted for compatibility.
  const amount = event.tagValue('amount_sats') ?? event.tagValue('amount');
  const amountSats = Number(amount);
  if (!amount || !Number.isSafeInteger(amountSats) || amountSats < 0) {
    return null;
  }

  // Optional, unlike the tags above: absent on every bounty this app publishes.
  const checkInDays = Number(event.tagValue('check_in_days'));
  const checkInIntervalDays =
    Number.isSafeInteger(checkInDays) && checkInDays > 0
      ? checkInDays
      : undefined;

  return {
    id,
    address: event.tagAddress(),
    makerPubkey: pubkey,
    createdAt,
    title: title.slice(0, MAX_TITLE_LENGTH),
    description: event.content.trim().slice(0, MAX_DESCRIPTION_LENGTH),
    amountSats,
    status,
    resolutionMode,
    checkInIntervalDays,
    tags: event
      .getMatchingTags('t')
      .map((tag) => tag[1])
      .filter(Boolean)
      .slice(0, MAX_TOPICS)
  };
}

/**
 * Insert a bounty into `byAddress`, keeping whichever revision is newest.
 *
 * Addressable events are identified by address, not event id, and NDK's
 * subscriptions only dedupe by id — so two relays holding different revisions
 * of one bounty arrive as two events that must collapse to a single entry.
 */
export function upsertBounty(
  bounty: Bounty,
  byAddress: Map<string, Bounty>
): void {
  const current = byAddress.get(bounty.address);
  if (!current || bounty.createdAt > current.createdAt) {
    byAddress.set(bounty.address, bounty);
  }
}

/** A NIP-09 deletion request, keyed by the event id or address it targets. */
export interface Deletion {
  /** `created_at` of the newest deletion request seen for that target. */
  at: number;
  /** Pubkey that signed it — only an author may delete their own events. */
  by: string;
}

/**
 * Record the targets of a kind-5 deletion request, newest wins.
 *
 * `a` and `e` targets share one map: a 64-character event id can never collide
 * with a `<kind>:<pubkey>:<d>` address.
 */
export function recordDeletion(
  event: NDKEvent,
  deletions: Map<string, Deletion>
): void {
  const { pubkey, created_at: at } = event;
  if (!pubkey || !at) return;

  const targets = [
    ...event.getMatchingTags('a'),
    ...event.getMatchingTags('e')
  ];
  for (const [, target] of targets) {
    if (!target) continue;
    const current = deletions.get(target);
    if (!current || at > current.at) {
      deletions.set(target, { at, by: pubkey });
    }
  }
}

function isDeleted(
  bounty: Bounty,
  deletions: ReadonlyMap<string, Deletion>
): boolean {
  const byAddress = deletions.get(bounty.address);
  // NIP-09: an `a` request deletes every version created before it.
  if (
    byAddress?.by === bounty.makerPubkey &&
    byAddress.at >= bounty.createdAt
  ) {
    return true;
  }
  return deletions.get(bounty.id)?.by === bounty.makerPubkey;
}

/** Bounties their maker has not retracted, newest first. */
export function visibleBounties(
  byAddress: ReadonlyMap<string, Bounty>,
  deletions: ReadonlyMap<string, Deletion>
): Bounty[] {
  return [...byAddress.values()]
    .filter((bounty) => !isDeleted(bounty, deletions))
    .sort((a, b) => b.createdAt - a.createdAt);
}
