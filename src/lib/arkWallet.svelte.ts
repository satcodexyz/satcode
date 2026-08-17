/**
 * arkWallet.svelte.ts
 *
 * Svelte 5 $state-reactive store managing the juror's managed Arkade wallet
 * lifecycle.
 *
 * State machine:
 *   uninitialised → needs-backup → boarding → boarding-pending
 *                                                    ↓
 *                                                 funded → bond-sent → ready
 *
 * The mnemonic is stored in localStorage under MNEMONIC_STORAGE_KEY.
 * The last reached step is persisted under STEP_STORAGE_KEY so that
 * re-opening the modal after a page reload does not redundantly call the
 * Arkade operator (getInfo) for states where that information is no longer
 * needed (funded, bond-sent, ready).
 */

import {
  Wallet,
  MnemonicIdentity,
  Ramps,
  type WalletBalance
} from '@arkade-os/sdk';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hex } from '@scure/base';
import {
  MUTINYNET_ARK_URL,
  MNEMONIC_STORAGE_KEY,
  STEP_STORAGE_KEY,
  BOND_VTXO_STORAGE_KEY,
  MIN_JUROR_BOND_SATS,
  MUTINYNET_MIN_CHECKPOINT_EXIT_DELAY_SECONDS
} from './config';
import { jurorBondArkAddress, buildJurorBondScript } from './jurorBond';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletStep =
  | 'uninitialised'
  | 'needs-backup'
  | 'boarding'
  | 'boarding-pending'
  | 'funded'
  | 'bond-sent'
  | 'ready';

export interface ArkWalletState {
  step: WalletStep;
  /** Mnemonic phrase — only non-null during needs-backup so user can copy it. */
  mnemonic: string | null;
  boardingAddress: string | null;
  balance: WalletBalance | null;
  jurorPubkeyHex: string | null;
  bondAddress: string | null;
  /**
   * The VTXO outpoint of the bond after sendBond() completes.
   * Formatted as "<txid>:<vout>" for inclusion in the kind:30060 bond_vtxo tag.
   */
  bondVtxoOutpoint: string | null;
  error: string | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

export const arkWalletState: ArkWalletState = $state({
  step: 'uninitialised',
  mnemonic: null,
  boardingAddress: null,
  balance: null,
  jurorPubkeyHex: null,
  bondAddress: null,
  bondVtxoOutpoint: null,
  error: null,
  loading: false
});

// Non-reactive wallet instance.
let _wallet: Wallet | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function setError(msg: string) {
  arkWalletState.error = msg;
  arkWalletState.loading = false;
}

function clearError() {
  arkWalletState.error = null;
}

function storedMnemonic(): string | null {
  try {
    return localStorage.getItem(MNEMONIC_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveMnemonic(phrase: string) {
  try {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, phrase);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Persist the highest step reached so that re-opening the modal after a page
 * reload can skip expensive Arkade operator calls that are no longer needed.
 */
function saveStep(step: WalletStep) {
  try {
    localStorage.setItem(STEP_STORAGE_KEY, step);
  } catch {
    // localStorage may be unavailable
  }
}

function storedStep(): WalletStep | null {
  try {
    const raw = localStorage.getItem(STEP_STORAGE_KEY);
    // Validate against known steps before trusting the stored value.
    const valid: WalletStep[] = [
      'needs-backup',
      'boarding',
      'boarding-pending',
      'funded',
      'bond-sent',
      'ready'
    ];
    return valid.includes(raw as WalletStep) ? (raw as WalletStep) : null;
  } catch {
    return null;
  }
}

function clearStoredStep() {
  try {
    localStorage.removeItem(STEP_STORAGE_KEY);
    localStorage.removeItem(BOND_VTXO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function saveBondVtxoOutpoint(outpoint: string) {
  try {
    localStorage.setItem(BOND_VTXO_STORAGE_KEY, outpoint);
  } catch {
    // localStorage may be unavailable
  }
}

function storedBondVtxoOutpoint(): string | null {
  try {
    return localStorage.getItem(BOND_VTXO_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function buildWallet(phrase: string): Promise<Wallet> {
  const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
  return Wallet.create({
    identity,
    arkServerUrl: MUTINYNET_ARK_URL,
    minCheckpointExitDelaySeconds: MUTINYNET_MIN_CHECKPOINT_EXIT_DELAY_SECONDS
  });
}

async function deriveWalletMeta(wallet: Wallet) {
  const boardingAddress = await wallet.getBoardingAddress();
  const pubkeyBytes = await wallet.identity.xOnlyPublicKey();
  const pubkeyHex = hex.encode(pubkeyBytes);
  const info = await wallet.arkProvider.getInfo();
  // signerPubkey is a compressed hex pubkey (33 bytes); strip the prefix byte
  const serverXOnly = hex.decode(info.signerPubkey).slice(1);
  const bondAddr = jurorBondArkAddress(pubkeyBytes, serverXOnly);
  return { boardingAddress, pubkeyHex, bondAddr };
}

/**
 * Query the Ark indexer for a spendable bond VTXO belonging to the juror's
 * bond script.  Returns the "<txid>:<vout>" outpoint string on success, or
 * null when no unspent VTXO is found.
 *
 * This is the authoritative lookup used both during the initial bond-send flow
 * AND on wallet import/restore — it queries the indexer by pkScript rather
 * than the wallet's own VTXO list, because the bond VTXO belongs to a
 * different VtxoScript (the bond address) not tracked by the sender's wallet.
 */
async function queryBondVtxoOutpoint(
  wallet: Wallet,
  jurorPubkeyHex: string
): Promise<string | null> {
  const jurorPubkeyBytes = hex.decode(jurorPubkeyHex);
  const bondPkScriptHex = hex.encode(
    buildJurorBondScript(jurorPubkeyBytes).pkScript
  );
  const { vtxos } = await wallet.indexerProvider.getVtxos({
    scripts: [bondPkScriptHex],
    spendableOnly: true
  });
  const found = vtxos.find((v) => v.script === bondPkScriptHex);
  if (!found) return null;
  return `${found.txid}:${found.vout}`;
}

/**
 * Probe the indexer for an existing bond VTXO immediately after the wallet is
 * built.  Used in two scenarios:
 *
 *  A) Page reload with localStorage intact — the step is 'bond-sent'/'ready'
 *     but bondVtxoOutpoint is missing from memory; restore it from the cache
 *     or by re-querying the indexer.
 *
 *  B) User imports an existing seed after localStorage wipe — detect that a
 *     bond was already sent with this seed and skip the full deposit flow.
 *
 * Side-effects when a VTXO is found:
 *   • Sets arkWalletState.bondVtxoOutpoint
 *   • Persists the outpoint to localStorage via saveBondVtxoOutpoint()
 *   • Advances the step to 'bond-sent' (caller may further advance to 'ready')
 *
 * Returns true when a bond VTXO was found, false otherwise.
 */
async function probeExistingBondVtxo(
  wallet: Wallet,
  jurorPubkeyHex: string
): Promise<boolean> {
  // Fast path: use the cached outpoint if available and skip the network call.
  const cached = storedBondVtxoOutpoint();
  if (cached) {
    arkWalletState.bondVtxoOutpoint = cached;
    return true;
  }

  try {
    const outpoint = await queryBondVtxoOutpoint(wallet, jurorPubkeyHex);
    if (outpoint) {
      arkWalletState.bondVtxoOutpoint = outpoint;
      saveBondVtxoOutpoint(outpoint);
      return true;
    }
  } catch {
    // Indexer unreachable — non-fatal; caller will stay on the current step.
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the wallet.
 *
 * Decision tree on open:
 *
 * 1. No mnemonic in localStorage → generate a fresh one, show needs-backup.
 *
 * 2. Mnemonic present + stored step is 'funded', 'bond-sent', or 'ready'
 *    → The user already deposited and onboarded. Build the wallet locally
 *      (deterministic, no network) and derive only the juror pubkey so that
 *      sendBond / the bond address can be re-derived on demand.  We DO NOT
 *      call arkProvider.getInfo() here because that network round-trip to the
 *      Arkade operator is no longer needed at these stages and could hit rate
 *      limits on repeated modal opens.
 *
 * 3. Mnemonic present + stored step is 'boarding' or 'boarding-pending'
 *    → The user already passed backup and made (or is waiting for) a deposit.
 *      Build the wallet and call deriveWalletMeta() (which includes getInfo())
 *      to restore the boarding address and bond address — both needed on this
 *      screen.
 *
 * 4. Mnemonic present + no valid stored step (or 'needs-backup')
 *    → Treat as a fresh wallet that still needs backup confirmation; skip all
 *      network calls and show the backup screen again.
 */
export async function initWallet(): Promise<void> {
  clearError();
  arkWalletState.loading = true;

  try {
    const existing = storedMnemonic();

    if (!existing) {
      // Case 1 — brand-new wallet.
      const phrase = generateMnemonic(wordlist, 128); // 12 words
      saveMnemonic(phrase);
      saveStep('needs-backup');
      arkWalletState.mnemonic = phrase;
      arkWalletState.step = 'needs-backup';
    } else {
      const resumeStep = storedStep();

      if (
        resumeStep === 'funded' ||
        resumeStep === 'bond-sent' ||
        resumeStep === 'ready'
      ) {
        // Case 2 — already past the deposit phase.  Restore the wallet
        // identity locally (no network) so downstream functions like
        // sendBond() that need _wallet will work.  The bond address is
        // derived on-demand in ensureBondAddress() when sendBond is actually
        // called; we skip getInfo() here to avoid an unnecessary round-trip.
        _wallet = await buildWallet(existing);
        const pubkeyBytes = await _wallet.identity.xOnlyPublicKey();
        const pubkeyHex = hex.encode(pubkeyBytes);
        arkWalletState.jurorPubkeyHex = pubkeyHex;
        arkWalletState.step = resumeStep;

        // Restore the bond VTXO outpoint from localStorage or the indexer so
        // the juror page can display it immediately without the user having to
        // open the registration modal.
        if (resumeStep === 'bond-sent' || resumeStep === 'ready') {
          // probeExistingBondVtxo is fire-and-forget here; failure is
          // non-fatal — the outpoint can be re-queried when the modal opens.
          probeExistingBondVtxo(_wallet, pubkeyHex).catch(() => {});
        }
      } else if (
        resumeStep === 'boarding' ||
        resumeStep === 'boarding-pending'
      ) {
        // Case 3 — deposit in progress; the boarding address is still shown
        // on screen so we need the full meta including the bond address.
        _wallet = await buildWallet(existing);
        const { boardingAddress, pubkeyHex, bondAddr } =
          await deriveWalletMeta(_wallet);
        arkWalletState.boardingAddress = boardingAddress;
        arkWalletState.jurorPubkeyHex = pubkeyHex;
        arkWalletState.bondAddress = bondAddr;
        arkWalletState.step = resumeStep;
      } else {
        // Case 4 — mnemonic exists but backup was never confirmed (or step
        // storage was cleared).  Show the backup screen again without any
        // network calls.
        arkWalletState.mnemonic = existing;
        saveStep('needs-backup');
        arkWalletState.step = 'needs-backup';
      }
    }
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Failed to initialise wallet'
    );
    return;
  }

  arkWalletState.loading = false;
}

/**
 * Called after the user confirms they have backed up the mnemonic.
 * Builds the wallet and advances to the boarding step.
 */
export async function confirmBackup(): Promise<void> {
  clearError();
  arkWalletState.loading = true;

  const phrase = arkWalletState.mnemonic ?? storedMnemonic();
  if (!phrase) {
    setError('No mnemonic found. Please restart the flow.');
    return;
  }

  try {
    _wallet = await buildWallet(phrase);
    const { boardingAddress, pubkeyHex, bondAddr } =
      await deriveWalletMeta(_wallet);
    arkWalletState.boardingAddress = boardingAddress;
    arkWalletState.jurorPubkeyHex = pubkeyHex;
    arkWalletState.bondAddress = bondAddr;
    // Clear mnemonic from reactive state; it remains in localStorage only.
    arkWalletState.mnemonic = null;

    // If a bond VTXO already exists for this seed (e.g. re-confirming backup
    // after a partial wipe), skip straight to 'bond-sent' instead of boarding.
    const hasBond = await probeExistingBondVtxo(_wallet, pubkeyHex);
    if (hasBond) {
      arkWalletState.step = 'bond-sent';
      saveStep('bond-sent');
    } else {
      arkWalletState.step = 'boarding';
      saveStep('boarding');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to build wallet');
    return;
  }

  arkWalletState.loading = false;
}

/**
 * Refresh balance and auto-advance state where possible.
 *
 * If `_wallet` is null (e.g. after a network error during `initWallet()` that
 * left the step stored but the in-memory wallet unset), we attempt to rebuild
 * it from the stored mnemonic before proceeding rather than silently bailing.
 */
export async function refreshBalance(): Promise<void> {
  clearError();
  arkWalletState.loading = true;

  try {
    // Re-hydrate the wallet if the in-memory instance was lost (e.g. after a
    // failed initWallet() call or a page reload that left step in localStorage
    // but _wallet unset because the modal was never fully re-opened).
    if (!_wallet) {
      const phrase = storedMnemonic();
      if (!phrase) {
        setError(
          'Wallet not initialised. Please close and reopen this dialog.'
        );
        return;
      }
      try {
        _wallet = await buildWallet(phrase);
        const { boardingAddress, pubkeyHex, bondAddr } =
          await deriveWalletMeta(_wallet);
        arkWalletState.boardingAddress = boardingAddress;
        arkWalletState.jurorPubkeyHex = pubkeyHex;
        arkWalletState.bondAddress = bondAddr;
      } catch (initErr) {
        setError(
          initErr instanceof Error
            ? initErr.message
            : 'Failed to reconnect wallet. Check your network connection and try again.'
        );
        return;
      }
    }

    const balance = await _wallet.getBalance();
    arkWalletState.balance = balance;

    if (arkWalletState.step === 'boarding' && balance.boarding.total > 0) {
      arkWalletState.step = 'boarding-pending';
      saveStep('boarding-pending');
    }

    if (
      arkWalletState.step === 'boarding-pending' &&
      balance.boarding.confirmed > 0
    ) {
      await onboard();
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to refresh balance');
  } finally {
    // Only clear loading if onboard() didn't already take over (onboard sets
    // and clears loading itself); guard against double-clear by checking the
    // step — onboard() sets loading = false on its own exit path.
    if (arkWalletState.loading) {
      arkWalletState.loading = false;
    }
  }
}

/**
 * Convert confirmed boarding UTXOs into VTXOs via Ark settle.
 */
export async function onboard(): Promise<void> {
  if (!_wallet) return;
  clearError();
  arkWalletState.loading = true;

  try {
    const ramps = new Ramps(_wallet);
    await ramps.onboard({ intentFee: {}, txFeeRate: '1' });

    const balance = await _wallet.getBalance();
    arkWalletState.balance = balance;

    if (balance.available >= MIN_JUROR_BOND_SATS) {
      arkWalletState.step = 'funded';
      saveStep('funded');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Onboard failed');
    return;
  }

  arkWalletState.loading = false;
}

/**
 * Lazily resolve the bond address when it has not been populated yet (e.g.
 * because initWallet() skipped getInfo() for a resumed 'funded' session).
 * This is the only place we make the deferred Arkade operator call.
 */
async function ensureBondAddress(): Promise<void> {
  if (arkWalletState.bondAddress || !_wallet) return;
  const { boardingAddress, pubkeyHex, bondAddr } =
    await deriveWalletMeta(_wallet);
  arkWalletState.boardingAddress = boardingAddress;
  arkWalletState.jurorPubkeyHex = pubkeyHex;
  arkWalletState.bondAddress = bondAddr;
}

/**
 * Send the bond amount to the juror bond Ark address.
 */
export async function sendBond(bondAmountSats: number): Promise<void> {
  if (!_wallet) return;
  clearError();
  arkWalletState.loading = true;

  // Lazily fetch bond address if it was skipped during wallet restore.
  try {
    await ensureBondAddress();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Failed to derive bond address'
    );
    return;
  }

  const bondAddress = arkWalletState.bondAddress;
  if (!bondAddress) {
    setError('Bond address not available. Re-initialise the wallet.');
    return;
  }

  try {
    await _wallet.send({ address: bondAddress, amount: bondAmountSats });
    const balance = await _wallet.getBalance();
    arkWalletState.balance = balance;

    // Advance the step immediately so the UI unblocks.
    arkWalletState.step = 'bond-sent';
    saveStep('bond-sent');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Send bond failed');
    return;
  }

  arkWalletState.loading = false;

  // Resolve the VTXO outpoint asynchronously with retries.
  // We do this after advancing the step so the user sees the confirmation
  // banner straight away. The "Publish registration" button remains disabled
  // until bondVtxoOutpoint is populated.
  resolveBondVtxo().catch(() => {
    // resolveBondVtxo sets arkWalletState.error itself; swallow here so the
    // unhandled-rejection handler is not triggered.
  });
}

// ---------------------------------------------------------------------------
// VTXO resolution (with retry)
// ---------------------------------------------------------------------------

/**
 * Retry delays between attempts (milliseconds).
 * Gives the Ark server time to index the freshly-sent VTXO.
 *
 * The Arkade SDK runs a background settle loop that participates in Ark rounds
 * (~30 s each on mutinynet). If the first round fails (e.g. "not enough intent
 * confirmations received"), the SDK retries automatically in the next round.
 * We therefore need to wait long enough to cover at least two full rounds.
 *
 * Total worst-case wait: 2000 + 3000 + 5000 + 10000 + 15000 + 20000 = 55 000 ms (~55 s).
 */
const VTXO_RETRY_DELAYS_MS = [2000, 3000, 5000, 10000, 15000, 20000];

/**
 * Try to find the bond VTXO on the Ark indexer, retrying with increasing
 * delays if the server hasn't indexed it yet.
 *
 * Queries the indexer by pkScript (not wallet.getVtxos()) because the bond
 * VTXO belongs to the bond address — a separate VtxoScript from the sender's
 * wallet — and therefore never appears in the wallet's own VTXO list.
 *
 * Sets arkWalletState.bondVtxoOutpoint and persists it to localStorage on
 * success.  Sets arkWalletState.error (non-fatal) if all attempts fail.
 */
export async function resolveBondVtxo(): Promise<void> {
  if (!_wallet || !arkWalletState.jurorPubkeyHex) return;

  const pubkeyHex = arkWalletState.jurorPubkeyHex;

  const attempt = async (): Promise<boolean> => {
    const outpoint = await queryBondVtxoOutpoint(_wallet!, pubkeyHex);
    if (outpoint) {
      arkWalletState.bondVtxoOutpoint = outpoint;
      saveBondVtxoOutpoint(outpoint);
      // Clear any prior "not indexed" warning.
      if (arkWalletState.error?.startsWith('Bond VTXO not yet indexed')) {
        arkWalletState.error = null;
      }
      return true;
    }
    return false;
  };

  // First attempt immediately.
  try {
    if (await attempt()) return;
  } catch {
    // Network hiccup — fall through to retries.
  }

  // Subsequent attempts with delays.
  for (const delay of VTXO_RETRY_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      if (await attempt()) return;
    } catch {
      // Continue retrying.
    }
  }

  // All attempts exhausted — surface a soft warning.
  arkWalletState.error =
    'Bond VTXO not yet indexed — the Ark server may still be processing your transaction. ' +
    'Wait ~30 s for the next round and click "Retry VTXO lookup", or it will resolve automatically.';
}

/** Mark the wallet as fully ready (call after publishing Nostr registration). */
export function markReady(): void {
  arkWalletState.step = 'ready';
  saveStep('ready');
}
/**
 * Import an existing BIP-39 mnemonic instead of using the freshly generated one.
 *
 * Validates the phrase, saves it to localStorage (overwriting any generated
 * phrase), then immediately builds the wallet and advances to 'boarding' —
 * skipping the seed-backup verification step because the user has demonstrated
 * they already know the phrase by typing it in.
 */
export async function importWallet(phrase: string): Promise<void> {
  clearError();

  const normalised = phrase.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalised, wordlist)) {
    setError('Invalid seed phrase. Please check each word and try again.');
    return;
  }

  arkWalletState.loading = true;

  saveMnemonic(normalised);
  // Keep mnemonic in reactive state null — user typed it, no need to display it.
  arkWalletState.mnemonic = null;

  try {
    _wallet = await buildWallet(normalised);
    const { boardingAddress, pubkeyHex, bondAddr } =
      await deriveWalletMeta(_wallet);
    arkWalletState.boardingAddress = boardingAddress;
    arkWalletState.jurorPubkeyHex = pubkeyHex;
    arkWalletState.bondAddress = bondAddr;

    // If the imported seed already has a bond VTXO on the indexer (e.g. the
    // user is restoring after a localStorage wipe), jump straight to
    // 'bond-sent' so they can publish their registration without re-depositing.
    const hasBond = await probeExistingBondVtxo(_wallet, pubkeyHex);
    if (hasBond) {
      arkWalletState.step = 'bond-sent';
      saveStep('bond-sent');
    } else {
      arkWalletState.step = 'boarding';
      saveStep('boarding');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to import wallet');
    return;
  }

  arkWalletState.loading = false;
}

/** Reset wallet state and clear all persisted wallet keys from localStorage. */
export function resetWalletState(): void {
  _wallet = null;
  arkWalletState.step = 'uninitialised';
  arkWalletState.mnemonic = null;
  arkWalletState.boardingAddress = null;
  arkWalletState.balance = null;
  arkWalletState.jurorPubkeyHex = null;
  arkWalletState.bondAddress = null;
  arkWalletState.bondVtxoOutpoint = null;
  arkWalletState.error = null;
  arkWalletState.loading = false;
  // clearStoredStep() also removes BOND_VTXO_STORAGE_KEY (see its definition).
  clearStoredStep();
}
