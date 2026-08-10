<script lang="ts">
  import { formatSats } from '$lib/format';
  import type { Juror, JurorAvailability } from '$lib/types/juror';

  interface Props {
    juror: Juror;
  }

  let { juror }: Props = $props();

  const availabilityBadge: Record<
    JurorAvailability,
    { label: string; classes: string }
  > = {
    active: {
      label: 'Active',
      classes: 'border-green-800 bg-green-900/50 text-green-400'
    },
    inactive: {
      label: 'Inactive',
      classes: 'border-surface-500 bg-surface-600 text-gray-400'
    }
  };

  const initial = $derived(juror.displayName.charAt(0).toUpperCase());

  const majorityRate = $derived(
    juror.reputation.totalVotes > 0
      ? Math.round(
          (juror.reputation.majorityVotes / juror.reputation.totalVotes) * 100
        )
      : null
  );
</script>

<article
  class="rounded-xl border border-surface-600 bg-surface-800 p-5 transition-colors hover:border-bitcoin-500/60"
>
  <!-- Header: avatar + name + availability badge -->
  <div class="flex items-start justify-between gap-3">
    <div class="flex min-w-0 items-center gap-3">
      {#if juror.avatarUrl}
        <img
          src={juror.avatarUrl}
          alt={juror.displayName}
          class="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-surface-500"
        />
      {:else}
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bitcoin-500/20 text-sm font-semibold text-bitcoin-400 ring-1 ring-bitcoin-500/40"
          aria-label={juror.displayName}
        >
          {initial}
        </span>
      {/if}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-gray-100">
          {juror.displayName}
        </p>
        <p class="truncate font-mono text-xs text-gray-500">
          {juror.nostrPubkey.slice(0, 8)}…{juror.nostrPubkey.slice(-4)}
        </p>
      </div>
    </div>
    <span
      class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium {availabilityBadge[
        juror.availability
      ].classes}"
    >
      {availabilityBadge[juror.availability].label}
    </span>
  </div>

  <!-- Bond amount -->
  <div class="mt-4 flex items-center gap-1.5">
    <span class="text-xs text-gray-500">Bond</span>
    <span class="text-sm font-bold text-bitcoin-400">
      {formatSats(juror.bondAmountSats)}
    </span>
  </div>

  <!-- Specialisations -->
  {#if juror.specialisations.length > 0}
    <ul class="mt-3 flex flex-wrap gap-1.5">
      {#each juror.specialisations as tag (tag)}
        <li
          class="rounded-md border border-surface-600 bg-surface-700 px-2 py-0.5 text-xs text-gray-400"
        >
          #{tag}
        </li>
      {/each}
    </ul>
  {/if}

  <!-- Reputation stats -->
  <div
    class="mt-4 flex items-center gap-4 border-t border-surface-600 pt-4 text-xs text-gray-500"
  >
    {#if juror.reputation.totalVotes === 0}
      <span class="italic">No votes yet</span>
    {:else}
      <span title="Total disputes voted on">
        <span class="font-medium text-gray-300"
          >{juror.reputation.totalVotes}</span
        >
        {juror.reputation.totalVotes === 1 ? 'vote' : 'votes'}
      </span>
      {#if majorityRate !== null}
        <span title="Voted with the majority">
          <span class="font-medium text-green-400">{majorityRate}%</span>
          majority
        </span>
      {/if}
      {#if juror.reputation.nonParticipation > 0}
        <span title="Missed votes (slashed)">
          <span class="font-medium text-red-400"
            >{juror.reputation.nonParticipation}</span
          >
          missed
        </span>
      {/if}
    {/if}
  </div>
</article>
