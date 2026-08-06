<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { formatSats } from '$lib/format';
  import {
    getBounty,
    getComments,
    getProfile,
    shortPubkey
  } from '$lib/mock/bounties';
  import type { Bounty, BountyComment } from '$lib/types/bounty';

  // TODO: Replace mock imports with NDK-based fetching:
  // import { getBounty, getComments, getProfile, shortPubkey } from '$lib/services/bounties';

  const isLoggedIn = false;

  const bounty: Bounty | null = $derived(getBounty(page.params.id ?? ''));
  const comments: BountyComment[] = $derived(
    bounty ? getComments(bounty.id) : []
  );

  const statusLabel: Record<string, string> = {
    open: 'Open',
    'in-progress': 'In Progress',
    'in-dispute': 'In Dispute',
    claimed: 'Claimed',
    cancelled: 'Cancelled'
  };

  const statusClass: Record<string, string> = {
    open: 'rounded-full border px-2 py-0.5 text-xs font-medium border-green-800 bg-green-900/50 text-green-400',
    'in-progress':
      'rounded-full border px-2 py-0.5 text-xs font-medium border-bitcoin-800 bg-bitcoin-900/50 text-bitcoin-400',
    'in-dispute':
      'rounded-full border px-2 py-0.5 text-xs font-medium border-red-800 bg-red-900/50 text-red-400',
    claimed:
      'rounded-full border px-2 py-0.5 text-xs font-medium border-surface-500 bg-surface-600 text-gray-400',
    cancelled:
      'rounded-full border px-2 py-0.5 text-xs font-medium border-surface-500 bg-surface-600 text-gray-500'
  };

  function timeAgo(ts: number): string {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  let commentText = $state('');
</script>

<svelte:head>
  <title>{bounty?.title ?? 'Bounty'} — Satcode</title>
</svelte:head>

{#if !bounty}
  <div class="py-20 text-center text-gray-500">
    <p class="text-lg font-medium">Bounty not found</p>
    <a
      href={resolve('/')}
      class="mt-3 inline-block text-sm text-bitcoin-400 hover:text-bitcoin-300"
      >← Back to bounties</a
    >
  </div>
{:else}
  {@const makerProfile = getProfile(bounty.makerPubkey)}
  <div class="mx-auto max-w-3xl px-4 py-8">
    <!-- Back link -->
    <a
      href={resolve('/')}
      class="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      All bounties
    </a>

    <!-- Header card -->
    <div class="mb-6 rounded-xl border border-surface-600 bg-surface-800 p-6">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class={statusClass[bounty.status]}
            >{statusLabel[bounty.status]}</span
          >
          {#if bounty.resolutionMode === 'B'}
            <span
              class="rounded-full border border-purple-800 bg-purple-900/50 px-2 py-0.5 text-xs font-medium text-purple-400"
            >
              Mode B · Oracle
            </span>
          {:else}
            <span
              class="rounded-full border border-blue-700 bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-50"
            >
              Mode A · Juror
            </span>
          {/if}
        </div>
        <span class="text-2xl font-bold text-bitcoin-400"
          >{formatSats(bounty.amountSats)}</span
        >
      </div>

      <h1 class="mb-4 text-2xl font-bold text-gray-100">{bounty.title}</h1>

      <!-- Meta row -->
      <div class="mb-5 flex flex-wrap items-center gap-4 text-sm text-gray-400">
        <div class="flex items-center gap-2">
          {#if makerProfile?.picture}
            <img
              src={makerProfile.picture}
              alt={makerProfile.displayName ?? 'maker'}
              class="h-5 w-5 rounded-full"
            />
          {/if}
          <span
            >Posted by <strong class="text-gray-300"
              >{makerProfile?.displayName ??
                shortPubkey(bounty.makerPubkey)}</strong
            ></span
          >
        </div>
        <span>·</span>
        <span>{timeAgo(bounty.createdAt)}</span>
        {#if bounty.checkInIntervalDays > 0}
          <span>·</span>
          <span>Check-in every {bounty.checkInIntervalDays}d</span>
        {/if}
      </div>

      <!-- Tags -->
      {#if bounty.tags.length > 0}
        <div class="mb-5 flex flex-wrap gap-1.5">
          {#each bounty.tags as tag (tag)}
            <span
              class="rounded-md border border-surface-600 bg-surface-700 px-2 py-0.5 text-xs text-gray-400"
            >
              #{tag}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Description (rendered as pre-formatted markdown-ish text) -->
      <div class="prose-bounty">
        {#each bounty.description.split('\n') as line, index (index)}
          {#if line.startsWith('## ')}
            <h2>{line.slice(3)}</h2>
          {:else if line.startsWith('# ')}
            <h1>{line.slice(2)}</h1>
          {:else if line.startsWith('- [ ] ')}
            <div class="checklist-item unchecked">☐ {line.slice(6)}</div>
          {:else if line.startsWith('- [x] ')}
            <div class="checklist-item checked">☑ {line.slice(6)}</div>
          {:else if line.startsWith('- ')}
            <div class="list-item">{line.slice(2)}</div>
          {:else if line.trim() === ''}
            <div class="spacer"></div>
          {:else}
            <p>{line}</p>
          {/if}
        {/each}
      </div>

      <!-- Dispute banner -->
      {#if bounty.status === 'in-dispute'}
        <div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
          <div class="flex items-start gap-3">
            <svg
              class="mt-0.5 h-5 w-5 shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-red-300">
                This bounty is in dispute
              </p>
              <p class="mt-1 text-xs text-gray-400">
                A 5-juror panel has been selected randomly. Evidence has been
                submitted and votes are being tallied.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <!-- CTA -->
      {#if bounty.status === 'open'}
        <div class="mt-6 border-t border-surface-600 pt-5">
          <button
            class={isLoggedIn
              ? 'rounded-lg bg-bitcoin-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-bitcoin-600'
              : 'cursor-not-allowed rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white opacity-50 transition-colors'}
            disabled={!isLoggedIn}
          >
            Accept Bounty
          </button>
          {#if !isLoggedIn}
            <p class="mt-3 text-sm text-gray-400">
              <a
                href={resolve('/')}
                class="text-bitcoin-400 hover:text-bitcoin-300"
                >Login with Nostr</a
              >
              to accept this bounty.
            </p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Comments / Thread -->
    <section>
      <h2 class="mb-4 text-lg font-semibold text-gray-200">
        Discussion
        {#if comments.length > 0}
          <span class="ml-2 text-sm font-normal text-gray-500"
            >({comments.length})</span
          >
        {/if}
      </h2>

      {#if comments.length === 0}
        {#if bounty.status === 'claimed'}
          <p class="text-sm text-gray-500">
            There is no comments in this discussion.
          </p>
        {:else}
          <p class="text-sm text-gray-500">
            No comments yet. Be the first to ask a question.
          </p>
        {/if}
      {:else}
        <div class="space-y-3">
          {#each comments.filter((c) => !c.replyToId) as comment (comment.id)}
            {@const commentProfile = getProfile(comment.pubkey)}
            <div
              class="rounded-xl border border-surface-600 bg-surface-800 p-4"
            >
              <div class="mb-2 flex items-center gap-2 text-xs text-gray-500">
                {#if commentProfile?.picture}
                  <img
                    src={commentProfile.picture}
                    alt={commentProfile.displayName ?? 'user'}
                    class="h-5 w-5 rounded-full"
                  />
                {/if}
                <span class="font-medium text-gray-300"
                  >{commentProfile?.displayName ??
                    shortPubkey(comment.pubkey)}</span
                >
                <span>·</span>
                <span>{timeAgo(comment.createdAt)}</span>
              </div>
              <p class="text-sm text-gray-300">{comment.content}</p>

              <!-- Replies -->
              {#each comments.filter((r) => r.replyToId === comment.id) as reply (reply.id)}
                {@const replyProfile = getProfile(reply.pubkey)}
                <div class="mt-3 border-l-2 border-surface-600 pl-4">
                  <div
                    class="mb-1 flex items-center gap-2 text-xs text-gray-500"
                  >
                    {#if replyProfile?.picture}
                      <img
                        src={replyProfile.picture}
                        alt={replyProfile.displayName ?? 'user'}
                        class="h-4 w-4 rounded-full"
                      />
                    {/if}
                    <span class="font-medium text-gray-300"
                      >{replyProfile?.displayName ??
                        shortPubkey(reply.pubkey)}</span
                    >
                    <span>·</span>
                    <span>{timeAgo(reply.createdAt)}</span>
                  </div>
                  <p class="text-sm text-gray-400">{reply.content}</p>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Comment input -->
      <div class="mt-5">
        {#if isLoggedIn}
          <div class="rounded-xl border border-surface-600 bg-surface-800 p-4">
            <label
              for="comment-input"
              class="mb-2 block text-sm font-medium text-gray-300"
            >
              Add a comment
            </label>
            <textarea
              id="comment-input"
              bind:value={commentText}
              rows="3"
              placeholder="Ask a question or leave a note…"
              class="w-full resize-none rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-bitcoin-500 focus:outline-none"
            ></textarea>
            <div class="mt-3 flex justify-end">
              <button
                disabled={!commentText.trim()}
                class="rounded-lg bg-bitcoin-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-bitcoin-600 disabled:opacity-50"
                onclick={() => {
                  commentText = '';
                }}
              >
                Post Comment
              </button>
            </div>
          </div>
        {:else}
          <p class="text-sm text-gray-500">
            <a
              href={resolve('/')}
              class="text-bitcoin-400 hover:text-bitcoin-300"
              >Login with Nostr</a
            >
            to join the discussion.
          </p>
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .prose-bounty :global(h1) {
    margin-bottom: 0.5rem;
    margin-top: 1.25rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: rgb(243 244 246);
  }
  .prose-bounty :global(h2) {
    margin-bottom: 0.5rem;
    margin-top: 1.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: rgb(229 231 235);
  }
  .prose-bounty :global(p) {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.625;
    color: rgb(209 213 219);
  }
  .prose-bounty :global(.checklist-item) {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: rgb(209 213 219);
  }
  .prose-bounty :global(.checklist-item.checked) {
    color: rgb(107 114 128);
    text-decoration: line-through;
  }
  .prose-bounty :global(.list-item) {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: rgb(209 213 219);
  }
  .prose-bounty :global(.spacer) {
    height: 0.5rem;
  }
</style>
