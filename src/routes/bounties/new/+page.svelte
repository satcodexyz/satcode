<script lang="ts">
  import { resolve } from '$app/paths';
  import { authState } from '$lib/auth.svelte';
  import { publishBounty } from '$lib/bounty';

  let title = $state('');
  let description = $state('');
  let amountSats = $state<number | null>(null);
  let deadline = $state(''); // YYYY-MM-DD from the date input
  let topics = $state(''); // comma-separated, optional

  let submitting = $state(false);
  let published = $state(false);
  let publishedTitle = $state('');
  let publishError = $state<string | null>(null);

  // Local "tomorrow" as YYYY-MM-DD, built from local date parts —
  // toISOString() would shift the day for users west of UTC.
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  const minDeadline = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0')
  ].join('-');

  // Fixed-width ISO date strings compare correctly lexicographically,
  // and the empty string always fails the comparison.
  const valid = $derived(
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      amountSats !== null &&
      Number.isInteger(amountSats) &&
      amountSats >= 1 &&
      deadline >= minDeadline
  );
  const loggedIn = $derived(
    authState.status === 'ready' && authState.user !== null
  );

  const inputClasses =
    'mt-1 block w-full rounded-md border-surface-500 bg-surface-700 text-sm text-gray-100 placeholder-gray-600 focus:border-bitcoin-500 focus:ring-bitcoin-500';

  function resetForm() {
    title = '';
    description = '';
    amountSats = null;
    deadline = '';
    topics = '';
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid || !loggedIn || submitting || amountSats === null) return;
    submitting = true;
    publishError = null;
    try {
      await publishBounty({ title, description, amountSats, deadline, topics });
      publishedTitle = title.trim();
      resetForm();
      published = true;
    } catch (err) {
      publishError =
        err instanceof Error ? err.message : 'Failed to publish bounty';
      // Keep the draft so a rejected signature can simply be retried.
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>SatCode — New bounty</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="text-2xl font-bold text-gray-100">New bounty</h1>
  <p class="mt-1 text-sm text-gray-400">
    Post a software bounty to Nostr, paid in Bitcoin.
  </p>

  {#if published}
    <div
      class="mt-8 rounded-xl border border-surface-600 bg-surface-800 p-6 text-center"
    >
      <h2 class="text-lg font-semibold text-green-400">Bounty published</h2>
      <p class="mt-2 text-sm text-gray-300">
        “{publishedTitle}” is now live on Nostr.
      </p>
      <div class="mt-5 flex justify-center gap-3">
        <button
          type="button"
          onclick={() => (published = false)}
          class="rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600"
        >
          Post another
        </button>
        <a
          href={resolve('/')}
          class="rounded-md border border-surface-500 bg-surface-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-surface-400 hover:text-gray-100"
        >
          Back to bounties
        </a>
      </div>
    </div>
  {:else}
    <form class="mt-8 space-y-5" onsubmit={handleSubmit}>
      <label class="block">
        <span class="text-sm font-medium text-gray-300">Title</span>
        <input
          type="text"
          bind:value={title}
          maxlength="120"
          required
          placeholder="Short title for the bounty"
          class={inputClasses}
        />
      </label>

      <label class="block">
        <span class="text-sm font-medium text-gray-300">Description</span>
        <textarea
          bind:value={description}
          rows="6"
          required
          placeholder="What needs to be done, and what are the exact bounty acceptance criteria?"
          class={inputClasses}></textarea>
        <span class="mt-1 block text-xs text-gray-500">Markdown supported</span>
      </label>

      <div class="grid gap-5 sm:grid-cols-2">
        <label class="block">
          <span class="text-sm font-medium text-gray-300">Reward (sats)</span>
          <input
            type="number"
            bind:value={amountSats}
            min="1"
            step="1"
            required
            placeholder="250000"
            class={inputClasses}
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-gray-300">Deadline (maker can claim the reward after this)</span>
          <input
            type="date"
            bind:value={deadline}
            min={minDeadline}
            required
            class="{inputClasses} scheme-dark"
          />
        </label>
      </div>

      <label class="block">
        <span class="text-sm font-medium text-gray-300">Topics</span>
        <input
          type="text"
          bind:value={topics}
          placeholder="typescript, nostr"
          class={inputClasses}
        />
        <span class="mt-1 block text-xs text-gray-500">
          Comma-separated, optional
        </span>
      </label>

      <div>
        <button
          type="submit"
          disabled={!valid || !loggedIn || submitting}
          class="rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Post bounty'}
        </button>
        {#if !loggedIn}
          <p class="mt-2 text-xs text-gray-500">
            Log in with Nostr (top right) to post a bounty.
          </p>
        {/if}
        {#if publishError}
          <p class="mt-2 text-xs text-red-400">{publishError}</p>
        {/if}
      </div>
    </form>
  {/if}
</main>
