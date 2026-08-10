export type JurorAvailability = 'active' | 'inactive';

export interface JurorReputation {
  totalVotes: number;
  majorityVotes: number;
  minorityVotes: number;
  nonParticipation: number;
}

export interface Juror {
  /** Hex-encoded Nostr public key */
  nostrPubkey: string;
  displayName: string;
  avatarUrl?: string;
  /** Satoshi amount locked in the bond vTXO (≥ MIN_JUROR_BOND = 100,000) */
  bondAmountSats: number;
  /** Skill tags used for panel matching, e.g. ["rust", "bitcoin"] */
  specialisations: string[];
  availability: JurorAvailability;
  reputation: JurorReputation;
}
