<script lang="ts">
  import BountyCard from '$lib/components/BountyCard.svelte';
  import type { Bounty } from '$lib/types/bounty';

  const bounties: Bounty[] = [
    {
      title: 'Add NIP-57 zap receipts to the bounty feed',
      amountSats: 250000,
      status: 'open',
      tags: ['typescript', 'nostr']
    },
    {
      title: 'Escrow state machine for Arkade multiparty flows',
      amountSats: 1200000,
      status: 'open',
      tags: ['bitcoin', 'escrow']
    },
    {
      title: 'Dark-mode landing page skeleton',
      amountSats: 50000,
      status: 'claimed',
      tags: []
    }
  ];
</script>

<svelte:head>
  <title>SatCode — Bounties</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8">
  <h1 class="text-2xl font-bold text-gray-100">Bounties</h1>
  <p class="mt-1 text-sm text-gray-400">
    Software bounties organized on Nostr, paid in Bitcoin.
  </p>
  <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each bounties as bounty (bounty.title)}
      <BountyCard {bounty} />
    {/each}
  </div>
</main>
