<script lang="ts">
  import JurorCard from '$lib/components/JurorCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { authState } from '$lib/auth.svelte';
  import { formatSats } from '$lib/format';
  import type { Juror } from '$lib/types/juror';

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

  // Modal state
  let showModal = $state(false);

  // Join form state
  const MIN_BOND = 100_000;
  let bondAmountSats = $state<number | null>(null);
  let signingPubkey = $state('');
  let specialisationsInput = $state('');

  const isLoggedIn = $derived(
    authState.status === 'ready' && authState.user !== null
  );

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
        {formatSats(MIN_BOND)}
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
          Stake a bond of at least {formatSats(MIN_BOND)} to register as juror. You'll
          earn sats on every dispute you help resolve. Voting without reasoning, or
          missing a vote, may result in a partial bond slash.
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
          Create an Ark vTXO of at least {formatSats(MIN_BOND)} locked to a juror
          bond script.
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
      onclick={() => (showModal = true)}
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
    <div class="mb-6 flex items-center justify-between gap-4">
      <h2 id="juror-modal-title" class="text-xl font-bold text-gray-100">
        Become a Juror
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
  </div>
</Modal>
