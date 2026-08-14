<script lang="ts">
  import { NDKKind } from '@nostr-dev-kit/ndk';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import {
    BOUNTY_KIND,
    BOUNTY_STATUSES,
    parseBountyEvent,
    recordDeletion,
    upsertBounty,
    visibleBounties,
    type Deletion
  } from '$lib/bounty';
  import BountyCard from '$lib/components/BountyCard.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import { ndk } from '$lib/ndk';
  import type { Bounty } from '$lib/types/bounty';

  /** Unreachable relays never send EOSE — stop waiting on them eventually. */
  const RELAY_TIMEOUT_MS = 8000;

  const byAddress = new SvelteMap<string, Bounty>();
  const deletions = new SvelteMap<string, Deletion>();
  let loading = $state(true);

  const bounties = $derived(visibleBounties(byAddress, deletions));

  // onMount rather than $effect: it never runs during SSR (so NDK is only
  // constructed in the browser), never tracks reads, and its return value is
  // the teardown.
  onMount(() => {
    const timeout = setTimeout(() => (loading = false), RELAY_TIMEOUT_MS);

    // One subscription, one EOSE. `#s` keeps other apps' kind-30050 events out
    // of the limit; the deletion filter uses the `k` tag NDKEvent.delete()
    // writes, so it only matches retracted bounties.
    const sub = ndk().subscribe(
      [
        { kinds: [BOUNTY_KIND], '#s': [...BOUNTY_STATUSES], limit: 100 },
        { kinds: [NDKKind.EventDeletion], '#k': [String(BOUNTY_KIND)] }
      ],
      {
        onEvent: (event) => {
          if (event.kind !== BOUNTY_KIND) {
            recordDeletion(event, deletions);
            return;
          }
          const bounty = parseBountyEvent(event);
          if (bounty) upsertBounty(bounty, byAddress);
        },
        onEose: () => (loading = false)
      }
    );

    return () => {
      clearTimeout(timeout);
      sub.stop();
    };
  });
</script>

<svelte:head>
  <title>SatCode — Bounties</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8">
  <h1 class="text-2xl font-bold text-gray-100">Bounties</h1>
  <p class="mt-1 text-sm text-gray-400">
    Software bounties organized on Nostr, paid in Bitcoin.
  </p>
  {#if loading && bounties.length === 0}
    <div class="mt-8 flex justify-center"><Loading /></div>
  {:else if bounties.length === 0}
    <p class="mt-8 text-sm text-gray-400">
      No bounties found on your relays yet.
    </p>
  {:else}
    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each bounties as bounty (bounty.address)}
        <BountyCard {bounty} />
      {/each}
    </div>
  {/if}
</main>
