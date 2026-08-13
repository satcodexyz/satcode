// ---------------------------------------------------------------------------
// SatCode — application-wide constants
// ---------------------------------------------------------------------------

/** Arkade mutinynet server URL. */
export const MUTINYNET_ARK_URL = 'https://mutinynet.arkade.sh';

/**
 * Bond lockup in seconds — 2 weeks (1,209,600 s).
 * Leaf A of the juror bond script uses a CSV of this value so governance
 * can slash the bond during this window after a juror signals deregistration.
 */
export const BOND_LOCKUP_SECONDS = BigInt(1_209_600);

/**
 * Minimum bond amount in satoshis required to register as a juror.
 */
export const MIN_JUROR_BOND_SATS = 100_000;

/**
 * 2-of-3 governance slash keys (x-only hex, 32 bytes each).
 * These are the ONLY keys that can slash a juror bond (Leaf B).
 * Replace with real governance keys before mainnet.
 *
 * @placeholder — swap these before production.
 */
export const GOVERNANCE_PUBKEYS: [string, string, string] = [
  '0101010101010101010101010101010101010101010101010101010101010101',
  '0202020202020202020202020202020202020202020202020202020202020202',
  '0303030303030303030303030303030303030303030303030303030303030303'
];

/** localStorage key under which the juror mnemonic is stored. */
export const MNEMONIC_STORAGE_KEY = 'satcode:juror:mnemonic';
