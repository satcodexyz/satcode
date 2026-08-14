<script lang="ts">
  import BountyCard from '$lib/components/BountyCard.svelte';
  import { getBounties } from '$lib/mock/bounties';

  // TODO: Replace with NDK-based fetching:
  // import { getBounties } from '$lib/services/bounties';

  const bounties = getBounties();
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
    {#each bounties as bounty (bounty.id)}
      <BountyCard {bounty} />
    {/each}
  </div>
</main>
