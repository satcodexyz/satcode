export type BountyStatus =
  'open' | 'in-progress' | 'in-dispute' | 'claimed' | 'cancelled';

export type ResolutionMode = 'A' | 'B';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  amountSats: number;
  status: BountyStatus;
  tags: string[];
  makerPubkey: string;
  createdAt: number; // unix timestamp
  resolutionMode: ResolutionMode;
  checkInIntervalDays: number;
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
