// ---------------------------------------------------------------------------
// SatCode — application-wide constants
// ---------------------------------------------------------------------------

/** Arkade mutinynet server URL. */
export const MUTINYNET_ARK_URL = 'https://mutinynet.arkade.sh';

/**
 * Bond lockup in seconds — 2 weeks, rounded up to the nearest BIP68 multiple
 * of 512 seconds (BIP68 time-based CSV granularity is 512 s).
 *
 * 2 weeks = 1,209,600 s; 1,209,600 % 512 = 256 (not valid for bip68.encode).
 * ceil(1,209,600 / 512) * 512 = 1,209,856 s ≈ 14.003 days — the smallest
 * valid value that is ≥ 2 weeks.
 *
 * Leaf A of the juror bond script uses a CSV of this value so governance
 * can slash the bond during this window after a juror signals deregistration.
 */
export const BOND_LOCKUP_SECONDS = BigInt(1_209_856);

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

/**
 * localStorage key under which the last reached wallet step is persisted.
 * Used by initWallet() to skip redundant Arkade operator calls on re-open.
 */
export const STEP_STORAGE_KEY = 'satcode:juror:step';

/**
 * localStorage key under which the resolved bond VTXO outpoint is cached.
 * Format: "<txid>:<vout>".  Persisted as soon as resolveBondVtxo() succeeds
 * so that the outpoint survives page reloads and can be recovered even when
 * the user imports the same seed after wiping localStorage.
 */
export const BOND_VTXO_STORAGE_KEY = 'satcode:juror:bond-vtxo';

/**
 * The mutinynet.arkade.sh server encodes a 4096-second checkpoint exit delay
 * in its checkpointTapscript. The SDK's default floor for non-regtest networks
 * is 86400s (1 day), which would reject the server's tapscript and throw:
 *   "checkpoint exit delay rejected: 4096 seconds is below the 86400s floor"
 *
 * Pass this value as `minCheckpointExitDelaySeconds` in `Wallet.create()` to
 * lower the floor to match what the mutinynet server actually advertises.
 */
export const MUTINYNET_MIN_CHECKPOINT_EXIT_DELAY_SECONDS = 4096n;
