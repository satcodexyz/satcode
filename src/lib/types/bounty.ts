export type BountyStatus =
  'open' | 'in-progress' | 'in-dispute' | 'claimed' | 'cancelled';

export type ResolutionMode = 'A' | 'B';

export interface Bounty {
  /** Event id of the revision this was parsed from; NIP-09 `e` tags match it. */
  id: string;
  /** `<kind>:<pubkey>:<d>` — stable across revisions, unlike the event id. */
  address: string;
  title: string;
  description: string;
  amountSats: number;
  status: BountyStatus;
  tags: string[];
  makerPubkey: string;
  createdAt: number; // unix timestamp
  resolutionMode: ResolutionMode;
  /** Omitted when the event carries no `check_in_days` tag. */
  checkInIntervalDays?: number;
}

export interface BountyComment {
  id: string;
  bountyId: string;
  pubkey: string;
  content: string;
  createdAt: number; // unix timestamp
  replyToId: string | null;
}

export interface NostrProfile {
  pubkey: string;
  displayName: string;
  picture?: string;
}
