/**
 * jurorBond.ts
 *
 * Builds the two-leaf Taproot script that locks a juror's bond:
 *
 *   Leaf A — Juror voluntary withdrawal (after CSV lock period)
 *     <juror_pubkey> CHECKSIG
 *     <bond_lockup_period> CHECKSEQUENCEVERIFY
 *
 *   Leaf B — Governance slash (2-of-3 multisig, no timelock)
 *     <gov_key_1> CHECKSIGADD
 *     <gov_key_2> CHECKSIGADD
 *     <gov_key_3> CHECKSIGADD
 *     OP_2 OP_GREATERTHANOREQUAL
 *
 * Leaf A is built with the SDK's `CSVMultisigTapscript` helper.
 * Leaf B is built with raw `Script.encode` from @scure/btc-signer because
 * the SDK has no k-of-n helper that omits the server key.
 */

import { CSVMultisigTapscript, VtxoScript, networks } from '@arkade-os/sdk';
import { Script, OP } from '@scure/btc-signer';
import { hex } from '@scure/base';
import { BOND_LOCKUP_SECONDS, GOVERNANCE_PUBKEYS } from './config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a hex string into a Uint8Array. */
function fromHex(h: string): Uint8Array {
  return hex.decode(h);
}

// ---------------------------------------------------------------------------
// Bond script builder
// ---------------------------------------------------------------------------

/**
 * Build a two-leaf `VtxoScript` for the juror bond.
 *
 * @param jurorXOnlyPubkey - 32-byte x-only pubkey (Taproot key) of the juror.
 * @returns `VtxoScript` whose `.address(hrp, serverPubKey)` gives the Ark
 *          address and whose `.pkScript` is the on-chain Taproot output script.
 */
export function buildJurorBondScript(jurorXOnlyPubkey: Uint8Array): VtxoScript {
  // -------------------------------------------------------------------------
  // Leaf A — CSV exit (juror can withdraw after lock period unilaterally)
  // -------------------------------------------------------------------------
  const leafA = CSVMultisigTapscript.encode({
    pubkeys: [jurorXOnlyPubkey],
    timelock: { type: 'seconds', value: BOND_LOCKUP_SECONDS }
  });

  // -------------------------------------------------------------------------
  // Leaf B — 2-of-3 governance slash (no timelock)
  //
  // Script:
  //   <gov1> CHECKSIGADD  <gov2> CHECKSIGADD  <gov3> CHECKSIGADD
  //   OP_2 OP_GREATERTHANOREQUAL
  // -------------------------------------------------------------------------
  const [g1, g2, g3] = GOVERNANCE_PUBKEYS.map(fromHex);

  const leafBScript = Script.encode([
    g1,
    'CHECKSIGADD',
    g2,
    'CHECKSIGADD',
    g3,
    'CHECKSIGADD',
    OP.OP_2,
    'GREATERTHANOREQUAL'
  ]);

  return new VtxoScript([leafA.script, leafBScript]);
}

/**
 * Derive the Ark off-chain address for the bond script.
 *
 * @param jurorXOnlyPubkey - 32-byte x-only pubkey of the juror.
 * @param serverXOnlyPubkey - 32-byte x-only server pubkey from ArkInfo.
 * @returns Bech32m-encoded Ark address string.
 */
export function jurorBondArkAddress(
  jurorXOnlyPubkey: Uint8Array,
  serverXOnlyPubkey: Uint8Array
): string {
  const vtxoScript = buildJurorBondScript(jurorXOnlyPubkey);
  return vtxoScript.address(networks.mutinynet.hrp, serverXOnlyPubkey).encode();
}

/**
 * Verify that a bond output is for the expected juror and governance keys.
 * Returns true if the pkScript of the built bond matches the provided script.
 *
 * @param pkScriptHex - Hex-encoded pkScript to check.
 * @param jurorXOnlyPubkey - 32-byte x-only juror pubkey.
 */
export function verifyBondPkScript(
  pkScriptHex: string,
  jurorXOnlyPubkey: Uint8Array
): boolean {
  const expected = buildJurorBondScript(jurorXOnlyPubkey).pkScript;
  const actual = fromHex(pkScriptHex);
  if (expected.length !== actual.length) return false;
  return expected.every((b, i) => b === actual[i]);
}
