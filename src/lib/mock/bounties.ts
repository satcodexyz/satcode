import type { Bounty, BountyComment, NostrProfile } from '$lib/types/bounty';

/**
 * Mock bounties — single source of truth for development.
 *
 * When NDK integration is ready, replace this module with real fetches:
 *   export async function getBounties(): Promise<Bounty[]> { ... }
 *   export async function getBounty(address: string): Promise<Bounty | null> { ... }
 */

export const mockBounties: Bounty[] = [
  {
    id: '1',
    address:
      '30050:npub1alice00000000000000000000000000000000000000000000000000:1',
    title: 'Add NIP-57 zap receipts to the bounty feed',
    description: `## Overview
Implement NIP-57 zap receipt parsing so that the bounty feed shows how much has been zapped to each bounty.

## Requirements
- [ ] Parse kind 9735 events from relay
- [ ] Display zap total on BountyCard
- [ ] Show individual zap receipts on bounty detail page
- [x] Read the NIP-57 spec

## Notes
- Use the existing NDK instance from \`$lib/ndk.ts\`
- Bolt11 decoding can use the lightningpay library`,
    amountSats: 250000,
    status: 'open',
    tags: ['typescript', 'nostr'],
    makerPubkey: 'npub1alice00000000000000000000000000000000000000000000000000',
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
    resolutionMode: 'A',
    checkInIntervalDays: 7
  },
  {
    id: '2',
    address:
      '30050:npub1bob0000000000000000000000000000000000000000000000000000:2',
    title: 'Escrow state machine for Arkade multiparty flows',
    description: `## Overview
Design and implement a state machine that manages escrow transitions for multi-party Bitcoin transactions using Arkade.

## Requirements
- [ ] Define state transitions (funded → locked → released / disputed)
- [ ] Integrate with Arkade SDK for VTXO management
- [ ] Emit Nostr events for each state change
- [ ] Handle timeout / expiry gracefully

## Acceptance Criteria
- All state transitions are tested with unit tests
- Integration test with regtest Ark server passes`,
    amountSats: 1200000,
    status: 'in-dispute',
    tags: ['bitcoin', 'escrow', 'arkade'],
    makerPubkey: 'npub1bob0000000000000000000000000000000000000000000000000000',
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
    resolutionMode: 'B',
    checkInIntervalDays: 3
  },
  {
    id: '3',
    address:
      '30050:npub1alice00000000000000000000000000000000000000000000000000:3',
    title: 'Dark-mode landing page skeleton',
    description: `## Overview
Create a responsive dark-mode landing page skeleton using Tailwind CSS.

## Requirements
- [x] Hero section with tagline
- [x] Feature grid (3 columns on desktop)
- [x] Footer with links
- [x] Mobile responsive

Completed and claimed!`,
    amountSats: 50000,
    status: 'claimed',
    tags: ['design', 'tailwind'],
    makerPubkey: 'npub1alice00000000000000000000000000000000000000000000000000',
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 14, // 14 days ago
    resolutionMode: 'A',
    checkInIntervalDays: 0
  }
];

export const mockComments: BountyComment[] = [
  {
    id: 'comment-1',
    bountyId: '1',
    pubkey: 'npub1bob0000000000000000000000000000000000000000000000000000',
    content:
      'Is there a preference on which bolt11 decoding library to use? I was thinking of using light-bolt11-decoder.',
    createdAt: Math.floor(Date.now() / 1000) - 3600 * 12,
    replyToId: null
  },
  {
    id: 'comment-2',
    bountyId: '1',
    pubkey: 'npub1alice00000000000000000000000000000000000000000000000000',
    content: 'Yes, light-bolt11-decoder works great. Go for it!',
    createdAt: Math.floor(Date.now() / 1000) - 3600 * 6,
    replyToId: 'comment-1'
  },
  {
    id: 'comment-3',
    bountyId: '2',
    pubkey: 'npub1charlie000000000000000000000000000000000000000000000000',
    content:
      'I have experience with Ark. Happy to take this on. Will submit a proposal by end of week.',
    createdAt: Math.floor(Date.now() / 1000) - 86400,
    replyToId: null
  }
];

export const mockProfiles: NostrProfile[] = [
  {
    pubkey: 'npub1alice00000000000000000000000000000000000000000000000000',
    displayName: 'Alice',
    picture: undefined
  },
  {
    pubkey: 'npub1bob0000000000000000000000000000000000000000000000000000',
    displayName: 'Bob',
    picture: undefined
  },
  {
    pubkey: 'npub1charlie000000000000000000000000000000000000000000000000',
    displayName: 'Charlie',
    picture: undefined
  }
];

// --- Accessor functions (easy to swap with async NDK versions later) ---

export function getBounties(): Bounty[] {
  return mockBounties;
}

/** Looked up by address: BountyCard links by it, since event ids change on edit. */
export function getBounty(address: string): Bounty | null {
  return mockBounties.find((b) => b.address === address) ?? null;
}

export function getComments(bountyId: string): BountyComment[] {
  return mockComments.filter((c) => c.bountyId === bountyId);
}

export function getProfile(pubkey: string): NostrProfile | null {
  return mockProfiles.find((p) => p.pubkey === pubkey) ?? null;
}

export function shortPubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`;
}
