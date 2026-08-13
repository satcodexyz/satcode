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
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hex } from '@scure/base';
import {
  MUTINYNET_ARK_URL,
  MNEMONIC_STORAGE_KEY,
  STEP_STORAGE_KEY,
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
  } catch {
    // ignore
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
        // derived on-demand in deriveAndRestoreBondMeta() when sendBond is
        // actually called; we skip getInfo() here entirely.
        _wallet = await buildWallet(existing);
        const pubkeyBytes = await _wallet.identity.xOnlyPublicKey();
        arkWalletState.jurorPubkeyHex = hex.encode(pubkeyBytes);
        arkWalletState.step = resumeStep;
      } else if (resumeStep === 'boarding' || resumeStep === 'boarding-pending') {
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
    arkWalletState.step = 'boarding';
    saveStep('boarding');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to build wallet');
    return;
  }

  arkWalletState.loading = false;
}

/**
 * Refresh balance and auto-advance state where possible.
 */
export async function refreshBalance(): Promise<void> {
  if (!_wallet) return;
  clearError();

  try {
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

    // Resolve the VTXO outpoint for the bond script so it can be placed in
    // the kind:30060 bond_vtxo tag.
    // getVtxos() returns all VTXOs owned by this wallet; we filter by the
    // bond script's pkScript (hex) to find the one we just created.
    const jurorPubkeyBytes = hex.decode(arkWalletState.jurorPubkeyHex!);
    const bondPkScriptHex = hex.encode(
      buildJurorBondScript(jurorPubkeyBytes).pkScript
    );
    const vtxos = await _wallet.getVtxos();
    const bondVtxo = vtxos.find(
      (v) => !v.isSpent && v.script === bondPkScriptHex
    );
    if (bondVtxo) {
      arkWalletState.bondVtxoOutpoint = `${bondVtxo.txid}:${bondVtxo.vout}`;
    }

    arkWalletState.step = 'bond-sent';
    saveStep('bond-sent');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Send bond failed');
    return;
  }

  arkWalletState.loading = false;
}

/** Mark the wallet as fully ready (call after publishing Nostr registration). */
export function markReady(): void {
  arkWalletState.step = 'ready';
  saveStep('ready');
}

/** Reset wallet state without wiping localStorage (useful for testing). */
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
  clearStoredStep();
}
