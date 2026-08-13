<script lang="ts">
  import JurorCard from '$lib/components/JurorCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { authState, login } from '$lib/auth.svelte';
  import { formatSats } from '$lib/format';
  import type { Juror } from '$lib/types/juror';
  import { ndk } from '$lib/ndk';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import {
    arkWalletState,
    initWallet,
    confirmBackup,
    refreshBalance,
    sendBond,
    markReady
  } from '$lib/arkWallet.svelte';
  import { MIN_JUROR_BOND_SATS } from '$lib/config';

  // Mock data — replaced by live Nostr (kind:30060) queries in a later task
  const jurors: Juror[] = [
    {
      nostrPubkey:
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      displayName: 'rustacean',
      bondAmountSats: 500_000,
      specialisations: ['rust', 'bitcoin', 'cryptography'],
      availability: 'active',
      reputation: {
        totalVotes: 14,
        majorityVotes: 13,
        minorityVotes: 1,
        nonParticipation: 0
      }
    },
    {
      nostrPubkey:
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
      displayName: 'bitplumber',
      bondAmountSats: 250_000,
      specialisations: ['bitcoin', 'lightning', 'c++'],
      availability: 'active',
      reputation: {
        totalVotes: 7,
        majorityVotes: 6,
        minorityVotes: 1,
        nonParticipation: 0
      }
    },
    {
      nostrPubkey:
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
      displayName: 'nostr_dev',
      bondAmountSats: 100_000,
      specialisations: ['typescript', 'nostr'],
      availability: 'active',
      reputation: {
        totalVotes: 3,
        majorityVotes: 3,
        minorityVotes: 0,
        nonParticipation: 0
      }
    },
    {
      nostrPubkey:
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
      displayName: 'zkproof_enjoyer',
      bondAmountSats: 750_000,
      specialisations: ['rust', 'zero-knowledge', 'cryptography'],
      availability: 'inactive',
      reputation: {
        totalVotes: 21,
        majorityVotes: 18,
        minorityVotes: 2,
        nonParticipation: 1
      }
    },
    {
      nostrPubkey:
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
      displayName: 'arkade_builder',
      bondAmountSats: 200_000,
      specialisations: ['bitcoin', 'ark', 'rust'],
      availability: 'active',
      reputation: {
        totalVotes: 0,
        majorityVotes: 0,
        minorityVotes: 0,
        nonParticipation: 0
      }
    }
  ];

  const activeJurors = $derived(
    jurors.filter((j) => j.availability === 'active')
  );
  const totalBondedSats = $derived(
    activeJurors.reduce((sum, j) => sum + j.bondAmountSats, 0)
  );

<<<<<<< HEAD
  // ---------------------------------------------------------------------------
  // Modal / form state
  // ---------------------------------------------------------------------------
  let showModal = $state(false);
  let specialisationsInput = $state('');
  let bondAmountInput = $state<number>(MIN_JUROR_BOND_SATS);
  let mnemonicConfirmed = $state(false);
  let publishing = $state(false);
  let publishError = $state<string | null>(null);
=======
  // Modal state
  let showModal = $state(false);

  // Join form state
  const MIN_BOND = 100_000;
  let bondAmountSats = $state<number | null>(null);
  let signingPubkey = $state('');
  let specialisationsInput = $state('');
>>>>>>> main

  const isLoggedIn = $derived(
    authState.status === 'ready' && authState.user !== null
  );

<<<<<<< HEAD
  // Which progress pill is active (1-based, 4 steps total)
  function getModalStepIndex(): number {
    if (arkWalletState.step === 'needs-backup') return 1;
    if (
      arkWalletState.step === 'boarding' ||
      arkWalletState.step === 'boarding-pending'
    )
      return 2;
    if (arkWalletState.step === 'funded') return 3;
    if (arkWalletState.step === 'bond-sent' || arkWalletState.step === 'ready')
      return 4;
    return 0;
  }
  const modalStepIndex = $derived(getModalStepIndex());

  function getPillClass(i: number): string {
    if (i + 1 < modalStepIndex) return 'bg-bitcoin-500';
    if (i + 1 === modalStepIndex) return 'bg-bitcoin-400';
    return 'bg-surface-600';
  }

  const inputClasses =
    'mt-1 block w-full rounded-md border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-bitcoin-500 focus:outline-none focus:ring-1 focus:ring-bitcoin-500';

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function openModal() {
    showModal = true;
    mnemonicConfirmed = false;
    publishError = null;
    if (arkWalletState.step === 'uninitialised') {
      await initWallet();
    }
  }

  async function handleConfirmBackup() {
    await confirmBackup();
  }

  async function handleRefreshBalance() {
    await refreshBalance();
  }

  async function handleSendBond() {
    await sendBond(bondAmountInput);
  }

  async function handlePublishRegistration() {
    publishError = null;
    publishing = true;
    try {
      if (!isLoggedIn)
        throw new Error('You must be logged in with Nostr to register.');
      const vtxoOutpoint = arkWalletState.bondVtxoOutpoint;
      if (!vtxoOutpoint)
        throw new Error('Bond VTXO outpoint not available yet.');
      const jurorPubkey = arkWalletState.jurorPubkeyHex;
      if (!jurorPubkey) throw new Error('Juror signing pubkey not available.');

      const specs = specialisationsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // d tag: first 32 hex chars of the juror Bitcoin pubkey — deterministic per key
      const dTag = jurorPubkey.slice(0, 32);

      const event = new NDKEvent(ndk());
      event.kind = 30060;
      event.content = '';
      event.tags = [
        ['d', dTag],
        ['juror_signing_pubkey', jurorPubkey],
        ['bond_vtxo', vtxoOutpoint],
        ['bond_amount_sats', String(bondAmountInput)],
        ...(specs.length > 0 ? [['specialisations', ...specs]] : []),
        ['availability', 'active']
      ];
      await event.publish();
      markReady();
    } catch (err) {
      publishError =
        err instanceof Error ? err.message : 'Failed to publish registration.';
    } finally {
      publishing = false;
    }
=======
  const valid = $derived(
    isLoggedIn &&
      bondAmountSats !== null &&
      Number.isInteger(bondAmountSats) &&
      bondAmountSats >= MIN_BOND &&
      signingPubkey.trim().length > 0
  );

  const inputClasses =
    'mt-1 block w-full rounded-md border-surface-500 bg-surface-700 text-sm text-gray-100 placeholder-gray-600 focus:border-bitcoin-500 focus:ring-bitcoin-500';

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault(); // publishing to Nostr (kind:30060) wired up in a later task
    showModal = false;
>>>>>>> main
  }
</script>

<svelte:head>
  <title>SatCode — Juror Registry</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8">
  <!-- Section 1: Active juror pool -->
  <h1 class="text-2xl font-bold text-gray-100">Juror Registry</h1>
  <p class="mt-1 text-sm text-gray-400">
    Staked jurors resolve disputes on subjective bounties. A randomly selected
    panel reviews evidence and votes; the majority verdict releases the escrow.
  </p>

  <!-- Summary stats bar -->
  <div
    class="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-surface-600 bg-surface-600"
  >
    <div class="bg-surface-800 px-5 py-4">
      <p class="text-xs font-medium tracking-wide text-gray-500 uppercase">
        Active jurors
      </p>
      <p class="mt-1 text-2xl font-bold text-gray-100">{activeJurors.length}</p>
    </div>
    <div class="bg-surface-800 px-5 py-4">
      <p class="text-xs font-medium tracking-wide text-gray-500 uppercase">
        Total bonded
      </p>
      <p class="mt-1 text-2xl font-bold text-bitcoin-400">
        {formatSats(totalBondedSats)}
      </p>
    </div>
    <div class="bg-surface-800 px-5 py-4">
      <p class="text-xs font-medium tracking-wide text-gray-500 uppercase">
        Min. bond
      </p>
      <p class="mt-1 text-2xl font-bold text-gray-100">
<<<<<<< HEAD
        {formatSats(MIN_JUROR_BOND_SATS)}
=======
        {formatSats(MIN_BOND)}
>>>>>>> main
      </p>
    </div>
  </div>

  <!-- Juror grid -->
  <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each jurors as juror (juror.nostrPubkey)}
      <JurorCard {juror} />
    {/each}
  </div>

  <!-- Section 2: Join the registry -->
  <div class="mt-14 border-t border-surface-600 pt-10">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-gray-100">Become a Juror</h2>
        <p class="mt-1 text-sm text-gray-400">
<<<<<<< HEAD
          Stake a bond of at least {formatSats(MIN_JUROR_BOND_SATS)} to register as
          juror. You'll earn sats on every dispute you help resolve. Voting without
          reasoning, or missing a vote, may result in a partial bond slash.
=======
          Stake a bond of at least {formatSats(MIN_BOND)} to register as juror. You'll
          earn sats on every dispute you help resolve. Voting without reasoning, or
          missing a vote, may result in a partial bond slash.
>>>>>>> main
        </p>
      </div>
    </div>

    <!-- Info callout -->
    <div
      class="mt-5 rounded-lg border border-surface-600 bg-surface-800 p-4 text-sm text-gray-400"
    >
      <p class="font-medium text-gray-300">How it works</p>
      <ul class="mt-2 list-inside list-disc space-y-1">
        <li>
<<<<<<< HEAD
          Create an Ark vTXO of at least {formatSats(MIN_JUROR_BOND_SATS)} locked
          to a juror bond script.
=======
          Create an Ark vTXO of at least {formatSats(MIN_BOND)} locked to a juror
          bond script.
>>>>>>> main
        </li>
        <li>
          Click <strong class="text-gray-300">Become a juror</strong> and submit your
          registration to Nostr (kind:30060).
        </li>
        <li>You'll be eligible for random selection onto dispute panels.</li>
        <li>Bonds must be refreshed every 30 days to maintain eligibility.</li>
      </ul>
    </div>
    <button
<<<<<<< HEAD
      onclick={openModal}
=======
      onclick={() => (showModal = true)}
>>>>>>> main
      class="mt-4 shrink-0 rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin-500"
    >
      Become a juror
    </button>
  </div>
</main>

<Modal
  open={showModal}
  onClose={() => (showModal = false)}
  labelId="juror-modal-title"
>
  <div class="w-full max-w-lg">
<<<<<<< HEAD
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <h2 id="juror-modal-title" class="text-xl font-bold text-gray-100">
        {arkWalletState.step === 'ready'
          ? '✅ Registered as Juror'
          : 'Become a Juror'}
=======
    <div class="mb-6 flex items-center justify-between gap-4">
      <h2 id="juror-modal-title" class="text-xl font-bold text-gray-100">
        Become a Juror
>>>>>>> main
      </h2>
      <button
        onclick={() => (showModal = false)}
        aria-label="Close"
        class="rounded-md p-1 text-gray-400 transition-colors hover:bg-surface-600 hover:text-gray-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

<<<<<<< HEAD
    <!-- Step progress pills -->
    {#if arkWalletState.step !== 'ready'}
      <div class="mb-6 flex gap-2">
        {#each ['Wallet', 'Deposit', 'Bond', 'Register'] as label, i (label)}
          <div class="flex flex-1 flex-col items-center gap-1">
            <div class="h-1.5 w-full rounded-full {getPillClass(i)}"></div>
            <span
              class="text-xs {i + 1 <= modalStepIndex
                ? 'text-bitcoin-400'
                : 'text-gray-500'}">{label}</span
            >
          </div>
        {/each}
      </div>
    {/if}

    <!-- Error banner -->
    {#if arkWalletState.error}
      <div
        class="mb-4 rounded-md border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-300"
      >
        {arkWalletState.error}
      </div>
    {/if}

    <!-- STEP 0 — Initialising -->
    {#if arkWalletState.step === 'uninitialised'}
      <div class="flex items-center gap-3 text-gray-400">
        <svg
          class="h-5 w-5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          ></path>
        </svg>
        <span>Initialising wallet…</span>
      </div>

      <!-- STEP 1 — Mnemonic backup -->
    {:else if arkWalletState.step === 'needs-backup'}
      <div class="space-y-4">
        <p class="text-sm text-gray-300">
          A fresh Arkade wallet has been generated.
          <strong class="text-gray-100">Write down these 12 words</strong> — they
          are the only way to recover your funds.
        </p>
        <div class="rounded-md border border-surface-500 bg-surface-800 p-4">
          <p
            class="font-mono text-sm leading-relaxed tracking-wide text-bitcoin-300 select-all"
          >
            {arkWalletState.mnemonic}
          </p>
        </div>
        <p class="text-xs text-gray-500">
          The mnemonic is stored in your browser's localStorage. Once you
          confirm, it is cleared from memory.
        </p>
        <label class="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            bind:checked={mnemonicConfirmed}
            class="mt-0.5 h-4 w-4 rounded border-surface-500 bg-surface-700 text-bitcoin-500 focus:ring-bitcoin-500"
          />
          <span class="text-sm text-gray-300"
            >I have written down my recovery phrase and stored it safely.</span
          >
        </label>
        <button
          onclick={handleConfirmBackup}
          disabled={!mnemonicConfirmed || arkWalletState.loading}
          class="w-full rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bitcoin-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {arkWalletState.loading
            ? 'Building wallet…'
            : "I've backed up my phrase →"}
        </button>
      </div>

      <!-- STEP 2 — Boarding -->
    {:else if arkWalletState.step === 'boarding' || arkWalletState.step === 'boarding-pending'}
      <div class="space-y-4">
        <p class="text-sm text-gray-300">
          Send at least <strong class="text-gray-100"
            >{formatSats(MIN_JUROR_BOND_SATS)}</strong
          > to this Bitcoin address. After 1 confirmation it will be onboarded to
          Ark automatically.
        </p>
        {#if arkWalletState.boardingAddress}
          <div>
            <p
              class="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase"
            >
              Boarding address
            </p>
            <div
              class="flex items-center gap-2 rounded-md border border-surface-500 bg-surface-800 px-3 py-2"
            >
              <span class="flex-1 font-mono text-xs break-all text-gray-200"
                >{arkWalletState.boardingAddress}</span
              >
              <button
                onclick={() =>
                  navigator.clipboard.writeText(arkWalletState.boardingAddress!)}
                title="Copy"
                aria-label="Copy boarding address"
                class="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-surface-600 hover:text-gray-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path
                    d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                  />
                </svg>
              </button>
            </div>
          </div>
        {/if}
        {#if arkWalletState.step === 'boarding-pending'}
          <div
            class="flex items-center gap-2 rounded-md border border-yellow-700 bg-yellow-950 px-3 py-2 text-sm text-yellow-300"
          >
            <svg
              class="h-4 w-4 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            Deposit detected — waiting for confirmation and Ark onboarding…
          </div>
        {:else}
          <p class="text-xs text-gray-500">
            Waiting for a deposit to this address…
          </p>
        {/if}
        <button
          onclick={handleRefreshBalance}
          disabled={arkWalletState.loading}
          class="w-full rounded-md border border-surface-500 bg-surface-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {arkWalletState.loading ? 'Checking…' : '↻ Check balance'}
        </button>
      </div>

      <!-- STEP 3 — Bond send -->
    {:else if arkWalletState.step === 'funded'}
      <div class="space-y-4">
        <p class="text-sm text-gray-300">
          Your wallet is funded. Lock your bond into the juror bond script on
          Ark.
        </p>
        {#if arkWalletState.balance}
          <div
            class="rounded-md border border-surface-600 bg-surface-800 px-4 py-3 text-sm"
          >
            <span class="text-gray-400">Available: </span>
            <span class="font-semibold text-gray-100"
              >{formatSats(arkWalletState.balance.available)}</span
            >
          </div>
        {/if}
        <label class="block">
          <span class="text-sm font-medium text-gray-300"
            >Bond amount (sats)</span
          >
          <input
            type="number"
            bind:value={bondAmountInput}
            min={MIN_JUROR_BOND_SATS}
            step={1000}
            class={inputClasses}
          />
          <span class="mt-1 block text-xs text-gray-500"
            >Minimum {formatSats(MIN_JUROR_BOND_SATS)}. Locked in the juror bond
            script.</span
          >
        </label>
        {#if arkWalletState.bondAddress}
          <div>
            <p
              class="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase"
            >
              Bond script address
            </p>
            <p class="font-mono text-xs break-all text-gray-400">
              {arkWalletState.bondAddress}
            </p>
          </div>
        {/if}
        <button
          onclick={handleSendBond}
          disabled={arkWalletState.loading ||
            bondAmountInput < MIN_JUROR_BOND_SATS}
          class="w-full rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bitcoin-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {arkWalletState.loading
            ? 'Sending…'
            : `Lock ${formatSats(bondAmountInput)} as bond →`}
        </button>
      </div>

      <!-- STEP 4 — Publish kind:30060 -->
    {:else if arkWalletState.step === 'bond-sent'}
      <div class="space-y-4">
        <div
          class="flex items-center gap-2 rounded-md border border-green-700 bg-green-950 px-3 py-2 text-sm text-green-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          Bond locked! VTXO:
          <span class="ml-1 font-mono"
            >{arkWalletState.bondVtxoOutpoint ?? '…'}</span
          >
        </div>
        <p class="text-sm text-gray-300">
          Publish your Nostr registration event (kind:30060) to join the juror
          pool.
        </p>
        {#if !isLoggedIn}
          <div
            class="rounded-md border border-surface-500 bg-surface-800 px-4 py-3"
          >
            <p class="mb-2 text-sm text-gray-300">
              You need to be logged in with Nostr to register.
            </p>
            <button
              onclick={login}
              class="rounded-md bg-surface-600 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-surface-500"
            >
              Connect Nostr (NIP-07)
            </button>
          </div>
        {:else}
          <div
            class="rounded-md border border-surface-600 bg-surface-800 px-4 py-3 text-sm"
          >
            <span class="text-gray-400">Signing as: </span>
            <span class="font-mono text-gray-200"
              >{authState.user?.npub?.slice(0, 20)}…</span
            >
          </div>
        {/if}
        <label class="block">
          <span class="text-sm font-medium text-gray-300"
            >Specialisations <span class="font-normal text-gray-500"
              >(optional)</span
            ></span
          >
          <input
            type="text"
            bind:value={specialisationsInput}
            placeholder="rust, bitcoin, cryptography"
            class={inputClasses}
          />
          <span class="mt-1 block text-xs text-gray-500"
            >Comma-separated skill tags for panel matching.</span
          >
        </label>
        {#if publishError}<p class="text-sm text-red-400">
            {publishError}
          </p>{/if}
        <button
          onclick={handlePublishRegistration}
          disabled={!isLoggedIn ||
            publishing ||
            !arkWalletState.bondVtxoOutpoint}
          class="w-full rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bitcoin-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishing ? 'Publishing…' : 'Publish registration →'}
        </button>
      </div>

      <!-- DONE -->
    {:else if arkWalletState.step === 'ready'}
      <div class="space-y-4 text-center">
        <div class="text-5xl">🎉</div>
        <p class="text-lg font-semibold text-gray-100">
          You are registered as a juror!
        </p>
        <p class="text-sm text-gray-400">
          Your bond is locked and your registration event is live on Nostr. You
          may now be selected for dispute panels.
        </p>
        {#if arkWalletState.bondVtxoOutpoint}
          <p class="font-mono text-xs text-gray-500">
            Bond VTXO: {arkWalletState.bondVtxoOutpoint}
          </p>
        {/if}
        <button
          onclick={() => (showModal = false)}
          class="rounded-md bg-surface-600 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-surface-500"
        >
          Close
        </button>
      </div>
    {/if}
=======
    <form class="space-y-5" onsubmit={handleSubmit}>
      <label class="block">
        <span class="text-sm font-medium text-gray-300">Bond amount (sats)</span
        >
        <input
          type="number"
          bind:value={bondAmountSats}
          min={MIN_BOND}
          step="1000"
          required
          placeholder={String(MIN_BOND)}
          class={inputClasses}
        />
        <span class="mt-1 block text-xs text-gray-500">
          Minimum {formatSats(MIN_BOND)}. Must already be locked in an Ark vTXO
          with the juror bond script.
        </span>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-gray-300">
          Bitcoin signing pubkey (hex)
        </span>
        <input
          type="text"
          bind:value={signingPubkey}
          required
          placeholder="02abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678"
          class="{inputClasses} font-mono"
        />
        <span class="mt-1 block text-xs text-gray-500">
          The key used to sign dispute votes and threshold witnesses. Not your
          Nostr key.
        </span>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-gray-300">
          Specialisations
          <span class="font-normal text-gray-500">(optional)</span>
        </span>
        <input
          type="text"
          bind:value={specialisationsInput}
          placeholder="rust, bitcoin, cryptography"
          class={inputClasses}
        />
        <span class="mt-1 block text-xs text-gray-500">
          Comma-separated skill tags used for panel matching.
        </span>
      </label>

      <div>
        {#if !isLoggedIn}
          <p class="mb-3 text-xs text-gray-400">
            You must be logged in with Nostr to register as a juror.
          </p>
        {/if}
        <button
          type="submit"
          disabled={!valid}
          class="rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Register as juror
        </button>
        <p class="mt-2 text-xs text-gray-500">
          Publishing to Nostr isn't wired up yet.
        </p>
      </div>
    </form>
>>>>>>> main
  </div>
</Modal>
