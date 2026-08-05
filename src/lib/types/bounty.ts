export type BountyStatus =
  'open' | 'in-progress' | 'in-dispute' | 'claimed' | 'cancelled';

export interface Bounty {
  title: string;
  amountSats: number;
  status: BountyStatus;
  tags: string[];
}
