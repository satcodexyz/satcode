import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk } from './ndk';

export const BOUNTY_KIND = 30050;

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
