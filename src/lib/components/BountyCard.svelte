<script lang="ts">
  import { formatSats } from '$lib/format';
  import { resolve } from '$app/paths';
  import type { Bounty, BountyStatus } from '$lib/types/bounty';

  interface Props {
    bounty: Bounty;
  }

  let { bounty }: Props = $props();

  const statusBadge: Record<BountyStatus, { label: string; classes: string }> =
    {
      open: {
        label: 'Open',
        classes: 'border-green-800 bg-green-900/50 text-green-400'
      },
      'in-progress': {
        label: 'In Progress',
        classes: 'border-bitcoin-800 bg-bitcoin-900/50 text-bitcoin-400'
      },
      'in-dispute': {
        label: 'In Dispute',
        classes: 'border-red-800 bg-red-900/50 text-red-400'
      },
      claimed: {
        label: 'Claimed',
        classes: 'border-surface-500 bg-surface-600 text-gray-400'
      },
      cancelled: {
        label: 'Cancelled',
        classes: 'border-surface-500 bg-surface-600 text-gray-500'
      }
    };
</script>

<a
  href={resolve(`/bounties/${bounty.id}`)}
  class="rounded-xl border border-surface-600 bg-surface-800 p-5 transition-colors hover:border-bitcoin-500/60"
>
  <article>
    <div class="flex items-center justify-between gap-2">
      <span
        class="rounded-full border px-2 py-0.5 text-xs font-medium {statusBadge[
          bounty.status
        ].classes}"
      >
        {statusBadge[bounty.status].label}
      </span>
      <span class="text-lg font-bold text-bitcoin-400">
        {formatSats(bounty.amountSats)}
      </span>
    </div>
    <h2 class="mt-3 text-base font-semibold text-gray-100">{bounty.title}</h2>
    {#if bounty.tags.length > 0}
      <ul class="mt-3 flex flex-wrap gap-1.5">
        {#each bounty.tags as tag (tag)}
          <li
            class="rounded-md border border-surface-600 bg-surface-700 px-2 py-0.5 text-xs text-gray-400"
          >
            #{tag}
          </li>
        {/each}
      </ul>
    {/if}
  </article>
</a>
