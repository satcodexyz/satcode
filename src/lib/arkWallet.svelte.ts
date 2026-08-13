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
  MIN_JUROR_BOND_SATS
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

async function buildWallet(phrase: string): Promise<Wallet> {
  const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
  return Wallet.create({ identity, arkServerUrl: MUTINYNET_ARK_URL });
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
 * - If a mnemonic exists in localStorage, restore it and go to boarding.
 * - Otherwise generate a fresh mnemonic and enter needs-backup.
 */
export async function initWallet(): Promise<void> {
  clearError();
  arkWalletState.loading = true;

  try {
    const existing = storedMnemonic();

    if (existing) {
      _wallet = await buildWallet(existing);
      const { boardingAddress, pubkeyHex, bondAddr } =
        await deriveWalletMeta(_wallet);
      arkWalletState.boardingAddress = boardingAddress;
      arkWalletState.jurorPubkeyHex = pubkeyHex;
      arkWalletState.bondAddress = bondAddr;
      arkWalletState.step = 'boarding';
    } else {
      const phrase = generateMnemonic(wordlist, 128); // 12 words
      saveMnemonic(phrase);
      arkWalletState.mnemonic = phrase;
      arkWalletState.step = 'needs-backup';
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
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Onboard failed');
    return;
  }

  arkWalletState.loading = false;
}

/**
 * Send the bond amount to the juror bond Ark address.
 */
export async function sendBond(bondAmountSats: number): Promise<void> {
  if (!_wallet) return;
  clearError();
  arkWalletState.loading = true;

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
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Send bond failed');
    return;
  }

  arkWalletState.loading = false;
}

/** Mark the wallet as fully ready (call after publishing Nostr registration). */
export function markReady(): void {
  arkWalletState.step = 'ready';
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
}
